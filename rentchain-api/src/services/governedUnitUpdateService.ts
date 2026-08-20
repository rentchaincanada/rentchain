import { deriveCanonicalLeaseTermState } from "../lib/leases/canonicalLeaseOccupancyState";

export class GovernedUnitUpdateError extends Error {
  constructor(public code: "end_lease_workflow_required" | "occupancy_reconciliation_required") {
    super(code);
  }
}

type GovernedUnitUpdateInput = {
  firestore: any;
  landlordId: string;
  unitId: string;
  updates: Record<string, any>;
};

const OCCUPANCY_FIELDS = new Set([
  "status",
  "occupancyStatus",
  "occupantName",
  "tenantName",
  "leaseEndDate",
  "tenantId",
  "currentTenantId",
  "leaseId",
  "currentLeaseId",
]);

function text(value: unknown): string {
  return String(value || "").trim();
}

function occupied(value: unknown): boolean {
  return text(value).toLowerCase() === "occupied";
}

function matchesEmbeddedUnit(unit: any, unitId: string, unitNumber: string): boolean {
  const candidates = [unit?.id, unit?.unitId, unit?.uid].map(text);
  if (candidates.includes(unitId)) return true;
  return Boolean(unitNumber) && [unit?.unitNumber, unit?.label, unit?.unit].map(text).includes(unitNumber);
}

function leaseMatchesUnit(lease: any, unitId: string, unitNumber: string): boolean {
  if (text(lease?.unitId) === unitId) return true;
  return Boolean(unitNumber) && [lease?.unitNumber, lease?.unit, lease?.unitLabel].map(text).includes(unitNumber);
}

function tenancyMatchesUnit(tenancy: any, unitId: string, unitNumber: string): boolean {
  if (text(tenancy?.unitId) === unitId) return true;
  return Boolean(unitNumber) && [tenancy?.unitNumber, tenancy?.unitLabel].map(text).includes(unitNumber);
}

function safeMetadata(updates: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.entries(updates).filter(([field]) => !OCCUPANCY_FIELDS.has(field)));
}

function embeddedPatch(updates: Record<string, any>): Record<string, any> {
  const allowed = new Set([
    "unitNumber", "rent", "marketRent", "beds", "bedrooms", "baths", "bathrooms", "notes",
    "status", "occupancyStatus", "occupantName", "tenantName", "leaseEndDate",
  ]);
  return Object.fromEntries(Object.entries(updates).filter(([field]) => allowed.has(field)));
}

