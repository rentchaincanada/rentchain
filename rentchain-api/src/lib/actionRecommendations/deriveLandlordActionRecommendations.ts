import type { LandlordPortfolioHealthSummaryV1, PortfolioHealthDimensionV1 } from "../portfolioHealth/portfolioHealthTypes";
import type { PortfolioScoreExternalV1 } from "../portfolioScoreExternal/portfolioScoreExternalTypes";
import {
  categoryTemplate,
  portfolioHealthRecommendation,
  priorityFromSignals,
  RECOMMENDATION_CATEGORY_ORDER,
  RECOMMENDATION_PRIORITY_ORDER,
  sparseDataRecommendationTemplates,
} from "./actionRecommendationMappings";
import type {
  LandlordActionRecommendationV1,
  RecommendationCategory,
} from "./actionRecommendationTypes";

function recommendationId(category: RecommendationCategory) {
  return category.replace(/_/g, "-");
}

function sparseData(input: {
  portfolioHealth: LandlordPortfolioHealthSummaryV1;
  portfolioScore: PortfolioScoreExternalV1;
}) {
  return (
    input.portfolioHealth.trend.direction === "insufficient_data" ||
    input.portfolioScore.trend.direction === "insufficient_data" ||
    /taking shape|more precise as more activity is recorded/i.test(input.portfolioScore.summary.explanation)
  );
}

function categoryForDimension(key: PortfolioHealthDimensionV1["key"]): RecommendationCategory {
  if (key === "screening_health") return "screening_follow_through";
  if (key === "maintenance_health") return "maintenance_follow_up";
  if (key === "workflow_health") return "workflow_completion";
  return "response_improvement";
}

function buildRecommendation(
  category: RecommendationCategory,
  input: {
    portfolioHealth: LandlordPortfolioHealthSummaryV1;
    portfolioScore: PortfolioScoreExternalV1;
    dimensionStatus?: PortfolioHealthDimensionV1["status"] | null;
  }
): LandlordActionRecommendationV1 {
  const priority = priorityFromSignals({
    overallStatus: input.portfolioHealth.overall.status,
    trendDirection: input.portfolioHealth.trend.direction,
    grade: input.portfolioScore.grade,
    dimensionStatus: input.dimensionStatus,
  });

  const template =
    category === "portfolio_health"
      ? portfolioHealthRecommendation({
          overallStatus: input.portfolioHealth.overall.status,
          trendDirection: input.portfolioHealth.trend.direction,
          grade: input.portfolioScore.grade,
        })
      : categoryTemplate({
          category,
          priority,
          trendDirection: input.portfolioHealth.trend.direction,
        });

  return {
    version: "v1",
    id: recommendationId(category),
    ...template,
    metadata: {
      trendDirection: input.portfolioHealth.trend.direction,
      overallHealthStatus: input.portfolioHealth.overall.status,
      portfolioScoreGrade: input.portfolioHealth.metadata?.portfolioScoreGrade ?? input.portfolioScore.grade ?? null,
    },
  };
}

export function deriveLandlordActionRecommendations(input: {
  portfolioHealth: LandlordPortfolioHealthSummaryV1;
  portfolioScore: PortfolioScoreExternalV1;
}): LandlordActionRecommendationV1[] {
  if (sparseData(input)) {
    return sparseDataRecommendationTemplates().map((template) => ({
      version: "v1",
      id: recommendationId(template.category),
      ...template,
      metadata: {
        trendDirection: input.portfolioHealth.trend.direction,
        overallHealthStatus: input.portfolioHealth.overall.status,
        portfolioScoreGrade: input.portfolioHealth.metadata?.portfolioScoreGrade ?? input.portfolioScore.grade ?? null,
      },
    }));
  }

  const categories = new Set<RecommendationCategory>();

  for (const dimension of input.portfolioHealth.dimensions) {
    if (dimension.status !== "healthy") {
      categories.add(categoryForDimension(dimension.key));
    }
  }

  if (
    input.portfolioHealth.overall.status !== "healthy" ||
    input.portfolioHealth.trend.direction === "declining" ||
    input.portfolioScore.grade === "D" ||
    input.portfolioScore.grade === "E"
  ) {
    categories.add("portfolio_health");
  }

  if (!categories.size) {
    categories.add("portfolio_health");
    categories.add("response_improvement");
  }

  const recommendations = [...categories].map((category) => {
    const dimension = input.portfolioHealth.dimensions.find(
      (item) => categoryForDimension(item.key) === category
    );
    return buildRecommendation(category, {
      portfolioHealth: input.portfolioHealth,
      portfolioScore: input.portfolioScore,
      dimensionStatus: dimension?.status ?? null,
    });
  });

  return recommendations
    .sort((left, right) => {
      const priorityDelta =
        RECOMMENDATION_PRIORITY_ORDER.indexOf(left.priority) -
        RECOMMENDATION_PRIORITY_ORDER.indexOf(right.priority);
      if (priorityDelta !== 0) return priorityDelta;
      return RECOMMENDATION_CATEGORY_ORDER.indexOf(left.category) - RECOMMENDATION_CATEGORY_ORDER.indexOf(right.category);
    })
    .slice(0, 5);
}
