import { describe, expect, it } from "vitest";
import { deriveCourtDisputeLineageProfile } from "../deriveCourtDisputeLineageProfile";

describe("deriveCourtDisputeLineageProfile", () => {
  const completeInput = {
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    generatedAt: "2026-05-07T00:00:00.000Z",
    disputeRecords: [{ disputeId: "dispute-1", status: "verified" }],
    courtRecordReferences: [{ courtRecordId: "court-1", status: "verified" }],
    filingReadinessReferences: [{ filingReadinessId: "filing-1", status: "verified" }],
    judgmentOrderReferences: [{ judgmentOrderId: "order-1", status: "verified" }],
    rentalDebtReferences: [{ rentalDebtId: "debt-1", status: "verified" }],
    consentRecords: [{ consentId: "consent-1", status: "verified" }],
    reviewRecords: [{ reviewSessionId: "review-1", status: "completed" }],
    evidencePacks: [{ evidencePackId: "evidence-1", status: "verified" }],
    auditEvents: [{ eventId: "event-1", eventType: "court_dispute_lineage_profile_derived" }],
  };

  it("derives a deterministic verified profile with execution flags pinned off", () => {
    const profile = deriveCourtDisputeLineageProfile(completeInput);
    const again = deriveCourtDisputeLineageProfile(completeInput);

    expect(profile).toEqual(again);
    expect(profile).toEqual(
      expect.objectContaining({
        courtDisputeLineageId: "court_dispute_lineage:landlord-1:tenant-1",
        status: "verified",
        manualReviewRequired: true,
        legalFilingExecutionEnabled: false,
        collectionsExecutionEnabled: false,
        bureauReportingEnabled: false,
        publicCourtRecordExposureEnabled: false,
      })
    );
    expect(profile.summary.totalReferences).toBe(9);
    expect(profile.summary.verifiedReferences).toBe(9);
    expect(profile.courtDisputeRestrictions).toEqual([]);
  });

  it("blocks unresolved consent, dispute, or court-record restrictions", () => {
    const profile = deriveCourtDisputeLineageProfile({
      ...completeInput,
      courtRecordReferences: [{ courtRecordId: "court-1", status: "restricted" }],
    });

    expect(profile.status).toBe("blocked");
    expect(profile.courtDisputeRestrictions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          restrictionType: "court_record",
          status: "blocked",
        }),
      ])
    );
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("court_dispute_lineage_blocked");
  });

  it("requires review when critical dispute, consent, review, evidence, or audit lineage is missing", () => {
    const profile = deriveCourtDisputeLineageProfile({
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      courtRecordReferences: [{ courtRecordId: "court-1", status: "verified" }],
    });

    expect(profile.status).toBe("review_required");
    expect(profile.courtDisputeRestrictions.some((restriction) => restriction.restrictionType === "dispute")).toBe(true);
    expect(profile.courtDisputeRestrictions.some((restriction) => restriction.restrictionType === "consent")).toBe(true);
    expect(profile.courtDisputeRestrictions.some((restriction) => restriction.restrictionType === "review")).toBe(true);
    expect(profile.courtDisputeRestrictions.some((restriction) => restriction.restrictionType === "evidence")).toBe(true);
    expect(profile.courtDisputeRestrictions.some((restriction) => restriction.restrictionType === "audit")).toBe(true);
  });

  it("uses partial verification for incomplete operational metadata without enabling execution", () => {
    const profile = deriveCourtDisputeLineageProfile({
      ...completeInput,
      filingReadinessReferences: [{ filingReadinessId: "filing-1", status: "under_review" }],
    });

    expect(profile.status).toBe("partially_verified");
    expect(profile.legalFilingExecutionEnabled).toBe(false);
    expect(profile.collectionsExecutionEnabled).toBe(false);
    expect(profile.bureauReportingEnabled).toBe(false);
    expect(profile.publicCourtRecordExposureEnabled).toBe(false);
    expect(profile.canonicalEvents.map((event) => event.eventType)).toContain("court_dispute_lineage_review_required");
  });

  it("returns unknown when source context is unavailable", () => {
    const profile = deriveCourtDisputeLineageProfile({ landlordId: "landlord-1", tenantId: "tenant-1" });

    expect(profile.status).toBe("unknown");
    expect(profile.summary.unavailableReferences).toBe(9);
  });

  it("generates additive canonical events for redaction and restrictions", () => {
    const profile = deriveCourtDisputeLineageProfile({
      ...completeInput,
      evidencePacks: [{ evidencePackId: "evidence-1", status: "blocked", redacted: true }],
    });

    expect(profile.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "court_dispute_lineage_profile_derived",
        "court_dispute_lineage_redaction_applied",
        "court_dispute_lineage_restriction_detected",
      ])
    );
    expect(profile.evidenceReferences[0]).toEqual(
      expect.objectContaining({
        redacted: true,
        redactionReason: "Court/dispute evidence lineage reference payload is redacted for court and dispute lineage safety.",
      })
    );
  });
});
