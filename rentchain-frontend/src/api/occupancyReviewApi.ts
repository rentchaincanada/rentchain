import { apiJson } from "@/api/http";

export type OccupancyReviewReason =
  | "MULTIPLE_CURRENT_LEASES" | "INVALID_LEASE_DATE_RANGE" | "CURRENT_LEASE_CONTEXT_MISMATCH"
  | "DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY" | "UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY"
  | "PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY" | "ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY"
  | "LEASE_EXECUTION_INCOMPLETE" | "OCCUPIED_WITHOUT_CURRENT_LEASE" | "VACANT_WITH_CURRENT_LEASE"
  | "STALE_CURRENT_LEASE_POINTER" | "TENANT_CURRENT_WITHOUT_CURRENT_LEASE";

export type OccupancyReviewItem = {
  id: string; scope: "unit" | "tenant"; propertyId: string | null; propertyName: string | null;
  unitId: string | null; unitLabel: string | null; tenantId: string | null; tenantName: string | null;
  supportingLeaseId: string | null; candidateLeaseIds: string[];
  canonicalState: { leaseTermState: string | null; occupancyState: string; tenantRelationshipState: string; supportingLeaseId: string | null; reasons: string[] };
  reasons: Array<OccupancyReviewReason | string>; severity: "high" | "medium" | "low";
  category: "occupancy" | "lease" | "signing" | "tenant_relationship";
  action: "resolve_multiple_current" | "resolve_occupancy" | "continue_signing" | "review_lease_dates" | "review_lease" | "review_tenant_relationship" | "review_only";
  actionTarget: string | null; stableSortKey: string;
};

export type OccupancyReviewWorkspace = {
  items: OccupancyReviewItem[];
  counts: { total: number; multipleCurrent: number; occupancy: number; lease: number; signing: number; tenantRelationship: number };
};

export async function getOccupancyReviewWorkspace() {
  return apiJson<{ ok: true } & OccupancyReviewWorkspace>("/occupancy-reviews");
}
