export const IDENTITY_DOCUMENT_TYPES = [
  "drivers_license",
  "passport",
  "provincial_id",
  "other_government_photo_id",
] as const;

export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

export const IDENTITY_DOCUMENT_SIDES = ["front", "back", "photo_page", "single"] as const;
export type IdentityDocumentSide = (typeof IDENTITY_DOCUMENT_SIDES)[number];

export const IDENTITY_DOCUMENT_SOURCES = ["applicant_upload", "tenant_upload", "provider_import"] as const;
export type IdentityDocumentSource = (typeof IDENTITY_DOCUMENT_SOURCES)[number];

export const IDENTITY_DOCUMENT_REQUEST_STATUSES = [
  "not_requested",
  "requested",
  "upload_in_progress",
  "submission_complete",
  "cancelled",
] as const;
export type IdentityDocumentRequestStatus = (typeof IDENTITY_DOCUMENT_REQUEST_STATUSES)[number];

export const IDENTITY_DOCUMENT_STATUSES = [
  "pending_upload",
  "processing",
  "ready",
  "rejected",
  "replaced",
  "deletion_scheduled",
  "deleted",
] as const;
export type IdentityDocumentStatus = (typeof IDENTITY_DOCUMENT_STATUSES)[number];

export const IDENTITY_VERIFICATION_STATUSES = [
  "not_started",
  "pending",
  "verified",
  "review_required",
  "failed",
  "expired",
  "cancelled",
] as const;
export type IdentityVerificationStatus = (typeof IDENTITY_VERIFICATION_STATUSES)[number];

// DOCUMENT_STATUS != VERIFICATION_STATUS. Custody readiness never proves identity assurance.
export const DOCUMENT_STATUS_IS_VERIFICATION_STATUS = false as const;

export const IDENTITY_DOCUMENT_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type IdentityDocumentMimeType = (typeof IDENTITY_DOCUMENT_MIME_TYPES)[number];

export const MAX_IDENTITY_DOCUMENT_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IDENTITY_DOCUMENT_IMAGE_COUNT = 3;
export const MAX_IDENTITY_DOCUMENT_TOTAL_BYTES = 25 * 1024 * 1024;
export const MAX_IDENTITY_DOCUMENT_WIDTH = 10_000;
export const MAX_IDENTITY_DOCUMENT_HEIGHT = 10_000;
export const MAX_IDENTITY_DOCUMENT_PIXELS = 40_000_000;
export const PDF_ID_UPLOAD_DEFERRED_UNTIL_DOCUMENT_SCANNING_FOUNDATION = true as const;
export const FULL_GOVERNMENT_ID_NUMBER_STORAGE = "NOT_INCLUDED_IN_G1A" as const;
export const G3_FACE_MATCH_NOT_STARTED = true as const;
export const G5_MOVE_IN_IDENTITY_CONFIRMATION_NOT_STARTED = true as const;

export type IdentitySubjectReference = {
  subjectId: string;
  subjectUserId?: string | null;
  applicantParticipantId?: string | null;
  applicationIds: string[];
  tenantId?: string | null;
};
export type IdentityDocumentContext = IdentitySubjectReference & {
  organizationId: string;
  documentId: string;
};

export type IdentityDocumentObjectReferences = {
  originalObjectId: string;
  sanitizedObjectId: string;
};

export type IdentityDocumentRetention = {
  retentionClass: "pending_upload" | "active_application" | "approved_tenant" | "lease_active" | "rejected_or_withdrawn" | "lease_ended";
  retentionPolicyId: string;
  retentionPolicyVersion: string;
  scheduledDeletionAt?: string | null;
  legalHold: boolean;
  legalHoldReason?: string | null;
  deletedAt?: string | null;
  deletionActorId?: string | null;
  deletionSource?: "subject_request" | "retention_policy" | "authorized_operator" | null;
};

