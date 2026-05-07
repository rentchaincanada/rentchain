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

export type PublicExposureCanonicalEventType =
  | "public_exposure_hardening_profile_derived"
  | "public_exposure_review_required"
  | "public_exposure_blocked"
  | "public_exposure_restriction_detected"
  | "public_exposure_redaction_applied";

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

export type PublicExposureCanonicalEvent = {
  eventType: PublicExposureCanonicalEventType;
  action: string;
  status: PublicExposureHardeningStatus;
  resourceType: "public_exposure_hardening_profile";
  resourceId: string;
  summary: string;
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
  canonicalEvents: PublicExposureCanonicalEvent[];
};

export type DerivePublicExposureHardeningProfileInput = {
  hardeningKey?: unknown;
  generatedAt?: unknown;
  releaseGovernanceProfiles?: Array<Record<string, any>> | null;
  rollbackArtifacts?: Array<Record<string, any>> | null;
  securityReadiness?: Array<Record<string, any>> | null;
  operationalRiskProfiles?: Array<Record<string, any>> | null;
  institutionOnboardingReadiness?: Array<Record<string, any>> | null;
  supportReadiness?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
