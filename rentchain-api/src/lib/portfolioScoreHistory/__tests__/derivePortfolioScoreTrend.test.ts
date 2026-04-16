import { describe, expect, it } from "vitest";
import { derivePortfolioScoreTrend } from "../derivePortfolioScoreTrend";
import type { PortfolioScoreSnapshotV1 } from "../portfolioScoreHistoryTypes";

function snapshot(overrides?: Partial<PortfolioScoreSnapshotV1>): PortfolioScoreSnapshotV1 {
  return {
    version: "v1",
    portfolioId: "portfolio-1",
    snapshotAt: "2026-04-15T12:00:00.000Z",
    score: 80,
    grade: "B",
    status: "watch",
    headline: "Portfolio is stable overall.",
    componentScores: [
      { key: "workflow_completion", normalizedScore: 80, contribution: 20 },
      { key: "screening_reliability", normalizedScore: 80, contribution: 16 },
      { key: "maintenance_stability", normalizedScore: 80, contribution: 12 },
      { key: "automation_health", normalizedScore: 80, contribution: 8 },
      { key: "policy_friction", normalizedScore: 80, contribution: 8 },
      { key: "exception_burden", normalizedScore: 80, contribution: 16 },
    ],
    metrics: {
      totalResourcesReviewed: 20,
      triageItemCount: 2,
      criticalTriageCount: 0,
      reconciliationIssueCount: 1,
      automationSkipCount: 1,
      policyReviewCount: 1,
      blockedWorkflowCount: 0,
      maintenanceReopenCount: 0,
    },
    ...overrides,
  };
}

describe("derivePortfolioScoreTrend", () => {
  it("derives an upward trend from two snapshots", () => {
    const trend = derivePortfolioScoreTrend([
      snapshot({ snapshotAt: "2026-04-15T12:00:00.000Z", score: 84, grade: "B" }),
      snapshot({ snapshotAt: "2026-04-01T12:00:00.000Z", score: 78, grade: "C" }),
    ]);

    expect(trend.direction).toBe("up");
    expect(trend.deltaScore).toBe(6);
    expect(trend.deltaGrade).toBe("C -> B");
  });

  it("derives a flat trend within the neutral threshold", () => {
    const trend = derivePortfolioScoreTrend([
      snapshot({ snapshotAt: "2026-04-15T12:00:00.000Z", score: 81 }),
      snapshot({ snapshotAt: "2026-04-01T12:00:00.000Z", score: 80 }),
    ]);

    expect(trend.direction).toBe("flat");
    expect(trend.deltaScore).toBe(1);
  });

  it("handles insufficient data safely", () => {
    const trend = derivePortfolioScoreTrend([snapshot()]);

    expect(trend.direction).toBe("insufficient_data");
    expect(trend.deltaScore).toBeNull();
    expect(trend.movers).toEqual([]);
  });

  it("sorts movers by absolute delta contribution", () => {
    const trend = derivePortfolioScoreTrend([
      snapshot({
        snapshotAt: "2026-04-15T12:00:00.000Z",
        componentScores: [
          { key: "workflow_completion", normalizedScore: 90, contribution: 22.5 },
          { key: "screening_reliability", normalizedScore: 60, contribution: 12 },
          { key: "maintenance_stability", normalizedScore: 80, contribution: 12 },
          { key: "automation_health", normalizedScore: 80, contribution: 8 },
          { key: "policy_friction", normalizedScore: 80, contribution: 8 },
          { key: "exception_burden", normalizedScore: 70, contribution: 14 },
        ],
      }),
      snapshot({
        snapshotAt: "2026-04-01T12:00:00.000Z",
        componentScores: [
          { key: "workflow_completion", normalizedScore: 82, contribution: 20.5 },
          { key: "screening_reliability", normalizedScore: 80, contribution: 16 },
          { key: "maintenance_stability", normalizedScore: 80, contribution: 12 },
          { key: "automation_health", normalizedScore: 80, contribution: 8 },
          { key: "policy_friction", normalizedScore: 80, contribution: 8 },
          { key: "exception_burden", normalizedScore: 80, contribution: 16 },
        ],
      }),
    ]);

    expect(trend.movers[0]?.key).toBe("screening_reliability");
    expect(trend.movers[0]?.direction).toBe("down");
  });
});

