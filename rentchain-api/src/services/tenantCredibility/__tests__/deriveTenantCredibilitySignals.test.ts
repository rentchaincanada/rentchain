import { describe, expect, it } from "vitest";
import { deriveTenantCredibilitySignals } from "../deriveTenantCredibilitySignals";

describe("deriveTenantCredibilitySignals", () => {
  it("derives full signals from an available tenant identity record", () => {
    const result = deriveTenantCredibilitySignals({
      tenantIdentityRecord: {
        identityStatus: "verified",
        profile: { completionStatus: "complete" },
        application: { reusable: true, lastSubmittedAt: null },
        documents: { completionStatus: "complete", missingCategories: [] },
        screening: { status: "completed", lastCompletedAt: null },
        leases: { activeCount: 1, historicalCount: 1, lastSignedAt: null },
        verification: { level: "strong" },
        readinessLabel: "Well established",
        readinessDescription: "desc",
      },
      leaseExecution: {
        executionStatus: "fully_executed",
        executionLabel: "Lease fully executed",
        executionDescription: "desc",
        requiredNextAction: "none",
        tenantSignatureStatus: "completed",
        landlordSignatureStatus: "completed",
        pdfStatus: "generated",
        completedAt: "2026-01-01T00:00:00.000Z",
      },
    });

    expect(result.tenantCredibilitySignals.summary).toEqual({
      completenessLevel: "high",
      verificationLevel: "strong",
      summaryLabel: "Credibility established",
      summaryDescription: "Most credibility signals are available in your current record.",
    });
    expect(result.tenantCredibilitySignals.signals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "profile_complete", status: "verified" }),
        expect.objectContaining({ key: "application_reusable", status: "available" }),
        expect.objectContaining({ key: "documents_available", status: "available" }),
        expect.objectContaining({ key: "screening_completed", status: "verified" }),
        expect.objectContaining({ key: "lease_history_present", status: "verified" }),
      ])
    );
  });

  it("fails closed when no tenant identity record is available", () => {
    const result = deriveTenantCredibilitySignals({
      tenantIdentityRecord: null,
      leaseExecution: null,
    });

    expect(result.tenantCredibilitySignals.signals.every((signal) => signal.status === "not_available")).toBe(true);
    expect(result.landlordSafeSummary).toEqual({
      completenessLevel: "low",
      verificationLevel: "none",
      summaryLabel: "Getting started",
      summaryDescription: "Credibility signals are still limited in the current record.",
    });
  });
});
