import { describe, expect, it } from "vitest";
import { deriveOperationalRiskProfile } from "../deriveOperationalRiskProfile";

describe("deriveOperationalRiskProfile", () => {
  it("derives deterministic operational risk with required safety flags", () => {
    const profile = deriveOperationalRiskProfile({
      landlordId: "landlord-1",
      riskScope: "institution",
      generatedAt: "2026-01-01T00:00:00.000Z",
      evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review", sensitiveTenantPayload: "private" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
      settlementReadiness: { settlementReadinessId: "settlement-1", status: "ready_for_review" },
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" }],
      institutionOnboardingReadiness: [{ onboardingReadinessId: "onboarding-1", status: "ready_for_review" }],
      trustRelationships: [{ trustRelationshipId: "trust-1", status: "verified" }],
      automatedWorkflows: [{ automationId: "workflow-1", decisionId: "decision-1", status: "derived" }],
      auditEvents: [{ eventId: "event-1", eventType: "operator_review_session_closed" }],
    });

    expect(profile).toEqual(
      expect.objectContaining({
        operationalRiskId: "operational_risk:landlord-1:institution",
        status: "stable",
        manualReviewRequired: true,
        autonomousRiskActionsEnabled: false,
        publicRiskExposureEnabled: false,
      })
    );
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("operational_risk_profile_derived");
    expect(JSON.stringify(profile)).not.toContain("sensitiveTenantPayload");
    expect(JSON.stringify(profile)).not.toContain("sensitive-id");
  });

  it("surfaces blocked and elevated risk references without scoring or enforcement", () => {
    const profile = deriveOperationalRiskProfile({
      landlordId: "landlord-1",
      riskScope: "settlement",
      evidencePacks: [{ evidencePackId: "evidence-1", status: "blocked" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "open" }],
      settlementReadiness: { settlementReadinessId: "settlement-1", status: "blocked" },
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "partially_ready" }],
      institutionOnboardingReadiness: [{ onboardingReadinessId: "onboarding-1", status: "blocked" }],
      trustRelationships: [{ trustRelationshipId: "trust-1", status: "blocked" }],
      automatedWorkflows: [{ automationId: "workflow-1", decisionId: "decision-1", status: "blocked", blockedReasons: ["missing_review"] }],
      delinquencySignals: [{ signalId: "signal-1", severity: "critical" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.summary.criticalSeverityReferences).toBeGreaterThan(0);
    expect(profile.blockedReasons.length).toBeGreaterThan(0);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("operational_risk_blocked");
    expect(profile).toEqual(expect.objectContaining({ autonomousRiskActionsEnabled: false, publicRiskExposureEnabled: false }));
  });

  it("returns unknown when source context is unavailable", () => {
    const profile = deriveOperationalRiskProfile({ landlordId: "landlord-1", riskScope: "workflow" });

    expect(profile.status).toBe("unknown");
    expect(profile.manualReviewRequired).toBe(true);
    expect(profile.autonomousRiskActionsEnabled).toBe(false);
    expect(profile.publicRiskExposureEnabled).toBe(false);
  });
});
