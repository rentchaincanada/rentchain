import { describe, expect, it } from "vitest";
import { deriveIdentityProfile } from "../deriveIdentityProfile";

describe("deriveIdentityProfile", () => {
  it("derives a verified tenant profile from verification and consent lineage", () => {
    const profile = deriveIdentityProfile({
      identityType: "tenant",
      identityId: "tenant-1",
      generatedAt: "2026-01-01T00:00:00.000Z",
      tenant: { id: "tenant-1", screeningId: "screening-1", createdAt: "2025-12-01T00:00:00.000Z" },
      consentRecords: [{ id: "consent-1", scope: "screening consent", signedAt: "2025-12-01T00:00:00.000Z" }],
      reviewSessions: [{ id: "review-1", openedAt: "2025-12-02T00:00:00.000Z" }],
    });

    expect(profile).toEqual(
      expect.objectContaining({
        identityId: "tenant:tenant-1",
        identityType: "tenant",
        status: "verified",
        manualReviewRequired: true,
        publiclyShareable: false,
        externalInstitutionSharingEnabled: false,
        tokenizationEnabled: false,
      })
    );
    expect(profile.verificationSummary.verifiedReferences).toBeGreaterThan(0);
    expect(profile.trustState).toEqual(
      expect.objectContaining({
        trustLevel: "institution_reviewed",
        manualReviewRequired: true,
        rawSensitivePayloadStored: false,
        executionEligible: false,
      })
    );
    expect(profile.identityAssurance).toEqual(
      expect.objectContaining({
        status: "not_started",
        level: "not_assessed",
        rawSensitivePayloadStored: false,
        onboardingBlocking: false,
      })
    );
    expect(profile.consentSummary.consentAvailable).toBe(true);
    expect(profile.reviewReferences).toHaveLength(1);
    expect(profile.canonicalEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "identity_profile_derived" }),
        expect.objectContaining({ eventType: "identity_verification_reference_attached" }),
        expect.objectContaining({ eventType: "identity_consent_reference_attached" }),
      ])
    );
  });

  it("requires review when tenant consent lineage is missing", () => {
    const profile = deriveIdentityProfile({
      identityType: "tenant",
      identityId: "tenant-2",
      tenant: { id: "tenant-2", screeningId: "screening-2" },
    });

    expect(profile.status).toBe("partially_verified");
    expect(profile.trustState.trustLevel).toBe("asserted");
    expect(profile.consentSummary.missingConsentReasons).toContain("Consent lineage reference is missing.");
    expect(profile.portabilitySummary.portabilityStatus).toBe("limited");
  });

  it("derives verified property identity from registry linkage", () => {
    const profile = deriveIdentityProfile({
      identityType: "property",
      identityId: "property-1",
      property: { id: "property-1", createdAt: "2025-01-01T00:00:00.000Z" },
      registryStatus: { id: "registry-1", status: "verified", verifiedAt: "2025-01-02T00:00:00.000Z" },
      consentRecords: [{ id: "consent-1", scope: "portfolio operations consent" }],
    });

    expect(profile.status).toBe("verified");
    expect(profile.trustState.trustLevel).toBe("provider_attested");
    expect(profile.verificationReferences).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Registry verification reference", status: "available" })])
    );
  });

  it("blocks conflicting identity references deterministically", () => {
    const profile = deriveIdentityProfile({
      identityType: "tenant",
      identityId: "tenant-3",
      tenant: { id: "tenant-3", screeningId: "screening-3", identityConflict: true },
      consentRecords: [{ id: "consent-3", scope: "screening consent" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.blockedReasons).toContain("Conflicting identity reference requires manual review.");
    expect(profile.canonicalEvents).toEqual(expect.arrayContaining([expect.objectContaining({ eventType: "identity_blocked" })]));
  });

  it("returns unknown when source context is unavailable", () => {
    const profile = deriveIdentityProfile({ identityType: "operator", identityId: "operator-1" });

    expect(profile.status).toBe("unknown");
    expect(profile.verificationSummary.missingReferences).toBeGreaterThan(0);
  });

  it("excludes sensitive raw identity payloads from the read model", () => {
    const profile = deriveIdentityProfile({
      identityType: "tenant",
      identityId: "tenant-sensitive",
      tenant: {
        id: "tenant-sensitive",
        screeningId: "screening-sensitive",
        governmentIdRaw: "sensitive-government-id-value",
        creditPayload: "sensitive-credit-payload",
        paymentAccount: "sensitive-payment-account",
      },
      consentRecords: [{ id: "consent-sensitive", scope: "screening consent" }],
    });

    const serialized = JSON.stringify(profile);
    expect(serialized).not.toContain("sensitive-government-id-value");
    expect(serialized).not.toContain("sensitive-credit-payload");
    expect(serialized).not.toContain("sensitive-payment-account");
    expect(profile.redactions).toEqual(expect.arrayContaining(["Raw screening and credit bureau payloads are excluded."]));
    expect(profile.trustState.redactions).toEqual(expect.arrayContaining(["Raw government identity documents are excluded."]));
  });

  it("aligns provider-neutral identity assurance with account trust without exposing raw provider references", () => {
    const profile = deriveIdentityProfile({
      identityType: "tenant",
      identityId: "tenant-assured",
      generatedAt: "2026-05-08T00:00:00.000Z",
      tenant: { id: "tenant-assured", createdAt: "2026-05-01T00:00:00.000Z" },
      consentRecords: [{ id: "consent-assurance", scope: "identity assurance consent" }],
      identityAssuranceAttestations: [
        {
          attestationId: "attestation-1",
          subjectType: "tenant",
          subjectId: "tenant-assured",
          level: "provider_identity_attested",
          status: "completed",
          lifecycleState: "completed",
          providerType: "identity_provider",
          providerKey: "future_provider",
          providerReferenceId: "provider-reference-sensitive",
          evidenceRef: "evidence-reference-sensitive",
          confidence: "high",
          consentScope: {
            consentId: "consent-assurance",
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
        },
      ],
    });

    expect(profile.identityAssurance).toEqual(
      expect.objectContaining({
        status: "completed",
        level: "provider_identity_attested",
        providerIntegrationEnabled: false,
        onboardingBlocking: false,
        publicShareable: false,
      })
    );
    expect(profile.trustState.trustLevel).toBe("provider_attested");
    expect(profile.identityAssurance.supportSummary.attestations[0]).toEqual(
      expect.objectContaining({
        providerReferenceRedacted: "***tive",
        evidenceRefRedacted: "***tive",
      })
    );
    expect(JSON.stringify(profile)).not.toContain("provider-reference-sensitive");
    expect(JSON.stringify(profile)).not.toContain("evidence-reference-sensitive");
  });
});
