import type {
  DecisionInboxItem,
  DecisionWorkflowEscalationLevel,
  DecisionWorkflowQueue,
} from "../decisions/decisionInboxTypes";

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

export type PolicyGatedAgentActionEvent = {
  eventType: PolicyGatedAgentActionEventType;
  action: string;
  status: AgentActionStatus;
  resourceType: AgentActionScope;
  resourceId: string;
  summary: string;
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
  canonicalEvents: PolicyGatedAgentActionEvent[];
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

export type PolicyGatedAgentActionResult = {
  actions: PolicyGatedAgentAction[];
  summary: PolicyGatedAgentActionSummary;
};

export type DerivePolicyGatedAgentActionsInput = {
  decisions?: DecisionInboxItem[] | null;
  generatedAt?: string | Date | null;
  filters?: {
    actionType?: unknown;
    status?: unknown;
    queue?: unknown;
    escalationLevel?: unknown;
  } | null;
};
