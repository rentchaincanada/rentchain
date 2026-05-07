import { apiFetch } from "./apiFetch";

export type PublicExposureHardeningStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";
export type PublicExposureReferenceType =
  | "release"
  | "rollback"
  | "security"
  | "onboarding"
  | "support"
  | "operational_risk"
  | "evidence"
  | "review"
  | "audit";
export type PublicExposureReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type PublicExposureReference = {
  referenceId: string;
  referenceType: PublicExposureReferenceType;
  status: PublicExposureReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type PublicExposureRestriction = {
  restrictionId: string;
  restrictionType: PublicExposureReferenceType | "public_exposure";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type PublicExposureHardeningProfile = {
  publicExposureHardeningId: string;
  status: PublicExposureHardeningStatus;
  manualApprovalRequired: true;
  autonomousLaunchEnabled: false;
  autonomousRollbackEnabled: false;
  publicExposureEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  releaseReferences: PublicExposureReference[];
  rollbackReferences: PublicExposureReference[];
  securityReferences: PublicExposureReference[];
  operationalRiskReferences: PublicExposureReference[];
  onboardingReferences: PublicExposureReference[];
  supportReferences: PublicExposureReference[];
  reviewReferences: PublicExposureReference[];
  evidenceReferences: PublicExposureReference[];
  auditReferences: PublicExposureReference[];
  publicExposureRestrictions: PublicExposureRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{ eventType: string; action: string; status: PublicExposureHardeningStatus; resourceId: string; summary: string }>;
};

export async function fetchPublicExposureHardeningProfiles(params?: {
  status?: PublicExposureHardeningStatus | "";
}): Promise<PublicExposureHardeningProfile[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profiles: PublicExposureHardeningProfile[] }>(`/admin/public-exposure-hardening${suffix}`);
  return response.profiles;
}

export async function fetchPublicExposureHardeningProfile(publicExposureHardeningId: string): Promise<PublicExposureHardeningProfile> {
  const response = await apiFetch<{ ok: true; profile: PublicExposureHardeningProfile }>(
    `/admin/public-exposure-hardening/${encodeURIComponent(publicExposureHardeningId)}`
  );
  return response.profile;
}
