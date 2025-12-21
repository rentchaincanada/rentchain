import { db } from "../config/firebase";
import { emitPropertyActivityEvent } from "./activityEventService";
import { getPropertyById } from "./firestorePropertiesService";

type ActionRequestStatus = "new" | "acknowledged" | "resolved";

type ActionRequestDoc = {
  landlordId: string;
  propertyId: string;
  ruleKey: string;
  title: string;
  description?: string;
  status: ActionRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | null;
  meta?: Record<string, any>;
  source?: string;
  issueType?: string;
  severity?: string;
  location?: string;
};

function actionRequestId(propertyId: string, ruleKey: string) {
  return `${propertyId}__${ruleKey}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

function isOpenStatus(s: any) {
  return s === "new";
}

export async function ensureActionRequestsForProperty(args: {
  propertyId: string;
}) {
  const { propertyId } = args;

  const property = await getPropertyById(propertyId);
  const landlordId = property?.landlordId;

  if (!landlordId) {
    throw new Error(
      `Property ${propertyId} missing landlordId (cannot generate action requests)`
    );
  }

  const leasesSnap = await db
    .collection("leases")
    .where("propertyId", "==", propertyId)
    .limit(50)
    .get();
  const hasAnyLease = leasesSnap.size > 0;

  const unitsSnap = await db
    .collection("units")
    .where("propertyId", "==", propertyId)
    .limit(200)
    .get();

  const units = unitsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const missingUnitBasics = units.filter((u) => {
    const bedsOk = typeof u.beds === "number";
    const bathsOk = typeof u.baths === "number";
    const sqftOk = typeof u.sqft === "number" && u.sqft > 0;
    return !(bedsOk && bathsOk && sqftOk);
  });

  const addressOk =
    Boolean((property as any)?.address1 || (property as any)?.address || (property as any)?.street) &&
    Boolean((property as any)?.city) &&
    Boolean((property as any)?.province || (property as any)?.state);

  const now = new Date();
  const makeRuleRequest = (args: {
    ruleKey: string;
    title: string;
    description: string;
    severity: "low" | "medium" | "high";
    location: "building" | "unit";
    issueType: string;
    meta?: Record<string, any>;
  }) => ({
    landlordId,
    propertyId,
    ruleKey: args.ruleKey,
    status: "new" as const,
    source: "system" as const,
    issueType: args.issueType,
    severity: args.severity,
    location: args.location,
    description: args.description,
    title: args.title,
    createdAt: now,
    updatedAt: now,
    meta: args.meta ?? {},
  });

  const desired: ActionRequestDoc[] = [];

  if (!hasAnyLease) {
    desired.push(
      makeRuleRequest({
        ruleKey: "no_active_lease",
        issueType: "lease_missing",
        severity: "high",
        location: "building",
        title: "No active leases recorded for this property yet",
        description: "Add a lease to unlock rent schedules, ledger events, and reporting.",
        meta: { leaseCount: leasesSnap.size },
      })
    );
  }

  if (unitsSnap.size === 0) {
    desired.push(
      makeRuleRequest({
        ruleKey: "no_units",
        issueType: "units_missing",
        severity: "high",
        location: "building",
        title: "Add units to this property",
        description: "Units are needed for vacancies, listing readiness, and lease assignment.",
        meta: { unitCount: 0 },
      })
    );
  } else if (missingUnitBasics.length > 0) {
    desired.push(
      makeRuleRequest({
        ruleKey: "units_missing_basics",
        issueType: "unit_data_incomplete",
        severity: "medium",
        location: "building",
        title: "Complete unit data (beds, baths, sqft)",
        description:
          "Some units are missing beds/baths/sqft. This blocks listing automation and analytics.",
        meta: { missingCount: missingUnitBasics.length },
      })
    );
  }

  if (!addressOk) {
    desired.push(
      makeRuleRequest({
        ruleKey: "property_address_incomplete",
        issueType: "property_data_incomplete",
        severity: "medium",
        location: "building",
        title: "Complete property address details",
        description:
          "Address fields are incomplete. This blocks mapping, listing exports, and portfolio clarity.",
        meta: { hasPropertyDoc: Boolean(property) },
      })
    );
  }

  const col = db.collection("actionRequests");
  const desiredKeys = new Set(desired.map((d) => d.ruleKey));

  const existingSnap = await col
    .where("propertyId", "==", propertyId)
    .limit(200)
    .get();
  const existing = existingSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

  const existingByRule = new Map<string, any>();
  for (const e of existing) {
    if (e.ruleKey) existingByRule.set(String(e.ruleKey), e);
  }

  const desiredByRule = new Map<string, any>();
  for (const d of desired) {
    desiredByRule.set(String(d.ruleKey), d);
  }

  const newlyOpenedRuleKeys: string[] = [];
  const autoResolvedRuleKeys: string[] = [];

  for (const d of desired) {
    const prev = existingByRule.get(String(d.ruleKey));
    const prevStatus = prev?.status;
    if (!prev || !isOpenStatus(prevStatus)) {
      newlyOpenedRuleKeys.push(String(d.ruleKey));
    }
  }

  for (const e of existing) {
    const ruleKey = String(e.ruleKey ?? "");
    if (!ruleKey) continue;

    if (!desiredKeys.has(ruleKey) && isOpenStatus(e.status)) {
      autoResolvedRuleKeys.push(ruleKey);
    }
  }

  const batch = db.batch();

  for (const d of desired) {
    const id = actionRequestId(propertyId, d.ruleKey);
    const ref = col.doc(id);
    const existingDoc = existing.find((e) => e.id === id);
    const createdAt =
      existingDoc?.createdAt?.toDate?.() ??
      existingDoc?.createdAt ??
      d.createdAt;

    const prevStatus = existingDoc?.status;
    const nextStatus =
      prevStatus === "acknowledged"
        ? "acknowledged"
        : prevStatus === "resolved"
        ? "resolved"
        : "new";

    batch.set(
      ref,
      {
        ...d,
        createdAt,
        updatedAt: now,
        status: nextStatus,
      },
      { merge: true }
    );
  }

  for (const e of existing) {
    const ruleKey = e.ruleKey as string | undefined;
    if (!ruleKey) continue;

    if (!desiredKeys.has(ruleKey) && e.status === "new") {
      const ref = col.doc(e.id);
      batch.set(
        ref,
        {
          status: "resolved",
          resolvedAt: now,
          updatedAt: now,
          meta: { ...(e.meta || {}), autoResolved: true },
        },
        { merge: true }
      );
    }
  }

  await batch.commit();
  await Promise.all([
    ...newlyOpenedRuleKeys.map(async (ruleKey) => {
      const d = desiredByRule.get(ruleKey);
      if (!d) return;

      await emitPropertyActivityEvent({
        propertyId,
        type: "action_request.created",
        ruleKey,
        title: `Action request created: ${d.title}`,
        body: d.description,
        meta: { type: d.type, priority: d.priority },
      });
    }),
    ...autoResolvedRuleKeys.map(async (ruleKey) => {
      const prev = existingByRule.get(ruleKey);
      const prevTitle = prev?.title ?? ruleKey;
      await emitPropertyActivityEvent({
        propertyId,
        type: "action_request.resolved",
        ruleKey,
        title: `Action request resolved: ${prevTitle}`,
        body: "Resolved automatically because the underlying condition is no longer true.",
        meta: { autoResolved: true },
      });
    }),
  ]);

  return {
    propertyId,
    desired: desired.map((d) => d.ruleKey),
    existingCount: existingSnap.size,
  };
}
