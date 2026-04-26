export type PortfolioScoreTrendDirection =
  | "up"
  | "down"
  | "flat"
  | "insufficient_data";

export type PortfolioScoreSnapshotV1 = {
  version: "v1";
  portfolioId: string;
  snapshotAt: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "E";
  status: "healthy" | "watch" | "at_risk";
  headline: string;
  componentScores: Array<{
    key:
      | "workflow_completion"
      | "screening_reliability"
      | "maintenance_stability"
      | "automation_health"
      | "policy_friction"
      | "exception_burden";
    normalizedScore: number;
    contribution: number;
  }>;
  metrics: {
    totalResourcesReviewed: number;
    triageItemCount: number;
    criticalTriageCount: number;
    reconciliationIssueCount: number;
    automationSkipCount: number;
    policyReviewCount: number;
    blockedWorkflowCount: number;
    maintenanceReopenCount: number;
  };
};

export type PortfolioScoreTrendV1 = {
  version: "v1";
  portfolioId: string;
  generatedAt: string;
  latest?: PortfolioScoreSnapshotV1 | null;
  previous?: PortfolioScoreSnapshotV1 | null;
  direction: PortfolioScoreTrendDirection;
  deltaScore: number | null;
  deltaGrade?: string | null;
  summary: {
    headline: string;
    notes: string[];
  };
  movers: Array<{
    key: string;
    deltaNormalizedScore: number;
    deltaContribution: number;
    direction: "up" | "down" | "flat";
    summary: string;
  }>;
  history: PortfolioScoreSnapshotV1[];
};

