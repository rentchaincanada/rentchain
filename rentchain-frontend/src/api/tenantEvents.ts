import { apiFetch } from "./apiFetch";

export type TenantEvent = {
  id: string;
  tenantId: string;
  landlordId: string;
  propertyId?: string;
  unitId?: string;
  type: string;
  severity: "positive" | "neutral" | "negative";
  title: string;
  description?: string;
  occurredAt: any;
  createdAt: any;
  amountCents?: number;
  currency?: string;
  daysLate?: number;
  anchorStatus?: "none" | "queued" | "anchored" | "failed";
  anchorTx?: string;
};

export async function getMyTenantEvents(limit = 50) {
  return apiFetch<{ ok: true; items: TenantEvent[] }>(`/api/tenant/events?limit=${limit}`);
}
