import { describe, expect, it } from "vitest";
import { derivePortableAttestationSummary, type PortableAttestation } from "../index";

function attestation(overrides: Partial<PortableAttestation> = {}): PortableAttestation {
  return {
    attestationId: "portable-attestation-1",
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
      consentId: "consent-portable-1",
      purpose: "insurance_review",
      audience: "insurer",
      grantedAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-08-01T00:00:00.000Z",
      revokedAt: null,
      claimCategories: ["identity_assurance"],
      attributeScopes: ["assurance_level", "status", "timestamps"],
    },
    retentionClass: "portable_metadata",
    evidenceSummary: {
      evidenceCategory: "provider_reference",
      sourceSystem: "identity_assurance",
      sourceCategory: "provider_neutral_identity_assurance",
      sourceVersion: "identity_assurance.v1",
      auditEventRef: "audit-event-sensitive",
      rawEvidenceIncluded: false,
    },
    sourceReference: {
      sourceSystem: "identity_assurance",
      sourceId: "identity-assurance-source-sensitive",
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
    internalReferenceId: "internal-reference-sensitive",
    providerReferenceId: "provider-reference-sensitive",
    ...overrides,
  };
}

describe("derivePortableAttestationSummary", () => {
  it("derives export-safe summaries only from consent-scoped metadata-only attestations", () => {
    const summary = derivePortableAttestationSummary({
      attestations: [attestation()],
      requestedAudience: "insurer",
      requestedPurpose: "insurance_review",
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(summary.exportReady).toBe(true);
    expect(summary.publicAccessEnabled).toBe(false);
    expect(summary.externalSubmissionEnabled).toBe(false);
    expect(summary.rawSensitivePayloadStored).toBe(false);
    expect(summary.exportSummaries).toEqual([
      expect.objectContaining({
        schemaVersion: "portable_attestation.v1",
        status: "active",
        lifecycleState: "export_ready",
        audience: "insurer",
        permittedPurpose: "insurance_review",
        consentReferenceId: "consent-portable-1",
        metadataOnly: true,
        rawEvidenceIncluded: false,
        rawProviderPayloadIncluded: false,
        supportMetadataIncluded: false,
        publicAccessEnabled: false,
      }),
    ]);
    expect(JSON.stringify(summary.exportSummaries)).not.toContain("provider-reference-sensitive");
    expect(JSON.stringify(summary.exportSummaries)).not.toContain("internal-reference-sensitive");
    expect(JSON.stringify(summary.exportSummaries)).not.toContain("identity-assurance-source-sensitive");
  });

  it("requires active claim-level consent before export portability", () => {
    const summary = derivePortableAttestationSummary({
      attestations: [
        attestation({
          consentScope: {
            ...attestation().consentScope,
            consentId: null,
            grantedAt: null,
          },
        }),
      ],
      requestedAudience: "insurer",
      requestedPurpose: "insurance_review",
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(summary.exportReady).toBe(false);
    expect(summary.exportSummaries).toHaveLength(0);
    expect(summary.supportSummaries[0].status).toBe("pending_consent");
    expect(summary.policyDecisions[0].reasons).toContain("consent_missing");
    expect(summary.blockedReasons).toEqual(
      expect.arrayContaining([
        "portable-attestation-1: active claim-level consent is required before portability.",
        "portable-attestation-1: consent_missing",
      ])
    );
  });

  it("blocks raw payload, public exposure, support metadata, and unsupported claim attempts", () => {
    const summary = derivePortableAttestationSummary({
      attestations: [
        attestation({ rawProviderPayloadIncluded: true as false }),
        attestation({ attestationId: "public-attempt", publicAccessEnabled: true as false }),
        attestation({ attestationId: "support-attempt", supportMetadataIncluded: true as false }),
        attestation({ attestationId: "unsupported-claim", unsupportedClaim: true as false }),
      ],
      requestedAudience: "insurer",
      requestedPurpose: "insurance_review",
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(summary.exportReady).toBe(false);
    expect(summary.exportSummaries).toHaveLength(0);
    expect(summary.supportSummaries.map((item) => item.status)).toEqual(["blocked", "blocked", "blocked", "blocked"]);
    expect(summary.blockedReasons).toEqual(
      expect.arrayContaining([
        "portable-attestation-1: portable attestation blocked by metadata-only/privacy guardrails.",
        "public-attempt: portable attestation blocked by metadata-only/privacy guardrails.",
        "support-attempt: portable attestation blocked by metadata-only/privacy guardrails.",
        "unsupported-claim: portable attestation blocked by metadata-only/privacy guardrails.",
      ])
    );
  });

  it("derives revocation, expiration, and reverification lifecycle states", () => {
    const summary = derivePortableAttestationSummary({
      attestations: [
        attestation({ attestationId: "revoked", revokedAt: "2026-05-02T00:00:00.000Z" }),
        attestation({ attestationId: "expired", expiresAt: "2026-05-01T00:00:00.000Z" }),
        attestation({
          attestationId: "consent-revoked",
          consentScope: {
            ...attestation().consentScope,
            revokedAt: "2026-05-02T00:00:00.000Z",
          },
        }),
        attestation({
          attestationId: "consent-expired",
          consentScope: {
            ...attestation().consentScope,
            expiresAt: "2026-05-01T00:00:00.000Z",
          },
        }),
        attestation({ attestationId: "reverify", nextReverificationAt: "2026-05-01T00:00:00.000Z" }),
      ],
      generatedAt: "2026-05-08T00:00:00.000Z",
      requestedAudience: "insurer",
      requestedPurpose: "insurance_review",
    });

    expect(summary.exportSummaries).toHaveLength(0);
    expect(summary.policyDecisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attestationId: "reverify", reasons: expect.arrayContaining(["reverification_required"]) }),
      ])
    );
    expect(summary.supportSummaries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ attestationId: "revoked", lifecycleState: "revoked" }),
        expect.objectContaining({ attestationId: "expired", lifecycleState: "expired" }),
        expect.objectContaining({ attestationId: "consent-revoked", lifecycleState: "revoked" }),
        expect.objectContaining({ attestationId: "consent-expired", lifecycleState: "expired" }),
        expect.objectContaining({ attestationId: "reverify", lifecycleState: "reverification_required" }),
      ])
    );
  });

  it("keeps support visibility separate and redacted", () => {
    const summary = derivePortableAttestationSummary({
      attestations: [attestation()],
      requestedAudience: "insurer",
      requestedPurpose: "insurance_review",
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(summary.supportSummaries[0]).toEqual(
      expect.objectContaining({
        consentIdRedacted: "***le-1",
        internalReferenceRedacted: "***tive",
        providerReferenceRedacted: "***tive",
        sourceIdRedacted: "***tive",
        rawProviderPayloadVisible: false,
        rawEvidenceVisible: false,
        supportMetadataPortable: false,
      })
    );
    expect(JSON.stringify(summary.supportSummaries)).not.toContain("provider-reference-sensitive");
    expect(JSON.stringify(summary.supportSummaries)).not.toContain("identity-assurance-source-sensitive");
  });

  it("aligns source references without exposing raw source identifiers in portable summaries", () => {
    const summary = derivePortableAttestationSummary({
      attestations: [
        attestation({
          attestationId: "property-authority",
          attestationType: "property_authority",
          subjectType: "property",
          subjectId: "property:property-1",
          claimCategory: "property_authority",
          issuerCategory: "property_registry",
          consentScope: {
            ...attestation().consentScope,
            claimCategories: ["property_authority"],
          },
          evidenceSummary: {
            evidenceCategory: "registry_record",
            sourceSystem: "property_trust",
            sourceCategory: "registry_linkage",
            sourceVersion: "property_trust.v1",
            auditEventRef: "property-audit-event-sensitive",
            rawEvidenceIncluded: false,
          },
          sourceReference: {
            sourceSystem: "property_trust",
            sourceId: "property-trust-source-sensitive",
            sourceAttestationId: "property-trust-1",
            sourceVersion: "property_trust.v1",
          },
          nonAuthorityDisclaimers: ["Property authority metadata is not a legal ownership conclusion."],
        }),
      ],
      requestedAudience: "insurer",
      requestedPurpose: "insurance_review",
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(summary.exportSummaries[0]).toEqual(
      expect.objectContaining({
        attestationType: "property_authority",
        sourceSystem: "property_trust",
        evidenceCategory: "registry_record",
      })
    );
    expect(summary.exportSummaries[0].nonAuthorityDisclaimers).toContain(
      "Property authority metadata is not a legal ownership conclusion."
    );
    expect(JSON.stringify(summary.exportSummaries)).not.toContain("property-trust-source-sensitive");
  });
});
