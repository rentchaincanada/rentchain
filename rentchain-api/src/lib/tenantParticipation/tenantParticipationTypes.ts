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

export type TenantParticipationCanonicalEventType =
  | "tenant_participation_profile_derived"
  | "tenant_participation_review_required"
  | "tenant_participation_blocked"
  | "tenant_participation_restriction_detected"
  | "tenant_participation_redaction_applied";

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

export type TenantParticipationCanonicalEvent = {
  eventType: TenantParticipationCanonicalEventType;
  action: string;
  status: TenantParticipationStatus;
  resourceType: "tenant_participation_profile";
  resourceId: string;
  summary: string;
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
  canonicalEvents: TenantParticipationCanonicalEvent[];
};

export type DeriveTenantParticipationProfileInput = {
  tenantId?: unknown;
  generatedAt?: unknown;
  onboardingRecords?: Array<Record<string, any>> | null;
  paymentConsistencyRecords?: Array<Record<string, any>> | null;
  occupancyRecords?: Array<Record<string, any>> | null;
  maintenanceRecords?: Array<Record<string, any>> | null;
  reviewRecords?: Array<Record<string, any>> | null;
  disputeRecords?: Array<Record<string, any>> | null;
  communicationRecords?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
