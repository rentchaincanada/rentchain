import crypto from "crypto";

import { authorizeIdentityDocumentOperation } from "./identityDocumentAuthorization";
import { buildIdentityDocumentObjectKey, makeOpaqueIdentityDocumentIds, processIdentityDocumentImage } from "./identityDocumentImageRuntime";
import type { IdentityDocumentStorage } from "./identityDocumentStorage";
import type {
  IdentityDocumentConsentEvent,
  IdentityDocumentMimeType,
  IdentityDocumentSide,
  IdentityDocumentStatus,
  IdentityDocumentType,
} from "./identityDocumentTypes";

export const IDENTITY_DOCUMENTS_COLLECTION = "identityDocuments";
export const IDENTITY_CONSENTS_COLLECTION = "identityConsentEvents";
export const IDENTITY_DOCUMENT_ACCESS_TTL_SECONDS = 300;

export type CanonicalIdentitySubjectContext = {
  actorUserId: string;
  subjectId: string;
  organizationId: string;
  tenantId: string | null;
  applicantParticipantId: string | null;
  applicationIds: string[];
  activeWorkflow: true;
};

export type IdentityDocumentRuntimePolicy = {
  requirementPolicyId: string;
  requirementPolicyVersion: string;
  policyTextVersion: string;
  privacyNoticeVersion: string;
  retentionPolicyId: string;
  retentionPolicyVersion: string;
};

export type IdentityDocumentRecord = {
  schemaVersion: "identity_document_runtime_v1";
  documentId: string;
  subjectId: string;
  organizationId: string;
  tenantId: string | null;
  applicantParticipantId: string | null;
  applicationIds: string[];
  documentType: IdentityDocumentType;
  side: IdentityDocumentSide;
  issuingCountry: string;
  issuingRegion: string | null;
  originalObjectId: string;
  sanitizedObjectId: string;
  mimeType: IdentityDocumentMimeType;
  originalByteSize: number;
  sanitizedByteSize: number;
  width: number;
  height: number;
  originalChecksumSha256: string;
  sanitizedChecksumSha256: string;
  status: IdentityDocumentStatus;
  verificationStatus: "not_started";
  uploadedAt: string;
  uploadedBy: string;
  consentEventId: string;
  retentionPolicyId: string;
  retentionPolicyVersion: string;
  retentionClass: "active_application" | "approved_tenant";
  legalHold: false;
  scheduledDeletionAt: null;
  version: number;
  replacedByDocumentId: string | null;
  deletedAt: string | null;
  failureCode?: string | null;
};

export type IdentityDocumentAuditAction =
  | "consent_recorded"
  | "upload_started"
  | "uploaded"
  | "processing_failed"
  | "access_link_issued"
  | "deletion_scheduled"
  | "deleted"
  | "replaced";

export interface IdentityDocumentRepository {
  createConsent(event: IdentityDocumentConsentEvent): Promise<void>;
  findValidConsent(input: {
    subjectId: string;
    organizationId: string;
    policy: IdentityDocumentRuntimePolicy;
  }): Promise<IdentityDocumentConsentEvent | null>;
  createDocument(record: IdentityDocumentRecord): Promise<void>;
  updateDocument(documentId: string, patch: Partial<IdentityDocumentRecord>): Promise<void>;
  getDocument(documentId: string): Promise<IdentityDocumentRecord | null>;
  listDocuments(subjectId: string): Promise<IdentityDocumentRecord[]>;
  appendAudit(input: {
    action: IdentityDocumentAuditAction;
    actorUserId: string;
    subjectId: string;
    organizationId: string;
    documentId: string | null;
    occurredAt: string;
    outcome: "succeeded" | "failed";
    context: "tenant" | "applicant";
  }): Promise<void>;
}

