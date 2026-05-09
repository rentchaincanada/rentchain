export type InstitutionReviewAudience =
  | "insurer"
  | "lender"
  | "institutional_landlord"
  | "subsidy_program"
  | "government_review"
  | "advocate_caseworker"
  | "auditor";

export type InstitutionReviewPurpose =
  | "insurance_review"
  | "lender_review"
  | "institutional_landlord_review"
  | "subsidy_program_review"
  | "government_housing_review"
  | "advocate_assisted_review"
  | "auditor_review";

export type InstitutionReviewRecipientRole =
  | "insurance_reviewer"
  | "lender_reviewer"
  | "institutional_landlord_reviewer"
  | "subsidy_program_reviewer"
  | "government_housing_reviewer"
  | "advocate_caseworker"
  | "auditor"
  | "unknown_reviewer";

export type InstitutionReviewLifecycleState =
  | "pending"
  | "active"
  | "expired"
  | "revoked"
  | "blocked"
  | "superseded"
  | "archived"
  | "reverification_required"
  | "session_closed";

export type InstitutionReviewEventType =
  | "institution_review_session_created"
  | "institution_review_session_opened"
  | "institution_review_session_closed"
  | "institution_review_session_expired"
  | "institution_review_session_revoked"
  | "institution_review_session_blocked"
  | "institution_review_session_reverification_required";

export type InstitutionReviewSessionEvent = {
  schemaVersion: "institution_review_session_event.v1";
  eventType: InstitutionReviewEventType;
  occurredAt: string;
  actorType: "tenant" | "recipient" | "system";
  lifecycleState: InstitutionReviewLifecycleState;
  reason: string;
  metadataOnly: true;
  visibility: {
    auditSafe: true;
    supportSafe: true;
    trustPayloadIncluded: false;
    providerPayloadIncluded: false;
    internalSupportMetadataIncluded: false;
    publicAccessEnabled: false;
    downloadEnabled: false;
  };
};

export type InstitutionReviewSessionSummary = {
  schemaVersion: "institution_review_session.v1";
  sessionId: string;
  accessGrantId: string;
  recipientReviewSessionId: string | null;
  audience: InstitutionReviewAudience;
  purpose: InstitutionReviewPurpose;
  recipientRole: InstitutionReviewRecipientRole;
  lifecycle: InstitutionReviewLifecycleState;
  tenantMediated: true;
  consentScoped: true;
  policyGated: true;
  metadataOnly: true;
  viewOnly: true;
  publicAccessEnabled: false;
  publicProfileEnabled: false;
  externalSubmissionEnabled: false;
  providerIntegrationEnabled: false;
  automatedDecisioningEnabled: false;
  downloadEnabled: false;
  accessGrant: {
    grantId: string;
    lifecycle: string | null;
    expiresAt: string | null;
    revokedAt: string | null;
  };
  trustExport: {
    exportId: string | null;
    lifecycleState: string | null;
    status: string | null;
    active: boolean;
    shareable: boolean;
  };
  recipient: {
    role: InstitutionReviewRecipientRole;
    redactedEmail: string;
    organizationName: string | null;
    authenticationRequirement: "recipient_email_session_required";
  };
  lifecycleLinkage: {
    grantLifecycleLinked: true;
    trustExportLifecycleLinked: true;
    recipientSessionLinked: boolean;
    revocationPropagates: true;
    expirationPropagates: true;
    reverificationPropagates: true;
  };
  payloadSafety: {
    metadataOnly: true;
    trustPayloadIncluded: false;
    portableAttestationContentsIncluded: false;
    rawProviderPayloadIncluded: false;
    rawIdentityPayloadIncluded: false;
    rawPropertyPayloadIncluded: false;
    supportMetadataIncluded: false;
  };
  events: InstitutionReviewSessionEvent[];
};

export type DeriveInstitutionReviewSessionInput = {
  accessGrant: any;
  recipientReviewSession?: any | null;
  generatedAt?: unknown;
};
