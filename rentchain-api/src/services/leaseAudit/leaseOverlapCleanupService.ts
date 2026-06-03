import { db, FieldValue } from "../../firebase";
import { CURRENT_LEASE_STATUSES, loadUnitsForProperty, toCanonicalLeaseRecord } from "../leaseCanonicalizationService";
import { getLeasePartyIds } from "../leasePartyConsolidationService";
import { generateLeaseOverlapAuditReport } from "./leaseOverlapAuditService";
import type {
  LeaseOverlapCleanupApplyResult,
  LeaseOverlapCleanupPreview,
  LeaseOverlapCleanupTargetStatus,
  LeaseOverlapCleanupLeaseChange,
  LeaseOverlapCleanupTenantChange,
} from "./leaseOverlapCleanupTypes";

type FirestoreLike = Pick<FirebaseFirestore.Firestore, "collection">;

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeTargetStatus(value: unknown): LeaseOverlapCleanupTargetStatus {
  return asTrimmedString(value).toLowerCase() === "inactive" ? "inactive" : "superseded";
}

function isCurrentStatus(status: unknown): boolean {
  return CURRENT_LEASE_STATUSES.has(asTrimmedString(status).toLowerCase());
}

function nowIso() {
  return new Date().toISOString();
}

function buildLogicalUnitKey(lease: ReturnType<typeof toCanonicalLeaseRecord>): string {
  return (
    asTrimmedString(lease.logicalUnitKey) ||
    asTrimmedString(lease.resolvedUnitId) ||
    asTrimmedString(lease.unitId) ||
    asTrimmedString(lease.unitLabel) ||
    asTrimmedString(lease.id)
  );
}

export async function previewLeaseOverlapCleanup(input: {
  firestore?: FirestoreLike;
  landlordId: string;
  propertyId: string;
  canonicalLeaseId: string;
  overlapLeaseIds: string[];
  targetStatus?: LeaseOverlapCleanupTargetStatus | string | null;
  dryRun?: boolean;
}): Promise<LeaseOverlapCleanupPreview> {
  const firestore = (input.firestore || (db as any)) as FirestoreLike;
  const landlordId = asTrimmedString(input.landlordId);
  const propertyId = asTrimmedString(input.propertyId);
  const canonicalLeaseId = asTrimmedString(input.canonicalLeaseId);
  const overlapLeaseIds = Array.from(new Set((input.overlapLeaseIds || []).map((value) => asTrimmedString(value)).filter(Boolean)));
  const targetStatus = normalizeTargetStatus(input.targetStatus);

  if (!landlordId || !propertyId || !canonicalLeaseId || !overlapLeaseIds.length) {
    throw new Error("cleanup_input_invalid");
  }
  if (!overlapLeaseIds.includes(canonicalLeaseId)) {
    throw new Error("canonical_lease_missing_from_group");
  }

  const units = await loadUnitsForProperty(firestore as any, propertyId, landlordId);
  const leaseDocs = await Promise.all(
    overlapLeaseIds.map(async (leaseId) => {
      const snap = await firestore.collection("leases").doc(leaseId).get();
      if (!snap.exists) throw new Error(`lease_not_found:${leaseId}`);
      return { id: snap.id, raw: (snap.data() || {}) as Record<string, unknown> };
    })
  );

  const canonicalized = leaseDocs.map((entry) => ({
    id: entry.id,
    raw: entry.raw,
    lease: toCanonicalLeaseRecord(entry.id, entry.raw, units),
  }));
  const canonical = canonicalized.find((entry) => entry.id === canonicalLeaseId);
  if (!canonical) throw new Error("canonical_lease_not_loaded");

  const sameOwnership = canonicalized.every(
    (entry) =>
      asTrimmedString(entry.lease.landlordId) === landlordId &&
      asTrimmedString(entry.lease.propertyId) === propertyId
  );
  if (!sameOwnership) {
    throw new Error("cleanup_group_ownership_mismatch");
  }

  const logicalUnitKey = buildLogicalUnitKey(canonical.lease);
  const sameUnit = canonicalized.every((entry) => buildLogicalUnitKey(entry.lease) === logicalUnitKey);
  if (!sameUnit) {
    throw new Error("cleanup_group_logical_unit_mismatch");
  }

  if (!isCurrentStatus(canonical.lease.status)) {
    throw new Error("canonical_lease_not_current");
  }

  const loserLeases = canonicalized.filter((entry) => entry.id !== canonicalLeaseId && isCurrentStatus(entry.lease.status));
  const leaseChanges: LeaseOverlapCleanupLeaseChange[] = loserLeases.map((entry) => ({
    leaseId: entry.id,
    fromStatus: asTrimmedString(entry.lease.status) || null,
    toStatus: targetStatus,
  }));

  const canonicalTenantIds = new Set(getLeasePartyIds(canonical.raw, canonical.lease));
  const allTenantIds = Array.from(new Set(canonicalized.flatMap((entry) => getLeasePartyIds(entry.raw, entry.lease))));
  const tenantDocs = await Promise.all(
    allTenantIds.map(async (tenantId) => {
      const snap = await firestore.collection("tenants").doc(tenantId).get();
      return { id: tenantId, exists: snap.exists, raw: (snap.data() || {}) as Record<string, unknown> };
    })
  );

  const loserIds = new Set(loserLeases.map((entry) => entry.id));
  const tenantChanges: LeaseOverlapCleanupTenantChange[] = tenantDocs
    .filter((tenant) => tenant.exists)
    .map((tenant) => {
      const currentLeaseId = asTrimmedString(tenant.raw?.currentLeaseId) || null;
      let nextCurrentLeaseId = currentLeaseId;

      if (canonicalTenantIds.has(tenant.id) && currentLeaseId !== canonicalLeaseId) {
        nextCurrentLeaseId = canonicalLeaseId;
      } else if (currentLeaseId && loserIds.has(currentLeaseId)) {
        nextCurrentLeaseId = canonicalTenantIds.has(tenant.id) ? canonicalLeaseId : null;
      }

      if (nextCurrentLeaseId === currentLeaseId) return null;
      return {
        tenantId: tenant.id,
        fromCurrentLeaseId: currentLeaseId,
        toCurrentLeaseId: nextCurrentLeaseId,
      };
    })
    .filter((item): item is LeaseOverlapCleanupTenantChange => Boolean(item));

  const audit = await generateLeaseOverlapAuditReport({
    firestore,
    landlordId,
    propertyId,
  });
  const group =
    audit.groups.find(
      (item) =>
        item.leaseIds.includes(canonicalLeaseId) &&
        overlapLeaseIds.every((leaseId) => item.leaseIds.includes(leaseId))
    ) || null;

  return {
    dryRun: input.dryRun !== false,
    landlordId,
    propertyId,
    canonicalLeaseId,
    targetStatus,
    group,
    leaseChanges,
    tenantChanges,
  };
}

