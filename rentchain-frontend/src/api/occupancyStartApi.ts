import { apiJson } from "@/api/http";

export type OccupancyStartContext = { leaseId: string; propertyId: string; unitId: string; participants: Array<{ tenantId: string; displayName: string }>; executionStatus: string | null; termStatus: string; currentOccupancyState: string; eligible: boolean; expectedStateToken: string; evaluationInstant: string; canonicalBlocker: string | null; availableAction: "start_occupancy" | null };

export function getOccupancyStartContext(leaseId: string) {
  return apiJson<{ ok: true; context: OccupancyStartContext }>(`/leases/${encodeURIComponent(leaseId)}/occupancy-start-context`);
}

export function startOccupancy(leaseId: string, input: { expectedStateToken: string; evaluationInstant: string; idempotencyKey: string }) {
  return apiJson<{ ok: true; result: unknown }>(`/leases/${encodeURIComponent(leaseId)}/start-occupancy`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey }, body: JSON.stringify({ expectedStateToken: input.expectedStateToken, evaluationInstant: input.evaluationInstant, possessionConfirmed: true }) });
}
