export type CommercialReadinessStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";

export type CommercialReferenceType =
  | "pricing"
  | "billing"
  | "subscription"
  | "onboarding"
  | "support"
  | "operational_risk"
  | "release"
  | "evidence"
  | "review"
  | "audit";

export type CommercialReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type CommercialCanonicalEventType =
  | "commercial_readiness_profile_derived"
  | "commercial_readiness_review_required"
  | "commercial_readiness_blocked"
  | "commercial_readiness_restriction_detected"
  | "commercial_readiness_redaction_applied";

export type CommercialReference = {
  referenceId: string;
  referenceType: CommercialReferenceType;
  status: CommercialReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type CommercialRestriction = {
  restrictionId: string;
  restrictionType: CommercialReferenceType | "commercialization" | "billing_execution" | "public_self_service";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type CommercialCanonicalEvent = {
  eventType: CommercialCanonicalEventType;
  action: string;
  status: CommercialReadinessStatus;
  resourceType: "commercial_readiness_profile";
  resourceId: string;
  summary: string;
};

export type CommercialReadinessProfile = {
  commercialReadinessId: string;
  status: CommercialReadinessStatus;
  manualApprovalRequired: true;
  autonomousBillingEnabled: false;
  autonomousCommercializationEnabled: false;
  publicSelfServiceEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  pricingReferences: CommercialReference[];
  billingReferences: CommercialReference[];
  subscriptionReferences: CommercialReference[];
  onboardingReferences: CommercialReference[];
  supportReferences: CommercialReference[];
  operationalRiskReferences: CommercialReference[];
  releaseReferences: CommercialReference[];
  reviewReferences: CommercialReference[];
  evidenceReferences: CommercialReference[];
  auditReferences: CommercialReference[];
  commercialRestrictions: CommercialRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: CommercialCanonicalEvent[];
};

export type DeriveCommercialReadinessProfileInput = {
  readinessKey?: unknown;
  generatedAt?: unknown;
  pricingReadiness?: Array<Record<string, any>> | null;
  billingReadiness?: Array<Record<string, any>> | null;
  subscriptionReadiness?: Array<Record<string, any>> | null;
  enterpriseOnboardingReadiness?: Array<Record<string, any>> | null;
  supportReadiness?: Array<Record<string, any>> | null;
  operationalRiskProfiles?: Array<Record<string, any>> | null;
  releaseGovernanceProfiles?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
