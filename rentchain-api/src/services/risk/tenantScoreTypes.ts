import type { RiskGrade } from "./riskTypes";

export type TenantScoreGrade = RiskGrade;

export type TenantScoreTimelineTrigger =
  | "lease_create"
  | "lease_recompute"
  | "tenant_recompute"
  | "backfill"
  | "unknown";

export type TenantScore = {
  version: string;
  score: number;
  grade: TenantScoreGrade;
  confidence: number;
  factors: {
    leaseRisk?: number | null;
    paymentBehavior?: number | null;
    stability?: number | null;
    historyDepth?: number | null;
  };
  signals: string[];
  recommendations: string[];
  derivedFrom: {
    activeLeaseCount?: number;
    completedLeaseCount?: number;
    latestLeaseRiskScore?: number | null;
    averageLeaseRiskScore?: number | null;
    onTimePaymentRatio?: number | null;
  };
  generatedAt: string;
};

export type TenantScoreTimelineEntry = {
  generatedAt: string;
  version: string;
  score: number;
  grade: TenantScoreGrade;
  confidence: number;
  trigger: TenantScoreTimelineTrigger;
  source?: string | null;
  signals?: string[];
};

export type TenantScoreInput = {
  activeLeaseCount?: number | null;
  completedLeaseCount?: number | null;
  latestLeaseRiskScore?: number | null;
  averageLeaseRiskScore?: number | null;
  onTimePaymentRatio?: number | null;
  latePayments?: number | null;
  missedPayments?: number | null;
  nsfCount?: number | null;
  evictionNoticeCount?: number | null;
  positiveNotesCount?: number | null;
  evidenceLeaseCount?: number | null;
};

export type TenantScoreSnapshotFields = {
  tenantScore: TenantScore | null;
  tenantScoreValue: number | null;
  tenantScoreGrade: TenantScoreGrade | null;
  tenantScoreConfidence: number | null;
};

export type TenantScorePersistenceFields = TenantScoreSnapshotFields & {
  tenantScoreTimeline: TenantScoreTimelineEntry[];
};
