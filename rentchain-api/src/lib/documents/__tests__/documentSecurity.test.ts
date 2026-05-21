import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOCUMENT_MAX_BYTES,
  DOCUMENT_SECURITY_PROFILE_VERSION,
  buildSafeDocumentReference,
  classifyDocumentSensitivity,
  deriveSignedUrlGovernance,
  isRoutineExportDocumentKind,
  normalizeDocumentExtension,
  validateAllowedDocumentExtension,
  validateAllowedDocumentMimeType,
  validateDocumentSizeLimit,
  validateSafeDocumentFile,
} from "../documentSecurity";

describe("documentSecurity", () => {
  it("allows only conservative MIME types by default", () => {
    expect(validateAllowedDocumentMimeType("application/pdf")).toEqual({ ok: true });

    expect(validateAllowedDocumentMimeType("image/png")).toMatchObject({
      ok: false,
      code: "document_mime_unsupported",
    });
    expect(validateAllowedDocumentMimeType("application/octet-stream")).toMatchObject({
      ok: false,
      code: "document_mime_disallowed",
    });
    expect(validateAllowedDocumentMimeType("text/html")).toMatchObject({
      ok: false,
      code: "document_mime_disallowed",
    });
  });

  it("requires route-specific opt-in for images, CSVs, and Office documents", () => {
    expect(validateAllowedDocumentMimeType("image/webp", { allowImages: true })).toEqual({ ok: true });
    expect(validateAllowedDocumentMimeType("text/csv", { allowCsv: true })).toEqual({ ok: true });
    expect(
      validateAllowedDocumentMimeType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", {
        allowOfficeDocuments: true,
      })
    ).toEqual({ ok: true });
  });

  it("normalizes extensions and rejects dangerous trailing extensions", () => {
    expect(normalizeDocumentExtension("Lease.PDF")).toBe(".pdf");
    expect(normalizeDocumentExtension("C:\\fakepath\\photo.PNG")).toBe(".png");

    expect(validateAllowedDocumentExtension("lease.pdf")).toEqual({ ok: true });
    expect(validateAllowedDocumentExtension("lease.pdf.exe")).toMatchObject({
      ok: false,
      code: "document_extension_dangerous",
    });
    expect(validateAllowedDocumentExtension("report.html")).toMatchObject({
      ok: false,
      code: "document_extension_dangerous",
    });
  });

  it("validates whole file metadata deterministically", () => {
    expect(
      validateSafeDocumentFile({
        fileName: "cost-receipt.png",
        mimeType: "image/png",
        sizeBytes: 1024,
        options: { allowImages: true },
      })
    ).toEqual({ ok: true });

    expect(
      validateSafeDocumentFile({
        fileName: "cost-receipt.png",
        mimeType: "image/png",
        sizeBytes: DEFAULT_DOCUMENT_MAX_BYTES + 1,
        options: { allowImages: true },
      })
    ).toMatchObject({
      ok: false,
      code: "document_size_too_large",
    });
  });

  it("classifies document sensitivity and routine export eligibility", () => {
    expect(classifyDocumentSensitivity("lease_document")).toBe("operational");
    expect(classifyDocumentSensitivity("tenant_document")).toBe("sensitive");
    expect(classifyDocumentSensitivity("screening_report_export")).toBe("restricted");
    expect(classifyDocumentSensitivity("institutional_export")).toBe("restricted");

    expect(isRoutineExportDocumentKind("lease_document")).toBe(true);
    expect(isRoutineExportDocumentKind("screening_report_export")).toBe(false);
  });

  it("recognizes signed URL expiry without treating the document as missing", () => {
    expect(
      deriveSignedUrlGovernance({
        expiresAt: "2026-05-20T12:00:00.000Z",
        now: "2026-05-20T12:01:00.000Z",
      })
    ).toEqual({ status: "expired", refreshRequired: true });

    expect(
      deriveSignedUrlGovernance({
        expiresAt: "2026-05-20T12:10:00.000Z",
        now: "2026-05-20T12:01:00.000Z",
      })
    ).toEqual({ status: "fresh", refreshRequired: false });
  });

  it("keeps storage paths and source IDs as internal references rather than primary labels", () => {
    const reference = buildSafeDocumentReference({
      fileName: "signed-lease.pdf",
      documentKind: "lease_document",
      contentType: "application/pdf; charset=binary",
      sizeBytes: 2048,
      bucket: "rentchain-private-documents",
      storagePath: "leases/landlord-1/lease-1/signed-lease.pdf",
      sourceCollection: "leases",
      sourceId: "lease-1",
    });

    expect(reference).toMatchObject({
      profileVersion: DOCUMENT_SECURITY_PROFILE_VERSION,
      label: "signed-lease.pdf",
      documentKind: "lease_document",
      contentType: "application/pdf",
      sensitivityClass: "operational",
      scanStatus: "not_scanned",
      internalReferences: {
        bucket: "rentchain-private-documents",
        storagePath: "leases/landlord-1/lease-1/signed-lease.pdf",
        sourceCollection: "leases",
        sourceId: "lease-1",
      },
    });
    expect(reference.label).not.toContain("leases/landlord-1");
    expect(reference.redactionSummary).toContain("internal references");
  });

  it("rejects invalid document sizes", () => {
    expect(validateDocumentSizeLimit(-1)).toMatchObject({
      ok: false,
      code: "document_size_invalid",
    });
    expect(validateDocumentSizeLimit(Number.NaN)).toMatchObject({
      ok: false,
      code: "document_size_invalid",
    });
  });
});
