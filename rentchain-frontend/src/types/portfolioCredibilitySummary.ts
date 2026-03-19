import type { RiskGrade } from "./leaseRisk";

export type PortfolioCredibilityHealthStatus = "strong" | "watch" | "limited-data" | "unknown";

export interface PortfolioCredibilitySummary {
  propertyCount: number;
  activeLeaseCount: number;
  tenantScoreAverage: number | null;
  tenantScoreGradeAverage: RiskGrade | null;
  leaseRiskAverage: number | null;
  leaseRiskGradeAverage: RiskGrade | null;
  tenantsWithScoreCount: number;
  leasesWithRiskCount: number;
  lowConfidenceCount: number;
  missingCredibilityCount: number;
  healthStatus: PortfolioCredibilityHealthStatus;
}
