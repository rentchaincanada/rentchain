import { apiFetch } from "./apiFetch";

export type DecisionInboxSeverity = "critical" | "high" | "medium" | "low" | "info" | "unknown";
export type DecisionInboxStatus = "open" | "pending" | "blocked" | "resolved" | "dismissed" | "unknown";
export type DecisionInboxType =
  | "lease"
  | "screening"
  | "maintenance"
  | "compliance"
  | "admin"
  | "property"
  | "tenant"
  | "billing"
  | "unknown";

export type DecisionInboxItem = {
  id: string;
  title: string;
  description: string;
  severity: DecisionInboxSeverity;
  status: DecisionInboxStatus;
  type: DecisionInboxType;
  source: "dashboard" | "lease_ledger" | "admin_review" | "analytics" | "unknown";
  relatedEntity: {
    kind: "lease" | "application" | "tenant" | "property" | "unit" | "maintenance_request" | "unknown";
    id: string;
    label: string;
  } | null;
  destination: string | null;
  automationEligible: false;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DecisionInboxResponse = {
  items: DecisionInboxItem[];
  filters: {
    severity: DecisionInboxSeverity[];
    status: DecisionInboxStatus[];
    type: DecisionInboxType[];
  };
  summary: {
    total: number;
    critical: number;
    high: number;
    open: number;
    blocked: number;
  };
};

export type DecisionInboxQuery = {
  severity?: DecisionInboxSeverity | "all";
  status?: DecisionInboxStatus | "all";
  type?: DecisionInboxType | "all";
};

export async function fetchDecisionInbox(params?: DecisionInboxQuery): Promise<DecisionInboxResponse> {
  const search = new URLSearchParams();
  if (params?.severity && params.severity !== "all") search.set("severity", params.severity);
  if (params?.status && params.status !== "all") search.set("status", params.status);
  if (params?.type && params.type !== "all") search.set("type", params.type);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true } & DecisionInboxResponse>(`/landlord/decision-inbox${suffix}`);
  return {
    items: response.items || [],
    filters: response.filters || { severity: [], status: [], type: [] },
    summary: response.summary || { total: 0, critical: 0, high: 0, open: 0, blocked: 0 },
  };
}
