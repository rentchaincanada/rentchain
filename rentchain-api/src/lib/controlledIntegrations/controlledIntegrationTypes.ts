export type ControlledIntegrationType =
  | "registry"
  | "lender"
  | "insurer"
  | "regulator"
  | "accounting"
  | "payment_provider"
  | "operational_partner";

export type ControlledIntegrationStatus = "disabled" | "sandbox_ready" | "review_required" | "partially_ready" | "blocked";

export type ControlledIntegrationReferenceType =
  | "adapter"
  | "review"
  | "evidence"
  | "settlement"
  | "regulatory"
  | "observability"
  | "governance"
  | "audit";

export type ControlledIntegrationReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type ControlledIntegrationCanonicalEventType =
  | "controlled_integration_profile_derived"
  | "controlled_integration_review_required"
  | "controlled_integration_blocked"
  | "controlled_integration_sandbox_ready"
  | "controlled_integration_redaction_applied";

export type ControlledIntegrationReference = {
  referenceId: string;
  referenceType: ControlledIntegrationReferenceType;
  status: ControlledIntegrationReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type ControlledIntegrationRestriction = {
  restrictionId: string;
  restrictionType:
    | ControlledIntegrationReferenceType
    | "external_synchronization"
    | "webhook_execution"
    | "financial_execution"
    | "live_settlement"
    | "provider_execution";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type ControlledIntegrationCanonicalEvent = {
  eventType: ControlledIntegrationCanonicalEventType;
  action: string;
  status: ControlledIntegrationStatus;
  resourceType: "controlled_integration_profile";
  resourceId: string;
  summary: string;
};

export type ControlledIntegrationProfile = {
  controlledIntegrationId: string;
  integrationType: ControlledIntegrationType;
  status: ControlledIntegrationStatus;
  manualApprovalRequired: true;
  liveSynchronizationEnabled: false;
  autonomousExecutionEnabled: false;
  webhookExecutionEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  adapterReferences: ControlledIntegrationReference[];
  reviewReferences: ControlledIntegrationReference[];
  evidenceReferences: ControlledIntegrationReference[];
  settlementReferences: ControlledIntegrationReference[];
  regulatoryReferences: ControlledIntegrationReference[];
  observabilityReferences: ControlledIntegrationReference[];
  releaseGovernanceReferences: ControlledIntegrationReference[];
  auditReferences: ControlledIntegrationReference[];
  integrationRestrictions: ControlledIntegrationRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: ControlledIntegrationCanonicalEvent[];
};

export type DeriveControlledIntegrationProfileInput = {
  integrationKey?: unknown;
  integrationType?: unknown;
  generatedAt?: unknown;
  activationMetadata?: Record<string, any> | null;
  adapterReadiness?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  settlementReadiness?: Array<Record<string, any>> | null;
  regulatoryProfiles?: Array<Record<string, any>> | null;
  observabilityIncidentReadiness?: Array<Record<string, any>> | null;
  releaseGovernanceProfiles?: Array<Record<string, any>> | null;
  operationalRiskProfiles?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
