import { apiJson } from "@/api/http";
import type { CanonicalLeaseOccupancyState } from "@/lib/leases/canonicalStatePresentation";

export type OccupancyResolutionType =
  | "record_operational_move_out"
  | "clear_stale_occupancy_record"
  | "link_existing_lease";

export type OccupancyResolutionContext = {
  propertyId: string;
  unitId: string;
  tenantId: string | null;
  unitLabel: string;
  propertyLabel: string;
  canonicalState: CanonicalLeaseOccupancyState;
  expectedStateToken: string;
  eligibleResolutionTypes: OccupancyResolutionType[];
  existingLeaseCandidates: Array<{ id: string; label: string; tenantId: string | null; startDate: string | null; endDate: string | null }>;
  activeLeaseRequiresEndWorkflow: boolean;
};

export async function getOccupancyResolutionContext(input: { propertyId: string; unitId: string; tenantId?: string | null }) {
  const query = new URLSearchParams({ propertyId: input.propertyId, unitId: input.unitId });
  if (input.tenantId) query.set("tenantId", input.tenantId);
  return apiJson<{ ok: true; context: OccupancyResolutionContext }>(`/occupancy-resolutions/context?${query.toString()}`);
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      propertyId: input.context.propertyId,
      unitId: input.context.unitId,
      tenantId: input.context.tenantId,
      expectedStateToken: input.context.expectedStateToken,
      type: input.type,
      idempotencyKey: input.idempotencyKey,
      confirmation: true,
      effectiveDate: input.effectiveDate || null,
      selectedLeaseId: input.selectedLeaseId || null,
    }),
  });
}
