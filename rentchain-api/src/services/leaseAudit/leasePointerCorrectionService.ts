import { db, FieldValue } from "../../firebase";
import {
  CURRENT_LEASE_STATUSES,
  loadUnitsForProperty,
  resolveUnitReference,
  toCanonicalLeaseRecord,
  type CanonicalLeaseRecord,
  type CanonicalUnitRecord,
} from "../leaseCanonicalizationService";
import { getLeasePartyIds } from "../leasePartyConsolidationService";
import type {
  TenantLeasePointerCandidate,
  TenantLeasePointerConflict,
  TenantLeasePointerCorrectionApplyResult,
  TenantLeasePointerCorrectionPreview,
} from "./leasePointerCorrectionTypes";

type FirestoreLike = Pick<FirebaseFirestore.Firestore, "collection">;

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function isCurrentStatus(status: unknown): boolean {
  return CURRENT_LEASE_STATUSES.has(asTrimmedString(status).toLowerCase());
}

function toCandidate(lease: CanonicalLeaseRecord, raw: Record<string, unknown>): TenantLeasePointerCandidate {
  return {
    leaseId: lease.id,
    unitId: lease.resolvedUnitId || lease.unitId || null,
    unitNumber: lease.resolvedUnitNumber || lease.unitLabel || null,
    unitLabel: lease.resolvedUnitLabel || lease.unitLabel || null,
    status: asTrimmedString(lease.status) || null,
    startDate: lease.leaseStartDate || null,
    endDate: lease.leaseEndDate || null,
    tenantIds: getLeasePartyIds(raw, lease),
  };
}

async function loadPropertyLeaseContext(
  firestore: FirestoreLike,
  landlordId: string,
  propertyId: string
): Promise<{
  units: CanonicalUnitRecord[];
  currentLeases: Array<{ id: string; raw: Record<string, unknown>; lease: CanonicalLeaseRecord }>;
}> {
  const units = await loadUnitsForProperty(firestore as any, propertyId, landlordId);
  let query: FirebaseFirestore.Query = firestore.collection("leases").where("propertyId", "==", propertyId);
  query = query.where("landlordId", "==", landlordId);
  const snap = await query.get();
  const currentLeases = (snap.docs || [])
    .map((doc: any) => {
      const raw = (doc.data() || {}) as Record<string, unknown>;
      return {
        id: doc.id,
        raw,
        lease: toCanonicalLeaseRecord(doc.id, raw, units),
      };
    })
    .filter((entry) => isCurrentStatus(entry.lease.status));
  return { units, currentLeases };
}

function resolveTenantUnit(units: CanonicalUnitRecord[], tenant: Record<string, unknown>) {
  return resolveUnitReference(
    units,
    tenant.unitId || tenant.unitNumber || tenant.unitLabel || tenant.unit || null
  ).unit;
}

function selectSuggestedLeaseId(
  tenantId: string,
  candidateLeases: Array<{ id: string; raw: Record<string, unknown>; lease: CanonicalLeaseRecord }>
) {
  const matchingTenant = candidateLeases.filter((entry) => getLeasePartyIds(entry.raw, entry.lease).includes(tenantId));
  if (matchingTenant.length === 1) return matchingTenant[0].id;
  if (candidateLeases.length === 1) return candidateLeases[0].id;
  return null;
}

async function buildTenantPointerConflict(
  firestore: FirestoreLike,
  tenantDoc: { id: string; raw: Record<string, unknown> },
  cachedPropertyContexts: Map<string, Awaited<ReturnType<typeof loadPropertyLeaseContext>>>
): Promise<TenantLeasePointerConflict | null> {
  const landlordId = asTrimmedString(tenantDoc.raw.landlordId);
  const propertyId = asTrimmedString(tenantDoc.raw.propertyId);
  const currentLeaseId = asTrimmedString(tenantDoc.raw.currentLeaseId);
  if (!landlordId || !propertyId || !currentLeaseId) return null;

  const contextKey = `${landlordId}::${propertyId}`;
  const context =
    cachedPropertyContexts.get(contextKey) ||
    (await loadPropertyLeaseContext(firestore, landlordId, propertyId));
  cachedPropertyContexts.set(contextKey, context);

  const targetUnit = resolveTenantUnit(context.units, tenantDoc.raw);
  if (!targetUnit?.id) return null;

  const currentLeaseSnap = await firestore.collection("leases").doc(currentLeaseId).get();
  if (!currentLeaseSnap.exists) return null;
  const currentLeaseRaw = (currentLeaseSnap.data() || {}) as Record<string, unknown>;
  const currentLease = toCanonicalLeaseRecord(currentLeaseSnap.id, currentLeaseRaw, context.units);

  const currentLeaseUnitId = currentLease.resolvedUnitId || currentLease.unitId || null;
  if (!currentLeaseUnitId || currentLeaseUnitId === targetUnit.id) return null;

  const sameOwnership =
    asTrimmedString(currentLease.landlordId) === landlordId &&
    asTrimmedString(currentLease.propertyId) === propertyId;
  if (!sameOwnership) return null;

  const candidateLeases = context.currentLeases.filter((entry) => {
    const leaseUnitId = entry.lease.resolvedUnitId || entry.lease.unitId || null;
    return leaseUnitId === targetUnit.id;
  });
  if (!candidateLeases.length) return null;

  return {
    tenantId: tenantDoc.id,
    landlordId,
    propertyId,
    tenantUnitId: targetUnit.id,
    tenantUnitNumber: targetUnit.unitNumber || null,
    tenantUnitLabel: targetUnit.label || targetUnit.unitNumber || null,
    currentLeaseId,
    currentLeaseUnitId,
    currentLeaseUnitNumber: currentLease.resolvedUnitNumber || currentLease.unitLabel || null,
    currentLeaseUnitLabel: currentLease.resolvedUnitLabel || currentLease.unitLabel || null,
    candidateLeases: candidateLeases.map((entry) => toCandidate(entry.lease, entry.raw)),
    suggestedLeaseId: selectSuggestedLeaseId(tenantDoc.id, candidateLeases),
    reason: "Tenant currentLeaseId points to a lease on a different unit than the tenant's unit context.",
  };
}

