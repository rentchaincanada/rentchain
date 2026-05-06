import type { PolicyGatedAgentActionEvent } from "../agentActions/agentActionTypes";
import type { AutomatedWorkflowCanonicalEvent } from "../automatedWorkflows/automatedWorkflowTypes";

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

export type AgentSupervisionCanonicalEventType =
  | "agent_supervision_snapshot_generated"
  | "agent_supervision_escalation_visible"
  | "agent_supervision_review_required"
  | "agent_supervision_policy_guard_visible"
  | "agent_supervision_acknowledgement_visible";

export type AgentSupervisionCanonicalEvent = {
  eventType: AgentSupervisionCanonicalEventType;
  action: string;
  status: AgentSupervisionStatus;
  resourceType: AgentSupervisionScope;
  resourceId: string;
  summary: string;
};

export type AgentSupervisionRelatedScope = {
  scope: AgentSupervisionScope;
  scopeId: string;
};

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
  relatedScope: AgentSupervisionRelatedScope;
  destination: string | null;
  timestamp: string;
  canonicalEvents: AgentSupervisionCanonicalEvent[];
};

export type AgentSupervisionSnapshotSummary = {
  suggestedActions: number;
  blockedActions: number;
  pendingReviews: number;
  escalations: number;
  workflowSyncIssues: number;
};

export type AgentSupervisionSnapshot = {
  supervisionSnapshotId: string;
  generatedAt: string;
  manualReviewRequired: true;
  externalExecutionEnabled: false;
  autonomousExecutionEnabled: false;
  summary: AgentSupervisionSnapshotSummary;
  agentActions: AgentSupervisionItem[];
  workflowStates: AgentSupervisionItem[];
  policyGuardResults: AgentSupervisionItem[];
  escalations: AgentSupervisionItem[];
  reviewReferences: AgentSupervisionItem[];
  evidenceReferences: AgentSupervisionItem[];
  timelineReferences: AgentSupervisionItem[];
  canonicalEvents: Array<AgentSupervisionCanonicalEvent | PolicyGatedAgentActionEvent | AutomatedWorkflowCanonicalEvent>;
};

export type DeriveAgentSupervisionSnapshotInput = {
  decisions?: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    destination: string | null;
    workflow: {
      queue: string;
      workflowState: string;
      escalationLevel: string;
      reviewPriority: string;
      manualOnly: true;
    };
    automatedWorkflow?: {
      automationId: string;
      status: string;
      transition: { fromState: string; toState: string };
      blockedReasons: string[];
      reasons: string[];
      canonicalEvents: AutomatedWorkflowCanonicalEvent[];
      generatedAt: string;
    };
    agentActions?: Array<{
      agentActionId: string;
      actionType: string;
      status: string;
      policyGuarded: true;
      manualReviewRequired: true;
      externalExecutionEnabled: false;
      requiresHumanApproval: true;
      explanation: {
        summary: string;
        reasons: string[];
        blockedReasons: string[];
      };
      relatedScope: { scope: string; scopeId: string };
      canonicalEvents: PolicyGatedAgentActionEvent[];
      generatedAt: string;
    }>;
    createdAt?: string | null;
    updatedAt?: string | null;
  }> | null;
  generatedAt?: string | Date | null;
};
