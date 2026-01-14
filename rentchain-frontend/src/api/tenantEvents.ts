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
    `/tenant-events?${qs.toString()}`
  );
}

export async function listRecentTenantEvents(limit = 25) {
  const qs = new URLSearchParams();
  qs.set("limit", String(limit));
  return apiFetch<{ ok: boolean; items: TenantEvent[] }>(
    `/tenant-events/recent?${qs.toString()}`
  );
}

// Tenant-side helper (uses tenant token if available)
export async function getMyTenantEvents(limit = 50) {
  return apiFetch<{ ok: boolean; items: TenantEvent[] }>(
    `/api/tenant/events?limit=${encodeURIComponent(String(limit))}`
  );
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
  return apiFetch<TenantSignalsResponse>(`/tenant-events/signals?${qs.toString()}`);
}

export type TenantScoreResponse = {
  ok: boolean;
  tenantId: string;
  lastEventAt: any;
  scoreV1: number;
  tierV1: "excellent" | "good" | "watch" | "risk";
  reasons: string[];
  signals: {
    lateCount90d: number;
    rentPaid90d: number;
    notices12m: number;
    onTimeStreak: number;
  };
};

export async function getTenantScore(tenantId: string) {
  const qs = new URLSearchParams();
  qs.set("tenantId", tenantId);
  return apiFetch<TenantScoreResponse>(`/tenant-events/score?${qs.toString()}`);
}

export type TenantSummary = {
  landlordId: string;
  tenantId: string;
  lastEventAt: any;
  signals: {
    lateCount90d: number;
    rentPaid90d: number;
    notices12m: number;
    onTimeStreak: number;
    riskTier: "low" | "medium" | "high" | "neutral";
  };
  scoreV1: number;
  tierV1: "excellent" | "good" | "watch" | "risk";
  reasons: string[];
  updatedAt: any;
};

export async function createTenantEvent(payload: {
  tenantId: string;
  propertyId?: string;
  type: string;
  title?: string;
  description?: string;
  amount?: number;
  occurredAt?: string | number;
}) {
  const defaultTitleFromType = (type: string): string => {
    switch (type) {
      case "RENT_PAID":
        return "Rent paid";
      case "RENT_RECORDED":
        return "Rent recorded";
      case "RENT_DUE":
        return "Rent due";
      case "FEE_ADDED":
        return "Fee added";
      case "ADJUSTMENT":
        return "Adjustment recorded";
      case "NOTICE_SENT":
        return "Notice sent";
      default:
        return (type || "")
          .replace(/_/g, " ")
          .toLowerCase()
          .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const occurredAt =
    typeof payload.occurredAt === "number"
      ? payload.occurredAt
      : payload.occurredAt
      ? new Date(payload.occurredAt).getTime()
      : Date.now();

  return apiFetch("/tenant-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...payload,
      title: payload.title && payload.title.trim() ? payload.title.trim() : defaultTitleFromType(payload.type),
      occurredAt,
    }),
  });
}
