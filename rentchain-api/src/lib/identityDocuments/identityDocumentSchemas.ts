import { z } from "zod";

import {
  IDENTITY_DOCUMENT_MIME_TYPES,
  IDENTITY_DOCUMENT_SIDES,
  IDENTITY_DOCUMENT_SOURCES,
  IDENTITY_DOCUMENT_STATUSES,
  IDENTITY_DOCUMENT_TYPES,
  IDENTITY_VERIFICATION_STATUSES,
  MAX_IDENTITY_DOCUMENT_FILE_BYTES,
  MAX_IDENTITY_DOCUMENT_HEIGHT,
  MAX_IDENTITY_DOCUMENT_PIXELS,
  MAX_IDENTITY_DOCUMENT_WIDTH,
} from "./identityDocumentTypes";

const canonicalId = z.string().trim().min(1).max(240);
const isoTimestamp = z.string().datetime({ offset: true });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const IdentitySubjectReferenceSchema = z
  .object({
    subjectId: canonicalId,
    subjectUserId: canonicalId.nullish(),
    applicantParticipantId: canonicalId.nullish(),
    applicationIds: z.array(canonicalId).max(50),
    tenantId: canonicalId.nullish(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.subjectUserId && !value.applicantParticipantId && !value.tenantId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "identity_subject_context_required" });
    }
    if (value.applicantParticipantId && value.applicationIds.length === 0) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "applicant_application_context_required" });
    }
  });

export const IdentityDocumentRetentionSchema = z
  .object({
    retentionClass: z.enum([
      "pending_upload",
      "active_application",
      "approved_tenant",
      "lease_active",
      "rejected_or_withdrawn",
      "lease_ended",
    ]),
    retentionPolicyId: canonicalId,
    retentionPolicyVersion: canonicalId,
    scheduledDeletionAt: isoTimestamp.nullish(),
    legalHold: z.boolean(),
    legalHoldReason: z.string().trim().min(1).max(500).nullish(),
    deletedAt: isoTimestamp.nullish(),
    deletionActorId: canonicalId.nullish(),
    deletionSource: z.enum(["subject_request", "retention_policy", "authorized_operator"]).nullish(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.legalHold && !value.legalHoldReason) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "legal_hold_reason_required" });
    }
    if (value.deletedAt && (!value.deletionActorId || !value.deletionSource)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "deletion_provenance_required" });
    }
  });

export const IdentityDocumentMetadataSchema = z
  .object({
    schemaVersion: z.literal("identity_document_metadata_v1"),
    documentId: canonicalId,
    organizationId: canonicalId,
    subjectId: canonicalId,
    subjectUserId: canonicalId.nullish(),
    applicantParticipantId: canonicalId.nullish(),
    applicationIds: z.array(canonicalId).max(50),
    tenantId: canonicalId.nullish(),
    documentType: z.enum(IDENTITY_DOCUMENT_TYPES),
    side: z.enum(IDENTITY_DOCUMENT_SIDES),
    issuingCountry: z.string().trim().length(2).transform((value) => value.toUpperCase()),
    issuingRegion: z.string().trim().min(1).max(120).nullish(),
    originalObjectId: canonicalId,
    sanitizedObjectId: canonicalId,
    mimeType: z.enum(IDENTITY_DOCUMENT_MIME_TYPES),
    byteSize: z.number().int().positive().max(MAX_IDENTITY_DOCUMENT_FILE_BYTES),
    width: z.number().int().positive().max(MAX_IDENTITY_DOCUMENT_WIDTH),
    height: z.number().int().positive().max(MAX_IDENTITY_DOCUMENT_HEIGHT),
    checksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.enum(IDENTITY_DOCUMENT_STATUSES),
    documentExpiry: isoDate.nullish(),
    uploadedAt: isoTimestamp,
    uploadedBy: canonicalId,
    source: z.enum(IDENTITY_DOCUMENT_SOURCES),
    consentEventId: canonicalId,
    retention: IdentityDocumentRetentionSchema,
    version: z.number().int().positive(),
    replacedByDocumentId: canonicalId.nullish(),
  })
  .strict()
  .superRefine((value, context) => {
    const subjectResult = IdentitySubjectReferenceSchema.safeParse({
      subjectId: value.subjectId,
      subjectUserId: value.subjectUserId,
      applicantParticipantId: value.applicantParticipantId,
      applicationIds: value.applicationIds,
      tenantId: value.tenantId,
    });
    if (!subjectResult.success) {
      for (const issue of subjectResult.error.issues) context.addIssue({ ...issue, path: issue.path });
    }
    if (value.width * value.height > MAX_IDENTITY_DOCUMENT_PIXELS) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "image_pixel_limit_exceeded", path: ["width"] });
    }
    if (value.originalObjectId === value.sanitizedObjectId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "original_and_sanitized_objects_must_differ" });
    }
    if (value.status === "replaced" && !value.replacedByDocumentId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "replacement_reference_required" });
    }
    if (value.status === "deleted" && !value.retention.deletedAt) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "deleted_timestamp_required" });
    }
  });

