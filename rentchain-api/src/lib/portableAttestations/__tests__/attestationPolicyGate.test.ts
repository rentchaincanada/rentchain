import { describe, expect, it } from "vitest";
import {
  assertPortableAttestationShareable,
  buildPolicySafeExportSummary,
  evaluateAttestationPolicy,
  type PortableAttestation,
} from "../index";

function attestation(overrides: Partial<PortableAttestation> = {}): PortableAttestation {
  return {
    attestationId: "attestation-policy-1",
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

function context(overrides = {}) {
  return {
    operation: "export" as const,
    requestedAudience: "insurer" as const,
    requestedPurpose: "insurance_review" as const,
    generatedAt: "2026-05-08T00:00:00.000Z",
    sensitivity: "confidential" as const,
    publicRequest: false,
    ...overrides,
  };
}

describe("attestation policy gate", () => {
  it("allows active consented audience-matched metadata attestations", () => {
    const decision = evaluateAttestationPolicy(attestation(), context());

    expect(decision.allowed).toBe(true);
    expect(decision.exportable).toBe(true);
    expect(decision.reasons).toEqual(["export_allowed"]);
  });

  it("builds export-safe summaries only when the policy allows export", () => {
    const result = buildPolicySafeExportSummary(attestation(), context());

    expect(result.decision.exportable).toBe(true);
    expect(result.exportSummary).toEqual(
      expect.objectContaining({
        attestationId: "attestation-policy-1",
        audience: "insurer",
        permittedPurpose: "insurance_review",
        rawProviderPayloadIncluded: false,
        supportMetadataIncluded: false,
        publicAccessEnabled: false,
      })
    );
    expect(JSON.stringify(result.exportSummary)).not.toContain("provider-reference");
    expect(JSON.stringify(result.exportSummary)).not.toContain("internal-reference");
  });

  it("blocks missing consent with machine-readable reasons", () => {
    const decision = evaluateAttestationPolicy(
      attestation({ consentScope: { ...attestation().consentScope, consentId: null, grantedAt: null } }),
      context()
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining(["deny_by_default", "consent_missing"]));
  });

  it("blocks audience and purpose mismatches", () => {
    const decision = evaluateAttestationPolicy(attestation(), context({ requestedAudience: "lender", requestedPurpose: "lender_review" }));

    expect(decision.allowed).toBe(false);
    expect(decision.reasons).toEqual(expect.arrayContaining(["audience_mismatch", "purpose_mismatch"]));
  });

  it("blocks expired, revoked, superseded, and reverification-required attestations", () => {
    const generatedAt = "2026-05-08T00:00:00.000Z";

    expect(evaluateAttestationPolicy(attestation({ expiresAt: "2026-05-01T00:00:00.000Z" }), context({ generatedAt })).reasons).toContain("expired");
    expect(evaluateAttestationPolicy(attestation({ revokedAt: "2026-05-01T00:00:00.000Z" }), context({ generatedAt })).reasons).toContain("revoked");
    expect(evaluateAttestationPolicy(attestation({ supersededAt: "2026-05-01T00:00:00.000Z" }), context({ generatedAt })).reasons).toContain("superseded");
    expect(evaluateAttestationPolicy(attestation({ nextReverificationAt: "2026-05-01T00:00:00.000Z" }), context({ generatedAt })).reasons).toContain("reverification_required");
  });

  it("blocks internal-only retention and public exposure contexts", () => {
    const retentionDecision = evaluateAttestationPolicy(attestation({ retentionClass: "audit_record" }), context());
    const publicDecision = evaluateAttestationPolicy(attestation(), context({ publicRequest: true }));
    const sensitivityDecision = evaluateAttestationPolicy(attestation(), context({ sensitivity: "restricted" }));
    const internalSensitivityDecision = evaluateAttestationPolicy(attestation(), context({ sensitivity: "internal" }));

    expect(retentionDecision.reasons).toContain("retention_not_portable");
    expect(publicDecision.reasons).toContain("public_exposure_blocked");
    expect(sensitivityDecision.reasons).toContain("sensitivity_blocked");
    expect(internalSensitivityDecision.reasons).toContain("sensitivity_blocked");
  });

  it("blocks raw payloads, support metadata, unsupported claims, and unsafe evidence", () => {
    expect(evaluateAttestationPolicy(attestation({ rawProviderPayloadIncluded: true as false }), context()).reasons).toContain("raw_payload_blocked");
    expect(evaluateAttestationPolicy(attestation({ supportMetadataIncluded: true as false }), context()).reasons).toContain("support_metadata_blocked");
    expect(evaluateAttestationPolicy(attestation({ unsupportedClaim: true as false }), context()).reasons).toContain("unsupported_claim");
    expect(
      evaluateAttestationPolicy(
        attestation({ evidenceSummary: { ...attestation().evidenceSummary, rawEvidenceIncluded: true as false } }),
        context()
      ).reasons
    ).toContain("unsafe_evidence_summary");
  });

  it("blocks source mismatches between evidence and source references", () => {
    const decision = evaluateAttestationPolicy(
      attestation({
        sourceReference: {
          ...attestation().sourceReference,
          sourceSystem: "property_trust",
        },
      }),
      context()
    );

    expect(decision.reasons).toContain("source_mismatch");
  });

  it("supports share policy decisions without exposing routes or share packages", () => {
    const decision = assertPortableAttestationShareable(attestation(), context({ operation: "share" }));

    expect(decision.allowed).toBe(true);
    expect(decision.shareable).toBe(true);
    expect(decision.exportable).toBe(false);
    expect(decision.reasons).toEqual(["share_allowed"]);
    expect(decision.publicAccessEnabled).toBe(false);
  });
});
