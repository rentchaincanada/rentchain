import { enforceAgentSupervisionPolicyFlags } from "./agentSupervisionPolicyGuards";
import type {
  AgentSupervisionCanonicalEvent,
  AgentSupervisionItem,
  AgentSupervisionSeverity,
  AgentSupervisionSnapshot,
  AgentSupervisionStatus,
  DeriveAgentSupervisionSnapshotInput,
} from "./agentSupervisionTypes";

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

function severityFromDecision(value: unknown): AgentSupervisionSeverity {
  const severity = asString(value, 40);
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  if (severity === "low") return "low";
  return "info";
}

function severityFromEscalation(value: unknown, fallback: AgentSupervisionSeverity): AgentSupervisionSeverity {
  const escalation = asString(value, 40);
  if (escalation === "critical") return "critical";
  if (escalation === "urgent") return "high";
  if (escalation === "attention") return fallback === "info" ? "medium" : fallback;
  return fallback;
}

function actionStatus(value: unknown): AgentSupervisionStatus {
  const status = asString(value, 40);
  if (status === "blocked") return "blocked";
  if (status === "acknowledged") return "acknowledged";
  if (status === "suggested") return "suggested";
  return "unresolved";
}

function workflowStatus(value: unknown): AgentSupervisionStatus {
  const status = asString(value, 40);
  if (status === "blocked") return "blocked";
  if (status === "completed" || status === "derived") return "synchronized";
  if (status === "pending") return "pending_review";
  return "unresolved";
}

function supervisionEvent(input: {
  eventType: AgentSupervisionCanonicalEvent["eventType"];
  action: string;
  status: AgentSupervisionStatus;
  resourceType: AgentSupervisionCanonicalEvent["resourceType"];
  resourceId: string;
  summary: string;
}): AgentSupervisionCanonicalEvent {
  return input;
}

function agentActionItem(decision: NonNullable<DeriveAgentSupervisionSnapshotInput["decisions"]>[number], action: NonNullable<NonNullable<DeriveAgentSupervisionSnapshotInput["decisions"]>[number]["agentActions"]>[number], generated: string): AgentSupervisionItem {
  const blockedReasons = action.explanation?.blockedReasons || [];
  const status = actionStatus(action.status);
  return enforceAgentSupervisionPolicyFlags({
    supervisionItemId: cleanId(`agent_supervision:agent_action:${action.agentActionId}`) || "agent_supervision:agent_action:unknown",
    itemType: "agent_action",
    status,
    severity: severityFromEscalation(decision.workflow.escalationLevel, severityFromDecision(decision.severity)),
    label: action.actionType.replace(/_/g, " "),
    description: action.explanation?.summary || "Policy-gated agent suggestion is available for review.",
    blockedReasons,
    relatedScope: { scope: "decision", scopeId: decision.id },
    destination: decision.destination,
    timestamp: action.generatedAt || generated,
    canonicalEvents: [
      supervisionEvent({
        eventType: status === "blocked" ? "agent_supervision_policy_guard_visible" : "agent_supervision_review_required",
        action: action.actionType,
        status,
        resourceType: "decision",
        resourceId: decision.id,
        summary: status === "blocked"
          ? "Policy guard block is visible in the agent supervision console."
          : "Agent suggestion remains visible for manual review.",
      }),
    ],
  });
}

function workflowItem(decision: NonNullable<DeriveAgentSupervisionSnapshotInput["decisions"]>[number], generated: string): AgentSupervisionItem | null {
  const workflow = decision.automatedWorkflow;
  if (!workflow) return null;
  const status = workflowStatus(workflow.status);
  return enforceAgentSupervisionPolicyFlags({
    supervisionItemId: cleanId(`agent_supervision:workflow:${workflow.automationId}`) || "agent_supervision:workflow:unknown",
    itemType: workflow.status === "blocked" ? "synchronization_issue" : "workflow_transition",
    status,
    severity: severityFromEscalation(decision.workflow.escalationLevel, severityFromDecision(decision.severity)),
    label: `Workflow ${workflow.transition.fromState} to ${workflow.transition.toState}`.replace(/_/g, " "),
    description: workflow.reasons?.[0] || "Deterministic workflow state is visible for supervision.",
    blockedReasons: workflow.blockedReasons || [],
    relatedScope: { scope: "workflow", scopeId: decision.id },
    destination: decision.destination,
    timestamp: workflow.generatedAt || generated,
    canonicalEvents: [
      supervisionEvent({
        eventType: workflow.status === "blocked" ? "agent_supervision_policy_guard_visible" : "agent_supervision_snapshot_generated",
        action: workflow.status === "blocked" ? "workflow_block_visible" : "workflow_state_visible",
        status,
        resourceType: "workflow",
        resourceId: decision.id,
        summary: workflow.status === "blocked"
          ? "Workflow synchronization issue is visible for manual review."
          : "Workflow state is visible in the supervision snapshot.",
      }),
    ],
  });
}

