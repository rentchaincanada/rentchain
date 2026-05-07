export type InstitutionType = "lender" | "insurer" | "auditor" | "regulator" | "municipality" | "institutional_landlord" | "operational_partner";

export type InstitutionOnboardingStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";

export type InstitutionOnboardingReferenceType = "identity" | "trust" | "evidence" | "review" | "settlement" | "regulatory" | "sharing" | "audit";

export type InstitutionOnboardingReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type InstitutionOnboardingCanonicalEventType =
  | "institution_onboarding_readiness_derived"
  | "institution_onboarding_review_required"
  | "institution_onboarding_blocked"
  | "institution_onboarding_restriction_detected"
  | "institution_onboarding_redaction_applied";

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

export type InstitutionOnboardingCanonicalEvent = {
  eventType: InstitutionOnboardingCanonicalEventType;
  action: string;
  status: InstitutionOnboardingStatus;
  resourceType: "institution_onboarding_readiness";
  resourceId: string;
  summary: string;
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
  canonicalEvents: InstitutionOnboardingCanonicalEvent[];
};

export type DeriveInstitutionOnboardingReadinessInput = {
  landlordId?: unknown;
  institutionType?: unknown;
  generatedAt?: unknown;
  networkParticipants?: Array<Record<string, any>> | null;
  trustRelationships?: Array<Record<string, any>> | null;
  identityProfiles?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  settlementReadiness?: Record<string, any> | null;
  regulatoryProfiles?: Array<Record<string, any>> | null;
  sharingRooms?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
  consentRecords?: Array<Record<string, any>> | null;
};
