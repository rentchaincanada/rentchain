export type AccountTrustSubjectType =
  | "tenant"
  | "landlord"
  | "applicant"
  | "operator"
  | "organization"
  | "property";

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

export type VerificationSignalStatus =
  | "asserted"
  | "pending"
  | "verified"
  | "failed"
  | "expired"
  | "revoked"
  | "manual_review_required";

export type VerificationSource =
  | "self_asserted"
  | "firebase_auth"
  | "email_verification"
  | "phone_otp"
  | "screening_workflow"
  | "screening_provider"
  | "payment_provider"
  | "lease_record"
  | "public_registry"
  | "operator_review"
  | "institution_review"
  | "future_identity_provider";

export type VerificationEvidenceType =
  | "metadata_only"
  | "canonical_event"
  | "provider_reference"
  | "screening_order"
  | "payment_event"
  | "lease_record"
  | "registry_record"
  | "manual_review";

export type VerificationConfidence = "low" | "medium" | "high";

export type VerificationSignal = {
  signalId: string;
  signalType: VerificationSignalType;
  subjectType: AccountTrustSubjectType;
  subjectId: string;
  status: VerificationSignalStatus;
  source: VerificationSource;
  evidenceType: VerificationEvidenceType;
  confidence: VerificationConfidence;
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

export type AccountTrustEventType =
  | "account_trust_state_derived"
  | "verification_signal_attached"
  | "account_verification_started"
  | "identity_verification_requested"
  | "email_verified"
  | "phone_verified"
  | "screening_verified"
  | "trust_level_changed";

export type AccountTrustEventDescriptor = {
  eventType: AccountTrustEventType;
  action: string;
  subjectType: AccountTrustSubjectType;
  subjectId: string;
  trustLevel: AccountTrustLevel;
  summary: string;
  metadataOnly: true;
};

export type AccountTrustStateSummary = {
  subjectType: AccountTrustSubjectType;
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
  canonicalEvents: AccountTrustEventDescriptor[];
  generatedAt: string;
};

export type DeriveAccountTrustStateInput = {
  subjectType?: unknown;
  subjectId?: unknown;
  signals?: VerificationSignal[] | null;
  previousTrustLevel?: AccountTrustLevel | null;
  generatedAt?: unknown;
};
