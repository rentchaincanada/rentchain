import { apiFetch } from "./apiFetch";

export type PortfolioScoreExternalV1 = {
  version: "v1";
  portfolioId: string;
  generatedAt: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  summary: {
    headline: string;
    explanation: string;
  };
  trend: {
    direction: "improving" | "stable" | "declining" | "insufficient_data";
    summary: string;
  };
  components: Array<{
    key:
      | "workflow_completion"
      | "screening_reliability"
      | "maintenance_stability"
      | "automation_health"
      | "policy_friction"
      | "exception_burden";
    label: string;
    status: "strong" | "moderate" | "needs_attention";
    summary: string;
  }>;
  trust: {
    explanation: string;
    methodologyNote: string;
  };
};

export async function fetchLandlordPortfolioScore(): Promise<{
  portfolioScore: PortfolioScoreExternalV1;
}> {
  return await apiFetch<{ portfolioScore: PortfolioScoreExternalV1 }>("/landlord/portfolio-score");
}
