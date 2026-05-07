import { describe, expect, it } from "vitest";
import { deriveProductionIntegrationProfile } from "../deriveProductionIntegrationProfile";

const completeInput = {
  integrationKey: "registry-production",
  integrationType: "registry",
  generatedAt: "2026-05-07T00:00:00.000Z",
  activationMetadata: [{ productionIntegrationId: "activation-1", status: "sandbox_ready" }],
  adapterReadiness: [{ adapterReadinessId: "adapter-1", status: "ready_for_review" }],
  controlledIntegrationProfiles: [{ controlledIntegrationId: "controlled-1", status: "sandbox_ready" }],
  observabilityIncidentReadiness: [{ observabilityIncidentReadinessId: "observability-1", status: "ready_for_review" }],
  releaseGovernanceProfiles: [{ releaseGovernanceId: "release-1", status: "ready_for_review" }],
  supportOperationsProfiles: [{ supportOperationsId: "support-1", status: "stable" }],
  operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
  evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
  operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "stable" }],
  regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" }],
  auditEvents: [{ eventId: "event-1", eventType: "controlled_integration_profile_derived" }],
};

describe("deriveProductionIntegrationProfile", () => {
  it("derives deterministic sandbox-ready profiles with execution flags pinned off", () => {
    const profile = deriveProductionIntegrationProfile(completeInput);
    const again = deriveProductionIntegrationProfile(completeInput);

    expect(profile).toEqual(again);
    expect(profile).toEqual(
      expect.objectContaining({
        productionIntegrationId: "production_integration:registry-production:registry",
        integrationType: "registry",
        status: "sandbox_ready",
        manualApprovalRequired: true,
        autonomousExecutionEnabled: false,
        paymentExecutionEnabled: false,
        unrestrictedWebhookExecutionEnabled: false,
      })
    );
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("production_integration_sandbox_ready");
  });

  it("marks missing critical observability and review lineage as production review required", () => {
    const profile = deriveProductionIntegrationProfile({
      ...completeInput,
      observabilityIncidentReadiness: [],
      operatorReviewSessions: [],
    });

    expect(profile.status).toBe("production_review_required");
    expect(profile.integrationRestrictions.some((restriction) => restriction.status === "review_required")).toBe(true);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("production_integration_review_required");
  });

  it("blocks unresolved operational risk restrictions", () => {
    const profile = deriveProductionIntegrationProfile({
      ...completeInput,
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "blocked" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.blockedReasons).toContain("Unresolved operational risk blocks production integration readiness.");
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("production_integration_blocked");
  });

  it("keeps inactive metadata disabled without enabling execution flags", () => {
    const profile = deriveProductionIntegrationProfile({
      ...completeInput,
      activationMetadata: [{ productionIntegrationId: "activation-1", status: "disabled" }],
    });

    expect(profile.status).toBe("disabled");
    expect(profile.manualApprovalRequired).toBe(true);
    expect(profile.autonomousExecutionEnabled).toBe(false);
    expect(profile.paymentExecutionEnabled).toBe(false);
    expect(profile.unrestrictedWebhookExecutionEnabled).toBe(false);
  });

  it("records redaction events for redacted audit lineage", () => {
    const profile = deriveProductionIntegrationProfile({
      ...completeInput,
      auditEvents: [{ eventId: "event-1", eventType: "production_integration_profile_derived", redacted: true }],
    });

    expect(profile.auditReferences[0]).toEqual(expect.objectContaining({ redacted: true, status: "partially_verified" }));
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("production_integration_redaction_applied");
  });
});
