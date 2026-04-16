import type { PortfolioScoreV1 } from "../portfolioScore/portfolioScoreTypes";
import type { PortfolioScoreTrendV1 } from "../portfolioScoreHistory/portfolioScoreHistoryTypes";
import {
  componentStatus,
  componentSummary,
  mapExternalTrend,
  PORTFOLIO_SCORE_EXTERNAL_SPARSE_DATA_THRESHOLD,
  scoreExplanation,
  scoreHeadline,
  trendSummary,
  trustExplanation,
  TRUST_METHODOLOGY_NOTE,
} from "./portfolioScoreExternalMappings";
import type { PortfolioScoreExternalV1 } from "./portfolioScoreExternalTypes";

export function derivePortfolioScoreExternal(input: {
  portfolioScore: PortfolioScoreV1;
  portfolioTrend: PortfolioScoreTrendV1;
}): PortfolioScoreExternalV1 {
  const { portfolioScore, portfolioTrend } = input;
  const sparseData =
    portfolioScore.metrics.totalResourcesReviewed < PORTFOLIO_SCORE_EXTERNAL_SPARSE_DATA_THRESHOLD;
  const externalTrend = mapExternalTrend(portfolioTrend.direction);

  return {
    version: "v1",
    portfolioId: portfolioScore.portfolioId,
    generatedAt: new Date().toISOString(),
    score: portfolioScore.score,
    grade: portfolioScore.grade,
    summary: {
      headline: scoreHeadline(portfolioScore.score, sparseData),
      explanation: scoreExplanation(portfolioScore.score, sparseData),
    },
    trend: {
      direction: externalTrend,
      summary: trendSummary(externalTrend, sparseData),
    },
    components: portfolioScore.components.map((component) => {
      const status = componentStatus(component.normalizedScore);
      return {
        key: component.key,
        label: component.label,
        status,
        summary: componentSummary(component.key, status, sparseData),
      };
    }),
    trust: {
      explanation: trustExplanation(portfolioScore, sparseData),
      methodologyNote: TRUST_METHODOLOGY_NOTE,
    },
  };
}
