import { describe, expect, it } from "vitest";
import { deriveTenantParticipationProfile } from "../deriveTenantParticipationProfile";

const completeInput = {
  tenantId: "tenant-1",
  generatedAt: "2026-05-07T00:00:00.000Z",
  onboardingRecords: [{ onboardingId: "onboarding-1", tenantId: "tenant-1", status: "completed" }],
  paymentConsistencyRecords: [{ paymentConsistencyId: "payment-1", tenantId: "tenant-1", status: "verified" }],
  occupancyRecords: [{ rentalHistoryLedgerId: "ledger-1", tenantId: "tenant-1", status: "verified" }],
  maintenanceRecords: [{ maintenanceRequestId: "maintenance-1", tenantId: "tenant-1", status: "completed" }],
  reviewRecords: [{ reviewSessionId: "review-1", tenantId: "tenant-1", status: "completed" }],
  disputeRecords: [{ disputeResolutionId: "dispute-1", tenantId: "tenant-1", status: "ready_for_review" }],
  communicationRecords: [{ communicationId: "message-1", tenantId: "tenant-1", status: "available" }],
  evidencePacks: [{ evidencePackId: "evidence-1", tenantId: "tenant-1", status: "ready_for_review" }],
  auditEvents: [{ eventId: "audit-1", resourceId: "tenant-1", eventType: "tenant_participation_profile_derived" }],
};

describe("deriveTenantParticipationProfile", () => {
  it("derives a deterministic verified profile with incentive flags pinned off", () => {
    const profile = deriveTenantParticipationProfile(completeInput);
    const repeat = deriveTenantParticipationProfile(completeInput);

    expect(profile).toEqual(repeat);
    expect(profile.status).toBe("verified");
    expect(profile).toEqual(
      expect.objectContaining({
        manualReviewRequired: true,
        publicParticipationExposureEnabled: false,
        autonomousRewardExecutionEnabled: false,
      })
    );
    expect(profile.summary).toEqual(
      expect.objectContaining({
        totalReferences: 9,
        verifiedReferences: 9,
        restrictions: 0,
      })
    );
  });

  it("blocks unresolved onboarding or dispute restrictions", () => {
    const profile = deriveTenantParticipationProfile({
      ...completeInput,
      onboardingRecords: [{ onboardingId: "onboarding-1", tenantId: "tenant-1", status: "blocked" }],
      disputeRecords: [{ disputeResolutionId: "dispute-1", tenantId: "tenant-1", status: "blocked" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.participationRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "onboarding", status: "blocked" }),
        expect.objectContaining({ restrictionType: "dispute_resolution", status: "blocked" }),
      ])
    );
  });

  it("requires review when critical review, evidence, or audit lineage is missing", () => {
    const profile = deriveTenantParticipationProfile({
      ...completeInput,
      reviewRecords: [],
      evidencePacks: [],
      auditEvents: [],
    });

    expect(profile.status).toBe("review_required");
    expect(profile.participationRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ restrictionType: "review", status: "review_required" }),
        expect.objectContaining({ restrictionType: "evidence", status: "review_required" }),
        expect.objectContaining({ restrictionType: "audit", status: "review_required" }),
      ])
    );
  });

  it("marks incomplete participation lineage as partially verified without autonomous incentives", () => {
    const profile = deriveTenantParticipationProfile({
      ...completeInput,
      maintenanceRecords: [{ maintenanceRequestId: "maintenance-1", tenantId: "tenant-1", status: "pending" }],
    });

    expect(profile.status).toBe("partially_verified");
    expect(profile.autonomousRewardExecutionEnabled).toBe(false);
  });

  it("returns unknown when there is insufficient source context", () => {
    const profile = deriveTenantParticipationProfile({ tenantId: "tenant-1" });

    expect(profile.status).toBe("unknown");
    expect(profile.summary.unavailableReferences).toBeGreaterThan(0);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["tenant_participation_profile_derived", "tenant_participation_redaction_applied"])
    );
  });

  it("generates canonical events for restriction, review-required, blocked, and redaction paths", () => {
    const blocked = deriveTenantParticipationProfile({
      ...completeInput,
      disputeRecords: [{ disputeResolutionId: "dispute-1", tenantId: "tenant-1", status: "blocked" }],
    });

    expect(blocked.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "tenant_participation_profile_derived",
        "tenant_participation_redaction_applied",
        "tenant_participation_restriction_detected",
        "tenant_participation_blocked",
      ])
    );
  });
});