export async function applyGovernedUnitUpdate(input: GovernedUnitUpdateInput): Promise<Record<string, any>> {
  return input.firestore.runTransaction(async (transaction: any) => {
    const unitRef = input.firestore.collection("units").doc(input.unitId);
    const unitSnap = await transaction.get(unitRef);
    if (!unitSnap.exists) throw Object.assign(new Error("UNIT_NOT_FOUND"), { status: 404 });
    const existing = unitSnap.data() || {};
    if (text(existing.landlordId) !== input.landlordId) throw Object.assign(new Error("FORBIDDEN"), { status: 403 });

    const propertyId = text(existing.propertyId);
    const propertyRef = propertyId ? input.firestore.collection("properties").doc(propertyId) : null;
    const leasesQuery = propertyId
      ? input.firestore.collection("leases").where("landlordId", "==", input.landlordId).where("propertyId", "==", propertyId)
      : null;
    const tenantId = text(existing.currentTenantId || existing.tenantId);
    const tenantRef = tenantId ? input.firestore.collection("tenants").doc(tenantId) : null;
    const tenanciesQuery = tenantId ? input.firestore.collection("tenancies").where("tenantId", "==", tenantId) : null;
    const [propertySnap, leasesSnap, tenantSnap, tenanciesSnap] = await Promise.all([
      propertyRef ? transaction.get(propertyRef) : Promise.resolve(null),
      leasesQuery ? transaction.get(leasesQuery) : Promise.resolve({ docs: [] }),
      tenantRef ? transaction.get(tenantRef) : Promise.resolve(null),
      tenanciesQuery ? transaction.get(tenanciesQuery) : Promise.resolve({ docs: [] }),
    ]);
    if (propertyRef && !propertySnap?.exists) throw Object.assign(new Error("PROPERTY_NOT_FOUND"), { status: 404 });
    const property = propertySnap?.data?.() || {};
    const propertyLandlordId = text(property.landlordId || property.ownerId || property.owner);
    if (propertyRef && propertyLandlordId !== input.landlordId) throw Object.assign(new Error("FORBIDDEN"), { status: 403 });

    const unitNumber = text(existing.unitNumber || existing.label || existing.unit);
    const embeddedUnits = Array.isArray(property.units) ? property.units : [];
    const embeddedMatches = embeddedUnits
      .map((unit: any, index: number) => ({ unit, index }))
      .filter(({ unit }: any) => matchesEmbeddedUnit(unit, input.unitId, unitNumber));
    if (embeddedUnits.length > 0 && embeddedMatches.length !== 1) {
      throw new GovernedUnitUpdateError("occupancy_reconciliation_required");
    }
    const embedded = embeddedMatches[0]?.unit || null;
    const leases = (leasesSnap?.docs || [])
      .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((lease: any) => leaseMatchesUnit(lease, input.unitId, unitNumber));
    const currentLeases = leases.filter((lease: any) =>
      lease.occupancyEffective === true && deriveCanonicalLeaseTermState({ id: lease.id, ...lease }).supportsCurrentOccupancy
    );
    const activeTenancies = (tenanciesSnap?.docs || [])
      .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter((tenancy: any) => text(tenancy.status).toLowerCase() === "active")
      .filter((tenancy: any) => !propertyId || !text(tenancy.propertyId) || text(tenancy.propertyId) === propertyId)
      .filter((tenancy: any) => tenancyMatchesUnit(tenancy, input.unitId, unitNumber));
    const tenant = tenantSnap?.exists ? tenantSnap.data() || {} : null;
    const requestsVacancy = input.updates.status === "vacant" || input.updates.occupancyStatus === "vacant";
    const hasOccupiedEvidence = occupied(existing.status) || occupied(existing.occupancyStatus) || occupied(embedded?.status) ||
      occupied(embedded?.occupancyStatus) || Boolean(text(existing.currentLeaseId || existing.leaseId)) ||
      Boolean(text(embedded?.currentLeaseId || embedded?.leaseId)) || Boolean(text(tenant?.currentLeaseId)) || activeTenancies.length > 0;

    if (requestsVacancy && currentLeases.length === 1) {
      throw new GovernedUnitUpdateError("end_lease_workflow_required");
    }
    if (requestsVacancy && (currentLeases.length > 1 || hasOccupiedEvidence)) {
      throw new GovernedUnitUpdateError("occupancy_reconciliation_required");
    }

    const canonicalCurrent = currentLeases.length === 1;
    const governedUpdates = canonicalCurrent ? { ...safeMetadata(input.updates) } : { ...input.updates };
    const now = new Date();
    governedUpdates.updatedAt = now;
    const nextUnit = { ...existing, ...governedUpdates };
    transaction.set(unitRef, governedUpdates, { merge: true });

    if (propertyRef && embeddedMatches.length === 1) {
      const projectionPatch = embeddedPatch(governedUpdates);
      const nextEmbeddedUnits = embeddedUnits.map((unit: any, index: number) =>
        index === embeddedMatches[0].index ? { ...unit, ...projectionPatch, updatedAt: now } : unit
      );
      transaction.set(propertyRef, { units: nextEmbeddedUnits, updatedAt: now }, { merge: true });
    }
    return { id: input.unitId, ...nextUnit };
  });
}
