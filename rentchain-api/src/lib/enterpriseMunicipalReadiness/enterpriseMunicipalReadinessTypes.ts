export type EnterpriseMunicipalOrganizationType =
  | "municipality"
  | "affordable_housing_operator"
  | "institutional_landlord"
  | "enterprise_operator"
  | "government_program";

export type EnterpriseMunicipalReadinessStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";

export type EnterpriseMunicipalReferenceType =
  | "institutional"
  | "municipal"
  | "portfolio_governance"
  | "regulatory"
  | "operational_risk"
  | "review"
  | "evidence"
  | "audit";

export type EnterpriseMunicipalReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type EnterpriseMunicipalCanonicalEventType =
  | "enterprise_municipal_readiness_profile_derived"
  | "enterprise_municipal_review_required"
  | "enterprise_municipal_blocked"
  | "enterprise_municipal_restriction_detected"
  | "enterprise_municipal_redaction_applied";

export type EnterpriseMunicipalReference = {
  referenceId: string;
  referenceType: EnterpriseMunicipalReferenceType;
  status: EnterpriseMunicipalReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type EnterpriseMunicipalRestriction = {
  restrictionId: string;
  restrictionType:
    | EnterpriseMunicipalReferenceType
    | "government_integration"
    | "cmhc_submission"
    | "public_sector_export"
    | "portfolio_exposure"
    | "enterprise_onboarding_execution"
    | "institutional_orchestration";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type EnterpriseMunicipalCanonicalEvent = {
  eventType: EnterpriseMunicipalCanonicalEventType;
  action: string;
  status: EnterpriseMunicipalReadinessStatus;
  resourceType: "enterprise_municipal_readiness_profile";
  resourceId: string;
  summary: string;
};

export type EnterpriseMunicipalReadinessProfile = {
  enterpriseMunicipalReadinessId: string;
  organizationType: EnterpriseMunicipalOrganizationType;
  status: EnterpriseMunicipalReadinessStatus;
  manualApprovalRequired: true;
  autonomousGovernmentExecutionEnabled: false;
  autonomousEnterpriseExecutionEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  institutionalReferences: EnterpriseMunicipalReference[];
  portfolioGovernanceReferences: EnterpriseMunicipalReference[];
  municipalReadinessReferences: EnterpriseMunicipalReference[];
  regulatoryReferences: EnterpriseMunicipalReference[];
  operationalRiskReferences: EnterpriseMunicipalReference[];
  reviewReferences: EnterpriseMunicipalReference[];
  evidenceReferences: EnterpriseMunicipalReference[];
  auditReferences: EnterpriseMunicipalReference[];
  enterpriseRestrictions: EnterpriseMunicipalRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: EnterpriseMunicipalCanonicalEvent[];
};

export type DeriveEnterpriseMunicipalReadinessProfileInput = {
  readinessKey?: unknown;
  organizationType?: unknown;
  generatedAt?: unknown;
  institutionalReadiness?: Array<Record<string, any>> | null;
  portfolioGovernance?: Array<Record<string, any>> | null;
  municipalReadiness?: Array<Record<string, any>> | null;
  regulatoryProfiles?: Array<Record<string, any>> | null;
  operationalRiskProfiles?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
