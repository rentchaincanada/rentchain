import { describe, expect, it } from "vitest";
import { buildLandlordDecisionWorkspace } from "./landlordDecisionWorkspace";
import type { SharePackageCategoryView } from "./sharePackageAlignment";

function categories(
  statuses: Array<SharePackageCategoryView["status"]>
): SharePackageCategoryView[] {
  return [
    { key: "profile_details", label: "Profile details", status: statuses[0], detail: "Profile details." },
    { key: "rental_history", label: "Rental history", status: statuses[1], detail: "Rental history." },
    { key: "documents_records", label: "Documents & records", status: statuses[2], detail: "Documents." },
    { key: "consent_identity_status", label: "Consent / identity status", status: statuses[3], detail: "Consent." },
    { key: "application_readiness", label: "Application readiness", status: statuses[4], detail: "Readiness." },
  ];
}

function summary(overrides?: Record<string, any>): any {
  return {
    applicationId: "app-1",
    generatedAt: "2026-04-10T00:00:00.000Z",
    applicant: {},
    employment: {},
    reference: {},
    compliance: {},
    screening: {
      status: "complete",
      provider: "transunion",
      referenceId: "TU-1",
    },
    derived: {
      incomeToRentRatio: 2.8,
      completeness: {
        score: 0.85,
        label: "High",
      },
      flags: [],
    },
    insights: [],
    decisionSummary: {
      applicationId: "app-1",
      screeningRecommendation: {
        recommended: false,
        reason: "Optional for now.",
        priority: "low",
      },
      screeningSummary: {
        available: true,
        provider: "transunion",
        completedAt: "2026-04-10T00:00:00.000Z",
        highlights: [],
      },
      riskSnapshot: {
        version: "risk-v1",
        status: "completed",
        score: 72,
        grade: "B",
        confidence: 0.84,
        factors: [],
        flags: [],
        recommendations: [],
        updatedAt: "2026-04-10T00:00:00.000Z",
      },
    },
    ...overrides,
  };
}

describe("buildLandlordDecisionWorkspace", () => {
  it("returns needs follow-up when category follow-up is still open", () => {
    const result = buildLandlordDecisionWorkspace({
      summary: summary(),
      packageCategories: categories(["ready", "missing", "ready", "partial", "ready"]),
    });

    expect(result.decisionState).toBe("needs_follow_up");
    expect(result.statusLabel).toBe("Needs follow-up");
    expect(result.blockers.some((item) => /Rental history/i.test(item))).toBe(true);
  });

  it("returns hold for later when follow-up is complete but review signals remain limited", () => {
    const result = buildLandlordDecisionWorkspace({
      summary: summary({
        screening: {
          status: "not_run",
          provider: null,
          referenceId: null,
        },
        derived: {
          incomeToRentRatio: 1.9,
          completeness: {
            score: 0.62,
            label: "Medium",
          },
          flags: ["MISSING_EMPLOYER_NAME"],
        },
        decisionSummary: {
          applicationId: "app-1",
          screeningRecommendation: {
            recommended: true,
            reason: "Still recommended.",
            priority: "high",
          },
          screeningSummary: {
            available: false,
            provider: null,
            completedAt: null,
            highlights: [],
          },
        },
      }),
      packageCategories: categories(["ready", "partial", "ready", "partial", "ready"]),
    });

    expect(result.decisionState).toBe("hold_for_later");
    expect(result.statusLabel).toBe("Hold for later");
    expect(result.blockers.some((item) => /Screening is still recommended/i.test(item))).toBe(true);
    expect(result.nextSteps[0]).toMatch(/Keep this file in review/i);
  });

  it("returns ready for decision when follow-up is resolved and review signals are organized", () => {
    const result = buildLandlordDecisionWorkspace({
      summary: summary(),
      packageCategories: categories(["ready", "ready", "ready", "partial", "ready"]),
    });

    expect(result.decisionState).toBe("ready_for_decision");
    expect(result.statusLabel).toBe("Ready for decision");
    expect(result.blockers).toEqual([]);
    expect(result.nextSteps[0]).toMatch(/guide your next landlord decision step/i);
  });
});
