// src/api/screeningApi.ts
import { apiFetch } from "./apiFetch";
import { withAuthHeaders } from "./httpClient";
import { getBureauAdapter } from "@/bureau";
import { comparePrimaryVsShadow } from "@/bureau/shadow/compare";
import { runShadowTask } from "@/bureau/shadow/runShadow";
import { getShadowTimeoutMs } from "@/bureau/shadow/shadowMode";
import { logShadowEvent } from "@/bureau/shadow/shadowLogger";

export type ScreeningStatus =
  | "requested"
  | "paid"
  | "completed"
  | "failed"
  | "pending";

export interface ScreeningReportSummary {
  headline: string;
  highlights: string[];
  createdAt: string;
  applicationId?: string;
  providerName?: string;
  providerReferenceId?: string;
  score?: number;
  riskBand?: string;
}

export interface ScreeningCreditReport {
  id?: string;
  provider?: string;
  score?: number;
  summary?: string;
  recommendations?: string[];
  generatedAt?: string;
}

export interface ScreeningRequest {
  id: string;
  applicationId?: string;
  landlordId?: string;
  status: ScreeningStatus;
  createdAt: string;
  paidAt?: string;
  completedAt?: string;
  priceCents?: number;
  currency?: string;
  reportSummary?: ScreeningReportSummary;
  creditReport?: ScreeningCreditReport;
  providerName?: string;
  providerReferenceId?: string;
  failureReason?: string;
}

export interface ScreeningRequestResponse {
  screeningRequest: ScreeningRequest;
}

export type ScreeningHistoryRecord = {
  id: string;
  landlordId: string;
  propertyId: string | null;
  unitId: string | null;
  applicationId: string | null;
  tenantId: string | null;
  applicantName: string | null;
  provider: "transunion" | "equifax" | "other";
  providerReferenceId: string | null;
  screeningType: string | null;
  status: "pending" | "completed" | "failed";
  result: "approved" | "review" | "declined" | "unknown";
  riskLevel: "low" | "medium" | "high" | "unknown";
  screenedAt: string | number | null;
  requestedAt: string | number | null;
  requestedByUserId: string | null;
  summary: {
    recommendation: string | null;
    scoreBand: string | null;
    confidence: string | null;
    openAccounts: number | null;
    pastDueTotal: number | null;
    collectionsPresent: boolean | null;
    bankruptcyPresent: boolean | null;
    inquiriesCount: number | null;
    flags: string[];
    notes: string | null;
  };
  report: {
    status: "available" | "archived" | "not_stored" | "retrieval_required" | "pending" | "failed";
    storageMode: "rentchain_encrypted" | "provider_only" | "none";
    fileRef: string | null;
    archivedAt: string | number | null;
    retrievalCost: number | null;
    retrievalRequired: boolean | null;
  };
  audit: {
    lastViewedAt: string | number | null;
    lastViewedByUserId: string | null;
    accessCount: number | null;
  };
  createdAt: string | number | null;
  updatedAt: string | number | null;
};

export type ScreeningHistoryDetail = ScreeningHistoryRecord & {
  propertyLabel: string | null;
  unitLabel: string | null;
  applicationStatus: string | null;
  metadata: {
    sourceType: "order" | "request";
    sourceId: string;
    referenceId: string | null;
    packageType: string | null;
    requestedByLabel: string | null;
  };
};

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const classifyShadowError = (error: unknown): string => {
  const message = String((error as any)?.message || "").toLowerCase();
  if (message.includes("timeout")) return "timeout";
  if (message.includes("401") || message.includes("unauthorized")) return "unauthorized";
  if (message.includes("403") || message.includes("forbidden")) return "forbidden";
  if (message.includes("404") || message.includes("not found")) return "not_found";
  if (message.includes("network") || message.includes("fetch")) return "network";
  return "unknown";
};

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const json = await response.json();
      if (json?.error) {
        message = json.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export async function requestScreening(
  applicationId: string
): Promise<ScreeningRequest> {
  const data = await apiFetch<ScreeningRequestResponse>(`/screenings/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicationId }),
  });
  return data.screeningRequest;
}

export async function runScreening(applicationId: string): Promise<ScreeningRequest> {
  const data = await apiFetch<ScreeningRequestResponse>(`/screenings/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ applicationId }),
  });
  return data.screeningRequest;
}

