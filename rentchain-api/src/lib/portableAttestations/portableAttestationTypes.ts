export type PortableAttestationType =
  | "account_trust"
  | "identity_assurance"
  | "business_verification"
  | "property_authority"
  | "lease_participation"
  | "legal_document_metadata"
  | "tenant_portability"
  | "institution_review";

export type PortableAttestationSubjectType =
  | "tenant"
  | "landlord"
  | "applicant"
  | "operator"
  | "organization"
  | "business_entity"
  | "property"
  | "lease"
  | "legal_document";

export type PortableAttestationClaimCategory =
  | "account_control"
  | "identity_assurance"
  | "business_legitimacy"
  | "property_registry_linkage"
  | "property_authority"
  | "operator_authority"
  | "lease_participation"
  | "document_provenance"
  | "tenant_portability"
  | "payment_readiness"
  | "institution_review";

export type PortableAttestationStatus =
  | "pending_consent"
  | "active"
  | "expired"
  | "revoked"
  | "superseded"
  | "reverification_required"
  | "blocked";

export type PortableAttestationLifecycleState =
  | "draft"
  | "consent_required"
  | "export_ready"
  | "expired"
  | "revoked"
  | "superseded"
  | "reverification_required"
  | "blocked";

export type PortableAttestationAudience =
  | "tenant"
  | "landlord"
  | "insurer"
  | "lender"
  | "government"
  | "auditor"
  | "institutional_landlord"
  | "compliance_partner"
  | "future_institution";

export type PortableAttestationPurpose =
  | "tenant_controlled_sharing"
  | "landlord_controlled_sharing"
  | "insurance_review"
  | "lender_review"
  | "government_program_review"
  | "auditor_review"
  | "compliance_review"
  | "future_institution_review";

export type PortableAttestationRetentionClass =
  | "portable_metadata"
  | "export_metadata"
  | "audit_record";

export type PortableAttestationIssuerCategory =
  | "rentchain"
  | "identity_provider"
  | "business_verification_provider"
  | "property_registry"
  | "institution_review"
  | "operator_review"
  | "future_provider";

export type PortableAttestationEvidenceCategory =
  | "metadata_only"
  | "provider_reference"
  | "registry_record"
  | "trust_signal"
  | "legal_document_metadata"
  | "audit_event"
  | "institution_review";

export type PortableAttestationSourceSystem =
  | "account_trust"
  | "identity_assurance"
  | "property_trust"
  | "legal_document"
  | "tenant_share_package"
  | "institution_export"
  | "sharing_room";

export type PortableAttestationConsentScope = {
  consentId: string | null;
  purpose: PortableAttestationPurpose;
  audience: PortableAttestationAudience;
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  claimCategories: PortableAttestationClaimCategory[];
  attributeScopes: string[];
};

export type PortableAttestationEvidenceSummary = {
  evidenceCategory: PortableAttestationEvidenceCategory;
  sourceSystem: PortableAttestationSourceSystem;
  sourceCategory: string;
  sourceVersion: string | null;
  auditEventRef: string | null;
  rawEvidenceIncluded: false;
};

export type PortableAttestationSourceReference = {
  sourceSystem: PortableAttestationSourceSystem;
  sourceId: string;
  sourceAttestationId: string | null;
  sourceVersion: string | null;
};

export type PortableAttestation = {
  attestationId: string;
  attestationType: PortableAttestationType;
  subjectType: PortableAttestationSubjectType;
  subjectId: string;
  claimCategory: PortableAttestationClaimCategory;
  claimLabel: string;
  claimDescription: string;
  status: PortableAttestationStatus;
  lifecycleState: PortableAttestationLifecycleState;
  issuerCategory: PortableAttestationIssuerCategory;
  audience: PortableAttestationAudience;
  consentScope: PortableAttestationConsentScope;
  retentionClass: PortableAttestationRetentionClass;
  evidenceSummary: PortableAttestationEvidenceSummary;
  sourceReference: PortableAttestationSourceReference;
  confidence: "none" | "low" | "medium" | "high";
  issuedAt: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  supersededAt: string | null;
  nextReverificationAt: string | null;
  jurisdiction: string | null;
  redactionProfile: "strict" | "standard";
  metadataOnly: true;
  rawSensitivePayloadStored: false;
  rawProviderPayloadIncluded: false;
  supportMetadataIncluded: false;
  publicAccessEnabled: false;
  externalSubmissionEnabled: false;
  unsupportedClaim: false;
  supportVisible: boolean;
  reviewRequired: boolean;
  nonAuthorityDisclaimers: string[];
  internalReferenceId: string | null;
  providerReferenceId: string | null;
};

