import type { PortfolioScoreV1 } from "../portfolioScore/portfolioScoreTypes";
import type { PortfolioScoreSnapshotV1 } from "./portfolioScoreHistoryTypes";

export function buildPortfolioScoreSnapshot(
  portfolioScore: PortfolioScoreV1,
  snapshotAt?: string
): PortfolioScoreSnapshotV1 {
  const timestamp = snapshotAt || new Date().toISOString();
  return {
    version: "v1",
    portfolioId: portfolioScore.portfolioId,
    snapshotAt: timestamp,
    score: portfolioScore.score,
    grade: portfolioScore.grade,
    status: portfolioScore.summary.status,
    headline: portfolioScore.summary.headline,
    componentScores: portfolioScore.components.map((component) => ({
      key: component.key,
      normalizedScore: component.normalizedScore,
      contribution: component.contribution,
    })),
    metrics: {
      ...portfolioScore.metrics,
    },
  };
}

