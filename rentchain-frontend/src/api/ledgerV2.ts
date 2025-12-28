import { apiFetch, apiJson } from "./http";

export interface LedgerEventV2 {
  id: string;
  landlordId: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  leaseId?: string;
  paymentId?: string;
  eventType: string;
  title: string;
  summary?: string;
  amount?: number;
  currency?: string;
  occurredAt: number;
  createdAt: number;
  actor?: { type: string; userId?: string; email?: string };
  tags?: string[];
  metadata?: Record<string, any>;
}

export async function listLedgerV2(params: {
  limit?: number;
  cursor?: number;
  propertyId?: string;
  tenantId?: string;
  eventType?: string;
}) {
  const qs = new URLSearchParams();
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor) qs.set("cursor", String(params.cursor));
  if (params.propertyId) qs.set("propertyId", params.propertyId);
  if (params.tenantId) qs.set("tenantId", params.tenantId);
  if (params.eventType) qs.set("eventType", params.eventType);
  const url = `/api/ledger-v2${qs.toString() ? `?${qs.toString()}` : ""}`;
  return apiFetch<{ ok: boolean; items: LedgerEventV2[]; nextCursor?: number }>(url);
}

export async function getLedgerEventV2(id: string) {
  return apiFetch<{ ok: boolean; item: LedgerEventV2 }>(`/api/ledger-v2/${encodeURIComponent(id)}`);
}

export async function createLedgerNoteV2(payload: {
  title: string;
  summary?: string;
  propertyId?: string;
  tenantId?: string;
  occurredAt?: number;
}) {
  return apiJson<{ ok: boolean; item: LedgerEventV2 }>("/api/ledger-v2", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
