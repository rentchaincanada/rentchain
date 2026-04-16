export type TriageCategory =
  | "screening_reconciliation"
  | "policy_review"
  | "automation_exception"
  | "maintenance_friction"
  | "workflow_stall"
  | "system_attention";

export type TriageSeverity = "low" | "medium" | "high" | "critical";

export type AdminTriageItemV1 = {
  id: string;
  version: "v1";
  category: TriageCategory;
  severity: TriageSeverity;
  resource: {
    type: string;
    id: string;
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
    lifecycleState?: string | null;
    policyOutcome?: string | null;
    automationAction?: string | null;
    automationExecuted?: boolean | null;
    blockedCount?: number | null;
    reopenCount?: number | null;
    inactivityMs?: number | null;
  };
  timestamps: {
    surfacedAt: string;
    firstSeenAt?: string | null;
    lastSeenAt?: string | null;
  };
  navigation: {
    supportConsolePath?: string | null;
  };
  resolution?: {
    status: "open" | "acknowledged" | "in_progress" | "resolved" | "dismissed";
    updatedAt: string;
  } | null;
  watch?: {
    isActive: boolean;
    watchId?: string | null;
  } | null;
  tags?: string[];
};
