export type PortfolioScoreVisibility = "private" | "landlord_visible" | "shareable_link";

export type PortfolioScoreShareRecordV1 = {
  version: "v1";
  portfolioId: string;
  visibility: PortfolioScoreVisibility;
  shareToken?: string | null;
  shareEnabledAt?: string | null;
  revokedAt?: string | null;
  updatedAt: string;
};

export type PortfolioScoreSharedViewV1 = {
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
