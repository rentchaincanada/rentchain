import { describe, expect, it } from "vitest";

import {
  expectNoRestrictedProjectionFields,
  expectPayloadDoesNotContainValues,
} from "../../../__tests__/helpers/projectionSafetyAssertions";
import {
  EXPORT_INTEGRITY_GOVERNANCE_VERSION,
  buildExportIntegrityMetadata,
  classifyVerificationReadiness,
  normalizeExportIntegrityScope,
  normalizeExportLineage,
} from "../exportIntegrityGovernance";

describe("exportIntegrityGovernance", () => {
  it("normalizes integrity scope and source lineage deterministically", () => {
    expect(normalizeExportIntegrityScope("Institutional Export")).toBe("institutional_export");
    expect(normalizeExportIntegrityScope("unknown-scope")).toBe("review_artifact");

    const lineage = normalizeExportLineage([
      {
        sourceCollection: "payments",
        sourceId: "payment-2",
        rawPayload: "raw provider dump",
        token: "secret-token",
      },
      { sourceCollection: "leases", sourceId: "lease-1" },
      { sourceCollection: "payments", sourceId: "payment-2", providerPayload: "duplicate raw dump" },
      { sourceCollection: "", sourceId: "missing-collection" },
      { sourceCollection: "tenants", sourceId: "" },
    ]);

    expect(lineage).toEqual([
      { sourceCollection: "leases", sourceId: "lease-1", internalReference: true },
      { sourceCollection: "payments", sourceId: "payment-2", internalReference: true },
    ]);
    expectNoRestrictedProjectionFields(lineage);
    expectPayloadDoesNotContainValues(lineage, ["raw provider dump", "secret-token", "duplicate raw dump"]);
  });

  it("builds metadata-only export integrity records without live signing or public verification", () => {
    const metadata = buildExportIntegrityMetadata({
      exportProfile: "institutional_export_v1",
      exportVersion: "2026-05-21",
      exportGeneratedAt: "2026-05-21T12:30:00.000Z",
      exportGeneratedBy: "admin-1",
      integrityScope: "institutional_export",
      projectionProfile: "institutional_export_projection_v1",
      sourceRefs: [
        { sourceCollection: "leases", sourceId: "lease-1" },
        { sourceCollection: "payments", sourceId: "payment-1" },
      ],
      signatureStatus: "signature_ready",
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        exportIntegrityVersion: EXPORT_INTEGRITY_GOVERNANCE_VERSION,
        exportProfile: "institutional_export_v1",
        exportVersion: "2026-05-21",
        exportGeneratedAt: "2026-05-21T12:30:00.000Z",
        exportGeneratedBy: "admin-1",
        integrityScope: "institutional_export",
        sensitivityClass: "restricted",
        projectionProfile: "institutional_export_projection_v1",
        signatureStatus: "signature_ready",
        verificationStatus: "ready_for_review",
        reproducibilityExpectation: "deterministic_projection_inputs_required",
        authorityScoped: true,
        publicVerificationEnabled: false,
        cryptographicSigningEnabled: false,
        blockchainAnchoringEnabled: false,
        tenantVisibleInternalMetadata: false,
      })
    );
    expect(metadata.sourceCollections).toEqual(["leases", "payments"]);
    expect(metadata.sourceRefs).toEqual([
      { sourceCollection: "leases", sourceId: "lease-1", internalReference: true },
      { sourceCollection: "payments", sourceId: "payment-1", internalReference: true },
    ]);
    expect(metadata.exportHashPlaceholder).toEqual({
      status: "not_computed",
      algorithm: "sha256",
      value: null,
      reason: "Hash computation is intentionally deferred until signed/exported artifact workflows are approved.",
    });
  });

  it("keeps source refs internal and excludes restricted/raw/provider payload material", () => {
    const metadata = buildExportIntegrityMetadata({
      exportProfile: "evidence_pack_v1",
      exportVersion: "v1",
      integrityScope: "evidence_pack",
      projectionProfile: "evidence_pack_projection_v1",
      sourceRefs: [
        {
          sourceCollection: "evidencePacks",
          sourceId: "evidence-1",
          rawReport: "raw credit report",
          providerPayload: "bureau payload",
          rawCsv: "raw csv row",
          bankAccount: "000123456",
          token: "secret-token",
          stack: "private stack trace",
          routeSource: "debug route source",
        },
      ],
    });

    expect(metadata.sourceRefs).toEqual([
      { sourceCollection: "evidencePacks", sourceId: "evidence-1", internalReference: true },
    ]);
    expectNoRestrictedProjectionFields(metadata.sourceRefs);
    expectPayloadDoesNotContainValues(metadata, [
      "raw credit report",
      "bureau payload",
      "raw csv row",
      "000123456",
      "secret-token",
      "private stack trace",
      "debug route source",
    ]);
  });

  it("classifies verification readiness without implying production cryptographic verification", () => {
    expect(
      classifyVerificationReadiness({
        sourceRefs: [{ sourceCollection: "leases", sourceId: "lease-1", internalReference: true }],
        projectionProfile: "tenant_trust_export_projection_v1",
        signatureStatus: "signed",
      })
    ).toBe("ready_for_review");
    expect(classifyVerificationReadiness({ sourceRefs: [], projectionProfile: "profile", signatureStatus: "not_signed" })).toBe(
      "metadata_only"
    );
    expect(classifyVerificationReadiness({ signatureStatus: "unexpected-status" })).toBe("unavailable");
  });

  it("defaults to safe metadata when optional inputs are missing", () => {
    const metadata = buildExportIntegrityMetadata({
      exportProfile: "",
      exportVersion: "",
      integrityScope: "unknown",
      sourceRefs: null,
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        exportProfile: "export_profile_unknown",
        exportVersion: "export_version_unknown",
        exportGeneratedAt: "1970-01-01T00:00:00.000Z",
        exportGeneratedBy: null,
        integrityScope: "review_artifact",
        sourceCollections: [],
        sourceRefs: [],
        signatureStatus: "not_signed",
        verificationStatus: "metadata_only",
        publicVerificationEnabled: false,
        cryptographicSigningEnabled: false,
        blockchainAnchoringEnabled: false,
      })
    );
  });
});