export async function listTenantLeasePointerConflicts(options?: {
  firestore?: FirestoreLike;
  landlordId?: string | null;
  propertyId?: string | null;
}): Promise<TenantLeasePointerConflict[]> {
  const firestore = (options?.firestore || (db as any)) as FirestoreLike;
  const landlordId = asTrimmedString(options?.landlordId);
  const propertyId = asTrimmedString(options?.propertyId);
  let query: FirebaseFirestore.Query = firestore.collection("tenants");
  if (landlordId) query = query.where("landlordId", "==", landlordId);
  if (propertyId) query = query.where("propertyId", "==", propertyId);
  const snap = await query.get();
  const propertyContextCache = new Map<string, Awaited<ReturnType<typeof loadPropertyLeaseContext>>>();
  const conflicts = await Promise.all(
    (snap.docs || []).map((doc: any) =>
      buildTenantPointerConflict(
        firestore,
        { id: doc.id, raw: (doc.data() || {}) as Record<string, unknown> },
        propertyContextCache
      )
    )
  );
  return conflicts.filter((item): item is TenantLeasePointerConflict => Boolean(item));
}

export async function previewTenantLeasePointerCorrection(input: {
  firestore?: FirestoreLike;
  landlordId: string;
  propertyId: string;
  tenantId: string;
  toCurrentLeaseId: string;
  dryRun?: boolean;
}): Promise<TenantLeasePointerCorrectionPreview> {
  const firestore = (input.firestore || (db as any)) as FirestoreLike;
  const landlordId = asTrimmedString(input.landlordId);
  const propertyId = asTrimmedString(input.propertyId);
  const tenantId = asTrimmedString(input.tenantId);
  const toCurrentLeaseId = asTrimmedString(input.toCurrentLeaseId);

  if (!landlordId || !propertyId || !tenantId || !toCurrentLeaseId) {
    throw new Error("pointer_correction_input_invalid");
  }

  const conflicts = await listTenantLeasePointerConflicts({ firestore, landlordId, propertyId });
  const conflict = conflicts.find((item) => item.tenantId === tenantId);
  if (!conflict) throw new Error("pointer_conflict_not_found");
  if (!conflict.candidateLeases.some((candidate) => candidate.leaseId === toCurrentLeaseId)) {
    throw new Error("pointer_correction_candidate_invalid");
  }

  const nextLeaseSnap = await firestore.collection("leases").doc(toCurrentLeaseId).get();
  if (!nextLeaseSnap.exists) throw new Error("pointer_correction_target_missing");
  const nextLeaseRaw = (nextLeaseSnap.data() || {}) as Record<string, unknown>;
  if (
    asTrimmedString(nextLeaseRaw.landlordId) !== landlordId ||
    asTrimmedString(nextLeaseRaw.propertyId) !== propertyId
  ) {
    throw new Error("pointer_correction_ownership_mismatch");
  }

  const nextUnitId = asTrimmedString(nextLeaseRaw.unitId);
  if (conflict.tenantUnitId && nextUnitId && nextUnitId !== conflict.tenantUnitId) {
    throw new Error("pointer_correction_wrong_unit");
  }

  return {
    dryRun: input.dryRun !== false,
    tenantId,
    landlordId,
    propertyId,
    fromCurrentLeaseId: conflict.currentLeaseId,
    toCurrentLeaseId,
    conflict,
  };
}

export async function applyTenantLeasePointerCorrection(input: {
  firestore?: FirestoreLike;
  landlordId: string;
  propertyId: string;
  tenantId: string;
  toCurrentLeaseId: string;
  actorUserId: string;
}): Promise<TenantLeasePointerCorrectionApplyResult> {
  const firestore = (input.firestore || (db as any)) as FirestoreLike;
  const actorUserId = asTrimmedString(input.actorUserId);
  if (!actorUserId) throw new Error("pointer_correction_actor_required");
  const preview = await previewTenantLeasePointerCorrection({ ...input, firestore, dryRun: false });
  const appliedAt = nowIso();
  const logRef = firestore.collection("tenantLeasePointerCorrectionLogs").doc();

  await firestore.collection("tenants").doc(preview.tenantId).set(
    {
      currentLeaseId: preview.toCurrentLeaseId,
      updatedAt: FieldValue?.serverTimestamp ? FieldValue.serverTimestamp() : appliedAt,
      currentLeasePointerCorrectedAt: appliedAt,
      currentLeasePointerCorrectedByUserId: actorUserId,
    },
    { merge: true }
  );

  await logRef.set({
    tenantId: preview.tenantId,
    landlordId: preview.landlordId,
    propertyId: preview.propertyId,
    fromCurrentLeaseId: preview.fromCurrentLeaseId,
    toCurrentLeaseId: preview.toCurrentLeaseId,
    actorUserId,
    conflict: preview.conflict,
    createdAt: FieldValue?.serverTimestamp ? FieldValue.serverTimestamp() : appliedAt,
    createdAtIso: appliedAt,
  });

  return {
    ...preview,
    applied: true,
    actorUserId,
    appliedAt,
    resolutionLogId: logRef.id,
  };
}
