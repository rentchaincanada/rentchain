import { describe, expect, it } from "vitest";
import { deriveEcosystemCoordinationSnapshot } from "../deriveEcosystemCoordinationSnapshot";

const completeInput = {
  generatedAt: "2026-05-07T00:00:00.000Z",
  networkParticipants: [{ participantId: "participant-1", status: "verified" }],
  trustRelationships: [{ trustRelationshipId: "trust-1", status: "verified" }],
  onboardingReadiness: [{ onboardingReadinessId: "onboarding-1", status: "ready_for_review" }],
  operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "stable" }],
  interoperabilityAdapterReadiness: [{ adapterReadinessId: "adapter-1", status: "ready_for_review" }],
  controlledIntegrationProfiles: [{ controlledIntegrationId: "controlled-1", status: "sandbox_ready" }],
  settlementReadiness: [{ settlementReadinessId: "settlement-1", status: "ready_for_review" }],
  regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "ready_for_review" }],
  observabilityReadiness: [{ observabilityIncidentReadinessId: "observability-1", status: "ready_for_review" }],
  releaseGovernanceProfiles: [{ releaseGovernanceId: "release-1", status: "ready_for_review" }],
  publicExposureHardeningProfiles: [{ publicExposureHardeningId: "public-exposure-1", status: "ready_for_review" }],
  commercialReadinessProfiles: [{ commercialReadinessId: "commercial-1", status: "ready_for_review" }],
  evidencePacks: [{ evidencePackId: "evidence-1", status: "ready_for_review" }],
  operatorReviewSessions: [{ reviewSessionId: "review-1", status: "completed" }],
  auditEvents: [{ eventId: "audit-1", eventType: "ecosystem_coordination_snapshot_derived" }],
};

describe("deriveEcosystemCoordinationSnapshot", () => {
  it("derives a deterministic stable snapshot with execution flags pinned off", () => {
    const snapshot = deriveEcosystemCoordinationSnapshot(completeInput);
    const repeat = deriveEcosystemCoordinationSnapshot(completeInput);

    expect(snapshot).toEqual(repeat);
    expect(snapshot.status).toBe("stable");
    expect(snapshot).toEqual(
      expect.objectContaining({
        manualReviewRequired: true,
        autonomousCoordinationEnabled: false,
        externalExecutionEnabled: false,
      })
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        totalReferences: 15,
        verifiedReferences: 15,
        restrictions: 0,
      })
    );
  });

  it("aggregates blocked operational, integration, and regulatory restrictions", () => {
    const snapshot = deriveEcosystemCoordinationSnapshot({
      ...completeInput,
      operationalRiskProfiles: [{ operationalRiskId: "risk-1", status: "blocked" }],
      controlledIntegrationProfiles: [{ controlledIntegrationId: "controlled-1", status: "blocked" }],
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "blocked" }],
    });

    expect(snapshot.status).toBe("blocked");
    expect(snapshot.ecosystemRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "risk", status: "blocked" }),
        expect.objectContaining({ restrictionType: "integration", status: "blocked" }),
        expect.objectContaining({ restrictionType: "regulatory", status: "blocked" }),
      ])
    );
    expect(snapshot.blockedReasons).toEqual(
      expect.arrayContaining([
        "Unresolved operational risk blocks ecosystem coordination.",
        "Controlled integration readiness is blocked.",
        "Regulatory restriction blocks ecosystem coordination.",
      ])
    );
  });

  it("requires review when critical observability, governance, review, or evidence lineage is missing", () => {
    const snapshot = deriveEcosystemCoordinationSnapshot({
      ...completeInput,
      observabilityReadiness: [],
      releaseGovernanceProfiles: [],
      publicExposureHardeningProfiles: [],
      commercialReadinessProfiles: [],
      evidencePacks: [],
      operatorReviewSessions: [],
    });

    expect(snapshot.status).toBe("review_required");
    expect(snapshot.ecosystemRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "observability", status: "review_required" }),
        expect.objectContaining({ restrictionType: "governance", status: "review_required" }),
        expect.objectContaining({ restrictionType: "evidence", status: "review_required" }),
        expect.objectContaining({ restrictionType: "review", status: "review_required" }),
      ])
    );
  });

  it("marks incomplete onboarding readiness as attention required", () => {
    const snapshot = deriveEcosystemCoordinationSnapshot({
      ...completeInput,
      onboardingReadiness: [{ onboardingReadinessId: "onboarding-1", status: "partially_ready" }],
    });

    expect(snapshot.status).toBe("attention_required");
    expect(snapshot.ecosystemRestrictions).toEqual(
      expect.arrayContaining([expect.objectContaining({ restrictionType: "onboarding", status: "review_required" })])
    );
  });

  it("returns unknown when there is insufficient source context", () => {
    const snapshot = deriveEcosystemCoordinationSnapshot({});

    expect(snapshot.status).toBe("unknown");
    expect(snapshot.summary.unavailableReferences).toBeGreaterThan(0);
    expect(snapshot.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["ecosystem_coordination_snapshot_derived", "ecosystem_coordination_redaction_applied"])
    );
  });

  it("generates canonical events for restriction, review-required, blocked, and redaction paths", () => {
    const blocked = deriveEcosystemCoordinationSnapshot({
      ...completeInput,
      regulatoryProfiles: [{ regulatoryProfileId: "regulatory-1", status: "blocked" }],
    });

    expect(blocked.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "ecosystem_coordination_snapshot_derived",
        "ecosystem_coordination_redaction_applied",
        "ecosystem_coordination_restriction_detected",
        "ecosystem_coordination_blocked",
      ])
    );
  });
});
