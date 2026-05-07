export type ProductionIntegrationType =
  | "registry"
  | "accounting_export"
  | "screening_provider"
  | "lender_handoff"
  | "webhook_ingestion"
  | "operational_partner";

export type ProductionIntegrationStatus = "disabled" | "sandbox_ready" | "production_review_required" | "partially_ready" | "blocked";

export type ProductionIntegrationReferenceType = "activation" | "observability" | "rollback" | "governance" | "review" | "evidence" | "audit";
export type ProductionIntegrationReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type ProductionIntegrationCanonicalEventType =
  | "production_integration_profile_derived"
  | "production_integration_review_required"
  | "production_integration_blocked"
  | "production_integration_sandbox_ready"
  | "production_integration_redaction_applied";

export type ProductionIntegrationReference = {
  referenceId: string;
  referenceType: ProductionIntegrationReferenceType;
  status: ProductionIntegrationReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type ProductionIntegrationRestriction = {
  restrictionId: string;
  restrictionType:
    | ProductionIntegrationReferenceType
    | "operational_risk"
    | "regulatory"
    | "payment_execution"
    | "settlement_execution"
    | "unrestricted_webhook_execution"
    | "autonomous_provider_orchestration"
    | "external_mutation";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type ProductionIntegrationCanonicalEvent = {
  eventType: ProductionIntegrationCanonicalEventType;
  action: string;
  status: ProductionIntegrationStatus;
  resourceType: "production_integration_profile";
  resourceId: string;
  summary: string;
};

export type ProductionIntegrationProfile = {
  productionIntegrationId: string;
  integrationType: ProductionIntegrationType;
  status: ProductionIntegrationStatus;
  manualApprovalRequired: true;
  autonomousExecutionEnabled: false;
  paymentExecutionEnabled: false;
  unrestrictedWebhookExecutionEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  activationReferences: ProductionIntegrationReference[];
  observabilityReferences: ProductionIntegrationReference[];
  rollbackReferences: ProductionIntegrationReference[];
  reviewReferences: ProductionIntegrationReference[];
  evidenceReferences: ProductionIntegrationReference[];
  governanceReferences: ProductionIntegrationReference[];
  auditReferences: ProductionIntegrationReference[];
  integrationRestrictions: ProductionIntegrationRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: ProductionIntegrationCanonicalEvent[];
};

export type DeriveProductionIntegrationProfileInput = {
  integrationKey?: unknown;
  integrationType?: unknown;
  generatedAt?: unknown;
  activationMetadata?: Array<Record<string, any>> | Record<string, any> | null;
  adapterReadiness?: Array<Record<string, any>> | null;
  controlledIntegrationProfiles?: Array<Record<string, any>> | null;
  observabilityIncidentReadiness?: Array<Record<string, any>> | null;
  releaseGovernanceProfiles?: Array<Record<string, any>> | null;
  supportOperationsProfiles?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  operationalRiskProfiles?: Array<Record<string, any>> | null;
  regulatoryProfiles?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
