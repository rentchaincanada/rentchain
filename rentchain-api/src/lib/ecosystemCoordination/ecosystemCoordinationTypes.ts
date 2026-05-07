export type EcosystemCoordinationStatus = "stable" | "attention_required" | "review_required" | "blocked" | "unknown";

export type EcosystemCoordinationReferenceType =
  | "participant"
  | "trust"
  | "onboarding"
  | "risk"
  | "integration"
  | "settlement"
  | "regulatory"
  | "observability"
  | "governance"
  | "evidence"
  | "review"
  | "audit";

export type EcosystemCoordinationReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type EcosystemCoordinationCanonicalEventType =
  | "ecosystem_coordination_snapshot_derived"
  | "ecosystem_coordination_review_required"
  | "ecosystem_coordination_blocked"
  | "ecosystem_coordination_restriction_detected"
  | "ecosystem_coordination_redaction_applied";

export type EcosystemCoordinationReference = {
  referenceId: string;
  referenceType: EcosystemCoordinationReferenceType;
  status: EcosystemCoordinationReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type EcosystemRestriction = {
  restrictionId: string;
  restrictionType: EcosystemCoordinationReferenceType | "orchestration" | "external_execution" | "public_networking";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type EcosystemCoordinationCanonicalEvent = {
  eventType: EcosystemCoordinationCanonicalEventType;
  action: string;
  status: EcosystemCoordinationStatus;
  resourceType: "ecosystem_coordination_snapshot";
  resourceId: string;
  summary: string;
};

export type EcosystemCoordinationSnapshot = {
  ecosystemCoordinationId: string;
  status: EcosystemCoordinationStatus;
  manualReviewRequired: true;
  autonomousCoordinationEnabled: false;
  externalExecutionEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  participantReferences: EcosystemCoordinationReference[];
  trustReferences: EcosystemCoordinationReference[];
  onboardingReferences: EcosystemCoordinationReference[];
  riskReferences: EcosystemCoordinationReference[];
  integrationReferences: EcosystemCoordinationReference[];
  settlementReferences: EcosystemCoordinationReference[];
  regulatoryReferences: EcosystemCoordinationReference[];
  observabilityReferences: EcosystemCoordinationReference[];
  governanceReferences: EcosystemCoordinationReference[];
  reviewReferences: EcosystemCoordinationReference[];
  evidenceReferences: EcosystemCoordinationReference[];
  auditReferences: EcosystemCoordinationReference[];
  ecosystemRestrictions: EcosystemRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: EcosystemCoordinationCanonicalEvent[];
};

export type DeriveEcosystemCoordinationSnapshotInput = {
  coordinationKey?: unknown;
  generatedAt?: unknown;
  networkParticipants?: Array<Record<string, any>> | null;
  trustRelationships?: Array<Record<string, any>> | null;
  onboardingReadiness?: Array<Record<string, any>> | null;
  operationalRiskProfiles?: Array<Record<string, any>> | null;
  interoperabilityAdapterReadiness?: Array<Record<string, any>> | null;
  controlledIntegrationProfiles?: Array<Record<string, any>> | null;
  settlementReadiness?: Array<Record<string, any>> | null;
  regulatoryProfiles?: Array<Record<string, any>> | null;
  observabilityReadiness?: Array<Record<string, any>> | null;
  releaseGovernanceProfiles?: Array<Record<string, any>> | null;
  publicExposureHardeningProfiles?: Array<Record<string, any>> | null;
  commercialReadinessProfiles?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
