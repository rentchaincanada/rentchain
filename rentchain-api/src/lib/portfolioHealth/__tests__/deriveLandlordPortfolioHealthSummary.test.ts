import { describe, expect, it } from "vitest";
import { deriveLandlordPortfolioHealthSummary } from "../deriveLandlordPortfolioHealthSummary";
import type { PortfolioScoreV1 } from "../../portfolioScore/portfolioScoreTypes";
import type { PortfolioScoreTrendV1 } from "../../portfolioScoreHistory/portfolioScoreHistoryTypes";

function buildScore(overrides: Partial<PortfolioScoreV1> = {}): PortfolioScoreV1 {
  return {
    version: "v1",
    portfolioId: "landlord-1",
    generatedAt: "2026-04-16T12:00:00.000Z",
    score: 84,
    grade: "B",
    summary: {
      status: "healthy",
      headline: "Healthy",
      notes: [],
    },
    components: [
      { key: "workflow_completion", label: "Workflow completion", rawValue: 0.9, normalizedScore: 88, weight: 0.25, contribution: 22 },
      { key: "screening_reliability", label: "Screening reliability", rawValue: 0.8, normalizedScore: 82, weight: 0.2, contribution: 16.4 },
      { key: "maintenance_stability", label: "Maintenance stability", rawValue: 0.86, normalizedScore: 86, weight: 0.15, contribution: 12.9 },
      { key: "automation_health", label: "Automation health", rawValue: 0.8, normalizedScore: 81, weight: 0.1, contribution: 8.1 },
      { key: "policy_friction", label: "Policy friction", rawValue: 0.1, normalizedScore: 83, weight: 0.1, contribution: 8.3 },
      { key: "exception_burden", label: "Exception burden", rawValue: 0.12, normalizedScore: 84, weight: 0.2, contribution: 16.8 },
    ],
    metrics: {
      totalResourcesReviewed: 8,
      triageItemCount: 1,
      criticalTriageCount: 0,
      reconciliationIssueCount: 0,
      automationSkipCount: 0,
      policyReviewCount: 0,
      blockedWorkflowCount: 0,
      maintenanceReopenCount: 0,
    },
    ...overrides,
  };
}

function buildTrend(overrides: Partial<PortfolioScoreTrendV1> = {}): PortfolioScoreTrendV1 {
  return {
    version: "v1",
    portfolioId: "landlord-1",
    generatedAt: "2026-04-16T12:00:00.000Z",
    latest: null,
    previous: null,
    direction: "flat",
    deltaScore: 0,
    deltaGrade: null,
    summary: {
      headline: "Stable",
      notes: [],
    },
    movers: [],
    history: [],
    ...overrides,
  };
}

describe("deriveLandlordPortfolioHealthSummary", () => {
  it("derives a landlord-safe healthy summary from healthy internal signals", () => {
    const summary = deriveLandlordPortfolioHealthSummary({
      portfolioScore: buildScore(),
      portfolioTrend: buildTrend({ direction: "up" }),
    });

    expect(summary.overall.status).toBe("healthy");
    expect(summary.trend.direction).toBe("improving");
    expect(summary.overall.headline).toMatch(/health looks strong|generally healthy/i);
    expect(summary.dimensions).toHaveLength(4);
    expect(summary.nextFocus[0]?.summary).not.toMatch(/triage|reconciliation|automation skipped|assignment/i);
  });

  it("maps at-risk score state to attention_needed safely", () => {
    const summary = deriveLandlordPortfolioHealthSummary({
      portfolioScore: buildScore({
        summary: { status: "at_risk", headline: "At risk", notes: [] },
        components: buildScore().components.map((component) =>
          component.key === "screening_reliability"
            ? { ...component, normalizedScore: 45 }
            : component
        ),
      }),
      portfolioTrend: buildTrend({ direction: "down" }),
    });

    expect(summary.overall.status).toBe("attention_needed");
    expect(summary.trend.direction).toBe("declining");
    expect(summary.dimensions.find((dimension) => dimension.key === "screening_health")?.status).toBe(
      "attention_needed"
    );
  });

  it("maps trend directions safely", () => {
    expect(
      deriveLandlordPortfolioHealthSummary({
        portfolioScore: buildScore(),
        portfolioTrend: buildTrend({ direction: "up" }),
      }).trend.direction
    ).toBe("improving");
    expect(
      deriveLandlordPortfolioHealthSummary({
        portfolioScore: buildScore(),
        portfolioTrend: buildTrend({ direction: "down" }),
      }).trend.direction
    ).toBe("declining");
    expect(
      deriveLandlordPortfolioHealthSummary({
        portfolioScore: buildScore(),
        portfolioTrend: buildTrend({ direction: "flat" }),
      }).trend.direction
    ).toBe("stable");
    expect(
      deriveLandlordPortfolioHealthSummary({
        portfolioScore: buildScore(),
        portfolioTrend: buildTrend({ direction: "insufficient_data", deltaScore: null }),
      }).trend.direction
    ).toBe("insufficient_data");
  });

  it("returns sparse-data fallback messaging conservatively", () => {
    const summary = deriveLandlordPortfolioHealthSummary({
      portfolioScore: buildScore({
        metrics: { ...buildScore().metrics, totalResourcesReviewed: 1 },
      }),
      portfolioTrend: buildTrend({ direction: "insufficient_data", deltaScore: null }),
    });

    expect(summary.overall.summary).toMatch(/still developing/i);
    expect(summary.trend.summary).toMatch(/Trend visibility will improve/i);
  });
});
