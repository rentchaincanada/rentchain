export type RecommendationPriority =
  | "high"
  | "medium"
  | "low";

export type RecommendationCategory =
  | "screening_follow_through"
  | "maintenance_follow_up"
  | "workflow_completion"
  | "portfolio_health"
  | "response_improvement";

export type LandlordActionRecommendationV1 = {
  version: "v1";
  id: string;
  category: RecommendationCategory;
  priority: RecommendationPriority;
  title: string;
  summary: string;
  whyNow: string;
  suggestedAction: string;
  relatedArea?: "health" | "score" | "trend" | "workflow" | "maintenance" | "screening";
  navigation?: {
    path?: string | null;
    label?: string | null;
  };
  metadata?: {
    trendDirection?: "improving" | "stable" | "declining" | "insufficient_data" | null;
    overallHealthStatus?: "healthy" | "watch" | "attention_needed" | null;
    portfolioScoreGrade?: string | null;
  };
};
