export type ApplicationDecisionGrade = "A" | "B" | "C" | "D" | "E";

export type RiskAgentReviewFactor = {
  code: string;
  label: string;
  impact: "positive" | "negative" | "neutral";
  weight: number;
};

export type RiskAgentReviewSnapshot = {
  version: string;
  status: "completed" | "insufficient_data" | "manual_review_required";
  score?: number | null;
  grade?: ApplicationDecisionGrade | null;
  confidence?: number | null;
  confidenceBand?: "low" | "medium" | "high" | null;
  factors?: RiskAgentReviewFactor[];
  flags?: string[];
  recommendations?: string[];
  updatedAt?: string | null;
  createdAt?: string | null;
} | null;

export type ApplicationDecisionSummary = {
  applicationId: string;
  status?: string | null;
  riskInsights?: {
    score?: number | null;
    grade?: ApplicationDecisionGrade | null;
    confidence?: number | null;
    signals?: string[];
    recommendations?: string[];
  } | null;
  riskSnapshot?: RiskAgentReviewSnapshot;
  referenceQuestions?: string[];
  screeningRecommendation?: {
    recommended: boolean;
    reason?: string | null;
    priority?: "low" | "medium" | "high" | null;
  } | null;
  screeningSummary?: {
    available: boolean;
    provider?: string | null;
    completedAt?: string | null;
    highlights?: string[];
  } | null;
  decisionSupport?: {
    summaryLine?: string | null;
    nextBestAction?: string | null;
  } | null;
};
