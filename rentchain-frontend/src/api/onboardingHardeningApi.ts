import { apiFetch } from "./apiFetch";
import { tenantApiFetch } from "./tenantApiFetch";

export type OnboardingParticipantType = "tenant" | "landlord";
export type OnboardingHardeningStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";
export type OnboardingReferenceType = "completion" | "profile" | "screening" | "integration" | "friction" | "review" | "evidence" | "audit";
export type OnboardingReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type OnboardingReference = {
  referenceId: string;
  referenceType: OnboardingReferenceType;
  status: OnboardingReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type OnboardingRestriction = {
  restrictionId: string;
  restrictionType: OnboardingReferenceType | "autonomous_onboarding" | "autonomous_screening_activation" | "public_profile_exposure" | "hidden_scoring";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type OnboardingHardeningProfile = {
  onboardingHardeningId: string;
  participantType: OnboardingParticipantType;
  participantId: string;
  status: OnboardingHardeningStatus;
  manualReviewRequired: true;
  autonomousOnboardingEnabled: false;
  autonomousScreeningActivationEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  completionReferences: OnboardingReference[];
  profileReferences: OnboardingReference[];
  screeningReadinessReferences: OnboardingReference[];
  integrationReadinessReferences: OnboardingReference[];
  frictionReferences: OnboardingReference[];
  reviewReferences: OnboardingReference[];
  evidenceReferences: OnboardingReference[];
  auditReferences: OnboardingReference[];
  onboardingRestrictions: OnboardingRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: OnboardingHardeningStatus; resourceId: string; summary: string }>;
};

type FetchParams = {
  participantType?: OnboardingParticipantType | "";
  status?: OnboardingHardeningStatus | "";
};

function suffix(params?: FetchParams) {
  const search = new URLSearchParams();
  if (params?.participantType) search.set("participantType", params.participantType);
  if (params?.status) search.set("status", params.status);
  return search.toString() ? `?${search.toString()}` : "";
}

export async function fetchLandlordOnboardingHardeningProfiles(params?: FetchParams): Promise<OnboardingHardeningProfile[]> {
  const response = await apiFetch<{ ok: true; profiles: OnboardingHardeningProfile[] }>(`/landlord/onboarding-hardening${suffix(params)}`);
  return response.profiles;
}

export async function fetchTenantOnboardingHardeningProfiles(params?: FetchParams): Promise<OnboardingHardeningProfile[]> {
  const response = await tenantApiFetch<{ ok: true; profiles: OnboardingHardeningProfile[] }>(`/tenant/onboarding-hardening${suffix(params)}`);
  return response.profiles;
}
