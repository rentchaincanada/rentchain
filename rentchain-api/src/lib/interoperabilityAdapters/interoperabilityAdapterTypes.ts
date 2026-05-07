export type InteroperabilityAdapterType = "lender" | "insurer" | "regulator" | "registry" | "accounting" | "payment_provider" | "operational_partner";

export type InteroperabilityAdapterStatus = "ready_for_review" | "partially_ready" | "review_required" | "blocked" | "unknown";

export type InteroperabilityAdapterReferenceType = "compatibility" | "settlement" | "regulatory" | "evidence" | "review" | "sharing" | "audit";

export type InteroperabilityAdapterReferenceStatus = "verified" | "partially_verified" | "blocked" | "unavailable";

export type InteroperabilityAdapterCanonicalEventType =
  | "interoperability_adapter_readiness_derived"
  | "interoperability_adapter_review_required"
  | "interoperability_adapter_blocked"
  | "interoperability_adapter_restriction_detected"
  | "interoperability_adapter_redaction_applied";

export type InteroperabilityAdapterReference = {
  referenceId: string;
  referenceType: InteroperabilityAdapterReferenceType;
  status: InteroperabilityAdapterReferenceStatus;
  label: string;
  description: string;
  reviewRequired: true;
  lineageReferences: string[];
  destination: string | null;
  redacted: boolean;
  redactionReason: string | null;
  blockedReason: string | null;
};

export type InteroperabilityAdapterRestriction = {
  restrictionId: string;
  restrictionType: "compatibility" | "settlement" | "regulatory" | "evidence" | "review" | "sharing" | "audit" | "risk";
  status: "visible" | "blocked" | "review_required";
  label: string;
  description: string;
  blockedReason: string | null;
};

export type InteroperabilityAdapterCanonicalEvent = {
  eventType: InteroperabilityAdapterCanonicalEventType;
  action: string;
  status: InteroperabilityAdapterStatus;
  resourceType: "interoperability_adapter_readiness";
  resourceId: string;
  summary: string;
};

export type InteroperabilityAdapterReadiness = {
  adapterReadinessId: string;
  adapterType: InteroperabilityAdapterType;
  status: InteroperabilityAdapterStatus;
  manualReviewRequired: true;
  liveIntegrationEnabled: false;
  externalSynchronizationEnabled: false;
  generatedAt: string;
  summary: {
    totalReferences: number;
    verifiedReferences: number;
    partiallyVerifiedReferences: number;
    blockedReferences: number;
    unavailableReferences: number;
    restrictions: number;
  };
  compatibilityReferences: InteroperabilityAdapterReference[];
  settlementReferences: InteroperabilityAdapterReference[];
  regulatoryReferences: InteroperabilityAdapterReference[];
  evidenceReferences: InteroperabilityAdapterReference[];
  reviewReferences: InteroperabilityAdapterReference[];
  sharingReferences: InteroperabilityAdapterReference[];
  auditReferences: InteroperabilityAdapterReference[];
  adapterRestrictions: InteroperabilityAdapterRestriction[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: InteroperabilityAdapterCanonicalEvent[];
};

export type DeriveInteroperabilityAdapterReadinessInput = {
  landlordId?: unknown;
  adapterType?: unknown;
  generatedAt?: unknown;
  operationalRiskProfiles?: Array<Record<string, any>> | null;
  institutionOnboardingReadiness?: Array<Record<string, any>> | null;
  trustRelationships?: Array<Record<string, any>> | null;
  sharingRooms?: Array<Record<string, any>> | null;
  settlementReadiness?: Record<string, any> | null;
  regulatoryProfiles?: Array<Record<string, any>> | null;
  evidencePacks?: Array<Record<string, any>> | null;
  operatorReviewSessions?: Array<Record<string, any>> | null;
  auditEvents?: Array<Record<string, any>> | null;
};
