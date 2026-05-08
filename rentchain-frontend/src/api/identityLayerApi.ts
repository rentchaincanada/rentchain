import { apiFetch } from "./apiFetch";

export type IdentityLayerType = "tenant" | "property" | "organization" | "operator" | "review_actor";
export type IdentityLayerStatus = "verified" | "partially_verified" | "review_required" | "blocked" | "unknown";

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

export type AccountTrustLevel =
  | "asserted"
  | "authenticated"
  | "platform_correlated"
  | "provider_attested"
  | "institution_reviewed";

export type VerificationSignalType =
  | "account_access"
  | "email"
  | "phone"
  | "screening"
  | "payment_method"
  | "lease_participation"
  | "identity"
  | "business"
  | "property"
  | "institution";

export type VerificationSignal = {
  signalId: string;
  signalType: VerificationSignalType;
  subjectType: "tenant" | "landlord" | "applicant" | "operator" | "organization" | "property";
  subjectId: string;
  status: "asserted" | "pending" | "verified" | "failed" | "expired" | "revoked" | "manual_review_required";
  source: string;
  evidenceType: string;
  confidence: "low" | "medium" | "high";
  providerKey: string | null;
  evidenceRef: string | null;
  issuedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  metadataOnly: true;
  rawSensitivePayloadStored: false;
  redacted: boolean;
  reviewRequired: boolean;
};

export type AccountTrustStateSummary = {
  subjectType: VerificationSignal["subjectType"];
  subjectId: string;
  trustLevel: AccountTrustLevel;
  trustLabel: string;
  trustDescription: string;
  manualReviewRequired: true;
  providerIntegrationEnabled: false;
  rawSensitivePayloadStored: false;
  executionEligible: false;
  externalSharingRequiresConsent: true;
  signalSummary: {
    totalSignals: number;
    assertedSignals: number;
    pendingSignals: number;
    verifiedSignals: number;
    providerAttestedSignals: number;
    expiredSignals: number;
    revokedSignals: number;
    reviewRequiredSignals: number;
  };
  activeSignals: VerificationSignal[];
  missingSignals: VerificationSignalType[];
  reviewReasons: string[];
  redactions: string[];
  canonicalEvents: Array<{
    eventType: string;
    action: string;
    subjectType: VerificationSignal["subjectType"];
    subjectId: string;
    trustLevel: AccountTrustLevel;
    summary: string;
    metadataOnly: true;
  }>;
  generatedAt: string;
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
  lineageReferences: IdentityLayerReference[];
  verificationReferences: IdentityLayerReference[];
  consentReferences: IdentityLayerReference[];
  reviewReferences: IdentityLayerReference[];
  redactions: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{
    eventType: string;
    action: string;
    status: IdentityLayerStatus;
    resourceType: IdentityLayerType;
    resourceId: string;
    summary: string;
  }>;
  generatedAt: string;
};

export type IdentityLayerProfileQuery = {
  identityType?: IdentityLayerType;
  identityId?: string;
};

export async function fetchIdentityLayerProfile(params?: IdentityLayerProfileQuery): Promise<IdentityLayerProfile> {
  const search = new URLSearchParams();
  if (params?.identityType) search.set("identityType", params.identityType);
  if (params?.identityId) search.set("identityId", params.identityId);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true; profile: IdentityLayerProfile }>(`/landlord/identity-layer/profile${suffix}`);
  return response.profile;
}
