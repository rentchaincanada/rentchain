import type {
  DecisionInboxItem,
  DecisionWorkflowEscalationLevel,
  DecisionWorkflowQueue,
  DecisionWorkflowState,
} from "../decisions/decisionInboxTypes";
import { evaluateAutomatedWorkflowPolicyGuards } from "./automatedWorkflowPolicyGuards";
import type {
  AutomatedWorkflowCanonicalEvent,
  AutomatedWorkflowPreview,
  AutomatedWorkflowPreviewResult,
  AutomatedWorkflowStatus,
  AutomatedWorkflowType,
  DeriveAutomatedWorkflowTransitionsInput,
} from "./automatedWorkflowTypes";

const WORKFLOW_TYPES: AutomatedWorkflowType[] = ["review", "evidence", "readiness", "delinquency", "export", "maintenance"];
const STATUSES: AutomatedWorkflowStatus[] = ["pending", "derived", "blocked", "completed"];
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

function workflowTypeForDecision(decision: DecisionInboxItem): AutomatedWorkflowType {
  if (decision.workflow.queue === "delinquency_review") return "delinquency";
  if (decision.workflow.queue === "maintenance_review") return "maintenance";
  if (decision.workflow.queue === "compliance_review") return "readiness";
  if (decision.workflow.queue === "lease_review") return "review";
  if (decision.type === "compliance") return "readiness";
  return "review";
}

function transitionForState(state: DecisionWorkflowState): { toState: DecisionWorkflowState; status: AutomatedWorkflowStatus } {
  if (state === "new" || state === "triaged") return { toState: "under_review", status: "derived" };
  if (state === "under_review") return { toState: "under_review", status: "pending" };
  if (state === "waiting_context") return { toState: "waiting_context", status: "blocked" };
  if (state === "escalated") return { toState: "escalated", status: "pending" };
  if (state === "resolved" || state === "archived") return { toState: state, status: "completed" };
  return { toState: "under_review", status: "derived" };
}

function reasonsForDecision(decision: DecisionInboxItem, toState: DecisionWorkflowState): string[] {
  const reasons = [
    `Decision ${decision.id} is routed to ${decision.workflow.queue}.`,
    `Current workflow state is ${decision.workflow.workflowState}.`,
    `Derived internal review state is ${toState}.`,
    "Manual review remains required before any operational action.",
  ];
  if (decision.workflow.escalationLevel !== "none") {
    reasons.push(`Escalation visibility is ${decision.workflow.escalationLevel}.`);
  }
  if (decision.workflow.queue === "delinquency_review") {
    reasons.push("Delinquency workflow can surface review context only; no notice or payment action is automated.");
  }
  return reasons;
}

function canonicalEventsForWorkflow(input: {
  decision: DecisionInboxItem;
  status: AutomatedWorkflowStatus;
  toState: DecisionWorkflowState;
  blockedReasons: string[];
}): AutomatedWorkflowCanonicalEvent[] {
  const events: AutomatedWorkflowCanonicalEvent[] = [];
  if (input.blockedReasons.length || input.status === "blocked") {
    events.push({
      eventType: "automated_workflow_blocked",
      action: "blocked",
      status: "blocked",
      resourceType: "workflow",
      resourceId: input.decision.id,
      summary: "Internal workflow orchestration is blocked pending manual context review.",
    });
  } else if (input.decision.workflow.workflowState !== input.toState) {
    events.push({
      eventType: "automated_workflow_transition_derived",
      action: "transition_derived",
      status: input.status,
      resourceType: "workflow",
      resourceId: input.decision.id,
      summary: `Internal workflow transition derived from ${input.decision.workflow.workflowState} to ${input.toState}.`,
    });
  } else {
    events.push({
      eventType: "automated_workflow_sync_completed",
      action: "sync_completed",
      status: input.status,
      resourceType: "workflow",
      resourceId: input.decision.id,
      summary: "Internal workflow state is already synchronized for manual review.",
    });
  }

  if (input.decision.workflow.escalationLevel === "critical" || input.decision.workflow.escalationLevel === "urgent") {
    events.push({
      eventType: "automated_workflow_escalation_flagged",
      action: "escalation_flagged",
      status: input.status === "completed" ? "completed" : "pending",
      resourceType: "workflow",
      resourceId: input.decision.id,
      summary: `Escalation flag derived from ${input.decision.workflow.escalationLevel} workflow metadata.`,
    });
  }

  events.push({
    eventType: "automated_workflow_review_required",
    action: "review_required",
    status: input.status === "completed" ? "completed" : "pending",
    resourceType: "decision",
    resourceId: input.decision.id,
    summary: "Human acknowledgement remains required; no external execution is enabled.",
  });

  return events;
}