export type PortableAttestationExportSummary = {
  attestationId: string;
  schemaVersion: "portable_attestation.v1";
  attestationType: PortableAttestationType;
  subjectType: PortableAttestationSubjectType;
  subjectId: string;
  claimCategory: PortableAttestationClaimCategory;
  claimLabel: string;
  claimDescription: string;
  status: PortableAttestationStatus;
  lifecycleState: PortableAttestationLifecycleState;
  issuerCategory: PortableAttestationIssuerCategory;
  audience: PortableAttestationAudience;
  permittedPurpose: PortableAttestationPurpose;
  consentReferenceId: string;
  consentGrantedAt: string;
  consentExpiresAt: string | null;
  retentionClass: PortableAttestationRetentionClass;
  evidenceCategory: PortableAttestationEvidenceCategory;
  sourceSystem: PortableAttestationSourceSystem;
  sourceCategory: string;
  confidence: "none" | "low" | "medium" | "high";
  issuedAt: string | null;
  effectiveAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  supersededAt: string | null;
  nextReverificationAt: string | null;
  jurisdiction: string | null;
  redactionProfile: "strict" | "standard";
  metadataOnly: true;
  rawEvidenceIncluded: false;
  rawProviderPayloadIncluded: false;
  supportMetadataIncluded: false;
  publicAccessEnabled: false;
  externalSubmissionEnabled: false;
  nonAuthorityDisclaimers: string[];
};

export type PortableAttestationSupportSummary = {
  attestationId: string;
  attestationType: PortableAttestationType;
  claimCategory: PortableAttestationClaimCategory;
  status: PortableAttestationStatus;
  lifecycleState: PortableAttestationLifecycleState;
  audience: PortableAttestationAudience;
  consentIdRedacted: string | null;
  internalReferenceRedacted: string | null;
  providerReferenceRedacted: string | null;
  sourceSystem: PortableAttestationSourceSystem;
  sourceIdRedacted: string | null;
  retentionClass: PortableAttestationRetentionClass;
  expiresAt: string | null;
  revokedAt: string | null;
  nextReverificationAt: string | null;
  rawProviderPayloadVisible: false;
  rawEvidenceVisible: false;
  supportMetadataPortable: false;
};

export type PortableAttestationSummary = {
  generatedAt: string;
  schemaVersion: "portable_attestation.v1";
  exportReady: boolean;
  consentRequired: true;
  publicAccessEnabled: false;
  externalSubmissionEnabled: false;
  metadataOnly: true;
  rawSensitivePayloadStored: false;
  blockedReasons: string[];
  policyDecisions: AttestationPolicyDecision[];
  exportSummaries: PortableAttestationExportSummary[];
  supportSummaries: PortableAttestationSupportSummary[];
  redactions: string[];
};

export type DerivePortableAttestationSummaryInput = {
  attestations?: PortableAttestation[] | null;
  generatedAt?: unknown;
  requestedAudience?: PortableAttestationAudience | null;
  requestedPurpose?: PortableAttestationPurpose | null;
  sensitivity?: PortableAttestationPolicySensitivity | null;
  publicRequest?: boolean | null;
};

export type PortableAttestationPolicySensitivity =
  | "internal"
  | "confidential"
  | "restricted"
  | "public";

export type AttestationPolicyOperation = "share" | "export";

export type AttestationPolicyReason =
  | "deny_by_default"
  | "consent_missing"
  | "consent_expired"
  | "consent_revoked"
  | "consent_scope_insufficient"
  | "audience_missing"
  | "audience_mismatch"
  | "purpose_missing"
  | "purpose_mismatch"
  | "expired"
  | "revoked"
  | "superseded"
  | "blocked"
  | "reverification_required"
  | "retention_not_portable"
  | "sensitivity_blocked"
  | "unsupported_claim"
  | "raw_payload_blocked"
  | "support_metadata_blocked"
  | "public_exposure_blocked"
  | "external_submission_blocked"
  | "unsafe_evidence_summary"
  | "source_mismatch"
  | "share_allowed"
  | "export_allowed";

export type AttestationPolicyContext = {
  operation: AttestationPolicyOperation;
  requestedAudience?: PortableAttestationAudience | null;
  requestedPurpose?: PortableAttestationPurpose | null;
  generatedAt?: unknown;
  sensitivity?: PortableAttestationPolicySensitivity | null;
  publicRequest?: boolean | null;
  allowedRetentionClasses?: PortableAttestationRetentionClass[] | null;
};

export type AttestationPolicyDecision = {
  allowed: boolean;
  shareable: boolean;
  exportable: boolean;
  operation: AttestationPolicyOperation;
  attestationId: string;
  requestedAudience: PortableAttestationAudience | null;
  requestedPurpose: PortableAttestationPurpose | null;
  status: PortableAttestationStatus;
  lifecycleState: PortableAttestationLifecycleState;
  reasons: AttestationPolicyReason[];
  generatedAt: string;
  metadataOnly: true;
  publicAccessEnabled: false;
  externalSubmissionEnabled: false;
};

export type PolicySafeExportSummaryResult = {
  decision: AttestationPolicyDecision;
  exportSummary: PortableAttestationExportSummary | null;
};
