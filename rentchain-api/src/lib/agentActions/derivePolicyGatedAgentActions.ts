import type {
  DecisionInboxItem,
  DecisionWorkflowEscalationLevel,
  DecisionWorkflowQueue,
} from "../decisions/decisionInboxTypes";
import { evaluateAgentActionPolicyGuards } from "./agentActionPolicyGuards";
import type {
  AgentActionStatus,
  AgentActionType,
  DerivePolicyGatedAgentActionsInput,
  PolicyGatedAgentAction,
  PolicyGatedAgentActionEvent,
  PolicyGatedAgentActionResult,
} from "./agentActionTypes";

const ACTION_TYPES: AgentActionType[] = [
  "request_evidence",
  "recommend_review",
  "suggest_escalation",
  "suggest_follow_up",
  "suggest_workflow_transition",
  "suggest_export_review",
];
const STATUSES: AgentActionStatus[] = ["suggested", "blocked", "unavailable", "acknowledged"];
const QUEUES: DecisionWorkflowQueue[] = [
  "lease_review",
  "delinquency_review",
  "screening_review",
  "maintenance_review",
  "compliance_review",
  "admin_review",
  "general_review",
];
const ESCALATIONS: DecisionWorkflowEscalationLevel[] = ["none", "attention", "urgent", "critical"];

function asString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanId(value: unknown): string {
  return asString(value, 800)
    .toLowerCase()
    .replace(/[\/\\#?]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function generatedAt(value: unknown): string {
  const raw = asString(value, 120);
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function actionTypeForDecision(decision: DecisionInboxItem): AgentActionType {
  if (decision.workflow.workflowState === "waiting_context" || decision.automatedWorkflow?.status === "blocked") {
    return "request_evidence";
  }
  if (decision.workflow.escalationLevel === "critical" || decision.workflow.escalationLevel === "urgent") {
    return "suggest_escalation";
  }
  if (decision.workflow.queue === "compliance_review") return "suggest_export_review";
  if (decision.workflow.workflowState === "new" || decision.workflow.workflowState === "triaged") {
    return "suggest_workflow_transition";
  }
  if (decision.workflow.workflowState === "under_review" || decision.status === "pending") return "suggest_follow_up";
  return "recommend_review";
}

function summaryForAction(actionType: AgentActionType, decision: DecisionInboxItem): string {
  if (actionType === "request_evidence") return "Request additional evidence before progressing this workflow.";
  if (actionType === "suggest_escalation") return "Escalation review is recommended based on workflow severity.";
  if (actionType === "suggest_follow_up") return "Follow-up review is recommended for this open workflow.";
  if (actionType === "suggest_workflow_transition") return "Workflow transition review is recommended.";
  if (actionType === "suggest_export_review") return "Review export or readiness context before use.";
  return `Review ${decision.title} before taking any manual operational step.`;
}

function reasonsForAction(actionType: AgentActionType, decision: DecisionInboxItem): string[] {
  const reasons = [
    `Decision ${decision.id} is routed to ${decision.workflow.queue}.`,
    `Workflow state is ${decision.workflow.workflowState}.`,
    `Escalation level is ${decision.workflow.escalationLevel}.`,
    "Operator review and human approval remain required.",
  ];
  if (actionType === "request_evidence") {
    reasons.push("Workflow context is blocked or waiting for additional evidence.");
  }
  if (actionType === "suggest_escalation") {
    reasons.push("Workflow escalation metadata indicates elevated review priority.");
  }
  if (decision.automatedWorkflow) {
    reasons.push(`Automated workflow preview status is ${decision.automatedWorkflow.status}.`);
  }
  return reasons;
}

function eventsForAction(input: {
  actionType: AgentActionType;
  status: AgentActionStatus;
  decision: DecisionInboxItem;
  blockedReasons: string[];
}): PolicyGatedAgentActionEvent[] {
  const events: PolicyGatedAgentActionEvent[] = [];
  events.push({
    eventType: input.blockedReasons.length ? "policy_gated_agent_action_blocked" : "policy_gated_agent_action_suggested",
    action: input.actionType,
    status: input.status,
    resourceType: "decision",
    resourceId: input.decision.id,
    summary: input.blockedReasons.length
      ? "Policy-gated agent suggestion is blocked pending manual review."
      : "Policy-gated agent suggestion is available for operator review.",
  });
  events.push({
    eventType: "policy_gated_agent_action_review_required",
    action: "review_required",
    status: input.status === "acknowledged" ? "acknowledged" : "suggested",
    resourceType: "workflow",
    resourceId: input.decision.id,
    summary: "Human approval remains required; no agent action will execute automatically.",
  });
  return events;
}

export function agentActionFromDecision(decision: DecisionInboxItem, generated: string): PolicyGatedAgentAction {
  const guard = evaluateAgentActionPolicyGuards(decision);
  const actionType = actionTypeForDecision(decision);
  const blockedReasons = [
    ...guard.blockedReasons,
    ...(decision.automatedWorkflow?.blockedReasons || []),
  ];
  const status: AgentActionStatus = blockedReasons.length ? "blocked" : "suggested";

  return {
    agentActionId: cleanId(`policy_gated_agent_action:${decision.id}:${actionType}`) || "policy_gated_agent_action:unknown",
    actionType,
    status,
    manualReviewRequired: true,
    policyGuarded: true,
    externalExecutionEnabled: false,
    requiresHumanApproval: true,
    explanation: {
      summary: summaryForAction(actionType, decision),
      reasons: reasonsForAction(actionType, decision),
      blockedReasons,
    },
    relatedScope: {
      scope: actionType === "suggest_export_review" ? "export" : actionType === "request_evidence" ? "evidence_pack" : "decision",
      scopeId: decision.id,
    },
    queue: decision.workflow.queue,
    escalationLevel: decision.workflow.escalationLevel,
    canonicalEvents: eventsForAction({ actionType, status, decision, blockedReasons }),
    generatedAt: generated,
  };
}

function filterValue<T extends string>(value: unknown, known: readonly T[]): T | null {
  const raw = asString(value, 80).toLowerCase();
  if (!raw || raw === "all") return null;
  return known.includes(raw as T) ? (raw as T) : null;
}

export function derivePolicyGatedAgentActions(input: DerivePolicyGatedAgentActionsInput): PolicyGatedAgentActionResult {
  const generated = generatedAt(input.generatedAt);
  const allActions = (input.decisions || []).map((decision) => agentActionFromDecision(decision, generated));
  const actionType = filterValue(input.filters?.actionType, ACTION_TYPES);
  const status = filterValue(input.filters?.status, STATUSES);
  const queue = filterValue(input.filters?.queue, QUEUES);
  const escalationLevel = filterValue(input.filters?.escalationLevel, ESCALATIONS);
  const actions = allActions.filter((action) => {
    if (actionType && action.actionType !== actionType) return false;
    if (status && action.status !== status) return false;
    if (queue && action.queue !== queue) return false;
    if (escalationLevel && action.escalationLevel !== escalationLevel) return false;
    return true;
  });

  return {
    actions,
    summary: {
      total: actions.length,
      suggested: actions.filter((action) => action.status === "suggested").length,
      blocked: actions.filter((action) => action.status === "blocked").length,
      unavailable: actions.filter((action) => action.status === "unavailable").length,
      acknowledged: actions.filter((action) => action.status === "acknowledged").length,
      reviewRequired: actions.filter((action) => action.manualReviewRequired).length,
      escalationSuggested: actions.filter((action) => action.actionType === "suggest_escalation").length,
    },
  };
}
