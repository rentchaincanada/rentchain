import type { AutomatedWorkflowPreview, AutomatedWorkflowSummary } from "../automatedWorkflows/automatedWorkflowTypes";
import type { PolicyGatedAgentAction, PolicyGatedAgentActionSummary } from "../agentActions/agentActionTypes";

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

export type DecisionInboxSource = "dashboard" | "lease_ledger" | "admin_review" | "analytics" | "unknown";

export type DecisionInboxRelatedEntity = {
  kind: "lease" | "application" | "tenant" | "property" | "unit" | "maintenance_request" | "unknown";
  id: string;
  label: string;
};

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

export type DecisionWorkflowOwnershipType = "landlord" | "admin" | "compliance" | "operations" | "system";

export type DecisionWorkflowReviewPriority = "critical" | "high" | "medium" | "low";

export type DecisionWorkflowEscalationLevel = "none" | "attention" | "urgent" | "critical";

export type DecisionWorkflowRouting = {
  queue: DecisionWorkflowQueue;
  workflowState: DecisionWorkflowState;
  ownershipType: DecisionWorkflowOwnershipType;
  reviewPriority: DecisionWorkflowReviewPriority;
  escalationLevel: DecisionWorkflowEscalationLevel;
  manualOnly: true;
};

export type DelinquencyActionKey = "review_context" | "prepare_reminder" | "prepare_notice" | "view_ledger";

export type DelinquencyActionStatus = "available" | "blocked" | "unavailable";

export type DelinquencyActionDescriptor = {
  actionKey: DelinquencyActionKey;
  label: string;
  description: string;
  manualOnly: true;
  requiresConfirmation: boolean;
  policyGuarded: true;
  destination: string | null;
  status: DelinquencyActionStatus;
  blockedReason: string | null;
};

export type DecisionInboxItem = {
  id: string;
  title: string;
  description: string;
  severity: DecisionInboxSeverity;
  status: DecisionInboxStatus;
  type: DecisionInboxType;
  source: DecisionInboxSource;
  relatedEntity: DecisionInboxRelatedEntity | null;
  destination: string | null;
  automationEligible: false;
  workflow: DecisionWorkflowRouting;
  automatedWorkflow?: AutomatedWorkflowPreview;
  agentActions?: PolicyGatedAgentAction[];
  delinquencyActions?: DelinquencyActionDescriptor[];
  dueAt?: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type DecisionInboxFilters = {
  severity: DecisionInboxSeverity[];
  status: DecisionInboxStatus[];
  type: DecisionInboxType[];
  queue: DecisionWorkflowQueue[];
  workflowState: DecisionWorkflowState[];
  escalationLevel: DecisionWorkflowEscalationLevel[];
};

export type DecisionInboxSummary = {
  total: number;
  critical: number;
  high: number;
  open: number;
  blocked: number;
};

export type DecisionInboxWorkflowSummary = {
  new: number;
  underReview: number;
  escalated: number;
  critical: number;
};

export type DecisionInboxResult = {
  items: DecisionInboxItem[];
  filters: DecisionInboxFilters;
  summary: DecisionInboxSummary;
  workflowSummary: DecisionInboxWorkflowSummary;
  automationSummary: AutomatedWorkflowSummary;
  agentActionSummary: PolicyGatedAgentActionSummary;
};