export type IdentityDocumentMetadata = IdentityDocumentContext &
  IdentityDocumentObjectReferences & {
    schemaVersion: "identity_document_metadata_v1";
    documentType: IdentityDocumentType;
    side: IdentityDocumentSide;
    issuingCountry: string;
    issuingRegion?: string | null;
    mimeType: IdentityDocumentMimeType;
    byteSize: number;
    width: number;
    height: number;
    checksumSha256: string;
    status: IdentityDocumentStatus;
    documentExpiry?: string | null;
    uploadedAt: string;
    uploadedBy: string;
    source: IdentityDocumentSource;
    consentEventId: string;
    retention: IdentityDocumentRetention;
    version: number;
    replacedByDocumentId?: string | null;
  };

export type ApplicationIdentityReference = {
  applicationId: string;
  applicantParticipantId: string;
  subjectId: string;
  requestStatus: IdentityDocumentRequestStatus;
  documentIds: string[];
  verificationId?: string | null;
  verificationStatus: IdentityVerificationStatus;
};

export type TenantIdentityReference = {
  tenantId: string;
  subjectId: string;
  sourceApplicationIds: string[];
  documentIds: string[];
  currentVerificationId?: string | null;
};

export type LeaseIdentityReference = {
  leaseId: string;
  tenantId: string;
  subjectId: string;
  identityVerificationId: string;
  statusAtSigning: IdentityVerificationStatus;
  observedAtSigning: string;
};

export const IDENTITY_DOCUMENT_CONSENT_PURPOSES = ["identity_document_collection"] as const;
export type IdentityDocumentConsentPurpose = (typeof IDENTITY_DOCUMENT_CONSENT_PURPOSES)[number];

// Reserved type boundary only. It is not an enabled G1A purpose.
export const BIOMETRIC_CONSENT_PURPOSES = ["face_match"] as const;
export type BiometricConsentPurpose = (typeof BIOMETRIC_CONSENT_PURPOSES)[number];

export type IdentityDocumentConsentEvent = {
  eventId: string;
  subjectId: string;
  actorUserId: string;
  organizationId: string;
  applicationId?: string | null;
  tenantId?: string | null;
  purpose: IdentityDocumentConsentPurpose;
  requirementPolicyId: string;
  requirementPolicyVersion: string;
  action: "granted" | "withdrawn";
  policyTextVersion: string;
  privacyNoticeVersion: string;
  retentionPolicyVersion: string;
  displayedLocale: string;
  capturedAt: string;
  channel: "application" | "tenant_portal";
  requestCorrelationId: string;
};

export const IDENTITY_DOCUMENT_AUDIT_EVENT_TYPES = [
  "identity_document_requested",
  "identity_document_upload_started",
  "identity_document_uploaded",
  "identity_document_processing_failed",
  "identity_document_replaced",
  "identity_document_access_link_issued",
  "identity_document_viewed",
  "identity_document_deletion_scheduled",
  "identity_document_deleted",
  "identity_document_legal_hold_changed",
  "identity_requirement_exception_requested",
  "identity_requirement_exception_approved",
  "identity_requirement_exception_rejected",
  "identity_consent_recorded",
] as const;
export type IdentityDocumentAuditEventType = (typeof IDENTITY_DOCUMENT_AUDIT_EVENT_TYPES)[number];

export type IdentityDocumentAuditEvent = {
  eventId: string;
  eventType: IdentityDocumentAuditEventType;
  occurredAt: string;
  actorId: string;
  actorType: "subject" | "organization_member" | "admin_staff" | "provider_service" | "system";
  organizationId: string;
  subjectId: string;
  documentId?: string | null;
  applicationId?: string | null;
  leaseId?: string | null;
  purposeCode: string;
  action: string;
  outcome: "allowed" | "denied" | "succeeded" | "failed";
  correlationId: string;
  policyVersion: string;
  metadataOnly: true;
  appendOnly: true;
  sensitivePayloadIncluded: false;
};
