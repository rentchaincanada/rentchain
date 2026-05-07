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

export type PlatformCredentialingCanonicalEventType =
  | "platform_credentialing_readiness_derived"
  | "platform_credentialing_review_required"
  | "platform_credentialing_blocked"
  | "platform_credentialing_restriction_detected"
  | "platform_credentialing_redaction_applied";

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

export type PlatformCredentialingCanonicalEvent = {
  eventType: PlatformCredentialingCanonicalEventType;
  action: string;
  status: PlatformCredentialingStatus;
  resourceType: "platform_credentialing_readiness";
  resourceId: string;
  summary: string;
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
  canonicalEvents: PlatformCredentialingCanonicalEvent[];
};

export type DerivePlatformCredentialingReadinessInput = {
  readinessKey?: unknown;
  generatedAt?: unknown;
  governanceReadiness?: Array<Record<string, any>> | null;
  privacyReadiness?: Array<Record<string, any>> | null;
  consentGovernance?: Array<Record<string, any>> | null;
  auditLineage?: Array<Record<string, any>> | null;
  verificationReadiness?: Array<Record<string, any>> | null;
  interoperabilityReadiness?: Array<Record<string, any>> | null;
  institutionOnboardingReadiness?: Array<Record<string, any>> | null;
  operationalRiskProfiles?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
};
