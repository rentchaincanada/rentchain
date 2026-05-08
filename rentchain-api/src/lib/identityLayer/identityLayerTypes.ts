import type { AccountTrustStateSummary } from "../accountTrust";
import type { IdentityAssuranceAttestation, IdentityAssuranceSummary } from "../identityAssurance";

export type IdentityLayerType = "tenant" | "property" | "organization" | "operator" | "review_actor";

export type IdentityLayerStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";

export type IdentityLayerEventType =
  | "identity_profile_derived"
  | "identity_verification_reference_attached"
  | "identity_consent_reference_attached"
  | "identity_review_required"
  | "identity_blocked";

export type IdentityLayerReference = {
  referenceId: string;
  referenceType:
    | "tenant_profile"
    | "property_registry"
    | "organization"
    | "operator_review"
    | "canonical_event"
    | "screening"
    | "consent"
    | "evidence"
    | "unknown";
  label: string;
  status: "available" | "missing" | "blocked" | "redacted";
  destination: string | null;
  occurredAt: string | null;
  redacted: boolean;
  blockedReason: string | null;
};

export type IdentityLayerCanonicalEvent = {
  eventType: IdentityLayerEventType;
  action: string;
  status: IdentityLayerStatus;
  resourceType: IdentityLayerType;
  resourceId: string;
  summary: string;
};

export type IdentityLayerProfile = {
  identityId: string;
  identityType: IdentityLayerType;
  status: IdentityLayerStatus;
  manualReviewRequired: true;
  publiclyShareable: false;
  externalInstitutionSharingEnabled: false;
  tokenizationEnabled: false;
  verificationSummary: {
    totalReferences: number;
    verifiedReferences: number;
    missingReferences: number;
    blockedReferences: number;
  };
  consentSummary: {
    consentAvailable: boolean;
    consentScope: string[];
    consentReferences: number;
    missingConsentReasons: string[];
  };
  portabilitySummary: {
    portableReferenceAvailable: boolean;
    portabilityStatus: "ready" | "limited" | "not_ready";
    blockedReasons: string[];
  };
  trustState: AccountTrustStateSummary;
  identityAssurance: IdentityAssuranceSummary;
  lineageReferences: IdentityLayerReference[];
  verificationReferences: IdentityLayerReference[];
  consentReferences: IdentityLayerReference[];
  reviewReferences: IdentityLayerReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: IdentityLayerCanonicalEvent[];
  generatedAt: string;
};

export type DeriveIdentityProfileInput = {
  identityType?: unknown;
  identityId?: unknown;
  generatedAt?: unknown;
  tenant?: Record<string, unknown> | null;
  property?: Record<string, unknown> | null;
  organization?: Record<string, unknown> | null;
  operator?: Record<string, unknown> | null;
  registryStatus?: Record<string, unknown> | null;
  reviewSessions?: Array<Record<string, unknown>> | null;
  canonicalEvents?: Array<Record<string, unknown>> | null;
  consentRecords?: Array<Record<string, unknown>> | null;
  identityAssuranceAttestations?: IdentityAssuranceAttestation[] | null;
};