export function automatedWorkflowFromDecision(decision: DecisionInboxItem, generated: string): AutomatedWorkflowPreview {
  const guard = evaluateAutomatedWorkflowPolicyGuards(decision);
  const transition = transitionForState(decision.workflow.workflowState);
  const status: AutomatedWorkflowStatus = guard.allowed ? transition.status : "blocked";
  const blockedReasons = [
    ...guard.blockedReasons,
    ...(decision.workflow.workflowState === "waiting_context" ? ["Required workflow context is missing or incomplete."] : []),
  ];
  const toState = blockedReasons.length ? "waiting_context" : transition.toState;

  return {
    automationId: cleanId(`automated_workflow:${decision.id}:${decision.workflow.queue}`) || "automated_workflow:unknown",
    decisionId: decision.id,
    workflowType: workflowTypeForDecision(decision),
    status: blockedReasons.length ? "blocked" : status,
    queue: decision.workflow.queue,
    escalationLevel: decision.workflow.escalationLevel,
    manualReviewRequired: true,
    policyGuarded: true,
    externalExecutionEnabled: false,
    requiresHumanAcknowledgement: true,
    transition: {
      fromState: decision.workflow.workflowState,
      toState,
    },
    reasons: reasonsForDecision(decision, toState),
    blockedReasons,
    canonicalEvents: canonicalEventsForWorkflow({
      decision,
      status: blockedReasons.length ? "blocked" : status,
      toState,
      blockedReasons,
    }),
    generatedAt: generated,
  };
}

function filterValue<T extends string>(value: unknown, known: readonly T[]): T | null {
  const raw = asString(value, 80).toLowerCase();
  if (!raw || raw === "all") return null;
  return known.includes(raw as T) ? (raw as T) : null;
}

export function deriveAutomatedWorkflowTransitions(
  input: DeriveAutomatedWorkflowTransitionsInput
): AutomatedWorkflowPreviewResult {
  const generated = generatedAt(input.generatedAt);
  const allWorkflows = (input.decisions || []).map((decision) => automatedWorkflowFromDecision(decision, generated));
  const workflowType = filterValue(input.filters?.workflowType, WORKFLOW_TYPES);
  const status = filterValue(input.filters?.status, STATUSES);
  const queue = filterValue(input.filters?.queue, QUEUES);
  const escalationLevel = filterValue(input.filters?.escalationLevel, ESCALATIONS);
  const workflows = allWorkflows.filter((workflow) => {
    if (workflowType && workflow.workflowType !== workflowType) return false;
    if (status && workflow.status !== status) return false;
    if (queue && workflow.queue !== queue) return false;
    if (escalationLevel && workflow.escalationLevel !== escalationLevel) return false;
    return true;
  });

  return {
    workflows,
    summary: {
      total: workflows.length,
      pending: workflows.filter((workflow) => workflow.status === "pending").length,
      derived: workflows.filter((workflow) => workflow.status === "derived").length,
      blocked: workflows.filter((workflow) => workflow.status === "blocked").length,
      completed: workflows.filter((workflow) => workflow.status === "completed").length,
      escalationFlagged: workflows.filter((workflow) => workflow.escalationLevel === "critical" || workflow.escalationLevel === "urgent").length,
      reviewRequired: workflows.filter((workflow) => workflow.manualReviewRequired).length,
    },
  };
}
