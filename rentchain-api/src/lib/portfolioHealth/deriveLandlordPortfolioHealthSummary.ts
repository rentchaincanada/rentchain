import type { PortfolioScoreComponent, PortfolioScoreV1 } from "../portfolioScore/portfolioScoreTypes";
import type { PortfolioScoreTrendV1 } from "../portfolioScoreHistory/portfolioScoreHistoryTypes";
import type { AggregatedFeedbackSignalV1 } from "../feedback/feedbackTypes";
import { deriveLandlordFeedbackSummary } from "../feedback/deriveLandlordFeedbackSummary";
import {
  mapOverallStatus,
  mapTrendDirection,
  overallHeadline,
  overallSummary,
  PORTFOLIO_HEALTH_SPARSE_DATA_THRESHOLD,
  sparseDataOverallSummary,
  sparseDataTrendSummary,
  statusFromComponentScore,
  trendSummary,
} from "./portfolioHealthMappings";
import type {
  LandlordPortfolioHealthSummaryV1,
  PortfolioHealthDimensionV1,
  PortfolioHealthStatus,
  PortfolioHealthTrend,
} from "./portfolioHealthTypes";

function componentScore(
  components: PortfolioScoreComponent[],
  key: PortfolioScoreComponent["key"],
  fallback = 70
) {
  return components.find((component) => component.key === key)?.normalizedScore ?? fallback;
}

function screeningDimension(
  score: PortfolioScoreV1,
  feedbackAdjustment?: PortfolioHealthStatus | null
): PortfolioHealthDimensionV1 {
  const screeningScore = componentScore(score.components, "screening_reliability");
  const baseStatus = statusFromComponentScore(screeningScore);
  const status = feedbackAdjustment || baseStatus;
  return {
    key: "screening_health",
    label: "Screening health",
    status,
    summary:
      status === "healthy"
        ? "Application and screening follow-through appears generally steady."
        : status === "watch"
        ? "Application and screening follow-through may need closer attention."
        : "Application and screening follow-through may need more consistent review.",
  };
}

function maintenanceDimension(
  score: PortfolioScoreV1,
  feedbackAdjustment?: PortfolioHealthStatus | null
): PortfolioHealthDimensionV1 {
  const maintenanceScore = componentScore(score.components, "maintenance_stability");
  const baseStatus = statusFromComponentScore(maintenanceScore);
  const status = feedbackAdjustment || baseStatus;
  return {
    key: "maintenance_health",
    label: "Maintenance health",
    status,
    summary:
      status === "healthy"
        ? "Maintenance activity appears generally stable."
        : status === "watch"
        ? "Maintenance workload is elevated in places and may need closer follow-through."
        : "Maintenance activity may need more focused follow-through to stay on track.",
  };
}

function workflowDimension(score: PortfolioScoreV1): PortfolioHealthDimensionV1 {
  const completionScore = componentScore(score.components, "workflow_completion");
  const exceptionScore = componentScore(score.components, "exception_burden");
  const workflowScore = Math.round((completionScore + exceptionScore) / 2);
  const status = statusFromComponentScore(workflowScore);
  return {
    key: "workflow_health",
    label: "Workflow health",
    status,
    summary:
      status === "healthy"
        ? "Portfolio activity is moving through core workflows at a healthy pace."
        : status === "watch"
        ? "Some portfolio activity may need closer follow-through to keep progress steady."
        : "A broader share of portfolio activity may need follow-through to keep progress moving.",
  };
}

function responseDimension(
  score: PortfolioScoreV1,
  trend: PortfolioHealthTrend,
  feedbackAdjustment?: PortfolioHealthStatus | null
): PortfolioHealthDimensionV1 {
  const workflowScore = componentScore(score.components, "workflow_completion");
  const automationScore = componentScore(score.components, "automation_health");
  const blended = Math.round((workflowScore + automationScore) / 2);
  const baseStatus =
    trend === "declining"
      ? (statusFromComponentScore(Math.max(0, blended - 15)) as PortfolioHealthStatus)
      : statusFromComponentScore(blended);
  const status = feedbackAdjustment || baseStatus;

  return {
    key: "response_health",
    label: "Response health",
    status,
    summary:
      status === "healthy"
        ? "Portfolio response and follow-through look generally timely."
        : status === "watch"
        ? "Keeping response times steady may need a bit more attention."
        : "Portfolio response timing may need closer follow-through right now.",
  };
}

