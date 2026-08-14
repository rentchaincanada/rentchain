import { describe, expect, expectTypeOf, it } from "vitest";

import {
  FULL_GOVERNMENT_ID_NUMBER_STORAGE,
  G3_FACE_MATCH_NOT_STARTED,
  IDENTITY_DOCUMENT_MIME_TYPES,
  IdentityDocumentConsentEventSchema,
  IdentityDocumentMetadataSchema,
  IdentityVerificationResultSchema,
  PDF_ID_UPLOAD_DEFERRED_UNTIL_DOCUMENT_SCANNING_FOUNDATION,
  authorizeIdentityDocumentOperation,
  canTransitionIdentityDocumentStatus,
  type BiometricConsentPurpose,
  type IdentityDocumentConsentPurpose,
  type IdentityDocumentStatus,
  type IdentityDocumentStorage,
  type IdentityVerificationProvider,
  type IdentityVerificationStatus,
  type LeaseIdentityReference,
  type TenantIdentityReference,
} from "..";

const validMetadata = {
  schemaVersion: "identity_document_metadata_v1",
  documentId: "doc-1",
  organizationId: "org-1",
  subjectId: "subject-1",
  subjectUserId: "user-1",
  applicantParticipantId: "participant-1",
  applicationIds: ["application-1"],
  tenantId: null,
  documentType: "drivers_license",
  side: "front",
  issuingCountry: "ca",
  issuingRegion: "NS",
  originalObjectId: "object-original",
  sanitizedObjectId: "object-sanitized",
  mimeType: "image/jpeg",
  byteSize: 1_024,
  width: 1_600,
  height: 1_000,
  checksumSha256: "a".repeat(64),
  status: "ready",
  documentExpiry: "2030-01-01",
  uploadedAt: "2026-08-14T12:00:00.000Z",
  uploadedBy: "user-1",
  source: "applicant_upload",
  consentEventId: "consent-1",
  retention: {
    retentionClass: "active_application",
    retentionPolicyId: "identity-retention-policy",
    retentionPolicyVersion: "v1",
    scheduledDeletionAt: null,
    legalHold: false,
  },
  version: 1,
  replacedByDocumentId: null,
} as const;

