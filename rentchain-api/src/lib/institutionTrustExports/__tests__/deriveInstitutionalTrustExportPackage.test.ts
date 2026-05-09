import { describe, expect, it } from "vitest";
import { deriveInstitutionalTrustExportPackage } from "../deriveInstitutionalTrustExportPackage";
import type { PortableAttestation } from "../../portableAttestations/portableAttestationTypes";

function attestation(overrides: Partial<PortableAttestation> = {}): PortableAttestation {
  return {
    attestationId: "trust-export-attestation-1",
    attestationType: "identity_assurance",
    subjectType: "tenant",
    subjectId: "tenant:tenant-1",
    claimCategory: "identity_assurance",
    claimLabel: "Identity assurance metadata present",
    claimDescription: "Identity assurance metadata is present through an approved workflow.",
    status: "active",
    lifecycleState: "export_ready",
    issuerCategory: "identity_provider",
    audience: "insurer",
    consentScope: {
      consentId: "consent-1",
      purpose: "insurance_review",
      audience: "insurer",
      grantedAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-08-01T00:00:00.000Z",
      revokedAt: null,
      claimCategories: ["identity_assurance"],
      attributeScopes: ["status", "timestamps"],
    },
    retentionClass: "portable_metadata",
    evidenceSummary: {
      evidenceCategory: "provider_reference",
      sourceSystem: "identity_assurance",
      sourceCategory: "provider_neutral_identity_assurance",
      sourceVersion: "identity_assurance.v1",
      auditEventRef: "event-1",
      rawEvidenceIncluded: false,
    },
    sourceReference: {
      sourceSystem: "identity_assurance",
      sourceId: "identity-source-1",
      sourceAttestationId: "identity-assurance-1",
      sourceVersion: "identity_assurance.v1",
    },
    confidence: "high",
    issuedAt: "2026-05-01T00:00:00.000Z",
    effectiveAt: "2026-05-01T00:10:00.000Z",
    expiresAt: "2026-08-01T00:00:00.000Z",
    revokedAt: null,
    supersededAt: null,
    nextReverificationAt: "2026-07-01T00:00:00.000Z",
    jurisdiction: "CA",
    redactionProfile: "strict",
    metadataOnly: true,
    rawSensitivePayloadStored: false,
    rawProviderPayloadIncluded: false,
    supportMetadataIncluded: false,
    publicAccessEnabled: false,
    externalSubmissionEnabled: false,
    unsupportedClaim: false,
    supportVisible: true,
    reviewRequired: false,
    nonAuthorityDisclaimers: ["RentChain stores metadata only and is not the identity authority."],
    internalReferenceId: "internal-reference",
    providerReferenceId: "provider-reference",
    ...overrides,
  };
}

