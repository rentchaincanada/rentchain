import type { DecisionInboxItem } from "../decisions/decisionInboxTypes";

export type AgentActionPolicyGuardResult = {
  allowed: boolean;
  manualReviewRequired: true;
  policyGuarded: true;
  externalExecutionEnabled: false;
  requiresHumanApproval: true;
  blockedReasons: string[];
};

export function evaluateAgentActionPolicyGuards(decision: DecisionInboxItem): AgentActionPolicyGuardResult {
  const blockedReasons: string[] = [];

  if (decision.automationEligible !== false) {
    blockedReasons.push("Agent suggestions cannot be derived from executable automation items.");
  }
  if (decision.workflow.manualOnly !== true) {
    blockedReasons.push("Workflow routing must remain manual-only before agent suggestions can be surfaced.");
  }
  if (decision.workflow.ownershipType === "admin") {
    blockedReasons.push("Admin-owned decisions are not exposed through landlord agent-action suggestions.");
  }
  if (decision.automatedWorkflow?.externalExecutionEnabled !== false) {
    blockedReasons.push("External workflow execution must be disabled before agent suggestions can be surfaced.");
  }

  return {
    allowed: blockedReasons.length === 0,
    manualReviewRequired: true,
    policyGuarded: true,
    externalExecutionEnabled: false,
    requiresHumanApproval: true,
    blockedReasons,
  };
}