describe("G1A identity document foundation", () => {
  it("parses valid metadata and normalizes the issuing country", () => {
    const parsed = IdentityDocumentMetadataSchema.parse(validMetadata);
    expect(parsed.issuingCountry).toBe("CA");
    expect(parsed.originalObjectId).not.toBe(parsed.sanitizedObjectId);
  });

  it.each([
    ["unsupported document type", { documentType: "student_card" }],
    ["invalid side", { side: "inside" }],
    ["verification status in custody field", { status: "verified" }],
    ["missing application for applicant", { applicationIds: [] }],
    ["same original and derivative", { sanitizedObjectId: "object-original" }],
  ])("rejects %s", (_name, change) => {
    expect(IdentityDocumentMetadataSchema.safeParse({ ...validMetadata, ...change }).success).toBe(false);
  });

  it("rejects persistent signed URLs and full government ID numbers", () => {
    expect(IdentityDocumentMetadataSchema.safeParse({ ...validMetadata, signedUrl: "https://example.invalid" }).success).toBe(false);
    expect(IdentityDocumentMetadataSchema.safeParse({ ...validMetadata, governmentIdNumber: "ABC123" }).success).toBe(false);
    expect(FULL_GOVERNMENT_ID_NUMBER_STORAGE).toBe("NOT_INCLUDED_IN_G1A");
  });

  it("allows only JPEG, PNG and WebP and explicitly defers PDF", () => {
    expect(IDENTITY_DOCUMENT_MIME_TYPES).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(IDENTITY_DOCUMENT_MIME_TYPES).not.toContain("application/pdf");
    expect(PDF_ID_UPLOAD_DEFERRED_UNTIL_DOCUMENT_SCANNING_FOUNDATION).toBe(true);
  });

  it("keeps document and verification statuses type-distinct", () => {
    expectTypeOf<IdentityDocumentStatus>().not.toEqualTypeOf<IdentityVerificationStatus>();
    expect(canTransitionIdentityDocumentStatus("processing", "ready")).toBe(true);
    expect(canTransitionIdentityDocumentStatus("ready", "deleted")).toBe(false);
  });

  it("records versioned collection consent without implying biometric consent", () => {
    const result = IdentityDocumentConsentEventSchema.safeParse({
      eventId: "consent-1",
      subjectId: "subject-1",
      actorUserId: "user-1",
      organizationId: "org-1",
      applicationId: "application-1",
      purpose: "identity_document_collection",
      action: "granted",
      policyTextVersion: "identity-collection-v1",
      privacyNoticeVersion: "privacy-v4",
      retentionPolicyVersion: "retention-pending-legal-v1",
      displayedLocale: "en-CA",
      capturedAt: "2026-08-14T12:00:00.000Z",
      channel: "application",
      requestCorrelationId: "request-1",
    });
    expect(result.success).toBe(true);
    expectTypeOf<IdentityDocumentConsentPurpose>().not.toEqualTypeOf<BiometricConsentPurpose>();
    expect(G3_FACE_MATCH_NOT_STARTED).toBe(true);
  });

  it("does not encode statutory retention durations", () => {
    const parsed = IdentityDocumentMetadataSchema.parse(validMetadata);
    expect(parsed.retention.retentionPolicyId).toBe("identity-retention-policy");
    expect(parsed.retention).not.toHaveProperty("retentionDays");
    expect(parsed.retention).not.toHaveProperty("retentionYears");
  });

  it("allows owner management only for the subject's active workflow", () => {
    const decision = authorizeIdentityDocumentOperation({
      operation: "replace",
      actor: { actorId: "user-1", role: "subject", subjectId: "subject-1" },
      resource: { subjectId: "subject-1", organizationId: "org-1", activeWorkflow: true },
      context: { applicationAccess: true },
    });
    expect(decision).toMatchObject({ allowed: true, rawDocumentAccess: false });

    const foreign = authorizeIdentityDocumentOperation({
      operation: "view_metadata",
      actor: { actorId: "user-2", role: "subject", subjectId: "subject-2" },
      resource: { subjectId: "subject-1", organizationId: "org-1", activeWorkflow: true },
      context: { applicationAccess: false },
    });
    expect(foreign.allowed).toBe(false);
  });

  it("allows same-org metadata but fails closed for ordinary raw access", () => {
    const base = {
      actor: { actorId: "reviewer-1", role: "organization_member" as const, organizationId: "org-1" },
      resource: { subjectId: "subject-1", organizationId: "org-1", activeWorkflow: true },
      context: { applicationAccess: true },
    };
    expect(authorizeIdentityDocumentOperation({ ...base, operation: "view_metadata" }).allowed).toBe(true);
    expect(authorizeIdentityDocumentOperation({ ...base, operation: "view_raw_document" }).allowed).toBe(false);
    expect(
      authorizeIdentityDocumentOperation({
        ...base,
        operation: "view_raw_document",
        actor: { ...base.actor, privileges: ["identity_raw_view"] },
        context: { applicationAccess: true, purposeCode: "application_manual_review" },
      })
    ).toMatchObject({ allowed: true, rawDocumentAccess: true, auditRequired: true });
  });

  it("denies a foreign organization even when it asks for metadata", () => {
    const decision = authorizeIdentityDocumentOperation({
      operation: "view_metadata",
      actor: { actorId: "reviewer-2", role: "organization_member", organizationId: "org-2" },
      resource: { subjectId: "subject-1", organizationId: "org-1", activeWorkflow: true },
      context: { applicationAccess: true },
    });
    expect(decision.allowed).toBe(false);
  });

  it("models application-to-tenant-to-lease continuity without raw documents", () => {
    const tenant: TenantIdentityReference = {
      tenantId: "tenant-1",
      subjectId: "subject-1",
      sourceApplicationIds: ["application-1"],
      documentIds: ["doc-1"],
      currentVerificationId: "verification-1",
    };
    const lease: LeaseIdentityReference = {
      leaseId: "lease-1",
      tenantId: tenant.tenantId,
      subjectId: tenant.subjectId,
      identityVerificationId: "verification-1",
      statusAtSigning: "verified",
      observedAtSigning: "2026-08-14T12:00:00.000Z",
    };
    expect(lease.subjectId).toBe(tenant.subjectId);
    expect(lease).not.toHaveProperty("documentBytes");
    expect(lease).not.toHaveProperty("documentUrl");
  });

  it("keeps storage and provider as implementation-free interfaces", () => {
    expectTypeOf<IdentityDocumentStorage>().toBeObject();
    expectTypeOf<IdentityVerificationProvider>().toBeObject();
  });

  it("keeps provider results biometric-free and provider-neutral", () => {
    const result = IdentityVerificationResultSchema.parse({
      verificationId: "verification-1",
      providerKey: "provider-key",
      providerReference: "provider-reference",
      subjectId: "subject-1",
      documentVersionIds: ["doc-1-v1"],
      status: "review_required",
      completedAt: null,
      documentAuthenticity: "review_required",
      nameMatch: "matched",
      dateOfBirthMatch: "matched",
      expiryCheck: "valid",
      manualReviewStatus: "pending",
    });
    expect(result).not.toHaveProperty("faceMatch");
    expect(result).not.toHaveProperty("selfieMatch");
    expect(result.providerKey).toBe("provider-key");
  });
});
