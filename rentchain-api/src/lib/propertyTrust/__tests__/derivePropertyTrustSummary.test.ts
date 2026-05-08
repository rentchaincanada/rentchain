import { describe, expect, it } from "vitest";
import {
  derivePropertyTrustSummary,
  propertyTrustSignalsFromAttestations,
  type PropertyVerificationAttestation,
} from "../index";

function attestation(overrides: Partial<PropertyVerificationAttestation> = {}): PropertyVerificationAttestation {
  return {
    attestationId: "property-attestation-1",
    subjectType: "property",
    subjectId: "property-1",
    propertyId: "property-1",
    accountId: "landlord-1",
    businessId: "business-1",
    relationshipType: "registry_linked",
    businessStatus: "completed",
    propertyStatus: "registry_linked",
    operatorAuthorityStatus: "partially_supported",
    registryLinkStatus: "linked",
    evidenceType: "registry_record",
    providerType: "public_registry",
    providerKey: "halifax_r400",
    providerReferenceId: "registry-reference-sensitive",
    evidenceRef: "property-evidence-sensitive",
    confidence: "medium",
    consentScope: {
      consentId: "consent-property-1",
      purpose: "property_verification",
      grantedAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-11-01T00:00:00.000Z",
      revokedAt: null,
      institutionRecipientType: "none",
      attributeScopes: ["registry_status", "authority_summary"],
    },
    retentionClass: "registry_reference",
    issuedAt: "2026-05-01T00:00:00.000Z",
    completedAt: "2026-05-01T00:10:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
    revokedAt: null,
    nextReverificationAt: "2026-10-01T00:00:00.000Z",
    auditEventRef: "event-property-1",
    metadataOnly: true,
    rawSensitivePayloadStored: false,
    supportVisible: true,
    publicShareable: false,
    onboardingBlocking: false,
    executionEligible: false,
    legalOwnershipConclusion: false,
    reviewRequired: false,
    redacted: false,
    ...overrides,
  };
}

describe("derivePropertyTrustSummary", () => {
  it("defaults to non-blocking metadata-only authority state", () => {
    const summary = derivePropertyTrustSummary({
      subjectType: "property",
      subjectId: "property-1",
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(summary.trustLabel).toBe("Property authority not verified");
    expect(summary.businessStatus).toBe("not_started");
    expect(summary.propertyStatus).toBe("not_started");
    expect(summary.operatorAuthorityStatus).toBe("not_asserted");
    expect(summary.liveRegistryIntegrationEnabled).toBe(false);
    expect(summary.onboardingBlocking).toBe(false);
    expect(summary.executionEligible).toBe(false);
    expect(summary.legalOwnershipConclusion).toBe(false);
    expect(summary.supportSummary.rawTitleDocumentVisible).toBe(false);
  });

  it("derives registry-linked property trust without ownership conclusions", () => {
    const summary = derivePropertyTrustSummary({
      subjectType: "property",
      subjectId: "property-1",
      attestations: [attestation()],
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(summary.trustLabel).toBe("Registry linkage established");
    expect(summary.businessStatus).toBe("completed");
    expect(summary.propertyStatus).toBe("registry_linked");
    expect(summary.registryLinkStatus).toBe("linked");
    expect(summary.authorityConfidence).toBe("medium");
    expect(summary.legalOwnershipConclusion).toBe(false);
    expect(summary.supportSummary.attestations[0]).toEqual(
      expect.objectContaining({
        providerReferenceRedacted: "***tive",
        evidenceRefRedacted: "***tive",
      })
    );
    expect(JSON.stringify(summary)).not.toContain("registry-reference-sensitive");
    expect(JSON.stringify(summary)).not.toContain("property-evidence-sensitive");
    expect(summary.canonicalEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: "property_registry_linked", metadataOnly: true })])
    );
  });

  it("prefers institution-reviewed operator authority when present", () => {
    const summary = derivePropertyTrustSummary({
      subjectType: "operator",
      subjectId: "operator-1",
      attestations: [
        attestation({
          subjectType: "operator",
          subjectId: "operator-1",
          relationshipType: "institution_reviewed",
          operatorAuthorityStatus: "institution_reviewed",
          providerType: "institution_review",
          confidence: "high",
        }),
      ],
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(summary.trustLabel).toBe("Institution-reviewed operator authority");
    expect(summary.operatorAuthorityStatus).toBe("institution_reviewed");
    expect(summary.relationshipType).toBe("institution_reviewed");
    expect(summary.authorityConfidence).toBe("high");
    expect(summary.canonicalEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: "operator_authority_confirmed" })])
    );
  });

  it("ignores attestations that imply raw payload custody or legal ownership conclusions", () => {
    const summary = derivePropertyTrustSummary({
      attestations: [
        attestation({
          rawSensitivePayloadStored: true as false,
        }),
        attestation({
          attestationId: "ownership-conclusion",
          legalOwnershipConclusion: true as false,
        }),
      ],
    });

    expect(summary.signalSummary.totalAttestations).toBe(0);
    expect(summary.propertyStatus).toBe("not_started");
    expect(summary.rawSensitivePayloadStored).toBe(false);
    expect(summary.legalOwnershipConclusion).toBe(false);
  });

  it("converts completed metadata attestations into conservative account-trust signals", () => {
    const signals = propertyTrustSignalsFromAttestations({
      attestations: [attestation({ operatorAuthorityStatus: "externally_supported", propertyStatus: "completed" })],
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalType: "business",
          subjectType: "property",
          evidenceRef: "property_trust:property-attestation-1",
          rawSensitivePayloadStored: false,
        }),
        expect.objectContaining({
          signalType: "property",
          subjectType: "property",
          source: "public_registry",
          evidenceType: "registry_record",
        }),
      ])
    );
  });
});
