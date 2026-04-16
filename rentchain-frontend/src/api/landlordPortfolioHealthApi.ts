import { apiFetch } from "./apiFetch";

export type PortfolioHealthStatus = "healthy" | "watch" | "attention_needed";
export type PortfolioHealthTrend = "improving" | "stable" | "declining" | "insufficient_data";

export type PortfolioHealthDimensionV1 = {
  key: "screening_health" | "maintenance_health" | "workflow_health" | "response_health";
  label: string;
  status: PortfolioHealthStatus;
  summary: string;
};

export type LandlordPortfolioHealthSummaryV1 = {
  version: "v1";
  portfolioId: string;
  generatedAt: string;
  overall: {
    status: PortfolioHealthStatus;
    headline: string;
    summary: string;
  };
  trend: {
    direction: PortfolioHealthTrend;
    summary: string;
  };
  dimensions: PortfolioHealthDimensionV1[];
  nextFocus: Array<{
    key: string;
    label: string;
    summary: string;
  }>;
  feedback?: {
    summaries: string[];
  };
  metadata?: {
    portfolioScoreGrade?: string | null;
    portfolioScoreAvailable: boolean;
    trendAvailable: boolean;
  };
};

export async function fetchLandlordPortfolioHealth(): Promise<{
  portfolioHealth: LandlordPortfolioHealthSummaryV1;
}> {
  return await apiFetch<{ portfolioHealth: LandlordPortfolioHealthSummaryV1 }>("/landlord/portfolio-health");
}
