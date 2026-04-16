import type { PortfolioHealthStatus, PortfolioHealthTrend } from "./portfolioHealthTypes";
import type { PortfolioScoreV1 } from "../portfolioScore/portfolioScoreTypes";
import type { PortfolioScoreTrendV1 } from "../portfolioScoreHistory/portfolioScoreHistoryTypes";

export const PORTFOLIO_HEALTH_SPARSE_DATA_THRESHOLD = 3;

export function mapOverallStatus(scoreStatus: PortfolioScoreV1["summary"]["status"]): PortfolioHealthStatus {
  if (scoreStatus === "healthy") return "healthy";
  if (scoreStatus === "watch") return "watch";
  return "attention_needed";
}

export function mapTrendDirection(
  direction: PortfolioScoreTrendV1["direction"]
): PortfolioHealthTrend {
  if (direction === "up") return "improving";
  if (direction === "down") return "declining";
  if (direction === "flat") return "stable";
  return "insufficient_data";
}

export function statusFromComponentScore(score: number): PortfolioHealthStatus {
  if (score >= 80) return "healthy";
  if (score >= 60) return "watch";
  return "attention_needed";
}

export function sparseDataOverallSummary() {
  return "Portfolio health data is still developing as more activity is recorded.";
}

export function sparseDataTrendSummary() {
  return "Trend visibility will improve as more portfolio activity is tracked.";
}

export function overallHeadline(status: PortfolioHealthStatus, trend: PortfolioHealthTrend) {
  if (status === "healthy" && trend === "improving") {
    return "Your portfolio health looks strong and continues to improve.";
  }
  if (status === "healthy") {
    return "Your portfolio health looks steady and generally healthy.";
  }
  if (status === "watch" && trend === "declining") {
    return "Your portfolio health is stable overall, with a few areas that need closer attention.";
  }
  if (status === "watch") {
    return "Your portfolio health is stable overall, with a few areas to monitor.";
  }
  return "Your portfolio health needs attention in a few important areas.";
}

export function overallSummary(status: PortfolioHealthStatus, sparseData: boolean) {
  if (sparseData) {
    return sparseDataOverallSummary();
  }
  if (status === "healthy") {
    return "Most portfolio activity is progressing normally and overall health appears steady.";
  }
  if (status === "watch") {
    return "Most portfolio activity is progressing normally, while a small number of areas may need closer follow-through.";
  }
  return "Some portfolio activity may need more consistent follow-through to keep operations moving smoothly.";
}

export function trendSummary(direction: PortfolioHealthTrend, sparseData: boolean) {
  if (sparseData || direction === "insufficient_data") {
    return sparseDataTrendSummary();
  }
  if (direction === "improving") {
    return "Portfolio health has been improving in recent history.";
  }
  if (direction === "declining") {
    return "Portfolio health has softened in recent history and may need closer follow-through.";
  }
  return "Portfolio health has remained generally steady in recent history.";
}
