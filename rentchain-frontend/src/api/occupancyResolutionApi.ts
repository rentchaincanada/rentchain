import { apiJson } from "@/api/http";
import type { CanonicalLeaseOccupancyState } from "@/lib/leases/canonicalStatePresentation";

export type OccupancyResolutionType =
  | "record_operational_move_out"
  | "clear_stale_occupancy_record"
  | "link_existing_lease"
  | "resolve_multiple_current_leases"
  | "reconcile_stale_occupancy_linkage"
  | "reconcile_ended_occupancy_to_vacant"
  | "reconcile_stale_tenant_relationship_status";

export type OccupancyResolutionContext = {
  propertyId: string;
  unitId: string;
  tenantId: string | null;
  unitLabel: string;
  propertyLabel: string;
  canonicalState: CanonicalLeaseOccupancyState;
  expectedStateToken: string;
  eligibleResolutionTypes: OccupancyResolutionType[];
  existingLeaseCandidates: Array<{ id: string; label: string; tenantId: string | null; startDate: string | null; endDate: string | null; executionStatus: string | null; participantNames: string[]; participantCount: number; reference: string; occupancyEffective: boolean; activeTenancyCount: number }>;
  activeLeaseRequiresEndWorkflow: boolean;
  contextMismatchRemediation: {
    classification: "stale_occupancy_linkage_with_unique_authoritative_lease" | "lease_context_mismatch" | "ownership_mismatch" | "ambiguous_context" | "participant_mismatch" | "missing_context" | "not_applicable";
    repairEligible: boolean;
    authoritativeLeaseId: string | null;
    blockedReason: string | null;
    mismatchedComponents: string[];
    staleLinkageFields: string[];
  };
};

export async function getOccupancyResolutionContext(input: { propertyId: string; unitId: string; tenantId?: string | null }) {
  const query = new URLSearchParams({ propertyId: input.propertyId, unitId: input.unitId });
  if (input.tenantId) query.set("tenantId", input.tenantId);
  return apiJson<{ ok: true; context: OccupancyResolutionContext }>(`/occupancy-resolutions/context?${query.toString()}`);
}

export async function submitStaleTenantRelationshipResolution(input: { tenantId: string; expectedStateToken: string; idempotencyKey: string }) {
  return apiJson<{ ok: true; auditEventId: string | null; idempotent: boolean; outcome: "resolved" | "already_resolved"; context: { postRepairLifecycle: "Past" | null } }>("/occupancy-resolutions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({ tenantId: input.tenantId, expectedStateToken: input.expectedStateToken, type: "reconcile_stale_tenant_relationship_status", confirmation: true }),
  });
}

export async function submitOccupancyResolution(input: {
  context: OccupancyResolutionContext;
  type: OccupancyResolutionType;
  idempotencyKey: string;
  effectiveDate?: string;
  selectedLeaseId?: string;
}) {
  return apiJson<{ ok: true; context: OccupancyResolutionContext; auditEventId: string; idempotent: boolean }>("/occupancy-resolutions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      propertyId: input.context.propertyId,
      unitId: input.context.unitId,
      tenantId: input.context.tenantId,
      expectedStateToken: input.context.expectedStateToken,
      type: input.type,
      confirmation: true,
      effectiveDate: input.effectiveDate || null,
      selectedLeaseId: input.selectedLeaseId || null,
    }),
  });
}
