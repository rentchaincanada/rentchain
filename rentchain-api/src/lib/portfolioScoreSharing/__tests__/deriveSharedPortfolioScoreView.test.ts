import { describe, expect, it } from "vitest";

import { deriveSharedPortfolioScoreView } from "../deriveSharedPortfolioScoreView";

describe("deriveSharedPortfolioScoreView", () => {
  it("returns a safe shared score payload from external score input", () => {
    const result = deriveSharedPortfolioScoreView({
      version: "v1",
      portfolioId: "portfolio-1",
      generatedAt: "2026-04-16T12:00:00.000Z",
      score: 88,
      grade: "B",
      summary: {
        headline: "Your portfolio is stable with some areas to monitor.",
        explanation: "Operations are generally consistent overall.",
      },
      trend: {
        direction: "stable",
        summary: "The score has remained generally steady.",
      },
      components: [
        {
          key: "workflow_completion",
          label: "Workflow completion",
          status: "strong",
          summary: "Core workflows are completing consistently.",
        },
      ],
      trust: {
        explanation: "Your score reflects operational consistency over time.",
        methodologyNote: "Scores are based on activity patterns and consistency.",
      },
    });

    expect(result).toEqual(
      expect.objectContaining({
        version: "v1",
        portfolioId: "portfolio-1",
        score: 88,
        grade: "B",
        components: expect.any(Array),
        trust: expect.objectContaining({
          explanation: expect.any(String),
          methodologyNote: expect.any(String),
        }),
      })
    );
  });

  it("returns null when external score input is missing", () => {
    expect(deriveSharedPortfolioScoreView(null)).toBeNull();
  });
});
