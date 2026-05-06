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
export type AutomatedWorkflowType = "review" | "evidence" | "readiness" | "delinquency" | "export" | "maintenance";
export type AutomatedWorkflowStatus = "pending" | "derived" | "blocked" | "completed";
export type AutomatedWorkflowEventType =
  | "automated_workflow_transition_derived"
  | "automated_workflow_blocked"
  | "automated_workflow_escalation_flagged"
  | "automated_workflow_review_required"
  | "automated_workflow_sync_completed";
export type AgentActionType =
  | "request_evidence"
  | "recommend_review"
  | "suggest_escalation"
  | "suggest_follow_up"
  | "suggest_workflow_transition"
  | "suggest_export_review";
export type AgentActionStatus = "suggested" | "blocked" | "unavailable" | "acknowledged";
export type AgentActionScope = "decision" | "workflow" | "evidence_pack" | "operator_review" | "export" | "audit_compliance";
export type PolicyGatedAgentActionEventType =
  | "policy_gated_agent_action_suggested"
  | "policy_gated_agent_action_blocked"
  | "policy_gated_agent_action_acknowledged"
  | "policy_gated_agent_action_review_required";
export type DecisionWorkflowRouting = {
  queue: DecisionWorkflowQueue;
  workflowState: DecisionWorkflowState;
  ownershipType: "landlord" | "admin" | "compliance" | "operations" | "system";
  reviewPriority: "critical" | "high" | "medium" | "low";
  escalationLevel: DecisionWorkflowEscalationLevel;
  manualOnly: true;
};
export type AutomatedWorkflowPreview = {
  automationId: string;
  decisionId: string;
  workflowType: AutomatedWorkflowType;
  status: AutomatedWorkflowStatus;
  queue: DecisionWorkflowQueue;
  escalationLevel: DecisionWorkflowEscalationLevel;
  manualReviewRequired: true;
  policyGuarded: true;
  externalExecutionEnabled: false;
  requiresHumanAcknowledgement: true;
  transition: {
    fromState: DecisionWorkflowState;
    toState: DecisionWorkflowState;
  };
  reasons: string[];
  blockedReasons: string[];
  canonicalEvents: Array<{
    eventType: AutomatedWorkflowEventType;
    action: string;
    status: AutomatedWorkflowStatus;
    resourceType: "decision" | "workflow";
    resourceId: string;
    summary: string;
  }>;
  generatedAt: string;
};
export type AutomatedWorkflowSummary = {
  total: number;
  pending: number;
  derived: number;
  blocked: number;
  completed: number;
  escalationFlagged: number;
  reviewRequired: number;
};
export type PolicyGatedAgentAction = {
  agentActionId: string;
  actionType: AgentActionType;
  status: AgentActionStatus;
  manualReviewRequired: true;
  policyGuarded: true;
  externalExecutionEnabled: false;
  requiresHumanApproval: true;
  explanation: {
    summary: string;
    reasons: string[];
    blockedReasons: string[];
  };
  relatedScope: {
    scope: AgentActionScope;
    scopeId: string;
  };
  queue: DecisionWorkflowQueue;
  escalationLevel: DecisionWorkflowEscalationLevel;
  canonicalEvents: Array<{
    eventType: PolicyGatedAgentActionEventType;
    action: string;
    status: AgentActionStatus;
    resourceType: AgentActionScope;
    resourceId: string;
    summary: string;
  }>;
  generatedAt: string;
};
export type PolicyGatedAgentActionSummary = {
  total: number;
  suggested: number;
  blocked: number;
  unavailable: number;
  acknowledged: number;
  reviewRequired: number;
  escalationSuggested: number;
};
export type DelinquencyActionDescriptor = {
  actionKey: "review_context" | "prepare_reminder" | "prepare_notice" | "view_ledger";
  label: string;
  description: string;
  manualOnly: true;
  requiresConfirmation: boolean;
  policyGuarded: true;
  destination: string | null;
  status: "available" | "blocked" | "unavailable";
  blockedReason: string | null;
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
  automatedWorkflow?: AutomatedWorkflowPreview;
  agentActions?: PolicyGatedAgentAction[];
  delinquencyActions?: DelinquencyActionDescriptor[];
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
  automationSummary: AutomatedWorkflowSummary;
  agentActionSummary: PolicyGatedAgentActionSummary;
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
    automationSummary: response.automationSummary || {
      total: 0,
      pending: 0,
      derived: 0,
      blocked: 0,
      completed: 0,
      escalationFlagged: 0,
      reviewRequired: 0,
    },
    agentActionSummary: response.agentActionSummary || {
      total: 0,
      suggested: 0,
      blocked: 0,
      unavailable: 0,
      acknowledged: 0,
      reviewRequired: 0,
      escalationSuggested: 0,
    },
  };
}
