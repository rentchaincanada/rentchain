export type BusinessVerificationStatus =
  | "not_started"
  | "self_asserted"
  | "pending"
  | "completed"
  | "failed"
  | "expired"
  | "revoked"
  | "manual_review_required";

export type PropertyVerificationStatus =
  | "not_started"
  | "self_asserted"
  | "registry_linked"
  | "pending"
  | "completed"
  | "failed"
  | "expired"
  | "revoked"
  | "manual_review_required";

export type OperatorAuthorityStatus =
  | "not_asserted"
  | "self_asserted"
  | "partially_supported"
  | "externally_supported"
  | "institution_reviewed"
  | "expired"
  | "revoked"
  | "manual_review_required";

export type RegistryLinkStatus =
  | "not_linked"
  | "pid_present"
  | "syntax_validated"
  | "linked"
  | "partial_match"
  | "unverified"
  | "source_unavailable"
  | "manual_review_required";

export type AuthorityConfidenceLevel = "none" | "low" | "medium" | "high";

export type PropertyAuthorityRelationshipType =
  | "none"
  | "landlord_asserted"
  | "manager_asserted"
  | "operator_asserted"
  | "agent_authorized"
  | "registry_linked"
  | "institution_reviewed";

export type PropertyTrustSubjectType =
  | "landlord"
  | "organization"
  | "business_entity"
  | "property"
  | "operator"
  | "property_account_relationship";

export type PropertyVerificationEvidenceType =
  | "metadata_only"
  | "self_assertion"
  | "registry_record"
  | "property_record"
  | "business_record"
  | "operator_review"
  | "management_agreement_reference"
  | "institution_reference"
  | "future_provider_reference";

export type PropertyVerificationProviderType =
  | "none"
  | "public_registry"
  | "business_registry"
  | "title_registry"
  | "operator_review"
  | "institution_review"
  | "future_provider";

export type PropertyTrustConsentPurpose =
  | "business_verification"
  | "property_verification"
  | "operator_authority"
  | "registry_linkage"
  | "institutional_export"
  | "support_review"
  | "future_provider_orchestration";

export type PropertyTrustConsentScope = {
  consentId: string | null;
  purpose: PropertyTrustConsentPurpose;
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  institutionRecipientType: "none" | "insurer" | "lender" | "government" | "auditor" | "future_institution";
  attributeScopes: string[];
};

export type PropertyTrustRetentionClass =
  | "authority_metadata"
  | "registry_reference"
  | "provider_reference"
  | "support_diagnostics"
  | "audit_record";

export type PropertyVerificationAttestation = {
  attestationId: string;
  subjectType: PropertyTrustSubjectType;
  subjectId: string;
  propertyId: string | null;
  accountId: string | null;
  businessId: string | null;
  relationshipType: PropertyAuthorityRelationshipType;
  businessStatus: BusinessVerificationStatus;
  propertyStatus: PropertyVerificationStatus;
  operatorAuthorityStatus: OperatorAuthorityStatus;
  registryLinkStatus: RegistryLinkStatus;
  evidenceType: PropertyVerificationEvidenceType;
  providerType: PropertyVerificationProviderType;
  providerKey: string | null;
  providerReferenceId: string | null;
  evidenceRef: string | null;
  confidence: AuthorityConfidenceLevel;
  consentScope: PropertyTrustConsentScope;
  retentionClass: PropertyTrustRetentionClass;
  issuedAt: string | null;
  completedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  nextReverificationAt: string | null;
  auditEventRef: string | null;
  metadataOnly: true;
  rawSensitivePayloadStored: false;
  supportVisible: boolean;
  publicShareable: false;
  onboardingBlocking: false;
  executionEligible: false;
  legalOwnershipConclusion: false;
  reviewRequired: boolean;
  redacted: boolean;
};

export type PropertyTrustEventType =
  | "business_verification_started"
  | "business_verification_completed"
  | "property_verification_started"
  | "property_registry_linked"
  | "operator_authority_confirmed"
  | "property_verification_expired"
  | "property_reverification_required";

export type PropertyTrustEventDescriptor = {
  eventType: PropertyTrustEventType;
  action: string;
  subjectType: PropertyTrustSubjectType;
  subjectId: string;
  authorityConfidence: AuthorityConfidenceLevel;
  summary: string;
  metadataOnly: true;
};

export type PropertyTrustSupportAttestationSummary = {
  attestationId: string;
  subjectType: PropertyTrustSubjectType;
  relationshipType: PropertyAuthorityRelationshipType;
  businessStatus: BusinessVerificationStatus;
  propertyStatus: PropertyVerificationStatus;
  operatorAuthorityStatus: OperatorAuthorityStatus;
  registryLinkStatus: RegistryLinkStatus;
  providerType: PropertyVerificationProviderType;
  providerKey: string | null;
  providerReferenceRedacted: string | null;
  evidenceRefRedacted: string | null;
  confidence: AuthorityConfidenceLevel;
  consentPurpose: PropertyTrustConsentPurpose;
  retentionClass: PropertyTrustRetentionClass;
  completedAt: string | null;
  expiresAt: string | null;
  nextReverificationAt: string | null;
  reviewRequired: boolean;
};

export type PropertyTrustSupportSummary = {
  visibleToSupport: true;
  rawTitleDocumentVisible: false;
  rawRegistryPayloadVisible: false;
  rawBankingPayloadVisible: false;
  legalOwnershipConclusionVisible: false;
  attestations: PropertyTrustSupportAttestationSummary[];
};

export type PropertyTrustSummary = {
  subjectType: PropertyTrustSubjectType;
  subjectId: string;
  propertyId: string | null;
  accountId: string | null;
  businessId: string | null;
  businessStatus: BusinessVerificationStatus;
  propertyStatus: PropertyVerificationStatus;
  operatorAuthorityStatus: OperatorAuthorityStatus;
  registryLinkStatus: RegistryLinkStatus;
  relationshipType: PropertyAuthorityRelationshipType;
  authorityConfidence: AuthorityConfidenceLevel;
  trustLabel: string;
  trustDescription: string;
  providerCategory: PropertyVerificationProviderType;
  consentRequired: true;
  consentAvailable: boolean;
  retentionClass: PropertyTrustRetentionClass;
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
  supportSummary: PropertyTrustSupportSummary;
  redactions: string[];
  reviewReasons: string[];
  canonicalEvents: PropertyTrustEventDescriptor[];
  generatedAt: string;
};

export type DerivePropertyTrustSummaryInput = {
  subjectType?: unknown;
  subjectId?: unknown;
  propertyId?: unknown;
  accountId?: unknown;
  businessId?: unknown;
  attestations?: PropertyVerificationAttestation[] | null;
  generatedAt?: unknown;
};
