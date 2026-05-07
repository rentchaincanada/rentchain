import { tenantApiFetch } from "./tenantApiFetch";

export type TenantParticipationStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";
export type ParticipationReferenceType =
  | "onboarding"
  | "payment_consistency"
  | "occupancy"
  | "maintenance"
  | "review"
  | "dispute_resolution"
  | "communication"
  | "evidence"
  | "audit";
export type ParticipationReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type ParticipationReference = {
  referenceId: string;
  referenceType: ParticipationReferenceType;
  status: ParticipationReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type ParticipationRestriction = {
  restrictionId: string;
  restrictionType: ParticipationReferenceType | "public_scoring" | "autonomous_incentive" | "public_profile";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type TenantParticipationProfile = {
  tenantParticipationId: string;
  status: TenantParticipationStatus;
  tenantId: string;
  manualReviewRequired: true;
  publicParticipationExposureEnabled: false;
  autonomousRewardExecutionEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  onboardingReferences: ParticipationReference[];
  paymentConsistencyReferences: ParticipationReference[];
  occupancyReferences: ParticipationReference[];
  maintenanceParticipationReferences: ParticipationReference[];
  reviewParticipationReferences: ParticipationReference[];
  disputeParticipationReferences: ParticipationReference[];
  communicationParticipationReferences: ParticipationReference[];
  evidenceReferences: ParticipationReference[];
  auditReferences: ParticipationReference[];
  participationRestrictions: ParticipationRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{
    eventType: string;
    action: string;
    status: TenantParticipationStatus;
    resourceId: string;
    summary: string;
  }>;
};

export async function fetchTenantParticipationProfiles(params?: {
  status?: TenantParticipationStatus | "";
}): Promise<TenantParticipationProfile[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await tenantApiFetch<{ ok: true; profiles: TenantParticipationProfile[] }>(`/tenant/participation-profile${suffix}`);
  return response.profiles;
}

export async function fetchTenantParticipationProfile(tenantParticipationId: string): Promise<TenantParticipationProfile> {
  const response = await tenantApiFetch<{ ok: true; profile: TenantParticipationProfile }>(
    `/tenant/participation-profile/${encodeURIComponent(tenantParticipationId)}`
  );
  return response.profile;
}
