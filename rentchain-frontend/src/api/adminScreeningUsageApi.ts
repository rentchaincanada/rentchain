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