export class IdentityDocumentApplicationError extends Error {
  constructor(
    public readonly code:
      | "CONSENT_REQUIRED"
      | "UNAUTHORIZED"
      | "NOT_FOUND"
      | "RETENTION_POLICY_REQUIRED"
      | "DOCUMENT_NOT_READY"
      | "IDENTITY_DOCUMENT_OPERATION_FAILED",
  ) {
    super(code);
  }
}

function assertOwnSubject(
  operation: "upload" | "view_metadata" | "issue_access_link" | "delete" | "replace",
  context: CanonicalIdentitySubjectContext,
  record?: IdentityDocumentRecord,
) {
  const decision = authorizeIdentityDocumentOperation({
    operation,
    actor: { actorId: context.actorUserId, role: "subject", subjectId: context.subjectId },
    resource: {
      subjectId: record?.subjectId || context.subjectId,
      organizationId: record?.organizationId || context.organizationId,
      activeWorkflow: context.activeWorkflow,
    },
    context: { applicationAccess: true, purposeCode: "identity_document_collection" },
  });
  if (!decision.allowed || (record && record.organizationId !== context.organizationId)) {
    throw new IdentityDocumentApplicationError("NOT_FOUND");
  }
}

function projectDocument(record: IdentityDocumentRecord) {
  return {
    documentId: record.documentId,
    documentType: record.documentType,
    side: record.side,
    status: record.status,
    verificationStatus: record.verificationStatus,
    mimeType: record.mimeType,
    byteSize: record.sanitizedByteSize,
    width: record.width,
    height: record.height,
    uploadedAt: record.uploadedAt,
    sanitizedAccessAvailable: record.status === "ready",
  };
}

export class IdentityDocumentApplicationService {
  constructor(
    private readonly repository: IdentityDocumentRepository,
    private readonly storage: IdentityDocumentStorage,
    private readonly policy: IdentityDocumentRuntimePolicy,
  ) {}

  async recordConsent(context: CanonicalIdentitySubjectContext, displayedLocale: string) {
    if (!this.policy.retentionPolicyId || !this.policy.retentionPolicyVersion) {
      throw new IdentityDocumentApplicationError("RETENTION_POLICY_REQUIRED");
    }
    const event: IdentityDocumentConsentEvent = {
      eventId: crypto.randomUUID(),
      subjectId: context.subjectId,
      actorUserId: context.actorUserId,
      organizationId: context.organizationId,
      applicationId: context.applicationIds[0] || null,
      tenantId: context.tenantId,
      purpose: "identity_document_collection",
      requirementPolicyId: this.policy.requirementPolicyId,
      requirementPolicyVersion: this.policy.requirementPolicyVersion,
      action: "granted",
      policyTextVersion: this.policy.policyTextVersion,
      privacyNoticeVersion: this.policy.privacyNoticeVersion,
      retentionPolicyVersion: this.policy.retentionPolicyVersion,
      displayedLocale,
      capturedAt: new Date().toISOString(),
      channel: context.tenantId ? "tenant_portal" : "application",
      requestCorrelationId: crypto.randomUUID(),
    };
    await this.repository.createConsent(event);
    await this.repository.appendAudit({
      action: "consent_recorded",
      actorUserId: context.actorUserId,
      subjectId: context.subjectId,
      organizationId: context.organizationId,
      documentId: null,
      occurredAt: event.capturedAt,
      outcome: "succeeded",
      context: context.tenantId ? "tenant" : "applicant",
    });
    return { purpose: event.purpose, capturedAt: event.capturedAt, policyTextVersion: event.policyTextVersion };
  }

