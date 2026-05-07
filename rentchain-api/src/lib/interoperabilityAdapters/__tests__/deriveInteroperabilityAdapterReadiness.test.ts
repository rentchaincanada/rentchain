import { describe, expect, it } from "vitest";
import { deriveInteroperabilityAdapterReadiness } from "../deriveInteroperabilityAdapterReadiness";

describe("deriveInteroperabilityAdapterReadiness", () => {
  it("derives deterministic adapter readiness with required disabled execution flags", () => {
    const readiness = deriveInteroperabilityAdapterReadiness({
      landlordId: "landlord-1",
      adapterType: "lender",
      generatedAt: "2026-01-01T00:00:00.000Z",
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "stable", sensitiveTenantPayload: "raw-secret" }],
      institutionOnboardingReadiness: [{ onboardingReadinessId: "onboarding-1", status: "ready_for_review" }],
      trustRelationships: [{ trustRelationshipId: "trust-1", status: "verified" }],
      sharingRooms: [{ sharingRoomId: "room-1", status: "active", publiclyAccessible: false, externalExecutionEnabled: false }],
      settlementReadiness: { settlementReadinessId: "settlement-1", status: "ready_for_review" },
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" }],
      evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
      auditEvents: [{ eventId: "event-1", eventType: "operational_risk_profile_derived" }],
    });

    expect(readiness).toEqual(
      expect.objectContaining({
        adapterReadinessId: "interoperability_adapter_readiness:landlord-1:lender",
        status: "ready_for_review",
        manualReviewRequired: true,
        liveIntegrationEnabled: false,
        externalSynchronizationEnabled: false,
      })
    );
    expect(readiness.canonicalEvents.map((event) => event.eventType)).toContain("interoperability_adapter_readiness_derived");
    expect(JSON.stringify(readiness)).not.toContain("sensitiveTenantPayload");
    expect(JSON.stringify(readiness)).not.toContain("raw-secret");
  });

  it("surfaces blocked restrictions without enabling synchronization", () => {
    const readiness = deriveInteroperabilityAdapterReadiness({
      landlordId: "landlord-1",
      adapterType: "payment_provider",
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "blocked" }],
      institutionOnboardingReadiness: [{ onboardingReadinessId: "onboarding-1", status: "blocked" }],
      sharingRooms: [{ sharingRoomId: "room-1", status: "blocked", publiclyAccessible: true, externalExecutionEnabled: true }],
      settlementReadiness: { settlementReadinessId: "settlement-1", status: "blocked" },
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "blocked" }],
      evidencePacks: [{ evidencePackId: "evidence-1", status: "blocked" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", status: "open" }],
    });

    expect(readiness.status).toBe("blocked");
    expect(readiness.adapterRestrictions.length).toBeGreaterThan(0);
    expect(readiness.liveIntegrationEnabled).toBe(false);
    expect(readiness.externalSynchronizationEnabled).toBe(false);
    expect(readiness.canonicalEvents.map((event) => event.eventType)).toContain("interoperability_adapter_blocked");
  });

  it("returns unknown when source context is unavailable", () => {
    const readiness = deriveInteroperabilityAdapterReadiness({ landlordId: "landlord-1", adapterType: "registry" });

    expect(readiness.status).toBe("unknown");
    expect(readiness.manualReviewRequired).toBe(true);
    expect(readiness.liveIntegrationEnabled).toBe(false);
    expect(readiness.externalSynchronizationEnabled).toBe(false);
  });
});
