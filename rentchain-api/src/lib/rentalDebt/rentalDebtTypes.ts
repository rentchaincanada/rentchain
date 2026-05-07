export type RentalDebtStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";

export type DebtReferenceType = "payment_default" | "delinquency" | "dispute" | "consent" | "review" | "evidence" | "audit";
export type DebtReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type RentalDebtCanonicalEventType =
  | "rental_debt_profile_derived"
  | "rental_debt_review_required"
  | "rental_debt_blocked"
  | "rental_debt_restriction_detected"
  | "rental_debt_redaction_applied";

export type DebtReference = {
  referenceId: string;
  referenceType: DebtReferenceType;
  status: DebtReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type DebtRestriction = {
  restrictionId: string;
  restrictionType: DebtReferenceType | "collections_execution" | "bureau_reporting" | "public_debt_exposure";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type RentalDebtCanonicalEvent = {
  eventType: RentalDebtCanonicalEventType;
  action: string;
  status: RentalDebtStatus;
  resourceType: "rental_debt_profile";
  resourceId: string;
  summary: string;
};

export type RentalDebtProfile = {
  rentalDebtId: string;
  status: RentalDebtStatus;
  landlordId: string;
  tenantId: string;
  manualReviewRequired: true;
  collectionsExecutionEnabled: false;
  bureauReportingEnabled: false;
  publicDebtExposureEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  paymentDefaultReferences: DebtReference[];
  delinquencyReferences: DebtReference[];
  disputeReferences: DebtReference[];
  consentReferences: DebtReference[];
  reviewReferences: DebtReference[];
  evidenceReferences: DebtReference[];
  auditReferences: DebtReference[];
  debtRestrictions: DebtRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: RentalDebtCanonicalEvent[];
};

export type DeriveRentalDebtProfileInput = {
  landlordId?: unknown;
  tenantId?: unknown;
  generatedAt?: unknown;
  paymentDefaultRecords?: Array<Record<string, any>> | null;
  delinquencyRecords?: Array<Record<string, any>> | null;
  disputeRecords?: Array<Record<string, any>> | null;
  consentRecords?: Array<Record<string, any>> | null;
  reviewRecords?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
