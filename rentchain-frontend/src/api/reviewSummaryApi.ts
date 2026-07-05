import { apiFetch } from "./apiFetch";
import type { ApplicationDecisionSummary, RiskAgentReviewSnapshot } from "@/types/applicationDecisionSummary";

type ReviewSummaryCore = {
  applicationId: string;
  generatedAt: string;
  application: {
    status: string | null;
    submittedAt: string | null;
    propertyName: string | null;
    unitLabel: string | null;
    leaseStartDate: string | null;
    requestedRentAmountCents: number | null;
    moveInDate: string | null;
  };
  applicant: {
    name: string | null;
    email: string | null;
    currentAddressLine: string | null;
    city: string | null;
    provinceState: string | null;
    postalCode: string | null;
    country: string | null;
    timeAtCurrentAddressMonths: number | null;
    currentRentAmountCents: number | null;
  };
  employment: {
    employerName: string | null;
    jobTitle: string | null;
    incomeAmountCents: number | null;
    incomeFrequency: "monthly" | "annual" | null;
    incomeMonthlyCents: number | null;
    monthsAtJob: number | null;
  };
  reference: {
    name: string | null;
    phone: string | null;
  };
  compliance: {
    applicationConsentAcceptedAt: string | null;
    applicationConsentVersion: string | null;
    signatureType: string | null;
    signedAt: string | null;
  };
  screening: {
    status: string;
    statusLabel?: string | null;
    provider: string | null;
    providerLabel?: string | null;
    referenceId: string | null;
  };
  derived: {
    incomeToRentRatio: number | null;
    completeness: {
      score: number;
      label: "High" | "Medium" | "Low";
    };
    flags: string[];
  };
  insights: string[];
};

export type LandlordTrustContext = {
  trustReadiness: "limited" | "emerging" | "ready" | "strong";
  trustLabel: string;
  trustDescription: string;
  positiveSignals: string[];
  missingSignals: string[];
  cautionSignals: string[];
  recommendedNextAction:
    | "review_application"
    | "request_missing_info"
    | "review_screening_status"
    | "review_documents"
    | "prepare_lease"
    | "no_action";
  decisionSupportLevel: "low" | "medium" | "high";
};

export type ApplicationReviewSummary = ReviewSummaryCore & {
  decisionSummary?: ApplicationDecisionSummary | null;
  risk?: RiskAgentReviewSnapshot;
  tenantIdentitySummary?: {
    identityStatus: "incomplete" | "ready" | "verified" | "limited";
    verification: {
      level: "none" | "partial" | "strong";
    };
    readinessLabel: string;
    readinessDescription: string;
  } | null;
  trustContext?: LandlordTrustContext | null;
  tenantCredibilitySummary?: {
    completenessLevel: "low" | "medium" | "high";
    verificationLevel: "none" | "partial" | "strong";
    summaryLabel: string;
    summaryDescription: string;
  } | null;
  portableIdentitySummary?: {
    portabilityStatus: "not_ready" | "ready" | "limited";
    portabilityLabel: string;
    portabilityDescription: string;
    reusableAcrossApplications: boolean;
  } | null;
  networkReuseSummary?: {
    reusable: boolean;
    source: "share_package" | "apply_with_rentchain";
    reuseStatus: "available" | "limited" | "not_available";
    consentRequired: true;
    reusePath:
      | "apply_prefill_ready"
      | "share_summary_ready"
      | "share_summary_with_more_available"
      | "not_ready";
    reusePathLabel: string;
    reusePathDescription: string;
    identitySummaryApproved: boolean;
    applicationSummaryApproved: boolean;
    additionalConsentMayUnlock: boolean;
  } | null;
};

export class ReviewSummaryApiError extends Error {
  status?: number;
  backendError?: string;
  detail?: string;
}

function attachRiskSnapshot(
  decisionSummary: ApplicationDecisionSummary | null | undefined,
  risk: RiskAgentReviewSnapshot | undefined
): ApplicationDecisionSummary | null {
  if (!decisionSummary && !risk) return null;
  return {
    applicationId: decisionSummary?.applicationId || "",
    ...(decisionSummary || {}),
    riskSnapshot: risk || null,
  };
}

export async function fetchReviewSummary(applicationId: string): Promise<ApplicationReviewSummary> {
  const res: any = await apiFetch(
    `/rental-applications/${encodeURIComponent(applicationId)}/review-summary`,
    {
      method: "GET",
      allowStatuses: [400, 401, 403, 404, 500],
    }
  );
  if (!res?.ok || !res?.summary) {
    const err = new ReviewSummaryApiError(
      res?.detail || res?.error || "Failed to load review summary"
    );
    err.status = Number.isFinite(Number(res?.status)) ? Number(res.status) : undefined;
    err.backendError = typeof res?.error === "string" ? res.error : undefined;
    err.detail = typeof res?.detail === "string" ? res.detail : undefined;
    throw err;
  }
  return {
    ...(res.summary as ReviewSummaryCore),
    decisionSummary: attachRiskSnapshot(
      (res?.decisionSummary || null) as ApplicationDecisionSummary | null,
      (res?.risk || null) as RiskAgentReviewSnapshot
    ),
    risk: ((res?.risk || null) as RiskAgentReviewSnapshot) || null,
    tenantIdentitySummary: (res?.tenantIdentitySummary || null) as ApplicationReviewSummary["tenantIdentitySummary"],
    trustContext: (res?.trustContext || null) as ApplicationReviewSummary["trustContext"],
    tenantCredibilitySummary:
      (res?.tenantCredibilitySummary || null) as ApplicationReviewSummary["tenantCredibilitySummary"],
    portableIdentitySummary:
      (res?.portableIdentitySummary || null) as ApplicationReviewSummary["portableIdentitySummary"],
    networkReuseSummary:
      (res?.networkReuseSummary || null) as ApplicationReviewSummary["networkReuseSummary"],
  };
}

export async function fetchReviewSummaryPdfSignedUrl(applicationId: string): Promise<string> {
  const res: any = await apiFetch(
    `/rental-applications/${encodeURIComponent(applicationId)}/review-summary.pdf`,
    {
      method: "GET",
      allowStatuses: [400, 401, 403, 404, 500],
    }
  );
  if (!res?.ok || typeof res?.url !== "string" || !res.url) {
    const err = new ReviewSummaryApiError(
      res?.detail || res?.error || "Failed to fetch review summary PDF URL"
    );
    err.status = Number.isFinite(Number(res?.status)) ? Number(res.status) : undefined;
    err.backendError = typeof res?.error === "string" ? res.error : undefined;
    err.detail = typeof res?.detail === "string" ? res.detail : undefined;
    throw err;
  }
  return res.url;
}
