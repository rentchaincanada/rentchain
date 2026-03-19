import type { LeaseRiskSnapshot, RiskGrade } from "./leaseRisk";

export type CredibilityTrend = "up" | "down" | "flat" | "unknown";

export interface CredibilityTenantScoreSummary {
  score: number;
  grade: RiskGrade;
  confidence: number;
  generatedAt: string | null;
  trend: CredibilityTrend;
  signals: string[];
  recommendations: string[];
}

export interface CredibilityLeaseRiskSummary {
  score: number;
  grade: RiskGrade;
  confidence: number;
  generatedAt: string | null;
  flags: string[];
  recommendations: string[];
}

export interface CredibilityInsights {
  tenantScore: CredibilityTenantScoreSummary | null;
  leaseRisk: CredibilityLeaseRiskSummary | null;
}

export type LeaseRiskLike = LeaseRiskSnapshot | CredibilityLeaseRiskSummary | null;
