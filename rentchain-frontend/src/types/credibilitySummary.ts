import type { RiskGrade } from "./leaseRisk";

export type PropertyCredibilityHealthStatus = "strong" | "watch" | "limited-data" | "unknown";

export interface PropertyCredibilitySummary {
  propertyId: string;
  tenantScoreAverage: number | null;
  tenantScoreGradeAverage: RiskGrade | null;
  leaseRiskAverage: number | null;
  leaseRiskGradeAverage: RiskGrade | null;
  activeLeaseCount: number;
  tenantsWithScoreCount: number;
  leasesWithRiskCount: number;
  lowConfidenceCount: number;
  missingCredibilityCount: number;
  healthStatus: PropertyCredibilityHealthStatus;
}