export async function applyLeaseOverlapCleanup(input: {
  firestore?: FirestoreLike;
  landlordId: string;
  propertyId: string;
  canonicalLeaseId: string;
  overlapLeaseIds: string[];
  actorUserId: string;
  targetStatus?: LeaseOverlapCleanupTargetStatus | string | null;
  dryRun?: boolean;
}): Promise<LeaseOverlapCleanupApplyResult> {
  const firestore = (input.firestore || (db as any)) as FirestoreLike;
  const preview = await previewLeaseOverlapCleanup({ ...input, firestore, dryRun: input.dryRun });
  const appliedAt = nowIso();
  const actorUserId = asTrimmedString(input.actorUserId);
  if (!actorUserId) throw new Error("cleanup_actor_required");

  const logRef = firestore.collection("leaseOverlapResolutionLogs").doc();
  const logPayload = {
    landlordId: preview.landlordId,
    propertyId: preview.propertyId,
    canonicalLeaseId: preview.canonicalLeaseId,
    overlapLeaseIds: input.overlapLeaseIds,
    targetStatus: preview.targetStatus,
    actorUserId,
    dryRun: preview.dryRun,
    leaseChanges: preview.leaseChanges,
    tenantChanges: preview.tenantChanges,
    auditGroup: preview.group,
    createdAt: FieldValue?.serverTimestamp ? FieldValue.serverTimestamp() : appliedAt,
    createdAtIso: appliedAt,
  };

  if (preview.dryRun) {
    await logRef.set(logPayload);
    return {
      ...preview,
      applied: false,
      resolutionLogId: logRef.id,
      actorUserId,
      appliedAt,
    };
  }

  await Promise.all([
    ...preview.leaseChanges.map((change) =>
      firestore.collection("leases").doc(change.leaseId).set(
        {
          status: change.toStatus,
          updatedAt: FieldValue?.serverTimestamp ? FieldValue.serverTimestamp() : appliedAt,
          overlapResolvedAt: appliedAt,
          overlapResolvedByUserId: actorUserId,
          overlapCanonicalLeaseId: preview.canonicalLeaseId,
        },
        { merge: true }
      )
    ),
    ...preview.tenantChanges.map((change) =>
      firestore.collection("tenants").doc(change.tenantId).set(
        {
          currentLeaseId: change.toCurrentLeaseId,
          updatedAt: FieldValue?.serverTimestamp ? FieldValue.serverTimestamp() : appliedAt,
        },
        { merge: true }
      )
    ),
  ]);

  await logRef.set({
    ...logPayload,
    dryRun: false,
    applied: true,
    appliedAt,
  });

  return {
    ...preview,
    dryRun: false,
    applied: true,
    resolutionLogId: logRef.id,
    actorUserId,
    appliedAt,
  };
}
