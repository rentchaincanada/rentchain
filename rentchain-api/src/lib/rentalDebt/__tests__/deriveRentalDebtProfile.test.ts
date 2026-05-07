import { describe, expect, it } from "vitest";
import { deriveRentalDebtProfile } from "../deriveRentalDebtProfile";

describe("deriveRentalDebtProfile", () => {
  const completeInput = {
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    generatedAt: "2026-05-07T00:00:00.000Z",
    paymentDefaultRecords: [{ paymentDefaultId: "default-1", status: "verified" }],
    delinquencyRecords: [{ delinquencyId: "delinquency-1", status: "verified" }],
    disputeRecords: [{ disputeId: "dispute-1", status: "verified" }],
    consentRecords: [{ consentId: "consent-1", status: "verified" }],
    reviewRecords: [{ reviewSessionId: "review-1", status: "completed" }],
    evidencePacks: [{ evidencePackId: "evidence-1", status: "verified" }],
    auditEvents: [{ eventId: "event-1", eventType: "rental_debt_profile_derived" }],
  };

  it("derives a deterministic verified profile with execution flags pinned off", () => {
    const profile = deriveRentalDebtProfile(completeInput);
    const again = deriveRentalDebtProfile(completeInput);

    expect(profile).toEqual(again);
    expect(profile).toEqual(
      expect.objectContaining({
        rentalDebtId: "rental_debt:landlord-1:tenant-1",
        status: "verified",
        manualReviewRequired: true,
        collectionsExecutionEnabled: false,
        bureauReportingEnabled: false,
        publicDebtExposureEnabled: false,
      })
    );
    expect(profile.summary.totalReferences).toBe(7);
    expect(profile.summary.verifiedReferences).toBe(7);
    expect(profile.debtRestrictions).toEqual([]);
  });

  it("blocks unresolved consent or dispute restrictions", () => {
    const profile = deriveRentalDebtProfile({
      ...completeInput,
      consentRecords: [{ consentId: "consent-1", status: "blocked" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.debtRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          restrictionType: "consent",
          status: "blocked",
        }),
      ])
    );
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("rental_debt_blocked");
  });

  it("requires review when critical evidence, review, consent, or audit lineage is missing", () => {
    const profile = deriveRentalDebtProfile({
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      paymentDefaultRecords: [{ paymentDefaultId: "default-1", status: "verified" }],
      delinquencyRecords: [{ delinquencyId: "delinquency-1", status: "verified" }],
      disputeRecords: [{ disputeId: "dispute-1", status: "verified" }],
    });

    expect(profile.status).toBe("review_required");
    expect(profile.debtRestrictions.some((restriction) => restriction.restrictionType === "consent")).toBe(true);
    expect(profile.debtRestrictions.some((restriction) => restriction.restrictionType === "review")).toBe(true);
    expect(profile.debtRestrictions.some((restriction) => restriction.restrictionType === "evidence")).toBe(true);
    expect(profile.debtRestrictions.some((restriction) => restriction.restrictionType === "audit")).toBe(true);
  });

  it("uses partial verification for incomplete operational debt lineage without enabling enforcement", () => {
    const profile = deriveRentalDebtProfile({
      ...completeInput,
      delinquencyRecords: [{ delinquencyId: "delinquency-1", status: "under_review" }],
    });

    expect(profile.status).toBe("partially_verified");
    expect(profile.collectionsExecutionEnabled).toBe(false);
    expect(profile.bureauReportingEnabled).toBe(false);
    expect(profile.publicDebtExposureEnabled).toBe(false);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("rental_debt_review_required");
  });

  it("returns unknown when source context is unavailable", () => {
    const profile = deriveRentalDebtProfile({ landlordId: "landlord-1", tenantId: "tenant-1" });

    expect(profile.status).toBe("unknown");
    expect(profile.summary.unavailableReferences).toBe(7);
  });

  it("generates additive canonical events for redaction and restrictions", () => {
    const profile = deriveRentalDebtProfile({
      ...completeInput,
      evidencePacks: [{ evidencePackId: "evidence-1", status: "blocked", redacted: true }],
    });

    expect(profile.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["rental_debt_profile_derived", "rental_debt_redaction_applied", "rental_debt_restriction_detected"])
    );
    expect(profile.evidenceReferences[0]).toEqual(
      expect.objectContaining({
        redacted: true,
        redactionReason: "Debt evidence lineage reference payload is redacted for debt accountability safety.",
      })
    );
  });
});
