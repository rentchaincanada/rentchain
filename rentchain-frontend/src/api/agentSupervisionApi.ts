import { apiFetch } from "./apiFetch";

export type AgentSupervisionItemType =
  | "agent_action"
  | "workflow_transition"
  | "escalation"
  | "review_requirement"
  | "policy_guard"
  | "synchronization_issue";

export type AgentSupervisionStatus =
  | "suggested"
  | "blocked"
  | "pending_review"
  | "acknowledged"
  | "synchronized"
  | "unresolved";

export type AgentSupervisionSeverity = "critical" | "high" | "medium" | "low" | "info";

export type AgentSupervisionScope = "decision" | "workflow" | "review" | "evidence_pack" | "export" | "audit_compliance";

export type AgentSupervisionItem = {
  supervisionItemId: string;
  itemType: AgentSupervisionItemType;
  status: AgentSupervisionStatus;
  severity: AgentSupervisionSeverity;
  label: string;
  description: string;
  policyGuarded: true;
  manualReviewRequired: true;
  requiresHumanApproval: true;
  blockedReasons: string[];
  relatedScope: {
    scope: AgentSupervisionScope;
    scopeId: string;
  };
  destination: string | null;
  timestamp: string;
};

export type AgentSupervisionSnapshot = {
  supervisionSnapshotId: string;
  generatedAt: string;
  manualReviewRequired: true;
  externalExecutionEnabled: false;
  autonomousExecutionEnabled: false;
  summary: {
    suggestedActions: number;
    blockedActions: number;
    pendingReviews: number;
    escalations: number;
    workflowSyncIssues: number;
  };
  agentActions: AgentSupervisionItem[];
  workflowStates: AgentSupervisionItem[];
  policyGuardResults: AgentSupervisionItem[];
  escalations: AgentSupervisionItem[];
  reviewReferences: AgentSupervisionItem[];
  evidenceReferences: AgentSupervisionItem[];
  timelineReferences: AgentSupervisionItem[];
};

export async function fetchAgentSupervisionSnapshot(): Promise<AgentSupervisionSnapshot> {
  const response = await apiFetch<{ ok: true } & AgentSupervisionSnapshot>("/landlord/agent-supervision/snapshot");
  return {
    supervisionSnapshotId: response.supervisionSnapshotId || "agent_supervision_snapshot",
    generatedAt: response.generatedAt || new Date(0).toISOString(),
    manualReviewRequired: true,
    externalExecutionEnabled: false,
    autonomousExecutionEnabled: false,
    summary: response.summary || {
      suggestedActions: 0,
      blockedActions: 0,
      pendingReviews: 0,
      escalations: 0,
      workflowSyncIssues: 0,
    },
    agentActions: response.agentActions || [],
    workflowStates: response.workflowStates || [],
    policyGuardResults: response.policyGuardResults || [],
    escalations: response.escalations || [],
    reviewReferences: response.reviewReferences || [],
    evidenceReferences: response.evidenceReferences || [],
    timelineReferences: response.timelineReferences || [],
  };
}
