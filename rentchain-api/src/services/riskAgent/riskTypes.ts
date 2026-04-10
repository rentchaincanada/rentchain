export type RiskAgentVersion = "risk-v1";

export type RiskAgentGrade = "A" | "B" | "C" | "D" | "E";

export type RiskAgentStatus = "completed" | "insufficient_data" | "manual_review_required";

export type RiskAgentConfidenceBand = "low" | "medium" | "high";

export type RiskAgentFactorImpact = "positive" | "negative" | "neutral";

export type RiskAgentIdentityStatus = "verified" | "pending" | "missing" | "needs_review" | "unknown";

export type RiskAgentDocumentStatus = "verified" | "pending" | "missing" | "needs_review" | "unknown";

export type RiskAgentConsistencyStatus = "aligned" | "conflict" | "unknown";

export interface RiskAgentFactor {
  code: string;
  label: string;
  impact: RiskAgentFactorImpact;
  weight: number;
}

export interface RiskAgentInputs {
  monthlyIncome: number | null;
  monthlyRent: number | null;
  incomeToRentRatio: number | null;
  identityStatus: RiskAgentIdentityStatus;
  documentStatus: RiskAgentDocumentStatus;
  employmentMonths: number | null;
  coTenantCount: number | null;
  applicationCompleteness: number | null;
  paymentHistoryRatio: number | null;
  latePayments: number | null;
  leaseApplicationConsistency: RiskAgentConsistencyStatus;
}

export interface RiskAgentEvaluation {
  version: RiskAgentVersion;
  score: number;
  grade: RiskAgentGrade;
  confidence: number;
  confidenceBand: RiskAgentConfidenceBand;
  status: RiskAgentStatus;
  factors: RiskAgentFactor[];
  flags: string[];
  recommendations: string[];
  inputs: RiskAgentInputs;
  createdAt: string;
}

export interface RiskAgentRunRecord extends RiskAgentEvaluation {
  id: string;
  entityType: "application";
  entityId: string;
  applicationId: string;
  landlordId: string | null;
  propertyId: string | null;
  tenantId: string | null;
  leaseId: string | null;
  reviewSummarySnapshot: {
    screeningStatus: string | null;
    screeningProvider: string | null;
    screeningScoreBand: string | null;
    applicationStatus: string | null;
  };
}

export interface RiskAgentLatestRecord extends RiskAgentEvaluation {
  id: string;
  latestRunId: string;
  entityType: "application";
  entityId: string;
  applicationId: string;
  landlordId: string | null;
  propertyId: string | null;
  tenantId: string | null;
  leaseId: string | null;
  updatedAt: string;
}

export interface RiskAgentApplicationContext {
  applicationId: string;
  application: any;
  landlordId: string | null;
  propertyId: string | null;
  tenantId: string | null;
  leaseId: string | null;
  identityStatus: RiskAgentIdentityStatus;
  documentStatus: RiskAgentDocumentStatus;
  monthlyIncome: number | null;
  monthlyRent: number | null;
  employmentMonths: number | null;
  coTenantCount: number | null;
  applicationCompleteness: number | null;
  paymentHistoryRatio: number | null;
  latePayments: number | null;
  leaseApplicationConsistency: RiskAgentConsistencyStatus;
  reviewSummarySnapshot: {
    screeningStatus: string | null;
    screeningProvider: string | null;
    screeningScoreBand: string | null;
    applicationStatus: string | null;
  };
}
