import { apiFetch } from "./apiFetch";

export type PlatformCredentialingStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";
export type CredentialingReferenceType =
  | "governance"
  | "privacy"
  | "consent"
  | "audit"
  | "verification"
  | "interoperability"
  | "evidence"
  | "review";
export type CredentialingReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type CredentialingReference = {
  referenceId: string;
  referenceType: CredentialingReferenceType;
  status: CredentialingReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type CredentialingRestriction = {
  restrictionId: string;
  restrictionType: CredentialingReferenceType | "consumer_reporting" | "bureau_execution" | "credential_marketplace";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type PlatformCredentialingReadiness = {
  platformCredentialingId: string;
  status: PlatformCredentialingStatus;
  manualApprovalRequired: true;
  consumerReportingExecutionEnabled: false;
  autonomousCredentialApprovalEnabled: false;
  publicCredentialExposureEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  governanceReferences: CredentialingReference[];
  privacyReferences: CredentialingReference[];
  consentReferences: CredentialingReference[];
  auditReferences: CredentialingReference[];
  verificationReferences: CredentialingReference[];
  interoperabilityReferences: CredentialingReference[];
  reviewReferences: CredentialingReference[];
  evidenceReferences: CredentialingReference[];
  credentialingRestrictions: CredentialingRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: PlatformCredentialingStatus; resourceId: string; summary: string }>;
};

export async function fetchPlatformCredentialingReadiness(params?: {
  status?: PlatformCredentialingStatus | "";
}): Promise<PlatformCredentialingReadiness[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; readiness: PlatformCredentialingReadiness[] }>(`/admin/platform-credentialing-readiness${suffix}`);
  return response.readiness;
}

export async function fetchPlatformCredentialingReadinessById(platformCredentialingId: string): Promise<PlatformCredentialingReadiness> {
  const response = await apiFetch<{ ok: true; readiness: PlatformCredentialingReadiness }>(
    `/admin/platform-credentialing-readiness/${encodeURIComponent(platformCredentialingId)}`
  );
  return response.readiness;
}
