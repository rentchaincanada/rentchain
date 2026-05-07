export type OnboardingParticipantType = "tenant" | "landlord";
export type OnboardingHardeningStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";
export type OnboardingReferenceType = "completion" | "profile" | "screening" | "integration" | "friction" | "review" | "evidence" | "audit";
export type OnboardingReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type OnboardingCanonicalEventType =
  | "onboarding_hardening_profile_derived"
  | "onboarding_hardening_review_required"
  | "onboarding_hardening_blocked"
  | "onboarding_hardening_restriction_detected"
  | "onboarding_hardening_redaction_applied";

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
  restrictionType:
    | OnboardingReferenceType
    | "autonomous_onboarding"
    | "autonomous_screening_activation"
    | "public_profile_exposure"
    | "hidden_scoring";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type OnboardingCanonicalEvent = {
  eventType: OnboardingCanonicalEventType;
  action: string;
  status: OnboardingHardeningStatus;
  resourceType: "onboarding_hardening_profile";
  resourceId: string;
  summary: string;
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
  canonicalEvents: OnboardingCanonicalEvent[];
};

export type DeriveOnboardingHardeningProfileInput = {
  participantType?: unknown;
  participantId?: unknown;
  generatedAt?: unknown;
  completionRecords?: Array<Record<string, any>> | null;
  profileRecords?: Array<Record<string, any>> | null;
  screeningReadinessRecords?: Array<Record<string, any>> | null;
  integrationReadinessRecords?: Array<Record<string, any>> | null;
  frictionRecords?: Array<Record<string, any>> | null;
  reviewRecords?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