function buildNextFocus(
  dimensions: PortfolioHealthDimensionV1[],
  trend: PortfolioHealthTrend,
  sparseData: boolean
) {
  const focus: LandlordPortfolioHealthSummaryV1["nextFocus"] = [];

  const screening = dimensions.find((dimension) => dimension.key === "screening_health");
  const maintenance = dimensions.find((dimension) => dimension.key === "maintenance_health");
  const workflow = dimensions.find((dimension) => dimension.key === "workflow_health");
  const response = dimensions.find((dimension) => dimension.key === "response_health");

  if (screening && screening.status !== "healthy") {
    focus.push({
      key: "screening_follow_through",
      label: "Screening follow-through",
      summary: "Review application and screening follow-through to keep momentum steady.",
    });
  }
  if (maintenance && maintenance.status !== "healthy") {
    focus.push({
      key: "maintenance_follow_up",
      label: "Maintenance follow-up",
      summary: "Follow up on outstanding maintenance activity to help keep service work moving.",
    });
  }
  if (workflow && workflow.status !== "healthy") {
    focus.push({
      key: "workflow_follow_through",
      label: "Workflow follow-through",
      summary: "Review outstanding portfolio activity to keep progress steady.",
    });
  }
  if (response && response.status !== "healthy") {
    focus.push({
      key: "response_timing",
      label: "Response timing",
      summary: "Keep portfolio response times steady as new activity comes in.",
    });
  }
  if (!focus.length && trend === "declining") {
    focus.push({
      key: "health_monitoring",
      label: "Health monitoring",
      summary: "Stay close to recent portfolio activity while overall health stabilizes.",
    });
  }
  if (!focus.length && sparseData) {
    focus.push({
      key: "developing_visibility",
      label: "Activity visibility",
      summary: "Continue normal portfolio activity so health visibility can develop over time.",
    });
  }
  if (!focus.length) {
    focus.push({
      key: "continue_practices",
      label: "Current momentum",
      summary: "Continue current portfolio health practices to keep activity moving smoothly.",
    });
  }

  return focus.slice(0, 4);
}

export function deriveLandlordPortfolioHealthSummary(input: {
  portfolioScore: PortfolioScoreV1;
  portfolioTrend: PortfolioScoreTrendV1;
  feedbackSignals?: AggregatedFeedbackSignalV1[];
}): LandlordPortfolioHealthSummaryV1 {
  const { portfolioScore, portfolioTrend } = input;
  const totalResourcesReviewed = portfolioScore.metrics.totalResourcesReviewed;
  const sparseData = totalResourcesReviewed < PORTFOLIO_HEALTH_SPARSE_DATA_THRESHOLD;
  const overallStatus = mapOverallStatus(portfolioScore.summary.status);
  const trendDirection = mapTrendDirection(portfolioTrend.direction);
  const feedbackSummary = deriveLandlordFeedbackSummary(input.feedbackSignals || []);

  const dimensions: PortfolioHealthDimensionV1[] = [
    screeningDimension(portfolioScore, feedbackSummary.dimensionAdjustments.screening_health),
    maintenanceDimension(portfolioScore, feedbackSummary.dimensionAdjustments.maintenance_health),
    workflowDimension(portfolioScore),
    responseDimension(portfolioScore, trendDirection, feedbackSummary.dimensionAdjustments.response_health),
  ];

  return {
    version: "v1",
    portfolioId: portfolioScore.portfolioId,
    generatedAt: new Date().toISOString(),
    overall: {
      status: overallStatus,
      headline: overallHeadline(overallStatus, trendDirection),
      summary: sparseData ? sparseDataOverallSummary() : overallSummary(overallStatus, false),
    },
    trend: {
      direction: trendDirection,
      summary:
        sparseData || trendDirection === "insufficient_data"
          ? sparseDataTrendSummary()
          : trendSummary(trendDirection, false),
    },
    dimensions,
    nextFocus: buildNextFocus(dimensions, trendDirection, sparseData),
    feedback:
      feedbackSummary.summaries.length > 0
        ? {
            summaries: feedbackSummary.summaries,
          }
        : undefined,
    metadata: {
      portfolioScoreGrade: portfolioScore.grade || null,
      portfolioScoreAvailable: true,
      trendAvailable: portfolioTrend.direction !== "insufficient_data",
    },
  };
}
