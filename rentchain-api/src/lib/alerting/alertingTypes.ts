export type AlertCategory =
  | "screening_reconciliation"
  | "portfolio_score_change"
  | "policy_exception"
  | "automation_exception"
  | "maintenance_friction"
  | "resolution_attention"
  | "system_attention";

export type AlertSeverity =
  | "low"
  | "medium"
  | "high"
  | "critical";

export type AdminAlertV1 = {
  version: "v1";
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  resource: {
    type: string;
    id: string;
    portfolioId?: string | null;
    title?: string | null;
    subtitle?: string | null;
    status?: string | null;
  };
  reason: {
    code: string;
    summary: string;
    details?: string | null;
  };
  signals: {
    reconciliationStatus?: string | null;
    triageCategory?: string | null;
    triageSeverity?: string | null;
    policyOutcome?: string | null;
    automationAction?: string | null;
    automationExecuted?: boolean | null;
    portfolioScore?: number | null;
    portfolioScoreDelta?: number | null;
    resolutionStatus?: string | null;
    inactivityMs?: number | null;
  };
  state: {
    isActive: boolean;
    isAcknowledged: boolean;
    acknowledgedAt?: string | null;
    acknowledgedBy?: string | null;
  };
  timestamps: {
    createdAt: string;
    updatedAt: string;
    lastSeenAt?: string | null;
  };
  navigation: {
    supportConsolePath?: string | null;
    triagePath?: string | null;
    portfolioScorePath?: string | null;
  };
  assignment?: {
    ownerId?: string | null;
    ownerLabel?: string | null;
  } | null;
  tags?: string[];
};
