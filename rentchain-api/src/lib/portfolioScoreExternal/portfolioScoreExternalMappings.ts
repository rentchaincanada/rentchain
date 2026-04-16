import type { PortfolioScoreTrendV1 } from "../portfolioScoreHistory/portfolioScoreHistoryTypes";
import type { PortfolioScoreComponent, PortfolioScoreV1 } from "../portfolioScore/portfolioScoreTypes";

export const PORTFOLIO_SCORE_EXTERNAL_SPARSE_DATA_THRESHOLD = 3;

export function mapExternalTrend(
  direction: PortfolioScoreTrendV1["direction"]
): "improving" | "stable" | "declining" | "insufficient_data" {
  if (direction === "up") return "improving";
  if (direction === "down") return "declining";
  if (direction === "flat") return "stable";
  return "insufficient_data";
}

export function scoreHeadline(score: number, sparseData: boolean) {
  if (sparseData) {
    return "Your portfolio score is still taking shape.";
  }
  if (score >= 90) {
    return "Your portfolio is operating at a high standard.";
  }
  if (score >= 70) {
    return "Your portfolio is stable with some areas to monitor.";
  }
  return "Your portfolio has areas that need attention.";
}

export function scoreExplanation(score: number, sparseData: boolean) {
  if (sparseData) {
    return "Your portfolio score will become more precise as more activity is recorded.";
  }
  if (score >= 90) {
    return "Recent portfolio activity has been consistent and well balanced across key operational areas.";
  }
  if (score >= 70) {
    return "Your portfolio is performing steadily overall, with a few areas that may benefit from closer follow-through.";
  }
  return "Some parts of your portfolio operations may need more consistent follow-through to strengthen overall performance.";
}

export function componentStatus(score: number): "strong" | "moderate" | "needs_attention" {
  if (score >= 80) return "strong";
  if (score >= 60) return "moderate";
  return "needs_attention";
}

export function componentSummary(
  key: PortfolioScoreComponent["key"],
  status: "strong" | "moderate" | "needs_attention",
  sparseData: boolean
) {
  if (sparseData) {
    if (key === "workflow_completion") {
      return "Workflow performance detail will become clearer as more portfolio activity is recorded.";
    }
    if (key === "screening_reliability") {
      return "Screening performance detail will become clearer as more portfolio activity is recorded.";
    }
    if (key === "maintenance_stability") {
      return "Maintenance performance detail will become clearer as more portfolio activity is recorded.";
    }
    if (key === "automation_health") {
      return "Operational consistency detail will become clearer as more portfolio activity is recorded.";
    }
    if (key === "policy_friction") {
      return "Operational review detail will become clearer as more portfolio activity is recorded.";
    }
    return "Overall consistency detail will become clearer as more portfolio activity is recorded.";
  }

  if (key === "workflow_completion") {
    return status === "strong"
      ? "Core portfolio workflows are reaching healthy outcomes consistently."
      : status === "moderate"
      ? "Most portfolio workflows are progressing normally, with some room to tighten follow-through."
      : "Portfolio workflows may need more consistent follow-through to keep progress moving.";
  }
  if (key === "screening_reliability") {
    return status === "strong"
      ? "Application and screening activity is moving through reliably."
      : status === "moderate"
      ? "Application and screening activity is generally steady, with a few areas to monitor."
      : "Application and screening follow-through may need closer attention.";
  }
  if (key === "maintenance_stability") {
    return status === "strong"
      ? "Maintenance activity appears stable and well managed."
      : status === "moderate"
      ? "Maintenance activity is mostly stable, with some areas to watch."
      : "Maintenance activity may need more focused follow-through.";
  }
  if (key === "automation_health") {
    return status === "strong"
      ? "Operational consistency has been supported well across recent activity."
      : status === "moderate"
      ? "Operational consistency is steady overall, with some room for improvement."
      : "Operational consistency may need closer follow-through in key areas.";
  }
  if (key === "policy_friction") {
    return status === "strong"
      ? "Portfolio activity is moving with relatively low operational friction."
      : status === "moderate"
      ? "Portfolio activity is moving steadily, though some areas may require extra review."
      : "Operational friction may be slowing progress in a few areas.";
  }
  return status === "strong"
    ? "Overall portfolio consistency looks strong."
    : status === "moderate"
    ? "Overall portfolio consistency is steady, with a few areas to monitor."
    : "Overall portfolio consistency may need more attention right now.";
}

export function trendSummary(
  direction: "improving" | "stable" | "declining" | "insufficient_data",
  sparseData: boolean
) {
  if (sparseData || direction === "insufficient_data") {
    return "Your trend will become clearer as more portfolio activity is recorded over time.";
  }
  if (direction === "improving") {
    return "Your portfolio score has been improving in recent history.";
  }
  if (direction === "declining") {
    return "Your portfolio score has softened in recent history and may need closer attention.";
  }
  return "Your portfolio score has remained generally steady in recent history.";
}

export function trustExplanation(score: PortfolioScoreV1, sparseData: boolean) {
  if (sparseData) {
    return "Your score reflects early activity patterns and will become more informative as more portfolio activity is recorded.";
  }
  if (score.score >= 85) {
    return "Your score reflects strong operational consistency across recent portfolio activity.";
  }
  if (score.score >= 70) {
    return "Your score reflects generally steady portfolio operations, with some areas that may need attention.";
  }
  return "Your score reflects portfolio activity that may need more consistent follow-through in a few areas.";
}

export const TRUST_METHODOLOGY_NOTE =
  "Scores are based on activity patterns, workflow completion, and operational consistency over time.";
