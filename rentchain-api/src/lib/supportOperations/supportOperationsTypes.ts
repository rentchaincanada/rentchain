export type SupportOperationsStatus = "stable" | "attention_required" | "review_required" | "blocked" | "unknown";
export type SupportReferenceType = "support" | "onboarding" | "credentialing" | "incident" | "operational_risk" | "review" | "evidence" | "audit";
export type SupportReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type SupportOperationsCanonicalEventType =
  | "support_operations_profile_derived"
  | "support_operations_review_required"
  | "support_operations_blocked"
  | "support_operations_restriction_detected"
  | "support_operations_redaction_applied";

export type SupportOperationsReference = {
  referenceId: string;
  referenceType: SupportReferenceType;
  status: SupportReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type SupportOperationsRestriction = {
  restrictionId: string;
  restrictionType: SupportReferenceType | "autonomous_support_execution" | "admin_impersonation" | "operator_override" | "public_support_exposure";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type SupportOperationsCanonicalEvent = {
  eventType: SupportOperationsCanonicalEventType;
  action: string;
  status: SupportOperationsStatus;
  resourceType: "support_operations_profile";
  resourceId: string;
  summary: string;
};

export type SupportOperationsProfile = {
  supportOperationsId: string;
  status: SupportOperationsStatus;
  manualReviewRequired: true;
  autonomousSupportExecutionEnabled: false;
  adminImpersonationEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  supportReferences: SupportOperationsReference[];
  onboardingReferences: SupportOperationsReference[];
  credentialingReferences: SupportOperationsReference[];
  incidentReferences: SupportOperationsReference[];
  operationalRiskReferences: SupportOperationsReference[];
  reviewReferences: SupportOperationsReference[];
  evidenceReferences: SupportOperationsReference[];
  auditReferences: SupportOperationsReference[];
  supportRestrictions: SupportOperationsRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: SupportOperationsCanonicalEvent[];
};

export type DeriveSupportOperationsProfileInput = {
  supportOperationsKey?: unknown;
  generatedAt?: unknown;
  supportRecords?: Array<Record<string, any>> | null;
  onboardingRecords?: Array<Record<string, any>> | null;
  credentialingRecords?: Array<Record<string, any>> | null;
  incidentRecords?: Array<Record<string, any>> | null;
  operationalRiskRecords?: Array<Record<string, any>> | null;
  reviewRecords?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
