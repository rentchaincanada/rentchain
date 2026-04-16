import { apiFetch } from "./apiFetch";

export type AdminAlertV1 = {
  version: "v1";
  id: string;
  category:
    | "screening_reconciliation"
    | "portfolio_score_change"
    | "policy_exception"
    | "automation_exception"
    | "maintenance_friction"
    | "resolution_attention"
    | "system_attention";
  severity: "low" | "medium" | "high" | "critical";
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

export async function fetchAdminAlerts(params?: {
  category?: string | null;
  severity?: string | null;
  resourceType?: string | null;
  activeOnly?: boolean | null;
  acknowledged?: boolean | null;
  watchedOnly?: boolean | null;
  limit?: number | null;
  cursor?: string | null;
}): Promise<{ alerts: AdminAlertV1[]; nextCursor?: string }> {
  const search = new URLSearchParams();
  if (params?.category) search.set("category", params.category);
  if (params?.severity) search.set("severity", params.severity);
  if (params?.resourceType) search.set("resourceType", params.resourceType);
  if (typeof params?.activeOnly === "boolean") search.set("activeOnly", String(params.activeOnly));
  if (typeof params?.acknowledged === "boolean") search.set("acknowledged", String(params.acknowledged));
  if (typeof params?.watchedOnly === "boolean") search.set("watchedOnly", String(params.watchedOnly));
  if (typeof params?.limit === "number") search.set("limit", String(params.limit));
  if (params?.cursor) search.set("cursor", params.cursor);
  const query = search.toString();
  return await apiFetch(`/admin/alerts${query ? `?${query}` : ""}`);
}

export async function acknowledgeAlert(alertId: string, payload: { acknowledged: boolean }) {
  return await apiFetch(`/admin/alerts/${encodeURIComponent(alertId)}/acknowledge`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
