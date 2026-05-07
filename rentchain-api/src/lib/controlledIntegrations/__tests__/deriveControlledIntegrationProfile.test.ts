import { describe, expect, it } from "vitest";
import { deriveControlledIntegrationProfile } from "../deriveControlledIntegrationProfile";

const completeInput = {
  integrationKey: "registry-baseline",
  integrationType: "registry",
  generatedAt: "2026-05-07T00:00:00.000Z",
  activationMetadata: { integrationType: "registry", status: "sandbox_ready" },
  adapterReadiness: [{ adapterReadinessId: "adapter-1", adapterType: "registry", status: "ready_for_review" }],
  operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
  evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
  settlementReadiness: [{ settlementReadinessId: "settlement-1", status: "ready_for_review" }],
  regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" }],
  observabilityIncidentReadiness: [{ observabilityIncidentReadinessId: "observability-1", status: "ready_for_review" }],
  releaseGovernanceProfiles: [{ releaseGovernanceId: "release-1", status: "ready_for_review" }],
  operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "stable" }],
  auditEvents: [{ eventId: "audit-1", eventType: "controlled_integration_profile_derived" }],
};

describe("deriveControlledIntegrationProfile", () => {
  it("derives deterministic sandbox-ready profiles with execution flags pinned off", () => {
    const profile = deriveControlledIntegrationProfile(completeInput);
    const repeat = deriveControlledIntegrationProfile(completeInput);

    expect(profile).toEqual(repeat);
    expect(profile.status).toBe("sandbox_ready");
    expect(profile).toEqual(
      expect.objectContaining({
        manualApprovalRequired: true,
        liveSynchronizationEnabled: false,
        autonomousExecutionEnabled: false,
        webhookExecutionEnabled: false,
      })
    );
    expect(profile.summary).toEqual(
      expect.objectContaining({
        totalReferences: 8,
        verifiedReferences: 8,
        restrictions: 0,
      })
    );
  });

  it("keeps integrations disabled when activation metadata is inactive", () => {
    const profile = deriveControlledIntegrationProfile({
      ...completeInput,
      activationMetadata: { integrationType: "registry", status: "disabled" },
    });

    expect(profile.status).toBe("disabled");
    expect(profile.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["controlled_integration_profile_derived", "controlled_integration_redaction_applied"])
    );
  });

  it("aggregates blocked settlement, regulatory, and operational risk restrictions", () => {
    const profile = deriveControlledIntegrationProfile({
      ...completeInput,
      settlementReadiness: [{ settlementReadinessId: "settlement-1", status: "blocked" }],
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "blocked" }],
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "blocked" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.integrationRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "settlement", status: "blocked" }),
        expect.objectContaining({ restrictionType: "regulatory", status: "blocked" }),
        expect.objectContaining({ restrictionType: "provider_execution", status: "blocked" }),
      ])
    );
    expect(profile.blockedReasons).toEqual(
      expect.arrayContaining([
        "Settlement readiness blocks controlled integration.",
        "Regulatory readiness blocks controlled integration.",
        "Unresolved operational risk blocks controlled integration readiness.",
      ])
    );
  });

  it("requires review when critical review, evidence, observability, or governance lineage is missing", () => {
    const profile = deriveControlledIntegrationProfile({
      ...completeInput,
      operatorReviewSessions: [],
      evidencePacks: [],
      observabilityIncidentReadiness: [],
      releaseGovernanceProfiles: [],
    });

    expect(profile.status).toBe("review_required");
    expect(profile.integrationRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "review", status: "review_required" }),
        expect.objectContaining({ restrictionType: "evidence", status: "review_required" }),
        expect.objectContaining({ restrictionType: "observability", status: "review_required" }),
        expect.objectContaining({ restrictionType: "governance", status: "review_required" }),
      ])
    );
  });

  it("marks incomplete non-critical settlement readiness as partially ready", () => {
    const profile = deriveControlledIntegrationProfile({
      ...completeInput,
      settlementReadiness: [{ settlementReadinessId: "settlement-1", status: "needs_review" }],
    });

    expect(profile.status).toBe("partially_ready");
    expect(profile.integrationRestrictions).toEqual(
      expect.arrayContaining([expect.objectContaining({ restrictionType: "settlement", status: "review_required" })])
    );
  });

  it("generates canonical events for sandbox-ready, review-required, blocked, and redaction paths", () => {
    const sandboxReady = deriveControlledIntegrationProfile(completeInput);
    const blocked = deriveControlledIntegrationProfile({
      ...completeInput,
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "blocked" }],
    });

    expect(sandboxReady.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["controlled_integration_profile_derived", "controlled_integration_redaction_applied", "controlled_integration_sandbox_ready"])
    );
    expect(blocked.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["controlled_integration_profile_derived", "controlled_integration_redaction_applied", "controlled_integration_blocked"])
    );
  });
});
