import { describe, expect, it } from "vitest";
import type { PortfolioScoreV1 } from "../../portfolioScore/portfolioScoreTypes";
import type { PortfolioScoreTrendV1 } from "../../portfolioScoreHistory/portfolioScoreHistoryTypes";
import { derivePortfolioScoreExternal } from "../derivePortfolioScoreExternal";

function buildScore(overrides: Partial<PortfolioScoreV1> = {}): PortfolioScoreV1 {
  return {
    version: "v1",
    portfolioId: "landlord-1",
    generatedAt: "2026-04-16T12:00:00.000Z",
    score: 92,
    grade: "A",
    summary: {
      status: "healthy",
      headline: "Healthy",
      notes: [],
    },
    components: [
      { key: "workflow_completion", label: "Workflow completion", rawValue: 0.94, normalizedScore: 92, weight: 0.25, contribution: 23 },
      { key: "screening_reliability", label: "Screening reliability", rawValue: 0.91, normalizedScore: 90, weight: 0.2, contribution: 18 },
      { key: "maintenance_stability", label: "Maintenance stability", rawValue: 0.9, normalizedScore: 91, weight: 0.15, contribution: 13.65 },
      { key: "automation_health", label: "Automation health", rawValue: 0.88, normalizedScore: 88, weight: 0.1, contribution: 8.8 },
      { key: "policy_friction", label: "Policy friction", rawValue: 0.15, normalizedScore: 84, weight: 0.1, contribution: 8.4 },
      { key: "exception_burden", label: "Exception burden", rawValue: 0.1, normalizedScore: 86, weight: 0.2, contribution: 17.2 },
    ],
    metrics: {
      totalResourcesReviewed: 10,
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

describe("derivePortfolioScoreExternal", () => {
  it("renders a high score safely with strong messaging", () => {
    const external = derivePortfolioScoreExternal({
      portfolioScore: buildScore(),
      portfolioTrend: buildTrend({ direction: "up" }),
    });

    expect(external.score).toBe(92);
    expect(external.grade).toBe("A");
    expect(external.summary.headline).toMatch(/high standard/i);
    expect(external.trend.direction).toBe("improving");
    expect(external.components.every((component) => component.status === "strong")).toBe(true);
  });

  it("renders a lower score safely without internal admin leakage", () => {
    const external = derivePortfolioScoreExternal({
      portfolioScore: buildScore({
        score: 64,
        grade: "D",
        summary: { status: "at_risk", headline: "At risk", notes: [] },
        components: buildScore().components.map((component) =>
          component.key === "screening_reliability"
            ? { ...component, normalizedScore: 42 }
            : { ...component, normalizedScore: Math.min(component.normalizedScore, 63) }
        ),
      }),
      portfolioTrend: buildTrend({ direction: "down" }),
    });

    expect(external.summary.headline).toMatch(/areas that need attention/i);
    expect(external.trend.direction).toBe("declining");
    expect(external.components.some((component) => component.status === "needs_attention")).toBe(true);
    expect(JSON.stringify(external)).not.toMatch(/triage|reconciliation|alert|sla|assignment|resolution|automation skipped/i);
  });

  it("maps trend directions safely", () => {
    expect(
      derivePortfolioScoreExternal({
        portfolioScore: buildScore(),
        portfolioTrend: buildTrend({ direction: "up" }),
      }).trend.direction
    ).toBe("improving");
    expect(
      derivePortfolioScoreExternal({
        portfolioScore: buildScore(),
        portfolioTrend: buildTrend({ direction: "down" }),
      }).trend.direction
    ).toBe("declining");
    expect(
      derivePortfolioScoreExternal({
        portfolioScore: buildScore(),
        portfolioTrend: buildTrend({ direction: "flat" }),
      }).trend.direction
    ).toBe("stable");
    expect(
      derivePortfolioScoreExternal({
        portfolioScore: buildScore(),
        portfolioTrend: buildTrend({ direction: "insufficient_data", deltaScore: null }),
      }).trend.direction
    ).toBe("insufficient_data");
  });

  it("handles sparse data conservatively", () => {
    const external = derivePortfolioScoreExternal({
      portfolioScore: buildScore({
        score: 78,
        grade: "C",
        metrics: { ...buildScore().metrics, totalResourcesReviewed: 1 },
      }),
      portfolioTrend: buildTrend({ direction: "insufficient_data", deltaScore: null }),
    });

    expect(external.summary.explanation).toMatch(/become more precise as more activity is recorded/i);
    expect(external.trend.summary).toMatch(/become clearer as more portfolio activity is recorded/i);
  });
});
