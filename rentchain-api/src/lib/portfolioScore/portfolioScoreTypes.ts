export type PortfolioScoreGrade = "A" | "B" | "C" | "D" | "E";

export type PortfolioScoreComponent = {
  key:
    | "workflow_completion"
    | "screening_reliability"
    | "maintenance_stability"
    | "automation_health"
    | "policy_friction"
    | "exception_burden";
  label: string;
  rawValue: number;
  normalizedScore: number;
  weight: number;
  contribution: number;
  reasons?: string[];
};

export type PortfolioScoreV1 = {
  version: "v1";
  portfolioId: string;
  generatedAt: string;
  score: number;
  grade: PortfolioScoreGrade;
  summary: {
    status: "healthy" | "watch" | "at_risk";
    headline: string;
    notes: string[];
  };
  components: PortfolioScoreComponent[];
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

