import type {
  LandlordAgentDecision,
  LandlordDecisionAutomationState,
  LandlordDecisionWorkflowCategory,
} from "./analyticsTypes";

type AutomationRule = {
  automationEligible: boolean;
  automationState: LandlordDecisionAutomationState;
  automationReason: string | null;
};

const WORKFLOW_BLOCK_REASONS: Partial<Record<LandlordDecisionWorkflowCategory, string>> = {
  lease_renewals:
    "A lease automation path exists, but this decision still needs a specific lease target and notice inputs before execution.",
  application_funnel:
    "A screening automation path exists, but this decision does not yet identify a specific application to execute against.",
  maintenance_cost_approval:
    "This maintenance approval decision still needs a deterministic approval-ready work order and complete approval inputs before execution.",
  screening_checkout:
    "This screening checkout decision now has a deterministic application target, but explicit screening execution is not enabled in this mission.",
  maintenance_backlog:
    "A maintenance automation path exists, but this decision does not yet identify a specific work order with execution-ready evidence.",
};

function lifecycleBlockedRule(reason: string): AutomationRule {
  return {
    automationEligible: false,
    automationState: "blocked",
    automationReason: reason,
  };
}

export function deriveDecisionAutomationRule(decision: LandlordAgentDecision): AutomationRule {
  if (decision.state === "dismissed") {
    return lifecycleBlockedRule("Dismissed decisions are excluded from automation until they are re-derived as active work.");
  }
  if (decision.state === "snoozed") {
    return lifecycleBlockedRule("Snoozed decisions stay out of automation until the snooze window expires.");
  }
  if (decision.state === "reviewed") {
    return lifecycleBlockedRule("Reviewed decisions stay manual until a new active decision is surfaced.");
  }

  if (decision.automationEligible) {
    return {
      automationEligible: true,
      automationState: "ready",
      automationReason: "This decision is active and already mapped to a deterministic automation path.",
    };
  }

  const workflowReason = decision.workflowCategory ? WORKFLOW_BLOCK_REASONS[decision.workflowCategory] : null;
  if (workflowReason) {
    return {
      automationEligible: false,
      automationState: "blocked",
      automationReason: workflowReason,
    };
  }

  return {
    automationEligible: false,
    automationState: "manual_only",
    automationReason: "This decision is guidance-only in v1 and does not map to an execution rule.",
  };
}

export function applyDecisionAutomationRules(decisions: LandlordAgentDecision[]): LandlordAgentDecision[] {
  return decisions.map((decision) => {
    const rule = deriveDecisionAutomationRule(decision);
    return {
      ...decision,
      automationEligible: rule.automationEligible,
      automationState: rule.automationState,
      automationReason: rule.automationReason,
    };
  });
}
