import type { PortfolioScoreExternalV1 } from "../portfolioScoreExternal/portfolioScoreExternalTypes";
import type { PortfolioScoreSharedViewV1 } from "./portfolioScoreSharingTypes";

export function deriveSharedPortfolioScoreView(
  portfolioScore: PortfolioScoreExternalV1 | null | undefined
): PortfolioScoreSharedViewV1 | null {
  if (!portfolioScore) return null;
  return {
    version: "v1",
    portfolioId: portfolioScore.portfolioId,
    generatedAt: portfolioScore.generatedAt,
    score: portfolioScore.score,
    grade: portfolioScore.grade,
    summary: {
      headline: portfolioScore.summary.headline,
      explanation: portfolioScore.summary.explanation,
    },
    trend: {
      direction: portfolioScore.trend.direction,
      summary: portfolioScore.trend.summary,
    },
    components: portfolioScore.components.map((component) => ({
      key: component.key,
      label: component.label,
      status: component.status,
      summary: component.summary,
    })),
    trust: {
      explanation: portfolioScore.trust.explanation,
      methodologyNote: portfolioScore.trust.methodologyNote,
    },
  };
}
