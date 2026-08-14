import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";

import {
  IdentityDocumentApplicationError,
  IdentityDocumentApplicationService,
  type CanonicalIdentitySubjectContext,
  type IdentityDocumentAuditAction,
  type IdentityDocumentRecord,
  type IdentityDocumentRepository,
  type IdentityDocumentRuntimePolicy,
} from "../identityDocumentApplicationService";
import type { IdentityDocumentStorage, IdentityDocumentStorageWrite } from "../identityDocumentStorage";
import type { IdentityDocumentConsentEvent } from "../identityDocumentTypes";
import { DEFAULT_TENANT_GOVERNMENT_ID_REQUIREMENT_POLICY, evaluateTenantIdentityRequirement } from "../tenantIdentityRequirement";
import { forbiddenAuthorityOverride } from "../../../routes/tenantIdentityDocumentRoutes";

const policy: IdentityDocumentRuntimePolicy = {
  requirementPolicyId: "tenant_government_photo_id_required",
  requirementPolicyVersion: "v1",
  policyTextVersion: "identity_collection_v1",
  privacyNoticeVersion: "privacy_v1",
  retentionPolicyId: "identity_retention",
  retentionPolicyVersion: "v1",
};

const subject: CanonicalIdentitySubjectContext = {
  actorUserId: "user-1",
  subjectId: "subject-1",
  organizationId: "organization-1",
  tenantId: "tenant-1",
  applicantParticipantId: null,
  applicationIds: ["application-1"],
  activeWorkflow: true,
};

class MemoryRepository implements IdentityDocumentRepository {
  consents: IdentityDocumentConsentEvent[] = [];
  documents = new Map<string, IdentityDocumentRecord>();
  audits: Array<{ action: IdentityDocumentAuditAction; outcome: "succeeded" | "failed" }> = [];
  failAuditAction: IdentityDocumentAuditAction | null = null;
  failUpdateStatus: IdentityDocumentRecord["status"] | null = null;

  async createConsent(event: IdentityDocumentConsentEvent) { this.consents.push(event); }
  async findValidConsent(input: { subjectId: string; organizationId: string; policy: IdentityDocumentRuntimePolicy }) {
    return this.consents.find((event) =>
      event.subjectId === input.subjectId &&
      event.organizationId === input.organizationId &&
      event.purpose === "identity_document_collection" &&
      event.action === "granted" &&
      event.requirementPolicyId === input.policy.requirementPolicyId &&
      event.requirementPolicyVersion === input.policy.requirementPolicyVersion &&
      event.policyTextVersion === input.policy.policyTextVersion &&
      event.privacyNoticeVersion === input.policy.privacyNoticeVersion &&
      event.retentionPolicyVersion === input.policy.retentionPolicyVersion
    ) || null;
  }
  async createDocument(record: IdentityDocumentRecord) { this.documents.set(record.documentId, structuredClone(record)); }
  async updateDocument(documentId: string, patch: Partial<IdentityDocumentRecord>) {
    if (patch.status === this.failUpdateStatus) throw new Error("metadata_finalize_failed");
    const current = this.documents.get(documentId);
    if (!current) throw new Error("document_missing");
    this.documents.set(documentId, { ...current, ...patch });
  }
  async getDocument(documentId: string) { return this.documents.get(documentId) || null; }
  async listDocuments(subjectId: string) { return [...this.documents.values()].filter((record) => record.subjectId === subjectId); }
  async appendAudit(input: Parameters<IdentityDocumentRepository["appendAudit"]>[0]) {
    if (this.failAuditAction === input.action) throw new Error("audit_unavailable");
    this.audits.push({ action: input.action, outcome: input.outcome });
  }
}

