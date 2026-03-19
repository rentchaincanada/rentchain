export type ApplicationDecisionGrade = "A" | "B" | "C" | "D" | "E";

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
