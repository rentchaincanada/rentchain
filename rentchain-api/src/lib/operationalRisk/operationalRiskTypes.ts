export type OperationalRiskScope = "property" | "lease" | "participant" | "institution" | "workflow" | "onboarding" | "settlement" | "regulatory";

export type OperationalRiskStatus = "stable" | "attention_required" | "elevated" | "blocked" | "unknown";

export type OperationalRiskType =
  | "review_gap"
  | "evidence_gap"
  | "settlement_inconsistency"
  | "workflow_instability"
  | "delinquency_exposure"
  | "onboarding_blocker"
  | "regulatory_restriction"
  | "audit_gap"
  | "trust_restriction";

export type OperationalRiskReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type OperationalRiskSeverity = "low" | "moderate" | "elevated" | "critical";

export type OperationalRiskCanonicalEventType =
  | "operational_risk_profile_derived"
  | "operational_risk_restriction_detected"
  | "operational_risk_review_required"
  | "operational_risk_blocked"
  | "operational_risk_redaction_applied";

export type OperationalRiskReference = {
  riskReferenceId: string;
  riskType: OperationalRiskType;
  status: OperationalRiskReferenceStatus;
  severity: OperationalRiskSeverity;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type OperationalRiskCanonicalEvent = {
  eventType: OperationalRiskCanonicalEventType;
  action: string;
  status: OperationalRiskStatus;
  resourceType: "operational_risk";
  resourceId: string;
  summary: string;
};

export type OperationalRiskProfile = {
  operationalRiskId: string;
  riskScope: OperationalRiskScope;
  status: OperationalRiskStatus;
  manualReviewRequired: true;
  autonomousRiskActionsEnabled: false;
  publicRiskExposureEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    lowSeverityReferences: number;
    moderateSeverityReferences: number;
    elevatedSeverityReferences: number;
    criticalSeverityReferences: number;
  };
  riskReferences: OperationalRiskReference[];
  evidenceReferences: OperationalRiskReference[];
  reviewReferences: OperationalRiskReference[];
  settlementReferences: OperationalRiskReference[];
  regulatoryReferences: OperationalRiskReference[];
  onboardingReferences: OperationalRiskReference[];
  trustReferences: OperationalRiskReference[];
  workflowReferences: OperationalRiskReference[];
  delinquencyReferences: OperationalRiskReference[];
  auditReferences: OperationalRiskReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: OperationalRiskCanonicalEvent[];
};

export type DeriveOperationalRiskProfileInput = {
  landlordId?: unknown;
  riskScope?: unknown;
  generatedAt?: unknown;
  evidencePacks?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  settlementReadiness?: Record<string, any> | null;
  regulatoryProfiles?: Array<Record<string, any>> | null;
  institutionOnboardingReadiness?: Array<Record<string, any>> | null;
  trustRelationships?: Array<Record<string, any>> | null;
  automatedWorkflows?: Array<Record<string, any>> | null;
  delinquencySignals?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
