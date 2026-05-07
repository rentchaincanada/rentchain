export type CourtDisputeLineageStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";

export type CourtDisputeReferenceType =
  | "dispute"
  | "court_record"
  | "filing_readiness"
  | "judgment_order"
  | "rental_debt"
  | "consent"
  | "review"
  | "evidence"
  | "audit";
export type CourtDisputeReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type CourtDisputeCanonicalEventType =
  | "court_dispute_lineage_profile_derived"
  | "court_dispute_lineage_review_required"
  | "court_dispute_lineage_blocked"
  | "court_dispute_lineage_restriction_detected"
  | "court_dispute_lineage_redaction_applied";

export type CourtDisputeReference = {
  referenceId: string;
  referenceType: CourtDisputeReferenceType;
  status: CourtDisputeReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type CourtDisputeRestriction = {
  restrictionId: string;
  restrictionType:
    | CourtDisputeReferenceType
    | "legal_filing_execution"
    | "collections_execution"
    | "bureau_reporting"
    | "public_court_record_exposure";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type CourtDisputeCanonicalEvent = {
  eventType: CourtDisputeCanonicalEventType;
  action: string;
  status: CourtDisputeLineageStatus;
  resourceType: "court_dispute_lineage_profile";
  resourceId: string;
  summary: string;
};

export type CourtDisputeLineageProfile = {
  courtDisputeLineageId: string;
  status: CourtDisputeLineageStatus;
  landlordId: string;
  tenantId: string;
  manualReviewRequired: true;
  legalFilingExecutionEnabled: false;
  collectionsExecutionEnabled: false;
  bureauReportingEnabled: false;
  publicCourtRecordExposureEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  disputeReferences: CourtDisputeReference[];
  courtRecordReferences: CourtDisputeReference[];
  filingReadinessReferences: CourtDisputeReference[];
  judgmentOrderReferences: CourtDisputeReference[];
  rentalDebtReferences: CourtDisputeReference[];
  consentReferences: CourtDisputeReference[];
  reviewReferences: CourtDisputeReference[];
  evidenceReferences: CourtDisputeReference[];
  auditReferences: CourtDisputeReference[];
  courtDisputeRestrictions: CourtDisputeRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: CourtDisputeCanonicalEvent[];
};

export type DeriveCourtDisputeLineageProfileInput = {
  landlordId?: unknown;
  tenantId?: unknown;
  generatedAt?: unknown;
  disputeRecords?: Array<Record<string, any>> | null;
  courtRecordReferences?: Array<Record<string, any>> | null;
  filingReadinessReferences?: Array<Record<string, any>> | null;
  judgmentOrderReferences?: Array<Record<string, any>> | null;
  rentalDebtReferences?: Array<Record<string, any>> | null;
  consentRecords?: Array<Record<string, any>> | null;
  reviewRecords?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
