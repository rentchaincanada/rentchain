import { describe, expect, it } from "vitest";
import { deriveEnterpriseMunicipalReadinessProfile } from "../deriveEnterpriseMunicipalReadinessProfile";

const completeInput = {
  readinessKey: "enterprise-v1",
  organizationType: "municipality",
  generatedAt: "2026-05-07T00:00:00.000Z",
  institutionalReadiness: [{ onboardingReadinessId: "institution-1", status: "ready_for_review" }],
  portfolioGovernance: [{ portfolioGovernanceId: "portfolio-1", status: "ready_for_review" }],
  municipalReadiness: [{ municipalReadinessId: "municipal-1", status: "ready_for_review" }],
  regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" }],
  operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "stable" }],
  operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
  evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
  auditEvents: [{ eventId: "event-1", eventType: "enterprise_municipal_readiness_profile_derived" }],
};

describe("deriveEnterpriseMunicipalReadinessProfile", () => {
  it("derives deterministic ready-for-review profiles with execution flags pinned off", () => {
    const profile = deriveEnterpriseMunicipalReadinessProfile(completeInput);
    const again = deriveEnterpriseMunicipalReadinessProfile(completeInput);

    expect(profile).toEqual(again);
    expect(profile).toEqual(
      expect.objectContaining({
        enterpriseMunicipalReadinessId: "enterprise_municipal_readiness:enterprise-v1:municipality",
        organizationType: "municipality",
        status: "ready_for_review",
        manualApprovalRequired: true,
        autonomousGovernmentExecutionEnabled: false,
        autonomousEnterpriseExecutionEnabled: false,
      })
    );
  });

  it("requires review when municipal and evidence lineage are missing", () => {
    const profile = deriveEnterpriseMunicipalReadinessProfile({
      ...completeInput,
      municipalReadiness: [],
      evidencePacks: [],
    });

    expect(profile.status).toBe("review_required");
    expect(profile.enterpriseRestrictions.some((restriction) => restriction.status === "review_required")).toBe(true);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("enterprise_municipal_review_required");
  });

  it("blocks unresolved operational-risk restrictions", () => {
    const profile = deriveEnterpriseMunicipalReadinessProfile({
      ...completeInput,
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "blocked" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.blockedReasons).toContain("Unresolved operational risk blocks enterprise and municipal readiness.");
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("enterprise_municipal_blocked");
  });

  it("returns unknown without source context", () => {
    const profile = deriveEnterpriseMunicipalReadinessProfile({ readinessKey: "enterprise-v1", organizationType: "government_program" });

    expect(profile.status).toBe("unknown");
    expect(profile.manualApprovalRequired).toBe(true);
    expect(profile.autonomousGovernmentExecutionEnabled).toBe(false);
    expect(profile.autonomousEnterpriseExecutionEnabled).toBe(false);
  });

  it("preserves redaction visibility for redacted audit lineage", () => {
    const profile = deriveEnterpriseMunicipalReadinessProfile({
      ...completeInput,
      auditEvents: [{ eventId: "event-1", eventType: "enterprise_municipal_redaction_applied", redacted: true }],
    });

    expect(profile.auditReferences[0]).toEqual(expect.objectContaining({ redacted: true, status: "partially_verified" }));
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("enterprise_municipal_redaction_applied");
  });
});
