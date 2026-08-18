import {
  deriveCanonicalLeaseTermState,
  evaluateCanonicalOccupancy,
  evaluateCanonicalTenantRelationship,
  selectCanonicalCurrentLease,
  type CanonicalLeaseConflictReason,
  type CanonicalLeaseSelectorContext,
  type CanonicalLeaseStateInput,
  type CanonicalLeaseTermState,
  type CanonicalOccupancyState,
  type CanonicalTenantRelationshipState,
} from "./canonicalLeaseOccupancyState";

export type CanonicalLeaseOccupancyProjection = {
  leaseTermState: CanonicalLeaseTermState | null;
  occupancyState: CanonicalOccupancyState;
  tenantRelationshipState: CanonicalTenantRelationshipState;
  supportingLeaseId: string | null;
  reasons: CanonicalLeaseConflictReason[];
};

export function canonicalLeaseMatchesUnit(raw: Record<string, any>, unitId: unknown): boolean {
  const expectedUnitId = String(unitId || "").trim();
  if (!expectedUnitId) return false;
  return String(raw?.resolvedUnitId || raw?.unitId || "").trim() === expectedUnitId;
}

export function toCanonicalLeaseStateInput(raw: Record<string, any>): CanonicalLeaseStateInput {
  return {
    id: String(raw?.id || "").trim(),
    landlordId: raw?.landlordId,
    propertyId: raw?.propertyId,
    unitId: raw?.resolvedUnitId || raw?.unitId || raw?.unitNumber || raw?.unitLabel,
    tenantId: raw?.primaryTenantId || raw?.tenantId || raw?.tenantIds?.[0],
    status: raw?.status,
    startDate: raw?.startDate,
    leaseStartDate: raw?.leaseStartDate,
    leaseStart: raw?.leaseStart,
    endDate: raw?.endDate,
    leaseEndDate: raw?.leaseEndDate,
    leaseEnd: raw?.leaseEnd,
    executionState: raw?.leaseExecutionState || raw?.leaseExecution?.executionStatus,
    executionStatus: raw?.executionStatus,
    endedAt: raw?.endedAt,
    terminatedAt: raw?.terminatedAt,
    terminationDate: raw?.terminationDate,
    successorLeaseId: raw?.successorLeaseId || raw?.replacementLeaseId,
    renewedByLeaseId: raw?.renewedByLeaseId || raw?.renewalLeaseId,
    updatedAt: raw?.updatedAt,
    createdAt: raw?.createdAt,
  };
}

export function buildCanonicalLeaseOccupancyProjection(input: {
  leases: Array<Record<string, any>>;
  context?: CanonicalLeaseSelectorContext;
  persistedUnitOccupancy?: unknown;
  persistedTenancyStatus?: unknown;
  persistedTenantStatus?: unknown;
  currentLeasePointerId?: unknown;
  tenantId?: unknown;
}): CanonicalLeaseOccupancyProjection {
  const selection = selectCanonicalCurrentLease(
    input.leases.map(toCanonicalLeaseStateInput).filter((lease) => lease.id),
    input.context
  );
  const occupancy = evaluateCanonicalOccupancy({
    persistedUnitOccupancy: input.persistedUnitOccupancy,
    persistedTenancyStatus: input.persistedTenancyStatus,
    currentLeasePointerId: input.currentLeasePointerId,
    selection,
  });
  const relationship = evaluateCanonicalTenantRelationship({
    tenantId: input.tenantId,
    persistedTenantStatus: input.persistedTenantStatus,
    currentLeasePointerId: input.currentLeasePointerId,
    selection,
    occupancy,
  });

  const relevantLease = selection.lease || input.leases.map(toCanonicalLeaseStateInput).find((lease) => lease.id) || null;
  const fallbackTerm = relevantLease
    ? deriveCanonicalLeaseTermState(relevantLease, input.context?.asOfDate)
    : null;

  return {
    leaseTermState: selection.lifecycle?.state || fallbackTerm?.state || null,
    occupancyState: occupancy.occupancyState,
    tenantRelationshipState: relationship.relationshipState,
    supportingLeaseId: occupancy.supportingLeaseId,
    reasons: Array.from(new Set([...selection.reasons, ...occupancy.reasons, ...relationship.reasons])),
  };
}

export function canonicalTermLabel(state: CanonicalLeaseTermState | null): string {
  switch (state) {
    case "draft": return "Draft";
    case "upcoming": return "Upcoming";
    case "active": return "Active";
    case "past": return "Expired";
    case "ended": return "Ended";
    case "terminated": return "Terminated";
    default: return "Unknown";
  }
}

export function canonicalOccupancyLabel(state: CanonicalOccupancyState): string {
  if (state === "occupied") return "Occupied";
  if (state === "vacant") return "Vacant";
  return "Review needed";
}

export function canonicalTenantRelationshipLabel(state: CanonicalTenantRelationshipState): string {
  if (state === "current_occupant") return "Current occupant";
  if (state === "past_tenant") return "Past tenant";
  return "Review needed";
}
