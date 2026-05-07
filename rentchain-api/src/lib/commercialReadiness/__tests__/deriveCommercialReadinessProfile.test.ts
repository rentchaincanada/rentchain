import { describe, expect, it } from "vitest";
import { deriveCommercialReadinessProfile } from "../deriveCommercialReadinessProfile";

const completeInput = {
  generatedAt: "2026-05-07T00:00:00.000Z",
  pricingReadiness: [{ pricingReadinessId: "pricing-1", status: "ready_for_review" }],
  billingReadiness: [{ billingReadinessId: "billing-1", status: "ready_for_review" }],
  subscriptionReadiness: [{ subscriptionReadinessId: "subscription-1", status: "ready_for_review" }],
  enterpriseOnboardingReadiness: [{ onboardingReadinessId: "onboarding-1", status: "ready_for_review" }],
  supportReadiness: [{ supportReadinessId: "support-1", status: "ready_for_review" }],
  operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "stable" }],
  releaseGovernanceProfiles: [{ releaseGovernanceId: "release-1", status: "ready_for_review" }],
  evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
  operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
  auditEvents: [{ eventId: "audit-1", eventType: "commercial_readiness_profile_derived" }],
};

describe("deriveCommercialReadinessProfile", () => {
  it("derives a deterministic ready-for-review profile with manual governance flags pinned", () => {
    const profile = deriveCommercialReadinessProfile(completeInput);
    const repeat = deriveCommercialReadinessProfile(completeInput);

    expect(profile).toEqual(repeat);
    expect(profile.status).toBe("ready_for_review");
    expect(profile).toEqual(
      expect.objectContaining({
        manualApprovalRequired: true,
        autonomousBillingEnabled: false,
        autonomousCommercializationEnabled: false,
        publicSelfServiceEnabled: false,
      })
    );
    expect(profile.summary).toEqual(
      expect.objectContaining({
        totalReferences: 10,
        verifiedReferences: 10,
        restrictions: 0,
      })
    );
  });

  it("aggregates blocked commercial restrictions from operational risk and billing governance", () => {
    const profile = deriveCommercialReadinessProfile({
      ...completeInput,
      billingReadiness: [{ billingReadinessId: "billing-1", status: "blocked" }],
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "blocked" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.commercialRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "billing", status: "blocked" }),
        expect.objectContaining({ restrictionType: "operational_risk", status: "blocked" }),
      ])
    );
    expect(profile.blockedReasons).toEqual(
      expect.arrayContaining([
        "Billing governance restriction is unresolved.",
        "Unresolved operational risk blocks commercial readiness.",
      ])
    );
  });

  it("requires review when critical evidence or onboarding lineage is missing", () => {
    const profile = deriveCommercialReadinessProfile({
      ...completeInput,
      enterpriseOnboardingReadiness: [],
      evidencePacks: [],
    });

    expect(profile.status).toBe("review_required");
    expect(profile.commercialRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "onboarding", status: "review_required" }),
        expect.objectContaining({ restrictionType: "evidence", status: "review_required" }),
      ])
    );
  });

  it("marks incomplete support readiness as partially ready", () => {
    const profile = deriveCommercialReadinessProfile({
      ...completeInput,
      supportReadiness: [{ supportReadinessId: "support-1", status: "needs_review" }],
    });

    expect(profile.status).toBe("partially_ready");
    expect(profile.commercialRestrictions).toEqual(
      expect.arrayContaining([expect.objectContaining({ restrictionType: "support", status: "review_required" })])
    );
  });

  it("derives unknown when source context is unavailable", () => {
    const profile = deriveCommercialReadinessProfile({});

    expect(profile.status).toBe("unknown");
    expect(profile.summary.unavailableReferences).toBe(10);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["commercial_readiness_profile_derived", "commercial_readiness_redaction_applied"])
    );
  });

  it("generates canonical events for restrictions, review-required, blocked, and redaction paths", () => {
    const profile = deriveCommercialReadinessProfile({
      ...completeInput,
      billingReadiness: [{ billingReadinessId: "billing-1", status: "blocked" }],
    });

    expect(profile.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "commercial_readiness_profile_derived",
        "commercial_readiness_redaction_applied",
        "commercial_readiness_restriction_detected",
        "commercial_readiness_blocked",
      ])
    );
  });
});
