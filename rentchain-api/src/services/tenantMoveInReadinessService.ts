import { db } from "../firebase";
import { buildMoveInRequirements, type MoveInRequirementsParams } from "./moveInRequirements";

export type MoveInReadinessItemKey =
  | "lease_signed"
  | "tenant_portal_invite_sent"
  | "tenant_portal_activated"
  | "deposit_received"
  | "first_rent_received"
  | "insurance_received"
  | "utility_setup_received"
  | "inspection_scheduled"
  | "inspection_completed"
  | "keys_release_approved"
  | "keys_released";

export type MoveInReadinessItemStatus =
  | "not_started"
  | "pending"
  | "submitted"
  | "confirmed"
  | "blocked"
  | "not_required";

export type MoveInReadinessOverallStatus =
  | "not_started"
  | "in_progress"
  | "blocked"
  | "ready_for_keys"
  | "complete";

export interface MoveInReadinessItemRecord {
  key: MoveInReadinessItemKey;
  label: string;
  stage: "lease" | "onboarding" | "funding" | "inspection" | "keys";
  required: boolean;
  status: MoveInReadinessItemStatus;
  note: string | null;
  blockerReason: string | null;
  source: "system" | "manual";
  updatedAt: string | null;
  updatedByUserId: string | null;
}

export interface MoveInReadinessEventRecord {
  id: string;
  type: "item_updated" | "record_created";
  itemKey: MoveInReadinessItemKey | null;
  label: string;
  note: string | null;
  status: MoveInReadinessItemStatus | null;
  actorUserId: string | null;
  actorRole: "landlord" | "admin" | "system";
  createdAt: string;
}

export interface MoveInReadinessRecord {
  tenantId: string;
  landlordId: string | null;
  overallStatus: MoveInReadinessOverallStatus;
  completionPercent: number;
  blockerCount: number;
  nextRequiredStep: string | null;
  lastUpdatedAt: string | null;
  items: MoveInReadinessItemRecord[];
  events: MoveInReadinessEventRecord[];
}

export interface PersistedMoveInReadinessRecord {
  tenantId: string;
  landlordId: string | null;
  items?: Record<
    string,
    {
      status?: MoveInReadinessItemStatus;
      note?: string | null;
      blockerReason?: string | null;
      updatedAt?: number | string | null;
      updatedByUserId?: string | null;
    }
  >;
  updatedAt?: number | string | null;
}

const ITEM_DEFS: Array<{
  key: MoveInReadinessItemKey;
  label: string;
  stage: MoveInReadinessItemRecord["stage"];
}> = [
  { key: "lease_signed", label: "Lease signed", stage: "lease" },
  { key: "tenant_portal_invite_sent", label: "Tenant portal invite sent", stage: "onboarding" },
  { key: "tenant_portal_activated", label: "Tenant portal activated", stage: "onboarding" },
  { key: "deposit_received", label: "Deposit received", stage: "funding" },
  { key: "first_rent_received", label: "First rent received", stage: "funding" },
  { key: "insurance_received", label: "Insurance received", stage: "onboarding" },
  { key: "utility_setup_received", label: "Utility setup confirmed", stage: "onboarding" },
  { key: "inspection_scheduled", label: "Inspection scheduled", stage: "inspection" },
  { key: "inspection_completed", label: "Inspection completed", stage: "inspection" },
  { key: "keys_release_approved", label: "Keys release approved", stage: "keys" },
  { key: "keys_released", label: "Keys released", stage: "keys" },
];

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof (value as any)?.toMillis === "function") return (value as any).toMillis();
  if (typeof (value as any)?.seconds === "number") return (value as any).seconds * 1000;
  return null;
}

function toIso(value: unknown): string | null {
  const ts = toMillis(value);
  return ts == null ? null : new Date(ts).toISOString();
}

function asString(value: unknown, max = 500): string | null {
  const next = String(value || "").trim().slice(0, max);
  return next || null;
}

function isTruthy(value: unknown): boolean {
  if (value === true) return true;
  const normalized = String(value || "").trim().toLowerCase();
  return ["true", "yes", "confirmed", "complete", "completed", "received", "approved"].includes(normalized);
}

function findRequirement(requirements: ReturnType<typeof buildMoveInRequirements>, key: string) {
  return requirements.items.find((item) => item.key === key) || null;
}

function hasFirstRentEvidence(
  payments: Array<{ notes?: unknown; method?: unknown; amount?: unknown }>,
  ledger: Array<{ notes?: unknown; type?: unknown; amount?: unknown }>
) {
  const mentionsRent = (value: unknown) => {
    const text = String(value || "").trim().toLowerCase();
    return text.includes("rent") && !text.includes("deposit");
  };

  return (
    payments.some((payment) => mentionsRent(payment.notes) || mentionsRent(payment.method) || Number(payment.amount || 0) > 0) ||
    ledger.some((entry) => mentionsRent(entry.notes) || mentionsRent(entry.type) || Number(entry.amount || 0) > 0)
  );
}

