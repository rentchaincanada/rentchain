import { describe, expect, it } from "vitest";
import {
  deriveIdentityAssuranceSummary,
  identityAssuranceSignalsFromAttestations,
  type IdentityAssuranceAttestation,
} from "../index";

function attestation(overrides: Partial<IdentityAssuranceAttestation> = {}): IdentityAssuranceAttestation {
  return {
    attestationId: "attestation-1",
    subjectType: "tenant",
    subjectId: "tenant-1",
    level: "provider_identity_attested",
    status: "completed",
    lifecycleState: "completed",
    providerType: "identity_provider",
    providerKey: "future_provider",
    providerReferenceId: "provider-reference-sensitive",
    evidenceRef: "evidence-reference-sensitive",
    confidence: "high",
    consentScope: {
      consentId: "consent-1",
      purpose: "identity_assurance",
      grantedAt: "2026-05-01T00:00:00.000Z",
      expiresAt: "2026-11-01T00:00:00.000Z",
      revokedAt: null,
      institutionRecipientType: "none",
      attributeScopes: ["identity_status", "assurance_level"],
    },
    retentionClass: "provider_reference",
    issuedAt: "2026-05-01T00:00:00.000Z",
    completedAt: "2026-05-01T00:10:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
    revokedAt: null,
    nextReverificationAt: "2026-10-01T00:00:00.000Z",
    auditEventRef: "event-1",
    metadataOnly: true,
    rawSensitivePayloadStored: false,
    supportVisible: true,
    publicShareable: false,
    reviewRequired: false,
    redacted: false,
    ...overrides,
  };
}

describe("deriveIdentityAssuranceSummary", () => {
  it("defaults to a non-blocking not-started summary without provider integration", () => {
    const summary = deriveIdentityAssuranceSummary({
      subjectType: "tenant",
      subjectId: "tenant-1",
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(summary.status).toBe("not_started");
    expect(summary.level).toBe("not_assessed");
    expect(summary.onboardingBlocking).toBe(false);
    expect(summary.providerIntegrationEnabled).toBe(false);
    expect(summary.executionEligible).toBe(false);
    expect(summary.rawSensitivePayloadStored).toBe(false);
    expect(summary.supportSummary.rawIdentityDocumentVisible).toBe(false);
  });

  it("derives completed provider-neutral assurance with redacted support references", () => {
    const summary = deriveIdentityAssuranceSummary({
      subjectType: "tenant",
      subjectId: "tenant-1",
      attestations: [attestation()],
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(summary.status).toBe("completed");
    expect(summary.level).toBe("provider_identity_attested");
    expect(summary.assuranceLabel).toBe("Identity assurance completed through approved workflow");
    expect(summary.consentAvailable).toBe(true);
    expect(summary.signalSummary.completedAttestations).toBe(1);
    expect(summary.supportSummary.attestations[0]).toEqual(
      expect.objectContaining({
        providerReferenceRedacted: "***tive",
        evidenceRefRedacted: "***tive",
      })
    );
    expect(JSON.stringify(summary)).not.toContain("provider-reference-sensitive");
    expect(JSON.stringify(summary)).not.toContain("evidence-reference-sensitive");
    expect(summary.canonicalEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: "identity_assurance_completed", metadataOnly: true })])
    );
  });

  it("requires reverification without changing onboarding or execution flags", () => {
    const summary = deriveIdentityAssuranceSummary({
      subjectType: "applicant",
      subjectId: "applicant-1",
      attestations: [attestation({ nextReverificationAt: "2026-05-01T00:00:00.000Z" })],
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(summary.lifecycleState).toBe("reverification_required");
    expect(summary.reverificationRequired).toBe(true);
    expect(summary.onboardingBlocking).toBe(false);
    expect(summary.executionEligible).toBe(false);
    expect(summary.canonicalEvents).toEqual(
      expect.arrayContaining([expect.objectContaining({ eventType: "identity_assurance_reverification_required" })])
    );
  });

  it("ignores attestations that would imply raw sensitive payload custody", () => {
    const summary = deriveIdentityAssuranceSummary({
      attestations: [
        {
          ...attestation(),
          metadataOnly: true,
          rawSensitivePayloadStored: true as false,
        },
      ],
    });

    expect(summary.status).toBe("not_started");
    expect(summary.signalSummary.totalAttestations).toBe(0);
    expect(summary.rawSensitivePayloadStored).toBe(false);
  });

  it("converts completed attestations into conservative account-trust signals", () => {
    const signals = identityAssuranceSignalsFromAttestations({
      attestations: [attestation({ level: "business_attested", subjectType: "business_entity", subjectId: "business-1" })],
      generatedAt: "2026-05-08T00:00:00.000Z",
    });

    expect(signals).toEqual([
      expect.objectContaining({
        signalType: "business",
        subjectType: "organization",
        subjectId: "business-1",
        status: "verified",
        source: "future_identity_provider",
        evidenceType: "provider_reference",
        rawSensitivePayloadStored: false,
      }),
    ]);
  });
});
