import {
  deriveCanonicalLeaseTermState,
  type CanonicalLeaseConflictReason,
  type CanonicalLeaseStateInput,
} from "../leases/canonicalLeaseOccupancyState";
import type { CanonicalLeaseOccupancyProjection } from "../leases/canonicalLeaseOccupancyProjection";

export type TenantWorkspaceCategory = "current" | "upcoming" | "past" | "archived";
export type TenantArchiveEligibilityReason =
  | "already_archived"
  | "current_relationship"
  | "upcoming_relationship"
  | "occupancy_conflict"
  | null;

export interface TenantWorkspaceLifecycle {
  category: TenantWorkspaceCategory;
  label: "Current" | "Upcoming" | "Past" | "Archived";
  isArchived: boolean;
  archivedAt: string | null;
  actualEndDate: string | null;
  hasCanonicalCurrentLease: boolean;
  hasUpcomingLease: boolean;
  hasUnresolvedOccupancyConflict: boolean;
  archiveEligibility: {
    allowed: boolean;
    reason: TenantArchiveEligibilityReason;
  };
}
const UNRESOLVED_OCCUPANCY_REASONS = new Set<CanonicalLeaseConflictReason>([
  "MULTIPLE_CURRENT_LEASES",
  "INVALID_LEASE_DATE_RANGE",
  "CURRENT_LEASE_CONTEXT_MISMATCH",
  "OCCUPIED_WITHOUT_CURRENT_LEASE",
  "VACANT_WITH_CURRENT_LEASE",
  "STALE_CURRENT_LEASE_POINTER",
  "TENANT_CURRENT_WITHOUT_CURRENT_LEASE",
]);

function isoDate(value: unknown): string | null {
  if (!value) return null;
  const parsed = typeof (value as any)?.toDate === "function"
    ? (value as any).toDate()
    : new Date(typeof (value as any)?.toMillis === "function" ? (value as any).toMillis() : String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function actualEndDate(leases: CanonicalLeaseStateInput[]): string | null {
  return leases
    .map((lease) => isoDate(lease.endedAt ?? lease.terminatedAt ?? lease.terminationDate))
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))[0] || null;
}

export function deriveTenantWorkspaceLifecycle(input: {
  canonicalState: CanonicalLeaseOccupancyProjection;
  leases: CanonicalLeaseStateInput[];
  archivedAt?: unknown;
  asOfDate?: unknown;
}): TenantWorkspaceLifecycle {
  const archivedAt = isoDate(input.archivedAt);
  const termStates = input.leases.map((lease) => deriveCanonicalLeaseTermState(lease, input.asOfDate));
  const hasUpcomingLease = termStates.some((state) => state.state === "upcoming");
  const hasCanonicalCurrentLease = input.canonicalState.tenantRelationshipState === "current_occupant";
  const hasUnresolvedOccupancyConflict =
    input.canonicalState.occupancyState === "review_needed" ||
    input.canonicalState.reasons.some((reason) => UNRESOLVED_OCCUPANCY_REASONS.has(reason));

  const category: TenantWorkspaceCategory = archivedAt
    ? "archived"
    : hasCanonicalCurrentLease
      ? "current"
      : hasUpcomingLease
        ? "upcoming"
        : "past";
  const label = `${category.charAt(0).toUpperCase()}${category.slice(1)}` as TenantWorkspaceLifecycle["label"];

  const reason: TenantArchiveEligibilityReason = archivedAt
    ? "already_archived"
    : hasCanonicalCurrentLease
      ? "current_relationship"
      : hasUnresolvedOccupancyConflict
        ? "occupancy_conflict"
        : hasUpcomingLease
          ? "upcoming_relationship"
          : null;

  return {
    category,
    label,
    isArchived: Boolean(archivedAt),
    archivedAt,
    actualEndDate: actualEndDate(input.leases),
    hasCanonicalCurrentLease,
    hasUpcomingLease,
    hasUnresolvedOccupancyConflict,
    archiveEligibility: { allowed: reason === null, reason },
  };
}
