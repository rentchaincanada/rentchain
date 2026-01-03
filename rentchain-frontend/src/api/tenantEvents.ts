import { apiFetch } from "./apiFetch";

export type TenantEventType =
  | "LEASE_STARTED"
  | "RENT_PAID"
  | "RENT_LATE"
  | "NOTICE_SERVED"
  | "LEASE_ENDED";

export type TenantEvent = {
  id: string;
  tenantId: string;
  landlordId: string;
  propertyId?: string | null;
  unitId?: string | null;
  type: TenantEventType | string;
  title?: string | null;
  description?: string | null;
  severity?: "positive" | "neutral" | "negative";
  amountCents?: number | null;
  currency?: string | null;
  daysLate?: number | null;
  noticeType?: string | null;
  occurredAt?: any;
  createdAt?: any;
  anchorStatus?: "none" | "queued" | "anchored" | "failed";
  anchorTx?: string;
};

export async function listTenantEvents(params: {
  tenantId: string;
  limit?: number;
  cursor?: string | number;
}) {
  const qs = new URLSearchParams();
  qs.set("tenantId", params.tenantId);
  if (params.limit) qs.set("limit", String(params.limit));
  if (params.cursor !== undefined && params.cursor !== null) {
    qs.set("cursor", String(params.cursor));
  }

  return apiFetch<{ ok: boolean; items: TenantEvent[]; nextCursor?: any }>(
    `/api/tenant-events?${qs.toString()}`
  );
}

export async function listRecentTenantEvents(limit = 25) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  return apiFetch<{ ok: boolean; items: TenantEvent[] }>(
    `/api/tenant-events/recent?${qs.toString()}`
  );
}

// Tenant-side helper (uses tenant token if available)
export async function getMyTenantEvents(limit = 50) {
  const token =
    sessionStorage.getItem("rentchain_tenant_token") ||
    sessionStorage.getItem("rentchain_token") ||
    localStorage.getItem("rentchain_token") ||
    "";

  const res = await fetch(`/api/tenant/events?limit=${limit}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`getMyTenantEvents ${res.status}: ${text}`);
  }

  return (await res.json()) as { ok: boolean; items: TenantEvent[] };
}

export type TenantSignalsResponse = {
  ok: boolean;
  tenantId: string;
  lastEventAt: any;
  signals: {
    lateCount90d: number;
    rentPaid90d: number;
    notices12m: number;
    onTimeStreak: number;
    riskTier: "low" | "medium" | "high" | "neutral";
  };
};

export async function getTenantSignals(tenantId: string) {
  const qs = new URLSearchParams();
  qs.set("tenantId", tenantId);
  return apiFetch<TenantSignalsResponse>(`/api/tenant-events/signals?${qs.toString()}`);
}
