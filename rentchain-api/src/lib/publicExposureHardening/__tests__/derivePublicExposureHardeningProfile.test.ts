import { describe, expect, it } from "vitest";
import { derivePublicExposureHardeningProfile } from "../derivePublicExposureHardeningProfile";

const completeInput = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  releaseGovernanceProfiles: [{ releaseGovernanceId: "release-1", status: "ready_for_review" }],
  rollbackArtifacts: [{ artifactId: "rollback-1", status: "verified" }],
  securityReadiness: [{ securityReadinessId: "security-1", status: "verified" }],
  operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "stable" }],
  institutionOnboardingReadiness: [{ onboardingReadinessId: "onboarding-1", status: "ready_for_review" }],
  supportReadiness: [{ supportReadinessId: "support-1", status: "ready_for_review" }],
  operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
  evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
  auditEvents: [{ eventId: "event-1", eventType: "release_governance_profile_derived" }],
};

describe("derivePublicExposureHardeningProfile", () => {
  it("derives deterministic ready-for-review hardening with fixed safety flags", () => {
    const profile = derivePublicExposureHardeningProfile(completeInput);

    expect(profile).toEqual(
      expect.objectContaining({
        status: "ready_for_review",
        manualApprovalRequired: true,
        autonomousLaunchEnabled: false,
        autonomousRollbackEnabled: false,
        publicExposureEnabled: false,
      })
    );
    expect(profile.summary.totalReferences).toBe(9);
    expect(profile.summary.verifiedReferences).toBe(9);
    expect(profile.publicExposureRestrictions).toEqual([]);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("public_exposure_hardening_profile_derived");
    expect(JSON.stringify(profile)).not.toContain("secret-value");
  });

  it("blocks public exposure hardening for unresolved operational risk or security restrictions", () => {
    const profile = derivePublicExposureHardeningProfile({
      ...completeInput,
      securityReadiness: [{ securityReadinessId: "security-1", status: "blocked" }],
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "elevated" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.publicExposureRestrictions.map((restriction) => restriction.status)).toContain("blocked");
    expect(profile.blockedReasons).toEqual(
      expect.arrayContaining(["Security readiness restriction is unresolved.", "Unresolved operational risk blocks public exposure readiness."])
    );
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("public_exposure_blocked");
  });

  it("requires review when critical release, rollback, evidence, or review lineage is missing", () => {
    const profile = derivePublicExposureHardeningProfile({
      ...completeInput,
      rollbackArtifacts: [],
      evidencePacks: [],
    });

    expect(profile.status).toBe("review_required");
    expect(profile.summary.unavailableReferences).toBe(2);
    expect(profile.publicExposureRestrictions.map((restriction) => restriction.restrictionType)).toEqual(expect.arrayContaining(["rollback", "evidence"]));
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("public_exposure_review_required");
  });

  it("partially readies incomplete onboarding or support readiness without autonomous operations", () => {
    const profile = derivePublicExposureHardeningProfile({
      ...completeInput,
      institutionOnboardingReadiness: [{ onboardingReadinessId: "onboarding-1", status: "partially_ready" }],
      supportReadiness: [{ supportReadinessId: "support-1", status: "attention_required" }],
    });

    expect(profile.status).toBe("partially_ready");
    expect(profile.manualApprovalRequired).toBe(true);
    expect(profile.autonomousLaunchEnabled).toBe(false);
    expect(profile.autonomousRollbackEnabled).toBe(false);
    expect(profile.publicExposureEnabled).toBe(false);
  });

  it("returns unknown when no source context is available", () => {
    const profile = derivePublicExposureHardeningProfile({});

    expect(profile.status).toBe("unknown");
    expect(profile.summary.unavailableReferences).toBeGreaterThan(0);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("public_exposure_redaction_applied");
  });
});
