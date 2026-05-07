import { apiFetch } from "./apiFetch";

export type ConsumerReportingGovernanceStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";
export type ReportingReferenceType = "consent" | "dispute" | "adverse_action" | "credentialing" | "review" | "evidence" | "audit";
export type ReportingReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type ReportingReference = {
  referenceId: string;
  referenceType: ReportingReferenceType;
  status: ReportingReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type ReportingRestriction = {
  restrictionId: string;
  restrictionType: ReportingReferenceType | "bureau_execution" | "collections_execution" | "public_scoring";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type ConsumerReportingGovernanceProfile = {
  consumerReportingGovernanceId: string;
  status: ConsumerReportingGovernanceStatus;
  manualApprovalRequired: true;
  consumerReportingExecutionEnabled: false;
  autonomousReportingEnabled: false;
  publicReportingExposureEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  consentReferences: ReportingReference[];
  disputeReferences: ReportingReference[];
  adverseActionReferences: ReportingReference[];
  credentialingReferences: ReportingReference[];
  reviewReferences: ReportingReference[];
  evidenceReferences: ReportingReference[];
  auditReferences: ReportingReference[];
  reportingRestrictions: ReportingRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: ConsumerReportingGovernanceStatus; resourceId: string; summary: string }>;
};

export async function fetchConsumerReportingGovernanceProfiles(params?: {
  status?: ConsumerReportingGovernanceStatus | "";
}): Promise<ConsumerReportingGovernanceProfile[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: ConsumerReportingGovernanceProfile[] }>(`/admin/consumer-reporting-governance${suffix}`);
  return response.profiles;
}

export async function fetchConsumerReportingGovernanceProfile(consumerReportingGovernanceId: string): Promise<ConsumerReportingGovernanceProfile> {
  const response = await apiFetch<{ ok: true; profile: ConsumerReportingGovernanceProfile }>(
    `/admin/consumer-reporting-governance/${encodeURIComponent(consumerReportingGovernanceId)}`
  );
  return response.profile;
}
