import type {
  DecisionInboxItem,
  DecisionInboxSeverity,
  DecisionInboxStatus,
  DecisionInboxType,
  DecisionWorkflowEscalationLevel,
  DecisionWorkflowOwnershipType,
  DecisionWorkflowQueue,
  DecisionWorkflowReviewPriority,
  DecisionWorkflowRouting,
  DecisionWorkflowState,
} from "./decisionInboxTypes";

export type DecisionWorkflowRoutingInput = Pick<
  DecisionInboxItem,
  "id" | "title" | "description" | "severity" | "status" | "type" | "source"
> & {
  decisionType?: string | null;
  workflowCategory?: string | null;
};

function lower(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function reviewPriorityFromSeverity(severity: DecisionInboxSeverity): DecisionWorkflowReviewPriority {
  if (severity === "critical") return "critical";
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "low";
}

function escalationFromStatusAndSeverity(
  status: DecisionInboxStatus,
  severity: DecisionInboxSeverity
): DecisionWorkflowEscalationLevel {
  if (status === "resolved" || status === "dismissed") return "none";
  if (status === "blocked") return severity === "critical" || severity === "high" ? "urgent" : "attention";
  if (severity === "critical") return "critical";
  if (severity === "high") return "urgent";
  if (severity === "medium") return "attention";
  return "none";
}

function workflowStateFromStatus(
  status: DecisionInboxStatus,
  escalationLevel: DecisionWorkflowEscalationLevel
): DecisionWorkflowState {
  if (status === "resolved") return "resolved";
  if (status === "dismissed") return "archived";
  if (status === "blocked") return "waiting_context";
  if (status === "pending") return "under_review";
  if (status === "open" && (escalationLevel === "critical" || escalationLevel === "urgent")) return "escalated";
  if (status === "open") return "new";
  return "triaged";
}

function queueFromInput(input: DecisionWorkflowRoutingInput): DecisionWorkflowQueue {
  const haystack = [input.decisionType, input.workflowCategory, input.type, input.title, input.description, input.id]
    .map(lower)
    .join(" ");

  if (input.source === "admin_review" || input.type === "admin") return "admin_review";
  if (haystack.includes("compliance") || input.type === "compliance") return "compliance_review";
  if (
    haystack.includes("rent") ||
    haystack.includes("payment") ||
    haystack.includes("revenue") ||
    input.type === "billing"
  ) {
    return "delinquency_review";
  }
  if (
    haystack.includes("lease") ||
    haystack.includes("renewal") ||
    haystack.includes("vacancy") ||
    haystack.includes("occupancy") ||
    input.type === "lease"
  ) {
    return "lease_review";
  }
  if (haystack.includes("screening") || haystack.includes("application") || input.type === "screening") {
    return "screening_review";
  }
  if (haystack.includes("maintenance") || haystack.includes("work_order") || input.type === "maintenance") {
    return "maintenance_review";
  }
  return "general_review";
}

function ownershipForQueue(queue: DecisionWorkflowQueue): DecisionWorkflowOwnershipType {
  if (queue === "admin_review") return "admin";
  if (queue === "compliance_review") return "compliance";
  if (queue === "general_review") return "operations";
  return "landlord";
}

export function deriveDecisionWorkflowRouting(input: DecisionWorkflowRoutingInput): DecisionWorkflowRouting {
  const queue = queueFromInput(input);
  const escalationLevel = escalationFromStatusAndSeverity(input.status, input.severity);
  return {
    queue,
    workflowState: workflowStateFromStatus(input.status, escalationLevel),
    ownershipType: ownershipForQueue(queue),
    reviewPriority: reviewPriorityFromSeverity(input.severity),
    escalationLevel,
    manualOnly: true,
  };
}
