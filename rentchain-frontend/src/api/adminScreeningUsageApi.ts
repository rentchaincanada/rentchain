import { apiUrl } from "./config";
import { getAuthToken } from "../lib/authToken";
import { getFirebaseIdToken } from "../lib/firebaseAuthToken";
import { apiFetch } from "./apiFetch";

export type TransUnionUsageReport = {
  ok: true;
  providerKey: "transunion";
  period: {
    label: "last_30_days" | "last_60_days" | "last_90_days" | "custom";
    startDate: string;
    endDate: string;
  };
  funnel: {
    optionViewed: number;
    getAccessClicks: number;
    haveCredentialsClicks: number;
    credentialSubmissions: number;
    connectionSuccesses: number;
    connectionFailures: number;
    firstScreeningInitiated: number;
    repeatScreeningUsers: number;
  };
  usage: {
    activeConnectedLandlords: number;
    totalScreeningRequests: number;
    completedScreenings: number;
    inProgressScreenings: number;
    blockedScreenings: number;
    manualReviewScreenings: number;
    averageScreeningsPerConnectedLandlord: number;
    repeatUsageRate: number;
  };
  compliance: {
    tenantConsentCapturedRate: number;
    permissiblePurposeConfirmedRate: number;
    auditCoverageRate: number;
    requestsBlockedForMissingConsent: number;
    requestsBlockedForMissingProviderConnection: number;
  };
  quality: {
    completionRate: number;
    manualReviewRate: number;
    failedOrBlockedRate: number;
    credentialConnectionFailureRate: number;
    averageTimeFromApplicationToScreeningRequestMinutes: number | null;
  };
  report: {
    executiveSummary: {
      headline: string;
      confidentialityNote: string;
      keyMetrics: Record<string, number>;
    };
    workflowDescription: {
      steps: string[];
    };
    landlordAdoptionInsights: {
      landlordCounts: {
        viewers: number;
        connected: number;
        repeatUsers: number;
      };
      mostCommonBlockedReason: string | null;
    };
    partnershipReadiness: {
      notes: string[];
    };
    appendix: {
      eventDefinitions: string[];
      dataExclusions: string[];
    };
  };
};

export async function fetchAdminTransUnionUsage(params?: {
  period?: "last_30_days" | "last_60_days" | "last_90_days";
  startDate?: string;
  endDate?: string;
}) {
  const query = new URLSearchParams();
  if (params?.period) query.set("period", params.period);
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<TransUnionUsageReport>(`/admin/screening/transunion-usage${suffix}`);
}

export async function downloadAdminTransUnionUsagePdf(params?: {
  period?: "last_30_days" | "last_60_days" | "last_90_days";
  startDate?: string;
  endDate?: string;
}) {
  const query = new URLSearchParams();
  if (params?.period) query.set("period", params.period);
  if (params?.startDate) query.set("startDate", params.startDate);
  if (params?.endDate) query.set("endDate", params.endDate);
  const token = getAuthToken() || (await getFirebaseIdToken()) || "";
  const path = `/admin/screening/transunion-usage/pdf${query.toString() ? `?${query.toString()}` : ""}`;
  const response = await fetch(apiUrl(path), {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: "include",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    let message = text || "Failed to export PDF report";
    try {
      const json = text ? JSON.parse(text) : null;
      message = json?.message || json?.error || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  return {
    blob,
    filename: match?.[1] || "rentchain-transunion-usage-summary-v1.pdf",
  };
}
