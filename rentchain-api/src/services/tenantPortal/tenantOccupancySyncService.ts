import { db } from "../../firebase";
import {
  getCanonicalLeaseStartContext,
  startCanonicalLeaseOccupancy,
  type LeaseStartServiceResult,
} from "../leaseStart/leaseStartService";

type OccupancySyncInput = {
  tenantId: string;
  leaseId?: string | null;
  applicationId?: string | null;
  landlordId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  actorId?: string | null;
  idempotencyKey?: string | null;
  source: "application_conversion" | "tenant_invite_onboarding";
  firestore?: any;
  evaluationInstant?: string;
};

export type OccupancySyncResult = {
  updated: boolean;
  reason:
    | "missing_context"
    | "lease_not_found"
    | "renewal_handoff_required"
    | "occupancy_excluded"
    | "created_without_occupancy"
    | "rejected"
    | "occupancy_effective"
    | "already_coherent";
  canonicalResult?: LeaseStartServiceResult;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function isRenewalLease(lease: Record<string, unknown>): boolean {
  return [
    lease.predecessorLeaseId,
    lease.renewalOfLeaseId,
    lease.renewedFromLeaseId,
    lease.replacesLeaseId,
  ].some((value) => Boolean(text(value)));
}

function isOccupancyExcluded(lease: Record<string, any>): boolean {
  return text(lease.occupancyDisposition?.status) === "excluded_from_current_occupancy_by_resolution";
}

/**
 * Narrow adapter from tenant setup workflows to the canonical lease-start
 * authority. This service never writes occupancy projections itself.
 */
export async function syncPropertyUnitOccupancyForTenantContext(
  input: OccupancySyncInput
): Promise<OccupancySyncResult> {
  const tenantId = text(input.tenantId);
  const leaseId = text(input.leaseId);
  const landlordId = text(input.landlordId);
  const propertyId = text(input.propertyId);
  const unitId = text(input.unitId);
  const idempotencyKey = text(input.idempotencyKey || input.applicationId);
  if (!tenantId || !leaseId || !landlordId || !propertyId || !unitId || !idempotencyKey) {
    return { updated: false, reason: "missing_context" };
  }

  const firestore = input.firestore || db;
  const leaseSnap = await firestore.collection("leases").doc(leaseId).get();
  if (!leaseSnap.exists) return { updated: false, reason: "lease_not_found" };
  const lease = { id: leaseSnap.id, ...(leaseSnap.data() || {}) };

  // Renewal occupancy is governed exclusively by the explicit PR G handoff.
  // The expected-state token generated below includes the complete lease, so
  // a concurrent linkage/disposition change makes the canonical commit stale.
  if (isRenewalLease(lease)) return { updated: false, reason: "renewal_handoff_required" };
  if (isOccupancyExcluded(lease)) return { updated: false, reason: "occupancy_excluded" };

  const evaluationInstant = input.evaluationInstant || new Date().toISOString();
  const context = await getCanonicalLeaseStartContext({
    landlordId,
    propertyId,
    unitId,
    tenantId,
    leaseId,
    evaluationInstant,
    firestore,
  });

  // A replay after a successful setup is already coherent and needs no new
  // request record. Ineligible decisions still pass through the canonical
  // engine, which guarantees zero occupancy-bearing writes.
  if (context.decision.outcome === "already_coherent") {
    return { updated: false, reason: "already_coherent" };
  }
  const canonicalResult = await startCanonicalLeaseOccupancy({
    landlordId,
    propertyId,
    unitId,
    tenantId,
    leaseId,
    operationKind: "conversion",
    trigger: "conversion",
    idempotencyKey,
    expectedStateToken: context.expectedStateToken,
    evaluationInstant: context.evaluationInstant,
    actorId: text(input.actorId) || landlordId,
    source: input.source,
    persistRejectedAttempt: false,
    firestore,
  });
  const reason = canonicalResult.canonicalOutcome;
  return {
    updated: canonicalResult.occupancyEffective,
    reason,
    canonicalResult,
  };
}