  async upload(context: CanonicalIdentitySubjectContext, input: {
    bytes: Buffer;
    declaredMimeType?: string | null;
    documentType: IdentityDocumentType;
    side: IdentityDocumentSide;
    issuingCountry: string;
    issuingRegion?: string | null;
    replaceDocumentId?: string | null;
  }) {
    assertOwnSubject(input.replaceDocumentId ? "replace" : "upload", context);
    if (!this.policy.retentionPolicyId || !this.policy.retentionPolicyVersion) {
      throw new IdentityDocumentApplicationError("RETENTION_POLICY_REQUIRED");
    }
    const consent = await this.repository.findValidConsent({
      subjectId: context.subjectId,
      organizationId: context.organizationId,
      policy: this.policy,
    });
    if (!consent) throw new IdentityDocumentApplicationError("CONSENT_REQUIRED");

    const replaced = input.replaceDocumentId ? await this.repository.getDocument(input.replaceDocumentId) : null;
    if (input.replaceDocumentId) {
      if (!replaced) throw new IdentityDocumentApplicationError("NOT_FOUND");
      assertOwnSubject("replace", context, replaced);
    }

    const processed = await processIdentityDocumentImage({ bytes: input.bytes, declaredMimeType: input.declaredMimeType });
    const ids = makeOpaqueIdentityDocumentIds();
    const originalObjectId = buildIdentityDocumentObjectKey({ documentId: ids.documentId, objectId: ids.originalObjectId, representation: "original" });
    const sanitizedObjectId = buildIdentityDocumentObjectKey({ documentId: ids.documentId, objectId: ids.sanitizedObjectId, representation: "sanitized" });
    const now = new Date().toISOString();
    const record: IdentityDocumentRecord = {
      schemaVersion: "identity_document_runtime_v1",
      documentId: ids.documentId,
      subjectId: context.subjectId,
      organizationId: context.organizationId,
      tenantId: context.tenantId,
      applicantParticipantId: context.applicantParticipantId,
      applicationIds: context.applicationIds,
      documentType: input.documentType,
      side: input.side,
      issuingCountry: input.issuingCountry.toUpperCase(),
      issuingRegion: input.issuingRegion || null,
      originalObjectId,
      sanitizedObjectId,
      mimeType: processed.original.mimeType,
      originalByteSize: processed.original.byteSize,
      sanitizedByteSize: processed.sanitized.byteSize,
      width: processed.sanitized.width,
      height: processed.sanitized.height,
      originalChecksumSha256: processed.original.checksumSha256,
      sanitizedChecksumSha256: processed.sanitized.checksumSha256,
      status: "pending_upload",
      verificationStatus: "not_started",
      uploadedAt: now,
      uploadedBy: context.actorUserId,
      consentEventId: consent.eventId,
      retentionPolicyId: this.policy.retentionPolicyId,
      retentionPolicyVersion: this.policy.retentionPolicyVersion,
      retentionClass: context.tenantId ? "approved_tenant" : "active_application",
      legalHold: false,
      scheduledDeletionAt: null,
      version: 1,
      replacedByDocumentId: null,
      deletedAt: null,
    };

    let originalWritten = false;
    let sanitizedWritten = false;
    let replacementUpdated = false;
    try {
      await this.repository.createDocument(record);
      await this.repository.appendAudit({ action: "upload_started", actorUserId: context.actorUserId, subjectId: context.subjectId, organizationId: context.organizationId, documentId: record.documentId, occurredAt: now, outcome: "succeeded", context: context.tenantId ? "tenant" : "applicant" });
      await this.storage.putOriginal({ opaqueObjectId: originalObjectId, bytes: processed.original.bytes, mimeType: processed.original.mimeType, checksumSha256: processed.original.checksumSha256 });
      originalWritten = true;
      await this.repository.updateDocument(record.documentId, { status: "processing" });
      await this.storage.putSanitizedDerivative({ opaqueObjectId: sanitizedObjectId, bytes: processed.sanitized.bytes, mimeType: processed.sanitized.mimeType, checksumSha256: processed.sanitized.checksumSha256 });
      sanitizedWritten = true;
      await this.repository.updateDocument(record.documentId, { status: "ready" });
      if (replaced) {
        await this.repository.updateDocument(replaced.documentId, { status: "replaced", replacedByDocumentId: record.documentId });
        replacementUpdated = true;
      }
      await this.repository.appendAudit({ action: replaced ? "replaced" : "uploaded", actorUserId: context.actorUserId, subjectId: context.subjectId, organizationId: context.organizationId, documentId: record.documentId, occurredAt: new Date().toISOString(), outcome: "succeeded", context: context.tenantId ? "tenant" : "applicant" });
      return projectDocument({ ...record, status: "ready" });
    } catch (error) {
      if (replacementUpdated && replaced) {
        await this.repository.updateDocument(replaced.documentId, { status: "ready", replacedByDocumentId: null }).catch(() => undefined);
      }
      if (sanitizedWritten) await this.storage.delete({ opaqueObjectId: sanitizedObjectId, reasonCode: "upload_rollback" }).catch(() => undefined);
      if (originalWritten) await this.storage.delete({ opaqueObjectId: originalObjectId, reasonCode: "upload_rollback" }).catch(() => undefined);
      await this.repository.updateDocument(record.documentId, { status: "rejected", failureCode: "upload_failed" }).catch(() => undefined);
      await this.repository.appendAudit({ action: "processing_failed", actorUserId: context.actorUserId, subjectId: context.subjectId, organizationId: context.organizationId, documentId: record.documentId, occurredAt: new Date().toISOString(), outcome: "failed", context: context.tenantId ? "tenant" : "applicant" }).catch(() => undefined);
      throw error;
    }
  }

