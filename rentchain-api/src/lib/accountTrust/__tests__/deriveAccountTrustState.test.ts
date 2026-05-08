import { describe, expect, it } from "vitest";
import { deriveAccountTrustState } from "../deriveAccountTrustState";
import { verificationSignal } from "../verificationSignalFactory";

describe("deriveAccountTrustState", () => {
  it("keeps self-asserted account context at asserted trust without execution eligibility", () => {
    const state = deriveAccountTrustState({
      subjectType: "tenant",
      subjectId: "tenant-1",
      generatedAt: "2026-05-08T00:00:00.000Z",
      signals: [
        verificationSignal({
          signalType: "identity",
          subjectType: "tenant",
          subjectId: "tenant-1",
          status: "asserted",
          source: "self_asserted",
        }),
      ],
    });

    expect(state.trustLevel).toBe("asserted");
    expect(state.manualReviewRequired).toBe(true);
    expect(state.providerIntegrationEnabled).toBe(false);
    expect(state.executionEligible).toBe(false);
    expect(state.rawSensitivePayloadStored).toBe(false);
    expect(state.signalSummary.assertedSignals).toBe(1);
    expect(state.missingSignals).toEqual(expect.arrayContaining(["email", "phone", "identity"]));
  });

  it("derives authenticated trust from email and phone verification metadata", () => {
    const state = deriveAccountTrustState({
      subjectType: "applicant",
      subjectId: "applicant-1",
      signals: [
        verificationSignal({
          signalType: "email",
          subjectType: "applicant",
          subjectId: "applicant-1",
          status: "verified",
          source: "email_verification",
          verifiedAt: "2026-05-01T00:00:00.000Z",
        }),
        verificationSignal({
          signalType: "phone",
          subjectType: "applicant",
          subjectId: "applicant-1",
          status: "verified",
          source: "phone_otp",
          verifiedAt: "2026-05-01T00:00:00.000Z",
        }),
      ],
    });

    expect(state.trustLevel).toBe("platform_correlated");
    expect(state.signalSummary.verifiedSignals).toBe(2);
    expect(state.canonicalEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "email_verified" }),
        expect.objectContaining({ eventType: "phone_verified" }),
      ])
    );
  });

  it("derives platform-correlated trust when authenticated contact aligns with screening", () => {
    const state = deriveAccountTrustState({
      subjectType: "tenant",
      subjectId: "tenant-2",
      signals: [
        verificationSignal({
          signalType: "email",
          subjectType: "tenant",
          subjectId: "tenant-2",
          status: "verified",
          source: "email_verification",
        }),
        verificationSignal({
          signalType: "screening",
          subjectType: "tenant",
          subjectId: "tenant-2",
          status: "verified",
          source: "screening_workflow",
          evidenceType: "screening_order",
          confidence: "medium",
          evidenceRef: "screening-1",
        }),
      ],
    });

    expect(state.trustLevel).toBe("platform_correlated");
    expect(state.signalSummary.verifiedSignals).toBe(2);
    expect(state.canonicalEvents).toEqual(expect.arrayContaining([expect.objectContaining({ eventType: "screening_verified" })]));
  });

  it("derives provider-attested trust from registry/provider metadata without raw payload custody", () => {
    const state = deriveAccountTrustState({
      subjectType: "property",
      subjectId: "property-1",
      signals: [
        verificationSignal({
          signalType: "property",
          subjectType: "property",
          subjectId: "property-1",
          status: "verified",
          source: "public_registry",
          evidenceType: "registry_record",
          confidence: "high",
          providerKey: "public_registry",
          evidenceRef: "registry-1",
        }),
      ],
    });

    expect(state.trustLevel).toBe("provider_attested");
    expect(state.signalSummary.providerAttestedSignals).toBe(1);
    expect(JSON.stringify(state)).not.toContain("passport");
    expect(state.redactions).toEqual(expect.arrayContaining(["Raw government identity documents are excluded."]));
  });

  it("records pending identity verification and trust level changes as metadata-only events", () => {
    const state = deriveAccountTrustState({
      subjectType: "tenant",
      subjectId: "tenant-3",
      previousTrustLevel: "asserted",
      signals: [
        verificationSignal({
          signalType: "email",
          subjectType: "tenant",
          subjectId: "tenant-3",
          status: "verified",
          source: "email_verification",
        }),
        verificationSignal({
          signalType: "identity",
          subjectType: "tenant",
          subjectId: "tenant-3",
          status: "pending",
          source: "future_identity_provider",
          evidenceType: "provider_reference",
          providerKey: "future_identity_provider",
          reviewRequired: true,
        }),
      ],
    });

    expect(state.trustLevel).toBe("authenticated");
    expect(state.signalSummary.pendingSignals).toBe(1);
    expect(state.signalSummary.reviewRequiredSignals).toBe(1);
    expect(state.canonicalEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "account_verification_started", metadataOnly: true }),
        expect.objectContaining({ eventType: "identity_verification_requested", metadataOnly: true }),
        expect.objectContaining({ eventType: "trust_level_changed", metadataOnly: true }),
      ])
    );
  });
});