export const IdentityDocumentConsentEventSchema = z
  .object({
    eventId: canonicalId,
    subjectId: canonicalId,
    actorUserId: canonicalId,
    organizationId: canonicalId,
    applicationId: canonicalId.nullish(),
    tenantId: canonicalId.nullish(),
    purpose: z.literal("identity_document_collection"),
    requirementPolicyId: canonicalId,
    requirementPolicyVersion: canonicalId,
    action: z.enum(["granted", "withdrawn"]),
    policyTextVersion: canonicalId,
    privacyNoticeVersion: canonicalId,
    retentionPolicyVersion: canonicalId,
    displayedLocale: z.string().trim().min(2).max(20),
    capturedAt: isoTimestamp,
    channel: z.enum(["application", "tenant_portal"]),
    requestCorrelationId: canonicalId,
  })
  .strict()
  .refine((value) => Boolean(value.applicationId || value.tenantId), "consent_workflow_context_required");

const opaqueIdentityObjectId = z.string().regex(/^identity\/[0-9a-f-]{36}\/(original|sanitized)\/[0-9a-f-]{36}$/);

/** Strict persisted G1B runtime shape. Unknown sensitive or delivery fields fail validation. */
export const IdentityDocumentRuntimeRecordSchema = z
  .object({
    schemaVersion: z.literal("identity_document_runtime_v1"),
    documentId: z.string().uuid(),
    subjectId: canonicalId,
    organizationId: canonicalId,
    tenantId: canonicalId.nullable(),
    applicantParticipantId: canonicalId.nullable(),
    applicationIds: z.array(canonicalId).max(50),
    documentType: z.enum(IDENTITY_DOCUMENT_TYPES),
    side: z.enum(IDENTITY_DOCUMENT_SIDES),
    issuingCountry: z.string().length(2),
    issuingRegion: z.string().trim().min(1).max(120).nullable(),
    originalObjectId: opaqueIdentityObjectId,
    sanitizedObjectId: opaqueIdentityObjectId,
    mimeType: z.enum(IDENTITY_DOCUMENT_MIME_TYPES),
    originalByteSize: z.number().int().positive().max(MAX_IDENTITY_DOCUMENT_FILE_BYTES),
    sanitizedByteSize: z.number().int().positive().max(MAX_IDENTITY_DOCUMENT_FILE_BYTES),
    width: z.number().int().positive().max(MAX_IDENTITY_DOCUMENT_WIDTH),
    height: z.number().int().positive().max(MAX_IDENTITY_DOCUMENT_HEIGHT),
    originalChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    sanitizedChecksumSha256: z.string().regex(/^[a-f0-9]{64}$/),
    status: z.enum(IDENTITY_DOCUMENT_STATUSES),
    verificationStatus: z.literal("not_started"),
    uploadedAt: isoTimestamp,
    uploadedBy: canonicalId,
    consentEventId: canonicalId,
    retentionPolicyId: canonicalId,
    retentionPolicyVersion: canonicalId,
    retentionClass: z.enum(["active_application", "approved_tenant"]),
    legalHold: z.literal(false),
    scheduledDeletionAt: isoTimestamp.nullable(),
    version: z.number().int().positive(),
    replacedByDocumentId: z.string().uuid().nullable(),
    deletedAt: isoTimestamp.nullable(),
    failureCode: z.string().trim().min(1).max(120).nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (!value.tenantId && !value.applicantParticipantId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "identity_subject_context_required" });
    }
    if (value.originalObjectId === value.sanitizedObjectId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "original_and_sanitized_objects_must_differ" });
    }
    if (value.width * value.height > MAX_IDENTITY_DOCUMENT_PIXELS) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "image_pixel_limit_exceeded", path: ["width"] });
    }
    if (value.status === "replaced" && !value.replacedByDocumentId) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "replacement_reference_required" });
    }
    if (value.status === "deleted" && !value.deletedAt) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: "deleted_timestamp_required" });
    }
  });

export const IdentityVerificationResultSchema = z
  .object({
    verificationId: canonicalId,
    providerKey: canonicalId,
    providerReference: canonicalId,
    subjectId: canonicalId,
    documentVersionIds: z.array(canonicalId).min(1).max(10),
    status: z.enum(IDENTITY_VERIFICATION_STATUSES),
    completedAt: isoTimestamp.nullish(),
    documentAuthenticity: z.enum(["not_checked", "passed", "review_required", "failed"]),
    nameMatch: z.enum(["not_checked", "matched", "review_required", "not_matched"]),
    dateOfBirthMatch: z.enum(["not_checked", "matched", "review_required", "not_matched"]),
    expiryCheck: z.enum(["not_checked", "valid", "expired", "review_required"]),
    manualReviewStatus: z.enum(["not_required", "pending", "completed"]),
  })
  .strict();

export type ParsedIdentityDocumentMetadata = z.infer<typeof IdentityDocumentMetadataSchema>;
export type IdentityVerificationResult = z.infer<typeof IdentityVerificationResultSchema>;
