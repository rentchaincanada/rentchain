import type { DecisionInboxItem } from "../decisions/decisionInboxTypes";

export type AutomatedWorkflowPolicyGuardResult = {
  allowed: boolean;
  manualReviewRequired: true;
  policyGuarded: true;
  externalExecutionEnabled: false;
  requiresHumanAcknowledgement: true;
  blockedReasons: string[];
};

export function evaluateAutomatedWorkflowPolicyGuards(decision: DecisionInboxItem): AutomatedWorkflowPolicyGuardResult {
  const blockedReasons: string[] = [];

  if (decision.workflow.manualOnly !== true) {
    blockedReasons.push("Workflow routing must remain manual-only before orchestration metadata can be derived.");
  }
  if (decision.automationEligible !== false) {
    blockedReasons.push("Executable automation is not enabled for Decision Inbox orchestration.");
  }
  if (decision.workflow.ownershipType === "admin") {
    blockedReasons.push("Admin-owned workflow metadata is not exposed through landlord automation previews.");
  }

  return {
    allowed: blockedReasons.length === 0,
    manualReviewRequired: true,
    policyGuarded: true,
    externalExecutionEnabled: false,
    requiresHumanAcknowledgement: true,
    blockedReasons,
  };
}