export async function checkoutScreening(id: string): Promise<string> {
  const primaryStart = nowMs();
  const data = await apiFetch<{ url: string }>(
    `/screenings/${encodeURIComponent(id)}/checkout`,
    { method: "POST" }
  );

  const primaryDurationMs = Math.round(nowMs() - primaryStart);

  void runShadowTask({
    name: "legacy_checkout",
    seedKey: id,
    timeoutMs: getShadowTimeoutMs(),
    task: async () => {
      const adapter = getBureauAdapter();
      const shadowStart = nowMs();
      const result = await adapter.startScreeningRedirect({ applicationId: id });
      return {
        provider: adapter.providerId,
        ok: Boolean(result?.redirectUrl),
        checkoutUrlPresent: Boolean(result?.redirectUrl),
        orderIdPresent: Boolean(result?.requestId),
        durationMs: Math.round(nowMs() - shadowStart),
      };
    },
    onResult: (shadow) => {
      const primary = {
        provider: "transunion",
        ok: Boolean(data?.url),
        checkoutUrlPresent: Boolean(data?.url),
        orderIdPresent: false,
      };
      const diff = comparePrimaryVsShadow(primary, shadow);
      logShadowEvent({
        eventType: "bureau_shadow",
        name: "legacy_checkout",
        seedKey: id,
        primary: {
          provider: primary.provider,
          ok: primary.ok,
          status: primary.ok ? 200 : 400,
          durationMs: primaryDurationMs,
        },
        shadow: {
          provider: shadow.provider,
          ok: shadow.ok,
          status: shadow.ok ? 200 : 400,
          durationMs: shadow.durationMs,
        },
        diff,
        meta: {
          envMode: import.meta.env.MODE,
          buildSha: (import.meta.env as any).VITE_BUILD_ID,
          ts: new Date().toISOString(),
        },
      });
    },
    onError: (error) => {
      logShadowEvent({
        eventType: "bureau_shadow",
        name: "legacy_checkout",
        seedKey: id,
        primary: {
          provider: "transunion",
          ok: Boolean(data?.url),
          status: data?.url ? 200 : 400,
          durationMs: primaryDurationMs,
        },
        shadow: {
          provider: getBureauAdapter().providerId,
          ok: false,
          errorCode: classifyShadowError(error),
        },
        diff: { isMatch: false, fields: ["shadow_error"] },
        meta: {
          envMode: import.meta.env.MODE,
          buildSha: (import.meta.env as any).VITE_BUILD_ID,
          ts: new Date().toISOString(),
        },
      });
    },
  });

  return data.url;
}

export async function getScreening(
  id: string
): Promise<ScreeningRequestResponse> {
  return apiFetch<ScreeningRequestResponse>(`/screenings/${encodeURIComponent(id)}`);
}

export async function fetchScreeningHistory(params: {
  applicationId?: string | null;
  tenantId?: string | null;
  limit?: number;
}): Promise<{ ok: boolean; items: ScreeningHistoryRecord[] }> {
  const query = new URLSearchParams();
  if (params.applicationId) query.set("applicationId", params.applicationId);
  if (params.tenantId) query.set("tenantId", params.tenantId);
  if (typeof params.limit === "number") query.set("limit", String(params.limit));
  return apiFetch<{ ok: boolean; items: ScreeningHistoryRecord[] }>(`/screenings/history?${query.toString()}`);
}

export async function fetchScreeningHistoryDetail(
  id: string
): Promise<{ ok: boolean; screening: ScreeningHistoryDetail }> {
  return apiFetch<{ ok: boolean; screening: ScreeningHistoryDetail }>(
    `/screenings/history/${encodeURIComponent(id)}`
  );
}

export async function fetchScreeningReportBlob(id: string): Promise<Blob> {
  const response = await fetch(`/api/screenings/history/${encodeURIComponent(id)}/report`, withAuthHeaders({ method: "GET" }));
  if (!response.ok) {
    let message = `Failed to load screening report: ${response.status}`;
    try {
      const text = await response.text();
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  return response.blob();
}

export async function downloadScreeningPdf(
  id: string
): Promise<Blob> {
  const res = await fetch(`/api/screenings/${encodeURIComponent(id)}/report.pdf`, {
    method: "GET",
  });

  if (!res.ok) {
    let message = `Failed to download screening PDF: ${res.status}`;
    try {
      const text = await res.text();
      const parsed = JSON.parse(text);
      if (parsed?.error) message = parsed.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  return res.blob();
}