function escalationItem(decision: NonNullable<DeriveAgentSupervisionSnapshotInput["decisions"]>[number], generated: string): AgentSupervisionItem | null {
  if (decision.workflow.escalationLevel !== "critical" && decision.workflow.escalationLevel !== "urgent") return null;
  return enforceAgentSupervisionPolicyFlags({
    supervisionItemId: cleanId(`agent_supervision:escalation:${decision.id}:${decision.workflow.escalationLevel}`) || "agent_supervision:escalation:unknown",
    itemType: "escalation",
    status: "pending_review",
    severity: decision.workflow.escalationLevel === "critical" ? "critical" : "high",
    label: `${decision.workflow.escalationLevel} escalation`.replace(/_/g, " "),
    description: `${decision.title} requires elevated manual review visibility.`,
    blockedReasons: [],
    relatedScope: { scope: "decision", scopeId: decision.id },
    destination: decision.destination,
    timestamp: decision.updatedAt || decision.createdAt || generated,
    canonicalEvents: [
      supervisionEvent({
        eventType: "agent_supervision_escalation_visible",
        action: "escalation_visible",
        status: "pending_review",
        resourceType: "decision",
        resourceId: decision.id,
        summary: "Escalation is visible for supervised manual review.",
      }),
    ],
  });
}

function referenceItem(input: {
  decisionId: string;
  title: string;
  kind: "review" | "evidence_pack" | "audit_compliance";
  destination: string | null;
  timestamp: string;
}): AgentSupervisionItem {
  return enforceAgentSupervisionPolicyFlags({
    supervisionItemId: cleanId(`agent_supervision:${input.kind}:${input.decisionId}`) || `agent_supervision:${input.kind}:unknown`,
    itemType: "review_requirement",
    status: "pending_review",
    severity: "info",
    label: input.kind.replace(/_/g, " "),
    description: `${input.title} has related ${input.kind.replace(/_/g, " ")} context available for supervision.`,
    blockedReasons: [],
    relatedScope: { scope: input.kind, scopeId: input.decisionId },
    destination: input.destination,
    timestamp: input.timestamp,
    canonicalEvents: [
      supervisionEvent({
        eventType: "agent_supervision_review_required",
        action: `${input.kind}_visible`,
        status: "pending_review",
        resourceType: input.kind,
        resourceId: input.decisionId,
        summary: "Related review context is visible in the supervision snapshot.",
      }),
    ],
  });
}

export function deriveAgentSupervisionSnapshot(input: DeriveAgentSupervisionSnapshotInput): AgentSupervisionSnapshot {
  const generated = generatedAt(input.generatedAt);
  const decisions = input.decisions || [];
  const agentActions = decisions.flatMap((decision) =>
    (decision.agentActions || []).map((action) => agentActionItem(decision, action, generated))
  );
  const workflowStates = decisions.map((decision) => workflowItem(decision, generated)).filter(Boolean) as AgentSupervisionItem[];
  const escalations = decisions.map((decision) => escalationItem(decision, generated)).filter(Boolean) as AgentSupervisionItem[];
  const reviewReferences = decisions.map((decision) =>
    referenceItem({
      decisionId: decision.id,
      title: decision.title,
      kind: "review",
      destination: `/review-timeline?scope=decision&scopeId=${encodeURIComponent(decision.id)}`,
      timestamp: decision.updatedAt || decision.createdAt || generated,
    })
  );
  const evidenceReferences = decisions.map((decision) =>
    referenceItem({
      decisionId: decision.id,
      title: decision.title,
      kind: "evidence_pack",
      destination: `/evidence-packs?scope=decision&scopeId=${encodeURIComponent(decision.id)}`,
      timestamp: decision.updatedAt || decision.createdAt || generated,
    })
  );
  const timelineReferences = decisions.map((decision) =>
    referenceItem({
      decisionId: decision.id,
      title: decision.title,
      kind: "audit_compliance",
      destination: "/audit-compliance",
      timestamp: decision.updatedAt || decision.createdAt || generated,
    })
  );
  const policyGuardResults = agentActions.filter((item) => item.status === "blocked");
  const canonicalEvents = [
    supervisionEvent({
      eventType: "agent_supervision_snapshot_generated",
      action: "snapshot_generated",
      status: "synchronized",
      resourceType: "workflow",
      resourceId: "agent_supervision",
      summary: "Agent supervision snapshot generated for read-only manual review.",
    }),
    ...agentActions.flatMap((item) => item.canonicalEvents),
    ...workflowStates.flatMap((item) => item.canonicalEvents),
    ...escalations.flatMap((item) => item.canonicalEvents),
  ];

  return {
    supervisionSnapshotId: cleanId(`agent_supervision_snapshot:${generated}`) || "agent_supervision_snapshot",
    generatedAt: generated,
    manualReviewRequired: true,
    externalExecutionEnabled: false,
    autonomousExecutionEnabled: false,
    summary: {
      suggestedActions: agentActions.filter((item) => item.status === "suggested").length,
      blockedActions: agentActions.filter((item) => item.status === "blocked").length,
      pendingReviews: [...agentActions, ...workflowStates, ...reviewReferences].filter((item) => item.status === "pending_review" || item.status === "suggested").length,
      escalations: escalations.length,
      workflowSyncIssues: workflowStates.filter((item) => item.itemType === "synchronization_issue" || item.status === "blocked").length,
    },
    agentActions,
    workflowStates,
    policyGuardResults,
    escalations,
    reviewReferences,
    evidenceReferences,
    timelineReferences,
    canonicalEvents,
  };
}
