export type ConsumerReportingGovernanceStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";

export type ReportingReferenceType =
  | "consent"
  | "dispute"
  | "adverse_action"
  | "credentialing"
  | "review"
  | "evidence"
  | "audit";

export type ReportingReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type ConsumerReportingCanonicalEventType =
  | "consumer_reporting_governance_profile_derived"
  | "consumer_reporting_review_required"
  | "consumer_reporting_blocked"
  | "consumer_reporting_restriction_detected"
  | "consumer_reporting_redaction_applied";

export type ReportingReference = {
  referenceId: string;
  referenceType: ReportingReferenceType;
  status: ReportingReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type ReportingRestriction = {
  restrictionId: string;
  restrictionType: ReportingReferenceType | "bureau_execution" | "collections_execution" | "public_scoring";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type ConsumerReportingCanonicalEvent = {
  eventType: ConsumerReportingCanonicalEventType;
  action: string;
  status: ConsumerReportingGovernanceStatus;
  resourceType: "consumer_reporting_governance_profile";
  resourceId: string;
  summary: string;
};

export type ConsumerReportingGovernanceProfile = {
  consumerReportingGovernanceId: string;
  status: ConsumerReportingGovernanceStatus;
  manualApprovalRequired: true;
  consumerReportingExecutionEnabled: false;
  autonomousReportingEnabled: false;
  publicReportingExposureEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  consentReferences: ReportingReference[];
  disputeReferences: ReportingReference[];
  adverseActionReferences: ReportingReference[];
  credentialingReferences: ReportingReference[];
  reviewReferences: ReportingReference[];
  evidenceReferences: ReportingReference[];
  auditReferences: ReportingReference[];
  reportingRestrictions: ReportingRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: ConsumerReportingCanonicalEvent[];
};

export type DeriveConsumerReportingGovernanceProfileInput = {
  governanceKey?: unknown;
  generatedAt?: unknown;
  consentGovernance?: Array<Record<string, any>> | null;
  disputeGovernance?: Array<Record<string, any>> | null;
  adverseActionReadiness?: Array<Record<string, any>> | null;
  credentialingReadiness?: Array<Record<string, any>> | null;
  operationalRiskProfiles?: Array<Record<string, any>> | null;
  rentalHistoryLineage?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
