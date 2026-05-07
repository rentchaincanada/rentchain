import { apiFetch } from "./apiFetch";

export type InstitutionType = "lender" | "insurer" | "auditor" | "regulator" | "municipality" | "institutional_landlord" | "operational_partner";
export type InstitutionOnboardingStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";
export type InstitutionOnboardingReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";
export type InstitutionOnboardingReferenceType = "identity" | "trust" | "evidence" | "review" | "settlement" | "regulatory" | "sharing" | "audit";

export type InstitutionOnboardingReference = {
  referenceId: string;
  referenceType: InstitutionOnboardingReferenceType;
  status: InstitutionOnboardingReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type InstitutionOnboardingRestriction = {
  restrictionId: string;
  restrictionType: "consent" | "settlement" | "regulatory" | "sharing" | "evidence" | "review" | "trust";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type InstitutionOnboardingReadiness = {
  onboardingReadinessId: string;
  institutionType: InstitutionType;
  status: InstitutionOnboardingStatus;
  manualReviewRequired: true;
  externalOnboardingEnabled: false;
  autonomousApprovalEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  participantReferences: InstitutionOnboardingReference[];
  trustReferences: InstitutionOnboardingReference[];
  identityReferences: InstitutionOnboardingReference[];
  evidenceReferences: InstitutionOnboardingReference[];
  reviewReferences: InstitutionOnboardingReference[];
  settlementReferences: InstitutionOnboardingReference[];
  regulatoryReferences: InstitutionOnboardingReference[];
  sharingReferences: InstitutionOnboardingReference[];
  auditReferences: InstitutionOnboardingReference[];
  onboardingRestrictions: InstitutionOnboardingRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: InstitutionOnboardingStatus; resourceId: string; summary: string }>;
};

export async function fetchInstitutionOnboardingReadiness(params?: {
  institutionType?: InstitutionType | "";
  status?: InstitutionOnboardingStatus | "";
}): Promise<InstitutionOnboardingReadiness[]> {
  const search = new URLSearchParams();
  if (params?.institutionType) search.set("institutionType", params.institutionType);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; readiness: InstitutionOnboardingReadiness[] }>(`/landlord/institution-onboarding-readiness${suffix}`);
  return response.readiness;
}

export async function fetchInstitutionOnboardingReadinessItem(onboardingReadinessId: string): Promise<InstitutionOnboardingReadiness> {
  const response = await apiFetch<{ ok: true; readiness: InstitutionOnboardingReadiness }>(
    `/landlord/institution-onboarding-readiness/${encodeURIComponent(onboardingReadinessId)}`
  );
  return response.readiness;
}
