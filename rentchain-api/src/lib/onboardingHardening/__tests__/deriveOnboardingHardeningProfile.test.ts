import { describe, expect, it } from "vitest";
import { deriveOnboardingHardeningProfile } from "../deriveOnboardingHardeningProfile";

describe("deriveOnboardingHardeningProfile", () => {
  const completeInput = {
    participantType: "tenant",
    participantId: "tenant-1",
    generatedAt: "2026-05-07T00:00:00.000Z",
    completionRecords: [{ onboardingId: "onboarding-1", status: "completed" }],
    profileRecords: [{ profileId: "profile-1", status: "verified" }],
    screeningReadinessRecords: [{ screeningReadinessId: "screening-1", status: "configured" }],
    integrationReadinessRecords: [{ integrationReadinessId: "integration-1", status: "active" }],
    frictionRecords: [{ frictionId: "friction-1", status: "resolved" }],
    reviewRecords: [{ reviewSessionId: "review-1", status: "completed" }],
    evidencePacks: [{ evidencePackId: "evidence-1", status: "verified" }],
    auditEvents: [{ eventId: "event-1", eventType: "onboarding_hardening_profile_derived" }],
  };

  it("derives a deterministic ready-for-review profile with execution flags pinned off", () => {
    const profile = deriveOnboardingHardeningProfile(completeInput);
    const again = deriveOnboardingHardeningProfile(completeInput);

    expect(profile).toEqual(again);
    expect(profile).toEqual(
      expect.objectContaining({
        onboardingHardeningId: "onboarding_hardening:tenant:tenant-1",
        participantType: "tenant",
        participantId: "tenant-1",
        status: "ready_for_review",
        manualReviewRequired: true,
        autonomousOnboardingEnabled: false,
        autonomousScreeningActivationEnabled: false,
      })
    );
    expect(profile.summary.totalReferences).toBe(8);
    expect(profile.summary.verifiedReferences).toBe(8);
    expect(profile.onboardingRestrictions).toEqual([]);
  });

  it("blocks unresolved completion or profile restrictions", () => {
    const profile = deriveOnboardingHardeningProfile({
      ...completeInput,
      profileRecords: [{ profileId: "profile-1", status: "blocked" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.onboardingRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          restrictionType: "profile",
          status: "blocked",
        }),
      ])
    );
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("onboarding_hardening_blocked");
  });

  it("requires review when critical completion, profile, review, evidence, or audit lineage is missing", () => {
    const profile = deriveOnboardingHardeningProfile({
      participantType: "landlord",
      participantId: "landlord-1",
      screeningReadinessRecords: [{ screeningReadinessId: "screening-1", status: "configured" }],
    });

    expect(profile.participantType).toBe("landlord");
    expect(profile.status).toBe("review_required");
    expect(profile.onboardingRestrictions.some((restriction) => restriction.restrictionType === "completion")).toBe(true);
    expect(profile.onboardingRestrictions.some((restriction) => restriction.restrictionType === "profile")).toBe(true);
    expect(profile.onboardingRestrictions.some((restriction) => restriction.restrictionType === "review")).toBe(true);
    expect(profile.onboardingRestrictions.some((restriction) => restriction.restrictionType === "evidence")).toBe(true);
    expect(profile.onboardingRestrictions.some((restriction) => restriction.restrictionType === "audit")).toBe(true);
  });

  it("marks incomplete screening or integration setup as partially ready without enabling activation", () => {
    const profile = deriveOnboardingHardeningProfile({
      ...completeInput,
      screeningReadinessRecords: [{ screeningReadinessId: "screening-1", status: "under_review" }],
    });

    expect(profile.status).toBe("partially_ready");
    expect(profile.autonomousOnboardingEnabled).toBe(false);
    expect(profile.autonomousScreeningActivationEnabled).toBe(false);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("onboarding_hardening_review_required");
  });

  it("returns unknown when source context is unavailable", () => {
    const profile = deriveOnboardingHardeningProfile({ participantType: "tenant", participantId: "tenant-1" });

    expect(profile.status).toBe("unknown");
    expect(profile.summary.unavailableReferences).toBe(8);
  });

  it("generates additive canonical events for redaction and restrictions", () => {
    const profile = deriveOnboardingHardeningProfile({
      ...completeInput,
      evidencePacks: [{ evidencePackId: "evidence-1", status: "blocked", redacted: true }],
    });

    expect(profile.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "onboarding_hardening_profile_derived",
        "onboarding_hardening_redaction_applied",
        "onboarding_hardening_restriction_detected",
      ])
    );
    expect(profile.evidenceReferences[0]).toEqual(
      expect.objectContaining({
        redacted: true,
        redactionReason: "Onboarding evidence lineage reference payload is redacted for onboarding hardening safety.",
      })
    );
  });
});
