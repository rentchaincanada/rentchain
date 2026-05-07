import { describe, expect, it } from "vitest";
import { derivePlatformCredentialingReadiness } from "../derivePlatformCredentialingReadiness";

const completeInput = {
  generatedAt: "2026-05-07T00:00:00.000Z",
  governanceReadiness: [{ governanceReadinessId: "governance-1", status: "ready_for_review" }],
  privacyReadiness: [{ privacyReadinessId: "privacy-1", status: "ready_for_review" }],
  consentGovernance: [{ consentGovernanceId: "consent-1", status: "ready_for_review" }],
  auditLineage: [{ eventId: "audit-1", eventType: "platform_credentialing_readiness_derived" }],
  verificationReadiness: [{ verificationReadinessId: "verification-1", status: "ready_for_review" }],
  interoperabilityReadiness: [{ adapterReadinessId: "adapter-1", status: "ready_for_review" }],
  institutionOnboardingReadiness: [{ onboardingReadinessId: "onboarding-1", status: "ready_for_review" }],
  operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "stable" }],
  evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
  operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
};

describe("derivePlatformCredentialingReadiness", () => {
  it("derives a deterministic ready-for-review profile with execution flags pinned off", () => {
    const readiness = derivePlatformCredentialingReadiness(completeInput);
    const repeat = derivePlatformCredentialingReadiness(completeInput);

    expect(readiness).toEqual(repeat);
    expect(readiness.status).toBe("ready_for_review");
    expect(readiness).toEqual(
      expect.objectContaining({
        manualApprovalRequired: true,
        consumerReportingExecutionEnabled: false,
        autonomousCredentialApprovalEnabled: false,
        publicCredentialExposureEnabled: false,
      })
    );
    expect(readiness.summary).toEqual(
      expect.objectContaining({
        totalReferences: 10,
        verifiedReferences: 10,
        restrictions: 0,
      })
    );
  });

  it("blocks unresolved governance, privacy, and consent restrictions", () => {
    const readiness = derivePlatformCredentialingReadiness({
      ...completeInput,
      governanceReadiness: [{ governanceReadinessId: "governance-1", status: "blocked" }],
      privacyReadiness: [{ privacyReadinessId: "privacy-1", status: "blocked" }],
      consentGovernance: [{ consentGovernanceId: "consent-1", status: "blocked" }],
    });

    expect(readiness.status).toBe("blocked");
    expect(readiness.credentialingRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "governance", status: "blocked" }),
        expect.objectContaining({ restrictionType: "privacy", status: "blocked" }),
        expect.objectContaining({ restrictionType: "consent", status: "blocked" }),
      ])
    );
  });

  it("requires review when critical consent, audit, evidence, or review lineage is missing", () => {
    const readiness = derivePlatformCredentialingReadiness({
      ...completeInput,
      consentGovernance: [],
      auditLineage: [],
      evidencePacks: [],
      operatorReviewSessions: [],
    });

    expect(readiness.status).toBe("review_required");
    expect(readiness.credentialingRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "consent", status: "review_required" }),
        expect.objectContaining({ restrictionType: "audit", status: "review_required" }),
        expect.objectContaining({ restrictionType: "evidence", status: "review_required" }),
        expect.objectContaining({ restrictionType: "review", status: "review_required" }),
      ])
    );
  });

  it("marks unresolved operational risk as partially ready without autonomous approval", () => {
    const readiness = derivePlatformCredentialingReadiness({
      ...completeInput,
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "elevated" }],
    });

    expect(readiness.status).toBe("partially_ready");
    expect(readiness.credentialingRestrictions).toEqual(
      expect.arrayContaining([expect.objectContaining({ restrictionType: "verification", status: "blocked" })])
    );
    expect(readiness.autonomousCredentialApprovalEnabled).toBe(false);
  });

  it("returns unknown when there is insufficient source context", () => {
    const readiness = derivePlatformCredentialingReadiness({});

    expect(readiness.status).toBe("unknown");
    expect(readiness.summary.unavailableReferences).toBeGreaterThan(0);
    expect(readiness.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["platform_credentialing_readiness_derived", "platform_credentialing_redaction_applied"])
    );
  });

  it("generates canonical events for restriction, review-required, blocked, and redaction paths", () => {
    const blocked = derivePlatformCredentialingReadiness({
      ...completeInput,
      privacyReadiness: [{ privacyReadinessId: "privacy-1", status: "blocked" }],
    });

    expect(blocked.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "platform_credentialing_readiness_derived",
        "platform_credentialing_redaction_applied",
        "platform_credentialing_restriction_detected",
        "platform_credentialing_blocked",
      ])
    );
  });
});