class MemoryStorage implements IdentityDocumentStorage {
  objects = new Map<string, Uint8Array>();
  deletes: string[] = [];
  failAt: "original" | "sanitized" | "access" | null = null;
  async putOriginal(input: IdentityDocumentStorageWrite) {
    if (this.failAt === "original") throw new Error("original_write_failed");
    this.objects.set(input.opaqueObjectId, input.bytes);
    return { objectId: input.opaqueObjectId, checksumSha256: input.checksumSha256, byteSize: input.bytes.byteLength, mimeType: input.mimeType };
  }
  async putSanitizedDerivative(input: IdentityDocumentStorageWrite) {
    if (this.failAt === "sanitized") throw new Error("sanitized_write_failed");
    this.objects.set(input.opaqueObjectId, input.bytes);
    return { objectId: input.opaqueObjectId, checksumSha256: input.checksumSha256, byteSize: input.bytes.byteLength, mimeType: input.mimeType };
  }
  async getAuthorizedAccess(input: { opaqueObjectId: string }) {
    if (this.failAt === "access") throw new Error("access_failed");
    return { accessReference: `https://storage.invalid/${input.opaqueObjectId}`, expiresAt: new Date(Date.now() + 300_000).toISOString(), cachePolicy: "private_no_store" as const };
  }
  async delete(input: { opaqueObjectId: string }) { this.deletes.push(input.opaqueObjectId); this.objects.delete(input.opaqueObjectId); }
  async exists(input: { opaqueObjectId: string }) { return this.objects.has(input.opaqueObjectId); }
}