function baseStatusFromRequirement(
  requirementState: string | null | undefined,
  required: boolean
): MoveInReadinessItemStatus {
  if (requirementState === "complete") return "confirmed";
  if (requirementState === "pending") return "pending";
  if (requirementState === "not-required" || !required) return "not_required";
  return "not_started";
}

function dedupeEvents(events: MoveInReadinessEventRecord[]) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = [
      event.type,
      event.itemKey,
      event.status,
      event.actorUserId,
      event.createdAt,
      event.note,
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getPersistedMoveInReadinessRecord(tenantId: string) {
  const snap = await db.collection("tenantMoveInReadiness").doc(tenantId).get();
  return snap.exists ? ((snap.data() as PersistedMoveInReadinessRecord) || null) : null;
}

export async function listMoveInReadinessEvents(tenantId: string): Promise<MoveInReadinessEventRecord[]> {
  const snap = await db
    .collection("tenantMoveInReadiness").doc(tenantId)
    .collection("events")
    .orderBy("createdAt", "desc")
    .limit(25)
    .get()
    .catch(() => null as any);

  if (!snap?.docs) return [];

  return snap.docs.map((doc: any) => {
    const data = (doc.data() as any) || {};
    return {
      id: doc.id,
      type: data.type === "record_created" ? "record_created" : "item_updated",
      itemKey: asString(data.itemKey, 120) as MoveInReadinessItemKey | null,
      label: asString(data.label, 240) || "Move-in readiness updated",
      note: asString(data.note, 1000),
      status: asString(data.status, 40) as MoveInReadinessItemStatus | null,
      actorUserId: asString(data.actorUserId, 160),
      actorRole: data.actorRole === "admin" ? "admin" : data.actorRole === "landlord" ? "landlord" : "system",
      createdAt: toIso(data.createdAt) || new Date().toISOString(),
    };
  });
}

export function buildMoveInReadinessRecord(
  params: MoveInRequirementsParams & {
    tenantId: string;
    landlordId?: string | null;
    persisted?: PersistedMoveInReadinessRecord | null;
    events?: MoveInReadinessEventRecord[];
  }
): MoveInReadinessRecord {
  const requirements = buildMoveInRequirements(params);
  const persisted = params.persisted || null;
  const persistedItems = persisted?.items || {};
  const payments = Array.isArray(params.payments) ? params.payments : [];
  const ledger = Array.isArray(params.ledger) ? params.ledger : [];
  const leaseRaw = (params.leaseRaw || {}) as Record<string, unknown>;
  const tenancy = (params.tenancy || {}) as Record<string, unknown>;

  const depositRequirement = findRequirement(requirements, "deposit_received");
  const insuranceRequirement = findRequirement(requirements, "insurance_received");
  const utilityRequirement = findRequirement(requirements, "utility_setup_received");
  const leaseRequirement = findRequirement(requirements, "lease_signed");
  const inviteRequirement = findRequirement(requirements, "portal_invited");
  const activatedRequirement = findRequirement(requirements, "portal_activated");
  const inspectionScheduledRequirement = findRequirement(requirements, "inspection_scheduled");
  const inspectionCompletedRequirement = findRequirement(requirements, "inspection_completed");
  const keysReadyRequirement = findRequirement(requirements, "keys_release_ready");

  const firstRentRequired =
    Boolean(params.lease || params.leaseRaw || params.tenancy) &&
    !isTruthy((leaseRaw as any)?.firstRentWaived);
  const firstRentConfirmed =
    isTruthy((leaseRaw as any)?.firstRentReceived) ||
    Boolean(toIso((leaseRaw as any)?.firstRentReceivedAt)) ||
    hasFirstRentEvidence(payments as any, ledger as any);

  const keysReleasedConfirmed =
    isTruthy((leaseRaw as any)?.keysReleased) ||
    Boolean(toIso((leaseRaw as any)?.keysReleasedAt)) ||
    Boolean((tenancy as any)?.moveInAt);

  const keysApprovalRequired = Boolean(keysReadyRequirement?.required);
  const keysApprovalConfirmed = keysReadyRequirement?.state === "complete";

  const systemItems: Record<MoveInReadinessItemKey, Omit<MoveInReadinessItemRecord, "source" | "updatedByUserId">> = {
    lease_signed: {
      key: "lease_signed",
      label: "Lease signed",
      stage: "lease",
      required: Boolean(leaseRequirement?.required),
      status: baseStatusFromRequirement(leaseRequirement?.state, Boolean(leaseRequirement?.required)),
      note: leaseRequirement?.note || null,
      blockerReason: null,
      updatedAt: leaseRequirement?.updatedAt || null,
    },
    tenant_portal_invite_sent: {
      key: "tenant_portal_invite_sent",
      label: "Tenant portal invite sent",
      stage: "onboarding",
      required: Boolean(inviteRequirement?.required),
      status: baseStatusFromRequirement(inviteRequirement?.state, Boolean(inviteRequirement?.required)),
      note: inviteRequirement?.note || null,
      blockerReason: null,
      updatedAt: inviteRequirement?.updatedAt || null,
    },
    tenant_portal_activated: {
      key: "tenant_portal_activated",
      label: "Tenant portal activated",
      stage: "onboarding",
      required: Boolean(activatedRequirement?.required),
      status: baseStatusFromRequirement(activatedRequirement?.state, Boolean(activatedRequirement?.required)),
      note: activatedRequirement?.note || null,
      blockerReason: null,
      updatedAt: activatedRequirement?.updatedAt || null,
    },
    deposit_received: {
      key: "deposit_received",
      label: "Deposit received",
      stage: "funding",
      required: Boolean(depositRequirement?.required),
      status: baseStatusFromRequirement(depositRequirement?.state, Boolean(depositRequirement?.required)),
      note: depositRequirement?.note || null,
      blockerReason: null,
      updatedAt: depositRequirement?.updatedAt || null,
    },
    first_rent_received: {
      key: "first_rent_received",
      label: "First rent received",
      stage: "funding",
      required: firstRentRequired,
      status: firstRentRequired ? (firstRentConfirmed ? "confirmed" : "pending") : "not_required",
      note: firstRentRequired && !firstRentConfirmed ? "Record the tenant's first rent payment." : null,
      blockerReason: null,
      updatedAt: toIso((leaseRaw as any)?.firstRentReceivedAt) || null,
    },
    insurance_received: {
      key: "insurance_received",
      label: "Insurance received",
      stage: "onboarding",
      required: Boolean(insuranceRequirement?.required),
      status: baseStatusFromRequirement(insuranceRequirement?.state, Boolean(insuranceRequirement?.required)),
      note: insuranceRequirement?.note || null,
      blockerReason: null,
      updatedAt: insuranceRequirement?.updatedAt || null,
    },
    utility_setup_received: {
      key: "utility_setup_received",
      label: "Utility setup confirmed",
      stage: "onboarding",
      required: Boolean(utilityRequirement?.required),
      status: baseStatusFromRequirement(utilityRequirement?.state, Boolean(utilityRequirement?.required)),
      note: utilityRequirement?.note || null,
      blockerReason: null,
      updatedAt: utilityRequirement?.updatedAt || null,
    },
    inspection_scheduled: {
      key: "inspection_scheduled",
      label: "Inspection scheduled",
      stage: "inspection",
      required: Boolean(inspectionScheduledRequirement?.required),
      status: baseStatusFromRequirement(
        inspectionScheduledRequirement?.state,
        Boolean(inspectionScheduledRequirement?.required)
      ),
      note: inspectionScheduledRequirement?.note || null,
      blockerReason: null,
      updatedAt: inspectionScheduledRequirement?.updatedAt || null,
    },
    inspection_completed: {
      key: "inspection_completed",
      label: "Inspection completed",
      stage: "inspection",
      required: Boolean(inspectionCompletedRequirement?.required),
      status: baseStatusFromRequirement(
        inspectionCompletedRequirement?.state,
        Boolean(inspectionCompletedRequirement?.required)
      ),
      note: inspectionCompletedRequirement?.note || null,
      blockerReason: null,
      updatedAt: inspectionCompletedRequirement?.updatedAt || null,
    },
    keys_release_approved: {
      key: "keys_release_approved",
      label: "Keys release approved",
      stage: "keys",
      required: keysApprovalRequired,
      status: keysApprovalRequired ? (keysApprovalConfirmed ? "confirmed" : "pending") : "not_required",
      note: keysApprovalRequired && !keysApprovalConfirmed ? "Approve key release after requirements are met." : null,
      blockerReason: null,
      updatedAt: keysReadyRequirement?.updatedAt || null,
    },
    keys_released: {
      key: "keys_released",
      label: "Keys released",
      stage: "keys",
      required: true,
      status: keysReleasedConfirmed ? "confirmed" : "pending",
      note: keysReleasedConfirmed ? null : "Release keys once move-in prerequisites are complete.",
      blockerReason: null,
      updatedAt: toIso((leaseRaw as any)?.keysReleasedAt || (tenancy as any)?.moveInAt) || null,
    },
  };

  const items = ITEM_DEFS.map((def) => {
    const system = systemItems[def.key];
    const override = (persistedItems[def.key] || {}) as any;
    const overriddenStatus = asString(override.status, 40) as MoveInReadinessItemStatus | null;
    const finalStatus =
      overriddenStatus &&
      ["not_started", "pending", "submitted", "confirmed", "blocked", "not_required"].includes(overriddenStatus)
        ? overriddenStatus
        : system.status;
    return {
      ...system,
      status: finalStatus,
      note: asString(override.note, 1000) ?? system.note,
      blockerReason: asString(override.blockerReason, 1000) ?? null,
      source: overriddenStatus ? "manual" : "system",
      updatedAt: toIso(override.updatedAt) || system.updatedAt,
      updatedByUserId: asString(override.updatedByUserId, 160),
    } satisfies MoveInReadinessItemRecord;
  });

  const requiredItems = items.filter((item) => item.required && item.status !== "not_required");
  const confirmedRequired = requiredItems.filter((item) => item.status === "confirmed").length;
  const blockerCount = items.filter((item) => item.status === "blocked").length;
  const completionPercent = requiredItems.length
    ? Math.round((confirmedRequired / requiredItems.length) * 100)
    : items.some((item) => item.status === "confirmed")
    ? 100
    : 0;

  const prereqKeys: MoveInReadinessItemKey[] = [
    "lease_signed",
    "tenant_portal_invite_sent",
    "tenant_portal_activated",
    "deposit_received",
    "first_rent_received",
    "insurance_received",
    "utility_setup_received",
    "inspection_scheduled",
    "inspection_completed",
    "keys_release_approved",
  ];
  const preKeysSatisfied = prereqKeys.every((key) => {
    const item = items.find((entry) => entry.key === key);
    return !item || item.status === "confirmed" || item.status === "not_required";
  });
  const keysReleased = items.find((item) => item.key === "keys_released")?.status === "confirmed";

  let overallStatus: MoveInReadinessOverallStatus = "not_started";
  if (keysReleased) {
    overallStatus = "complete";
  } else if (blockerCount > 0) {
    overallStatus = "blocked";
  } else if (preKeysSatisfied) {
    overallStatus = "ready_for_keys";
  } else if (confirmedRequired > 0 || items.some((item) => item.status === "pending" || item.status === "submitted")) {
    overallStatus = "in_progress";
  }

  const nextRequiredStep =
    items.find((item) => item.required && ["not_started", "pending", "submitted", "blocked"].includes(item.status))
      ?.label || null;

  const eventList = dedupeEvents(
    [...(params.events || [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  );
  const lastUpdatedAt =
    items
      .map((item) => item.updatedAt)
      .filter(Boolean)
      .sort((a, b) => Date.parse(String(b)) - Date.parse(String(a)))[0] ||
    toIso(persisted?.updatedAt) ||
    null;

  return {
    tenantId: params.tenantId,
    landlordId: params.landlordId || null,
    overallStatus,
    completionPercent,
    blockerCount,
    nextRequiredStep,
    lastUpdatedAt,
    items,
    events: eventList,
  };
}

export async function updateMoveInReadinessItems(input: {
  tenantId: string;
  landlordId: string | null;
  actorUserId: string | null;
  actorRole: "landlord" | "admin";
  updates: Array<{
    key: MoveInReadinessItemKey;
    status: MoveInReadinessItemStatus;
    note?: string | null;
    blockerReason?: string | null;
  }>;
}) {
  const now = Date.now();
  const docRef = db.collection("tenantMoveInReadiness").doc(input.tenantId);
  const current = await getPersistedMoveInReadinessRecord(input.tenantId);
  const nextItems = { ...(current?.items || {}) };

  for (const update of input.updates) {
    nextItems[update.key] = {
      status: update.status,
      note: asString(update.note, 1000),
      blockerReason: asString(update.blockerReason, 1000),
      updatedAt: now,
      updatedByUserId: input.actorUserId || null,
    };
  }

  await docRef.set(
    {
      tenantId: input.tenantId,
      landlordId: input.landlordId || null,
      items: nextItems,
      updatedAt: now,
    },
    { merge: true }
  );

  const eventsRef = docRef.collection("events");
  await Promise.all(
    input.updates.map((update) =>
      eventsRef.add({
        type: "item_updated",
        itemKey: update.key,
        label: ITEM_DEFS.find((item) => item.key === update.key)?.label || update.key,
        note: asString(update.note, 1000),
        status: update.status,
        actorUserId: input.actorUserId || null,
        actorRole: input.actorRole,
        createdAt: now,
      })
    )
  );

  return getPersistedMoveInReadinessRecord(input.tenantId);
}
