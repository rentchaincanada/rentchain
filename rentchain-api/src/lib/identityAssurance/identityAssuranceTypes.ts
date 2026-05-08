export type IdentityAssuranceSubjectType =
  | "tenant"
  | "landlord"
  | "applicant"
  | "property_operator"
  | "business_entity"
  | "organization"
  | "property";

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

export type IdentityAssuranceConsentPurpose =
  | "identity_assurance"
  | "business_assurance"
  | "property_authority"
  | "institutional_export"
  | "support_review"
  | "future_provider_orchestration";

export type IdentityAssuranceConsentScope = {
  consentId: string | null;
  purpose: IdentityAssuranceConsentPurpose;
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  institutionRecipientType: "none" | "landlord" | "insurer" | "lender" | "government" | "auditor" | "future_institution";
  attributeScopes: string[];
};

export type IdentityAssuranceRetentionClass =
  | "assurance_metadata"
  | "provider_reference"
  | "support_diagnostics"
  | "audit_record";

export type IdentityAssuranceAttestation = {
  attestationId: string;
  subjectType: IdentityAssuranceSubjectType;
  subjectId: string;
  level: IdentityAssuranceLevel;
  status: IdentityAssuranceStatus;
  lifecycleState: IdentityAssuranceLifecycleState;
  providerType: IdentityAssuranceProviderType;
  providerKey: string | null;
  providerReferenceId: string | null;
  evidenceRef: string | null;
  confidence: "low" | "medium" | "high";
  consentScope: IdentityAssuranceConsentScope;
  retentionClass: IdentityAssuranceRetentionClass;
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
  reviewRequired: boolean;
  redacted: boolean;
};

export type IdentityAssuranceEventType =
  | "identity_assurance_requested"
  | "identity_assurance_started"
  | "identity_assurance_completed"
  | "identity_assurance_failed"
  | "identity_assurance_expired"
  | "identity_assurance_revoked"
  | "identity_assurance_reverification_required";

export type IdentityAssuranceEventDescriptor = {
  eventType: IdentityAssuranceEventType;
  action: string;
  subjectType: IdentityAssuranceSubjectType;
  subjectId: string;
  status: IdentityAssuranceStatus;
  level: IdentityAssuranceLevel;
  summary: string;
  metadataOnly: true;
};

export type IdentityAssuranceSupportAttestationSummary = {
  attestationId: string;
  level: IdentityAssuranceLevel;
  status: IdentityAssuranceStatus;
  lifecycleState: IdentityAssuranceLifecycleState;
  providerType: IdentityAssuranceProviderType;
  providerKey: string | null;
  providerReferenceRedacted: string | null;
  evidenceRefRedacted: string | null;
  consentPurpose: IdentityAssuranceConsentPurpose;
  retentionClass: IdentityAssuranceRetentionClass;
  completedAt: string | null;
  expiresAt: string | null;
  nextReverificationAt: string | null;
  reviewRequired: boolean;
};

export type IdentityAssuranceSupportSummary = {
  visibleToSupport: true;
  rawProviderPayloadVisible: false;
  rawIdentityDocumentVisible: false;
  biometricPayloadVisible: false;
  identityDocumentNumberVisible: false;
  attestations: IdentityAssuranceSupportAttestationSummary[];
};

export type IdentityAssuranceSummary = {
  subjectType: IdentityAssuranceSubjectType;
  subjectId: string;
  status: IdentityAssuranceStatus;
  level: IdentityAssuranceLevel;
  lifecycleState: IdentityAssuranceLifecycleState;
  assuranceLabel: string;
  assuranceDescription: string;
  providerCategory: IdentityAssuranceProviderType;
  consentRequired: true;
  consentAvailable: boolean;
  retentionClass: IdentityAssuranceRetentionClass;
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
  supportSummary: IdentityAssuranceSupportSummary;
  redactions: string[];
  reviewReasons: string[];
  canonicalEvents: IdentityAssuranceEventDescriptor[];
  generatedAt: string;
};

export type DeriveIdentityAssuranceSummaryInput = {
  subjectType?: unknown;
  subjectId?: unknown;
  attestations?: IdentityAssuranceAttestation[] | null;
  generatedAt?: unknown;
};
