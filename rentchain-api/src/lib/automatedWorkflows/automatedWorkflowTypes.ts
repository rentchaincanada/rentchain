import type {
  DecisionInboxItem,
  DecisionWorkflowEscalationLevel,
  DecisionWorkflowQueue,
  DecisionWorkflowState,
} from "../decisions/decisionInboxTypes";

export type AutomatedWorkflowType =
  | "review"
  | "evidence"
  | "readiness"
  | "delinquency"
  | "export"
  | "maintenance";

export type AutomatedWorkflowStatus = "pending" | "derived" | "blocked" | "completed";

export type AutomatedWorkflowEventType =
  | "automated_workflow_transition_derived"
  | "automated_workflow_blocked"
  | "automated_workflow_escalation_flagged"
  | "automated_workflow_review_required"
  | "automated_workflow_sync_completed";

export type AutomatedWorkflowTransition = {
  fromState: DecisionWorkflowState;
  toState: DecisionWorkflowState;
};

export type AutomatedWorkflowCanonicalEvent = {
  eventType: AutomatedWorkflowEventType;
  action: string;
  status: AutomatedWorkflowStatus;
  resourceType: "decision" | "workflow";
  resourceId: string;
  summary: string;
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
  transition: AutomatedWorkflowTransition;
  reasons: string[];
  blockedReasons: string[];
  canonicalEvents: AutomatedWorkflowCanonicalEvent[];
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

export type AutomatedWorkflowPreviewResult = {
  workflows: AutomatedWorkflowPreview[];
  summary: AutomatedWorkflowSummary;
};

export type DeriveAutomatedWorkflowTransitionsInput = {
  decisions?: DecisionInboxItem[] | null;
  generatedAt?: string | Date | null;
  filters?: {
    workflowType?: unknown;
    status?: unknown;
    queue?: unknown;
    escalationLevel?: unknown;
  } | null;
};
