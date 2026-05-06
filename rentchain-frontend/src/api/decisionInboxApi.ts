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
export type DecisionWorkflowQueue =
  | "lease_review"
  | "delinquency_review"
  | "screening_review"
  | "maintenance_review"
  | "compliance_review"
  | "admin_review"
  | "general_review";
export type DecisionWorkflowState =
  | "new"
  | "triaged"
  | "under_review"
  | "waiting_context"
  | "escalated"
  | "resolved"
  | "archived";
export type DecisionWorkflowEscalationLevel = "none" | "attention" | "urgent" | "critical";
export type DecisionWorkflowRouting = {
  queue: DecisionWorkflowQueue;
  workflowState: DecisionWorkflowState;
  ownershipType: "landlord" | "admin" | "compliance" | "operations" | "system";
  reviewPriority: "critical" | "high" | "medium" | "low";
  escalationLevel: DecisionWorkflowEscalationLevel;
  manualOnly: true;
};

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
  workflow: DecisionWorkflowRouting;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DecisionInboxResponse = {
  items: DecisionInboxItem[];
  filters: {
    severity: DecisionInboxSeverity[];
    status: DecisionInboxStatus[];
    type: DecisionInboxType[];
    queue: DecisionWorkflowQueue[];
    workflowState: DecisionWorkflowState[];
    escalationLevel: DecisionWorkflowEscalationLevel[];
  };
  summary: {
    total: number;
    critical: number;
    high: number;
    open: number;
    blocked: number;
  };
  workflowSummary: {
    new: number;
    underReview: number;
    escalated: number;
    critical: number;
  };
};

export type DecisionInboxQuery = {
  severity?: DecisionInboxSeverity | "all";
  status?: DecisionInboxStatus | "all";
  type?: DecisionInboxType | "all";
  queue?: DecisionWorkflowQueue | "all";
  workflowState?: DecisionWorkflowState | "all";
  escalationLevel?: DecisionWorkflowEscalationLevel | "all";
};

export async function fetchDecisionInbox(params?: DecisionInboxQuery): Promise<DecisionInboxResponse> {
  const search = new URLSearchParams();
  if (params?.severity && params.severity !== "all") search.set("severity", params.severity);
  if (params?.status && params.status !== "all") search.set("status", params.status);
  if (params?.type && params.type !== "all") search.set("type", params.type);
  if (params?.queue && params.queue !== "all") search.set("queue", params.queue);
  if (params?.workflowState && params.workflowState !== "all") search.set("workflowState", params.workflowState);
  if (params?.escalationLevel && params.escalationLevel !== "all") search.set("escalationLevel", params.escalationLevel);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  const response = await apiFetch<{ ok: true } & DecisionInboxResponse>(`/landlord/decision-inbox${suffix}`);
  return {
    items: response.items || [],
    filters: response.filters || {
      severity: [],
      status: [],
      type: [],
      queue: [],
      workflowState: [],
      escalationLevel: [],
    },
    summary: response.summary || { total: 0, critical: 0, high: 0, open: 0, blocked: 0 },
    workflowSummary: response.workflowSummary || { new: 0, underReview: 0, escalated: 0, critical: 0 },
  };
}