  async list(context: CanonicalIdentitySubjectContext) {
    assertOwnSubject("view_metadata", context);
    return (await this.repository.listDocuments(context.subjectId))
      .filter((record) => record.organizationId === context.organizationId && record.status !== "deleted")
      .map(projectDocument);
  }

  async access(context: CanonicalIdentitySubjectContext, documentId: string) {
    const record = await this.repository.getDocument(documentId);
    if (!record) throw new IdentityDocumentApplicationError("NOT_FOUND");
    assertOwnSubject("issue_access_link", context, record);
    if (record.status !== "ready") throw new IdentityDocumentApplicationError("DOCUMENT_NOT_READY");
    const access = await this.storage.getAuthorizedAccess({ opaqueObjectId: record.sanitizedObjectId, actorId: context.actorUserId, purposeCode: "subject_sanitized_view" });
    await this.repository.appendAudit({ action: "access_link_issued", actorUserId: context.actorUserId, subjectId: context.subjectId, organizationId: context.organizationId, documentId, occurredAt: new Date().toISOString(), outcome: "succeeded", context: context.tenantId ? "tenant" : "applicant" });
    return { accessReference: access.accessReference, expiresAt: access.expiresAt, expiresInSeconds: IDENTITY_DOCUMENT_ACCESS_TTL_SECONDS, representation: "sanitized" as const, cachePolicy: access.cachePolicy };
  }

  async delete(context: CanonicalIdentitySubjectContext, documentId: string) {
    const record = await this.repository.getDocument(documentId);
    if (!record) throw new IdentityDocumentApplicationError("NOT_FOUND");
    assertOwnSubject("delete", context, record);
    if (record.status === "deleted") return;
    await this.repository.updateDocument(documentId, { status: "deletion_scheduled" });
    await this.repository.appendAudit({ action: "deletion_scheduled", actorUserId: context.actorUserId, subjectId: context.subjectId, organizationId: context.organizationId, documentId, occurredAt: new Date().toISOString(), outcome: "succeeded", context: context.tenantId ? "tenant" : "applicant" });
    await this.storage.delete({ opaqueObjectId: record.sanitizedObjectId, reasonCode: "subject_request" });
    await this.storage.delete({ opaqueObjectId: record.originalObjectId, reasonCode: "subject_request" });
    const deletedAt = new Date().toISOString();
    await this.repository.updateDocument(documentId, { status: "deleted", deletedAt });
    await this.repository.appendAudit({ action: "deleted", actorUserId: context.actorUserId, subjectId: context.subjectId, organizationId: context.organizationId, documentId, occurredAt: deletedAt, outcome: "succeeded", context: context.tenantId ? "tenant" : "applicant" });
  }
}
