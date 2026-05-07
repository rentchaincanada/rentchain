import { describe, expect, it } from "vitest";
import { deriveSupportOperationsProfile } from "../deriveSupportOperationsProfile";

describe("deriveSupportOperationsProfile", () => {
  const completeInput = {
    supportOperationsKey: "support-v1",
    generatedAt: "2026-05-07T00:00:00.000Z",
    supportRecords: [{ supportTicketId: "ticket-1", status: "resolved" }],
    onboardingRecords: [{ onboardingHardeningId: "onboarding-1", status: "ready_for_review" }],
    credentialingRecords: [{ platformCredentialingId: "credentialing-1", status: "ready_for_review" }],
    incidentRecords: [{ incidentId: "incident-1", status: "resolved" }],
    operationalRiskRecords: [{ operationalRiskProfileId: "risk-1", status: "ready_for_review" }],
    reviewRecords: [{ reviewSessionId: "review-1", status: "completed" }],
    evidencePacks: [{ evidencePackId: "evidence-1", status: "verified" }],
    auditEvents: [{ eventId: "event-1", eventType: "support_operations_profile_derived" }],
  };

  it("derives a deterministic stable profile with execution flags pinned off", () => {
    const profile = deriveSupportOperationsProfile(completeInput);
    const again = deriveSupportOperationsProfile(completeInput);

    expect(profile).toEqual(again);
    expect(profile).toEqual(
      expect.objectContaining({
        supportOperationsId: "support_operations:support-v1",
        status: "stable",
        manualReviewRequired: true,
        autonomousSupportExecutionEnabled: false,
        adminImpersonationEnabled: false,
      })
    );
    expect(profile.summary.totalReferences).toBe(8);
    expect(profile.supportRestrictions).toEqual([]);
  });

  it("blocks unresolved incident or operational-risk restrictions", () => {
    const profile = deriveSupportOperationsProfile({
      ...completeInput,
      operationalRiskRecords: [{ operationalRiskProfileId: "risk-1", status: "blocked" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.supportRestrictions).toEqual(expect.arrayContaining([expect.objectContaining({ restrictionType: "operational_risk", status: "blocked" })]));
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("support_operations_blocked");
  });

  it("requires review when critical support, onboarding, review, evidence, or audit lineage is missing", () => {
    const profile = deriveSupportOperationsProfile({
      supportOperationsKey: "support-v1",
      incidentRecords: [{ incidentId: "incident-1", status: "resolved" }],
    });

    expect(profile.status).toBe("review_required");
    expect(profile.supportRestrictions.some((restriction) => restriction.restrictionType === "support")).toBe(true);
    expect(profile.supportRestrictions.some((restriction) => restriction.restrictionType === "onboarding")).toBe(true);
    expect(profile.supportRestrictions.some((restriction) => restriction.restrictionType === "review")).toBe(true);
    expect(profile.supportRestrictions.some((restriction) => restriction.restrictionType === "evidence")).toBe(true);
    expect(profile.supportRestrictions.some((restriction) => restriction.restrictionType === "audit")).toBe(true);
  });

  it("marks incomplete incident linkage as attention required without enabling execution", () => {
    const profile = deriveSupportOperationsProfile({
      ...completeInput,
      incidentRecords: [{ incidentId: "incident-1", status: "investigating" }],
    });

    expect(profile.status).toBe("attention_required");
    expect(profile.autonomousSupportExecutionEnabled).toBe(false);
    expect(profile.adminImpersonationEnabled).toBe(false);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("support_operations_review_required");
  });

  it("returns unknown when source context is unavailable", () => {
    const profile = deriveSupportOperationsProfile({ supportOperationsKey: "support-v1" });

    expect(profile.status).toBe("unknown");
    expect(profile.summary.unavailableReferences).toBe(8);
  });

  it("generates additive canonical events for redaction and restrictions", () => {
    const profile = deriveSupportOperationsProfile({
      ...completeInput,
      evidencePacks: [{ evidencePackId: "evidence-1", status: "blocked", redacted: true }],
    });

    expect(profile.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["support_operations_profile_derived", "support_operations_redaction_applied", "support_operations_restriction_detected"])
    );
    expect(profile.evidenceReferences[0]).toEqual(
      expect.objectContaining({
        redacted: true,
        redactionReason: "Support evidence lineage reference payload is redacted for support operations safety.",
      })
    );
  });
});
