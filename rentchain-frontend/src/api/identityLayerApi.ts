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

export type IdentityAssuranceLevel =
  | "not_assessed"
  | "account_controlled"
  | "platform_correlated"
  | "provider_identity_attested"
  | "business_attested"
  | "property_authority_attested"
  | "institution_reviewed";

export type IdentityAssuranceStatus =
  | "not_started"
  | "requested"
  | "pending"
  | "completed"
  | "failed"
  | "expired"
  | "revoked"
  | "manual_review_required";

export type IdentityAssuranceLifecycleState =
  | "not_started"
  | "consent_required"
  | "ready_to_start"
  | "in_progress"
  | "completed"
  | "reverification_required"
  | "manual_review_required"
  | "failed"
  | "revoked";

export type IdentityAssuranceProviderType =
  | "none"
  | "identity_provider"
  | "business_verification_provider"
  | "property_registry"
  | "financial_identity_provider"
  | "government_digital_credential"
  | "institution_review"
  | "operator_review"
  | "future_provider";

export type IdentityAssuranceSummary = {
  subjectType: "tenant" | "landlord" | "applicant" | "property_operator" | "business_entity" | "organization" | "property";
  subjectId: string;
  status: IdentityAssuranceStatus;
  level: IdentityAssuranceLevel;
  lifecycleState: IdentityAssuranceLifecycleState;
  assuranceLabel: string;
  assuranceDescription: string;
  providerCategory: IdentityAssuranceProviderType;
  consentRequired: true;
  consentAvailable: boolean;
  retentionClass: "assurance_metadata" | "provider_reference" | "support_diagnostics" | "audit_record";
  metadataOnly: true;
  rawSensitivePayloadStored: false;
  providerIntegrationEnabled: false;
  onboardingBlocking: false;
  publicShareable: false;
  executionEligible: false;
  reverificationRequired: boolean;
  nextReverificationAt: string | null;
  signalSummary: {
    totalAttestations: number;
    completedAttestations: number;
    pendingAttestations: number;
    failedAttestations: number;
    expiredAttestations: number;
    revokedAttestations: number;
    reviewRequiredAttestations: number;
  };
  supportSummary: {
    visibleToSupport: true;
    rawProviderPayloadVisible: false;
    rawIdentityDocumentVisible: false;
    biometricPayloadVisible: false;
    identityDocumentNumberVisible: false;
    attestations: Array<{
      attestationId: string;
      level: IdentityAssuranceLevel;
      status: IdentityAssuranceStatus;
      lifecycleState: IdentityAssuranceLifecycleState;
      providerType: IdentityAssuranceProviderType;
      providerKey: string | null;
      providerReferenceRedacted: string | null;
      evidenceRefRedacted: string | null;
      consentPurpose: string;
      retentionClass: string;
      completedAt: string | null;
      expiresAt: string | null;
      nextReverificationAt: string | null;
      reviewRequired: boolean;
    }>;
  };
  redactions: string[];
  reviewReasons: string[];
  canonicalEvents: Array<{
    eventType: string;
    action: string;
    subjectType: string;
    subjectId: string;
    status: IdentityAssuranceStatus;
    level: IdentityAssuranceLevel;
    summary: string;
    metadataOnly: true;
  }>;
  generatedAt: string;
};

export type PropertyTrustSummary = {
  subjectType: "landlord" | "organization" | "business_entity" | "property" | "operator" | "property_account_relationship";
  subjectId: string;
  propertyId: string | null;
  accountId: string | null;
  businessId: string | null;
  businessStatus:
    | "not_started"
    | "self_asserted"
    | "pending"
    | "completed"
    | "failed"
    | "expired"
    | "revoked"
    | "manual_review_required";
  propertyStatus:
    | "not_started"
    | "self_asserted"
    | "registry_linked"
    | "pending"
    | "completed"
    | "failed"
    | "expired"
    | "revoked"
    | "manual_review_required";
  operatorAuthorityStatus:
    | "not_asserted"
    | "self_asserted"
    | "partially_supported"
    | "externally_supported"
    | "institution_reviewed"
    | "expired"
    | "revoked"
    | "manual_review_required";
  registryLinkStatus:
    | "not_linked"
    | "pid_present"
    | "syntax_validated"
    | "linked"
    | "partial_match"
    | "unverified"
    | "source_unavailable"
    | "manual_review_required";
  relationshipType:
    | "none"
    | "landlord_asserted"
    | "manager_asserted"
    | "operator_asserted"
    | "agent_authorized"
    | "registry_linked"
    | "institution_reviewed";
  authorityConfidence: "none" | "low" | "medium" | "high";
  trustLabel: string;
  trustDescription: string;
  providerCategory: "none" | "public_registry" | "business_registry" | "title_registry" | "operator_review" | "institution_review" | "future_provider";
  consentRequired: true;
  consentAvailable: boolean;
  retentionClass: "authority_metadata" | "registry_reference" | "provider_reference" | "support_diagnostics" | "audit_record";
  metadataOnly: true;
  rawSensitivePayloadStored: false;
  liveRegistryIntegrationEnabled: false;
  onboardingBlocking: false;
  publicShareable: false;
  executionEligible: false;
  legalOwnershipConclusion: false;
  reverificationRequired: boolean;
  nextReverificationAt: string | null;
  signalSummary: {
    totalAttestations: number;
    businessCompletedAttestations: number;
    propertyCompletedAttestations: number;
    operatorAuthorityAttestations: number;
    registryLinkedAttestations: number;
    expiredAttestations: number;
    revokedAttestations: number;
    reviewRequiredAttestations: number;
  };
  supportSummary: {
    visibleToSupport: true;
    rawTitleDocumentVisible: false;
    rawRegistryPayloadVisible: false;
    rawBankingPayloadVisible: false;
    legalOwnershipConclusionVisible: false;
    attestations: Array<{
      attestationId: string;
      subjectType: string;
      relationshipType: string;
      businessStatus: string;
      propertyStatus: string;
      operatorAuthorityStatus: string;
      registryLinkStatus: string;
      providerType: string;
      providerKey: string | null;
      providerReferenceRedacted: string | null;
      evidenceRefRedacted: string | null;
      confidence: string;
      consentPurpose: string;
      retentionClass: string;
      completedAt: string | null;
      expiresAt: string | null;
      nextReverificationAt: string | null;
      reviewRequired: boolean;
    }>;
  };
  redactions: string[];
  reviewReasons: string[];
  canonicalEvents: Array<{
    eventType: string;
    action: string;
    subjectType: string;
    subjectId: string;
    authorityConfidence: string;
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
  identityAssurance: IdentityAssuranceSummary;
  propertyTrust: PropertyTrustSummary;
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