describe("G1B identity document application lifecycle", () => {
  let repository: MemoryRepository;
  let storage: MemoryStorage;
  let service: IdentityDocumentApplicationService;
  let jpeg: Buffer;

  beforeEach(async () => {
    repository = new MemoryRepository();
    storage = new MemoryStorage();
    service = new IdentityDocumentApplicationService(repository, storage, policy);
    jpeg = await sharp({ create: { width: 24, height: 16, channels: 3, background: "blue" } }).jpeg().toBuffer();
  });

  async function consent() { await service.recordConsent(subject, "en-CA"); }
  async function upload(replaceDocumentId?: string) {
    return service.upload(subject, { bytes: jpeg, declaredMimeType: "image/jpeg", documentType: "passport", side: "photo_page", issuingCountry: "ca", replaceDocumentId });
  }

  it("fails closed without exact current consent", async () => {
    await expect(upload()).rejects.toEqual(new IdentityDocumentApplicationError("CONSENT_REQUIRED"));
    await service.recordConsent(subject, "en-CA");
    repository.consents[0].policyTextVersion = "stale";
    await expect(upload()).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
    expect(repository.documents.size).toBe(0);
  });

  it("records minimized consent and completes a ready upload without verification claims", async () => {
    await consent();
    const result = await upload();
    const record = repository.documents.get(result.documentId)!;
    expect(result).toMatchObject({ status: "ready", verificationStatus: "not_started", sanitizedAccessAvailable: true });
    expect(record).toMatchObject({ subjectId: subject.subjectId, status: "ready", verificationStatus: "not_started", consentEventId: repository.consents[0].eventId });
    expect(record.originalObjectId).toMatch(/^identity\/[0-9a-f-]+\/original\/[0-9a-f-]+$/);
    expect(JSON.stringify(result)).not.toMatch(/subject-1|tenant-1|organization-1|originalObjectId|checksum/i);
    expect(repository.audits.map((audit) => audit.action)).toEqual(["consent_recorded", "upload_started", "uploaded"]);
    expect(Object.keys(record).sort()).toEqual([
      "applicantParticipantId", "applicationIds", "consentEventId", "deletedAt", "documentId", "documentType",
      "height", "issuingCountry", "issuingRegion", "legalHold", "mimeType", "organizationId", "originalByteSize",
      "originalChecksumSha256", "originalObjectId", "replacedByDocumentId", "retentionClass", "retentionPolicyId",
      "retentionPolicyVersion", "sanitizedByteSize", "sanitizedChecksumSha256", "sanitizedObjectId", "scheduledDeletionAt",
      "schemaVersion", "side", "status", "subjectId", "tenantId", "uploadedAt", "uploadedBy", "verificationStatus",
      "version", "width",
    ]);
    expect(record).not.toHaveProperty("signedUrl");
    expect(record).not.toHaveProperty("publicUrl");
    expect(record).not.toHaveProperty("fullIdNumber");
    expect(record).not.toHaveProperty("ocrText");
    expect(record).not.toHaveProperty("faceTemplate");
    expect(record).not.toHaveProperty("biometricConsent");
  });

  it("blocks every client-supplied authority and storage override", () => {
    for (const key of ["subjectId", "tenantId", "applicantId", "applicantParticipantId", "organizationId", "bucket", "objectId"]) {
      expect(forbiddenAuthorityOverride({ [key]: "guessed" })).toBe(true);
    }
    expect(forbiddenAuthorityOverride({ documentType: "passport" })).toBe(false);
  });

  it("issues only five-minute sanitized access and hides foreign records", async () => {
    await consent();
    const uploaded = await upload();
    await expect(service.access({ ...subject, subjectId: "subject-foreign" }, uploaded.documentId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    const access = await service.access(subject, uploaded.documentId);
    expect(access).toMatchObject({ expiresInSeconds: 300, representation: "sanitized", cachePolicy: "private_no_store" });
    expect(access.accessReference).toContain("/sanitized/");
    expect(access.accessReference).not.toContain("/original/");
  });

  it("rolls back original storage and records rejected metadata when derivative storage fails", async () => {
    await consent();
    storage.failAt = "sanitized";
    await expect(upload()).rejects.toThrow("sanitized_write_failed");
    const record = [...repository.documents.values()][0];
    expect(record).toMatchObject({ status: "rejected", failureCode: "upload_failed" });
    expect(storage.objects.size).toBe(0);
    expect(storage.deletes).toEqual([record.originalObjectId]);
    expect(repository.audits.at(-1)).toEqual({ action: "processing_failed", outcome: "failed" });
  });

  it("leaves recoverable rejected metadata when the original write fails", async () => {
    await consent();
    storage.failAt = "original";
    await expect(upload()).rejects.toThrow("original_write_failed");
    expect([...repository.documents.values()][0]).toMatchObject({ status: "rejected", failureCode: "upload_failed" });
    expect(storage.objects.size).toBe(0);
    expect(storage.deletes).toEqual([]);
  });

  it("cleans both objects when metadata finalization fails", async () => {
    await consent();
    repository.failUpdateStatus = "ready";
    await expect(upload()).rejects.toThrow("metadata_finalize_failed");
    const record = [...repository.documents.values()][0];
    expect(storage.deletes).toEqual([record.sanitizedObjectId, record.originalObjectId]);
    expect(storage.objects.size).toBe(0);
    expect(record.status).toBe("rejected");
  });

  it("does not report upload success when the mandatory completion audit fails", async () => {
    await consent();
    repository.failAuditAction = "uploaded";
    await expect(upload()).rejects.toThrow("audit_unavailable");
    const record = [...repository.documents.values()][0];
    expect(record.status).toBe("rejected");
    expect(storage.objects.size).toBe(0);
  });

  it("restores the prior ready version if replacement completion fails", async () => {
    await consent();
    const prior = await upload();
    repository.failAuditAction = "replaced";
    await expect(upload(prior.documentId)).rejects.toThrow("audit_unavailable");
    expect(repository.documents.get(prior.documentId)).toMatchObject({ status: "ready", replacedByDocumentId: null });
    expect([...repository.documents.values()].filter((record) => record.documentId !== prior.documentId)[0].status).toBe("rejected");
  });

  it("deletes both representations, supports repeat delete, and preserves deleted metadata", async () => {
    await consent();
    const uploaded = await upload();
    const record = repository.documents.get(uploaded.documentId)!;
    await expect(service.delete({ ...subject, subjectId: "foreign" }, uploaded.documentId)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await service.delete(subject, uploaded.documentId);
    await service.delete(subject, uploaded.documentId);
    expect(storage.deletes).toEqual([record.sanitizedObjectId, record.originalObjectId]);
    expect(repository.documents.get(uploaded.documentId)).toMatchObject({ status: "deleted" });
    expect(await service.list(subject)).toEqual([]);
  });

  it("does not delete storage or return success when deletion scheduling audit fails", async () => {
    await consent();
    const uploaded = await upload();
    repository.failAuditAction = "deletion_scheduled";
    await expect(service.delete(subject, uploaded.documentId)).rejects.toThrow("audit_unavailable");
    expect(repository.documents.get(uploaded.documentId)?.status).toBe("deletion_scheduled");
    expect(storage.deletes).toEqual([]);
  });

  it("makes custody readiness satisfy the document requirement without asserting verification", async () => {
    await consent();
    const uploaded = await upload();
    const evaluation = evaluateTenantIdentityRequirement({
      subjectId: subject.subjectId,
      policy: DEFAULT_TENANT_GOVERNMENT_ID_REQUIREMENT_POLICY,
      documents: [{ documentId: uploaded.documentId, subjectId: subject.subjectId, documentType: "passport", status: "ready" }],
    });
    expect(evaluation).toMatchObject({ satisfied: true, satisfactionSource: "accepted_government_photo_id" });
    expect(uploaded.verificationStatus).toBe("not_started");
  });
});