describe("deriveInstitutionalTrustExportPackage", () => {
  it("builds a policy-gated insurer export package from consent-scoped portable attestations", () => {
    const pkg = deriveInstitutionalTrustExportPackage({
      exportId: "trust-export-1",
      audience: "insurer",
      purpose: "insurance_review",
      generatedAt: "2026-05-08T00:00:00.000Z",
      attestations: [attestation()],
    });

    expect(pkg).toEqual(
      expect.objectContaining({
        exportId: "trust-export-1",
        schemaVersion: "institutional_trust_export.v1",
        audience: "insurer",
        purpose: "insurance_review",
        status: "export_ready",
        lifecycle: "policy_evaluated",
        lifecycleControl: expect.objectContaining({
          schemaVersion: "institutional_trust_export_lifecycle_control.v1",
          state: "active",
          active: true,
          shareable: true,
          metadataOnly: true,
          publicAccessEnabled: false,
          externalSubmissionEnabled: false,
        }),
        metadataOnly: true,
        consentScoped: true,
        policyGated: true,
        manualOnly: true,
        publicAccessEnabled: false,
        externalSubmissionEnabled: false,
      })
    );
    expect(pkg.exportSummaries).toHaveLength(1);
    expect(pkg.policyDecisions[0].reasons).toEqual(["export_allowed"]);
    expect(pkg.auditMetadata).toEqual(
      expect.objectContaining({
        exportableAttestationCount: 1,
        blockedAttestationCount: 0,
        policyDecisionCount: 1,
      })
    );
  });

  it("blocks revoked, expired, and reverification-required attestations through the policy gate", () => {
    const pkg = deriveInstitutionalTrustExportPackage({
      audience: "insurer",
      purpose: "insurance_review",
      generatedAt: "2026-05-08T00:00:00.000Z",
      attestations: [
        attestation({ attestationId: "revoked", revokedAt: "2026-05-02T00:00:00.000Z" }),
        attestation({ attestationId: "expired", expiresAt: "2026-05-01T00:00:00.000Z" }),
        attestation({ attestationId: "reverify", nextReverificationAt: "2026-05-01T00:00:00.000Z" }),
      ],
    });

    expect(pkg.status).toBe("blocked");
    expect(pkg.exportSummaries).toHaveLength(0);
    expect(pkg.blockedReasons).toEqual(
      expect.arrayContaining([
        "revoked: revoked",
        "expired: expired",
        "reverify: reverification_required",
      ])
    );
    expect(pkg.auditMetadata.blockedAttestationCount).toBe(3);
    expect(pkg.lifecycleControl.state).toBe("reverification_required");
    expect(pkg.lifecycleControl.active).toBe(false);
  });

  it("enforces audience restrictions and excludes raw/internal references from export payloads", () => {
    const lenderPackage = deriveInstitutionalTrustExportPackage({
      audience: "lender",
      purpose: "lender_review",
      generatedAt: "2026-05-08T00:00:00.000Z",
      attestations: [attestation()],
    });
    const insurerPackage = deriveInstitutionalTrustExportPackage({
      audience: "insurer",
      purpose: "insurance_review",
      generatedAt: "2026-05-08T00:00:00.000Z",
      attestations: [attestation()],
    });

    expect(lenderPackage.status).toBe("blocked");
    expect(lenderPackage.blockedReasons).toEqual(expect.arrayContaining(["trust-export-attestation-1: audience_mismatch"]));
    expect(JSON.stringify(insurerPackage.exportSummaries)).not.toContain("provider-reference");
    expect(JSON.stringify(insurerPackage.exportSummaries)).not.toContain("internal-reference");
    expect(JSON.stringify(insurerPackage.exportSummaries)).not.toContain("identity-source-1");
  });

  it("blocks internal-review contexts instead of treating them as portable exports", () => {
    const pkg = deriveInstitutionalTrustExportPackage({
      audience: "internal_review",
      purpose: "internal_review",
      generatedAt: "2026-05-08T00:00:00.000Z",
      attestations: [attestation()],
    });

    expect(pkg.status).toBe("blocked");
    expect(pkg.policyDecisions).toHaveLength(0);
    expect(pkg.blockedReasons).toContain("Institutional trust export audience and purpose are not portable in this context.");
  });

  it("blocks raw payload, support metadata, and unsupported claims", () => {
    const pkg = deriveInstitutionalTrustExportPackage({
      audience: "insurer",
      purpose: "insurance_review",
      generatedAt: "2026-05-08T00:00:00.000Z",
      attestations: [
        attestation({ attestationId: "raw", rawProviderPayloadIncluded: true as false }),
        attestation({ attestationId: "support", supportMetadataIncluded: true as false }),
        attestation({ attestationId: "unsupported", unsupportedClaim: true as false }),
      ],
    });

    expect(pkg.exportSummaries).toHaveLength(0);
    expect(pkg.blockedReasons).toEqual(
      expect.arrayContaining([
        "raw: raw_payload_blocked",
        "support: support_metadata_blocked",
        "unsupported: unsupported_claim",
      ])
    );
  });
});
