import { db } from "../../config/firebase";

type OccupancySyncInput = {
  tenantId: string;
  leaseId?: string | null;
  applicationId?: string | null;
  landlordId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
};

type OccupancySyncResult = {
  updated: boolean;
  reason:
    | "missing_context"
    | "lease_not_found"
    | "lease_not_occupying"
    | "unit_not_found"
    | "occupied";
};

const OCCUPYING_LEASE_STATUSES = new Set([
  "active",
  "current",
  "signed",
  "executed",
  "notice_pending",
  "renewal_pending",
  "renewal_accepted",
  "move_out_pending",
]);

const NON_OCCUPYING_LEASE_STATUSES = new Set([
  "draft",
  "pending",
  "sent",
  "expired",
  "ended",
  "terminated",
  "cancelled",
  "canceled",
  "revoked",
  "archived",
]);

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function normalizeUnitToken(value: unknown): string {
  return String(value || "").trim().toUpperCase().replace(/[\s_-]+/g, "");
}

function unitMatches(unit: any, unitId: string): boolean {
  const targetRaw = String(unitId || "").trim();
  const targetToken = normalizeUnitToken(targetRaw);
  if (!targetRaw && !targetToken) return false;
  const candidates = [
    unit?.id,
    unit?.unitId,
    unit?.unitNumber,
    unit?.unit,
    unit?.label,
    unit?.name,
    unit?.displayLabel,
  ];
  return candidates.some((candidate) => {
    const raw = String(candidate || "").trim();
    return raw === targetRaw || normalizeUnitToken(raw) === targetToken;
  });
}

function isOccupyingLease(lease: any): boolean {
  const status = String(lease?.status || lease?.lifecycleStatus || "").trim().toLowerCase();
  if (NON_OCCUPYING_LEASE_STATUSES.has(status)) return false;
  if (OCCUPYING_LEASE_STATUSES.has(status)) return true;
  return Boolean(lease?.activatedAt || lease?.signedAt || lease?.fullySignedAt || lease?.executedAt);
}

async function findUnitDoc(propertyId: string, landlordId: string | null, unitId: string) {
  const snap = await db.collection("units").where("propertyId", "==", propertyId).get();
  const matches = snap.docs
    .map((doc: any) => ({ id: doc.id, data: doc.data() || {} }))
    .filter(({ data }: any) => {
      if (landlordId && asString(data?.landlordId) && asString(data?.landlordId) !== landlordId) return false;
      return unitMatches({ id: data?.id || data?.unitId, ...data }, unitId);
    });
  if (matches.length !== 1) return null;
  return matches[0];
}

async function updateEmbeddedPropertyUnit(propertyId: string, unitId: string, patch: Record<string, unknown>) {
  const propertyRef = db.collection("properties").doc(propertyId);
  const propertySnap = await propertyRef.get();
  if (!propertySnap.exists) return false;
  const property = propertySnap.data() || {};
  const units = Array.isArray((property as any)?.units) ? (property as any).units : [];
  const matchingIndexes = units
    .map((unit: any, index: number) => ({ unit, index }))
    .filter(({ unit }: any) => unitMatches(unit, unitId));
  if (matchingIndexes.length !== 1) return false;
  const nextUnits = units.map((unit: any, index: number) =>
    index === matchingIndexes[0].index ? { ...unit, ...patch } : unit
  );
  await propertyRef.set({ units: nextUnits, updatedAt: Date.now() }, { merge: true });
  return true;
}

export async function syncPropertyUnitOccupancyForTenantContext(
  input: OccupancySyncInput
): Promise<OccupancySyncResult> {
  const tenantId = asString(input.tenantId);
  const leaseId = asString(input.leaseId);
  const propertyId = asString(input.propertyId);
  const unitId = asString(input.unitId);
  if (!tenantId || !leaseId || !propertyId || !unitId) {
    return { updated: false, reason: "missing_context" };
  }

  const leaseSnap = await db.collection("leases").doc(leaseId).get();
  if (!leaseSnap.exists) {
    return { updated: false, reason: "lease_not_found" };
  }
  const lease = leaseSnap.data() || {};
  if (!isOccupyingLease(lease)) {
    return { updated: false, reason: "lease_not_occupying" };
  }

  const leasePropertyId = asString((lease as any)?.propertyId);
  const leaseUnitId = asString((lease as any)?.unitId || (lease as any)?.unitNumber || (lease as any)?.unit);
  if (leasePropertyId && leasePropertyId !== propertyId) {
    return { updated: false, reason: "missing_context" };
  }
  const unitReference = leaseUnitId || unitId;

  const now = Date.now();
  const occupancyPatch = {
    status: "occupied",
    occupancyStatus: "occupied",
    tenantId,
    currentTenantId: tenantId,
    leaseId,
    currentLeaseId: leaseId,
    applicationId: asString(input.applicationId),
    occupancySource: "canonical_lease",
    occupancyUpdatedAt: now,
    updatedAt: now,
  };
  const unitDoc = await findUnitDoc(propertyId, asString(input.landlordId), unitReference);
  const updatedEmbedded = await updateEmbeddedPropertyUnit(propertyId, unitReference, occupancyPatch);
  if (!unitDoc && !updatedEmbedded) {
    return { updated: false, reason: "unit_not_found" };
  }
  if (unitDoc) {
    await db.collection("units").doc(unitDoc.id).set(occupancyPatch, { merge: true });
  }
  return { updated: true, reason: "occupied" };
}
