import type { PortfolioHealthStatus, PortfolioHealthTrend } from "../portfolioHealth/portfolioHealthTypes";
import type { PortfolioScoreExternalV1 } from "../portfolioScoreExternal/portfolioScoreExternalTypes";
import type {
  LandlordActionRecommendationV1,
  RecommendationCategory,
  RecommendationPriority,
} from "./actionRecommendationTypes";

type RecommendationTemplate = Omit<LandlordActionRecommendationV1, "version" | "id" | "metadata">;

export const RECOMMENDATION_CATEGORY_ORDER: RecommendationCategory[] = [
  "screening_follow_through",
  "maintenance_follow_up",
  "workflow_completion",
  "portfolio_health",
  "response_improvement",
];

export const RECOMMENDATION_PRIORITY_ORDER: RecommendationPriority[] = ["high", "medium", "low"];

export function sparseDataRecommendationTemplates(): RecommendationTemplate[] {
  return [
    {
      category: "workflow_completion",
      priority: "medium",
      title: "Keep portfolio activity moving steadily",
      summary: "Your portfolio visibility is still developing, so steady follow-through matters most right now.",
      whyNow: "More consistent portfolio activity will make health trends and recommendations more useful over time.",
      suggestedAction: "Review new portfolio activity regularly and keep next steps moving where possible.",
      relatedArea: "workflow",
      navigation: {
        path: "/portfolio-health",
        label: "Review portfolio health",
      },
    },
    {
      category: "portfolio_health",
      priority: "low",
      title: "Keep building a clearer health picture",
      summary: "Your portfolio summary is still taking shape as more activity is recorded.",
      whyNow: "Trend visibility improves as more recent portfolio activity is captured consistently.",
      suggestedAction: "Check portfolio health regularly and continue normal operating follow-through.",
      relatedArea: "health",
      navigation: {
        path: "/portfolio-score",
        label: "Review portfolio score",
      },
    },
  ];
}

export function priorityFromSignals(input: {
  overallStatus: PortfolioHealthStatus;
  trendDirection: PortfolioHealthTrend;
  grade: PortfolioScoreExternalV1["grade"] | null | undefined;
  dimensionStatus?: PortfolioHealthStatus | null;
}): RecommendationPriority {
  const { overallStatus, trendDirection, grade, dimensionStatus } = input;

  if (
    overallStatus === "attention_needed" ||
    trendDirection === "declining" ||
    grade === "D" ||
    grade === "E" ||
    dimensionStatus === "attention_needed"
  ) {
    return "high";
  }

  if (overallStatus === "watch" || grade === "C" || dimensionStatus === "watch") {
    return "medium";
  }

  return "low";
}

export function portfolioHealthRecommendation(input: {
  overallStatus: PortfolioHealthStatus;
  trendDirection: PortfolioHealthTrend;
  grade: PortfolioScoreExternalV1["grade"] | null | undefined;
}): RecommendationTemplate {
  const priority = priorityFromSignals(input);
  return {
    category: "portfolio_health",
    priority,
    title:
      priority === "high"
        ? "Stabilize portfolio health this week"
        : priority === "medium"
        ? "Monitor portfolio health closely"
        : "Keep portfolio health on its current path",
    summary:
      priority === "high"
        ? "Recent portfolio patterns suggest a few areas need steadier follow-through."
        : priority === "medium"
        ? "Your portfolio is generally steady, with a few areas worth watching."
        : "Your portfolio health looks steady overall and is worth maintaining.",
    whyNow:
      input.trendDirection === "declining"
        ? "Recent portfolio direction has softened, so earlier follow-through can help steady performance."
        : input.trendDirection === "improving"
        ? "Recent portfolio direction is improving, which makes this a good time to reinforce what is working."
        : "A steady review rhythm helps keep your portfolio moving smoothly.",
    suggestedAction:
      priority === "high"
        ? "Review your portfolio health summary and focus first on the areas that currently need more attention."
        : priority === "medium"
        ? "Check your portfolio health summary this week and keep momentum in any area that looks less steady."
        : "Continue current portfolio habits and review your health summary regularly to keep progress steady.",
    relatedArea: "health",
    navigation: {
      path: "/portfolio-health",
      label: "Review portfolio health",
    },
  };
}

export function categoryTemplate(input: {
  category: RecommendationCategory;
  priority: RecommendationPriority;
  trendDirection: PortfolioHealthTrend;
}): RecommendationTemplate {
  const { category, priority, trendDirection } = input;

  if (category === "screening_follow_through") {
    return {
      category,
      priority,
      title:
        priority === "high"
          ? "Keep application follow-through moving"
          : "Review screening follow-through",
      summary:
        priority === "high"
          ? "Application and screening activity may need steadier follow-through right now."
          : "Application and screening activity may benefit from a quick review to keep momentum steady.",
      whyNow:
        trendDirection === "declining"
          ? "Recent portfolio direction suggests screening-related activity may be contributing to softer health."
          : "Consistent application follow-through helps support stronger portfolio health over time.",
      suggestedAction: "Review current application activity and keep screening progress moving where possible.",
      relatedArea: "screening",
      navigation: {
        path: "/portfolio-health",
        label: "Review portfolio health",
      },
    };
  }

  if (category === "maintenance_follow_up") {
    return {
      category,
      priority,
      title:
        priority === "high"
          ? "Follow up on maintenance activity"
          : "Keep maintenance activity on track",
      summary:
        priority === "high"
          ? "Maintenance activity may need more focused follow-through to stay on pace."
          : "Maintenance response looks worth monitoring so service activity stays steady.",
      whyNow:
        trendDirection === "declining"
          ? "Maintenance stability appears to be one of the areas softening recent portfolio health."
          : "Steady maintenance follow-through supports a more stable portfolio experience.",
      suggestedAction: "Review outstanding maintenance activity and keep next steps moving where possible.",
      relatedArea: "maintenance",
      navigation: {
        path: "/portfolio-health",
        label: "Review portfolio health",
      },
    };
  }

  if (category === "workflow_completion") {
    return {
      category,
      priority,
      title:
        priority === "high"
          ? "Keep portfolio workflows moving"
          : "Review incomplete portfolio activity",
      summary:
        priority === "high"
          ? "A broader share of portfolio activity may need follow-through to keep progress moving."
          : "A quick review of current activity can help keep portfolio workflows steady.",
      whyNow:
        trendDirection === "declining"
          ? "Recent portfolio direction suggests some workflow momentum may be slipping."
          : "Steady workflow completion supports stronger portfolio consistency over time.",
      suggestedAction: "Review outstanding portfolio activity and close out the next follow-through steps you can.",
      relatedArea: "workflow",
      navigation: {
        path: "/portfolio-health",
        label: "Review portfolio health",
      },
    };
  }

  return {
    category: "response_improvement",
    priority,
    title:
      priority === "high"
        ? "Improve response consistency"
        : "Keep response times steady",
    summary:
      priority === "high"
        ? "Portfolio response timing may need closer attention right now."
        : "Steady response habits can help support stronger portfolio health.",
    whyNow:
      trendDirection === "declining"
        ? "Recent portfolio direction suggests response consistency may be worth tightening."
        : "Keeping response timing steady supports portfolio health and trust over time.",
    suggestedAction: "Review current portfolio activity regularly and keep follow-through timing as consistent as possible.",
    relatedArea: "trend",
    navigation: {
      path: "/portfolio-score",
      label: "Review portfolio score",
    },
  };
}
