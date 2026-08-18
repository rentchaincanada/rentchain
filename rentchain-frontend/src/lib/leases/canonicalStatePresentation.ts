export type CanonicalLeaseTermState =
  | "draft"
  | "upcoming"
  | "active"
  | "past"
  | "ended"
  | "terminated"
  | "unknown";

export type CanonicalLeaseOccupancyState = {
  leaseTermState: CanonicalLeaseTermState | null;
  occupancyState: "vacant" | "occupied" | "review_needed";
  tenantRelationshipState: "current_occupant" | "past_tenant" | "occupancy_unresolved";
  supportingLeaseId: string | null;
  reasons: string[];
};

export function canonicalLeaseTermLabel(state: CanonicalLeaseTermState | null | undefined) {
  if (state === "past") return "Expired";
  if (!state || state === "unknown") return "Unknown";
  return state.charAt(0).toUpperCase() + state.slice(1);
}

export function canonicalOccupancyLabel(state: CanonicalLeaseOccupancyState["occupancyState"] | null | undefined) {
  if (state === "occupied") return "Occupied";
  if (state === "vacant") return "Vacant";
  return "Review needed";
}

export function canonicalTenantRelationshipLabel(
  state: CanonicalLeaseOccupancyState["tenantRelationshipState"] | null | undefined
) {
  if (state === "current_occupant") return "Current occupant";
  if (state === "past_tenant") return "Past tenant";
  return "Review needed";
}
