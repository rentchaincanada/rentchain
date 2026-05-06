import type { AgentSupervisionItem } from "./agentSupervisionTypes";

export function enforceAgentSupervisionPolicyFlags<T extends Omit<AgentSupervisionItem, "policyGuarded" | "manualReviewRequired" | "requiresHumanApproval">>(
  item: T
): T & Pick<AgentSupervisionItem, "policyGuarded" | "manualReviewRequired" | "requiresHumanApproval"> {
  return {
    ...item,
    policyGuarded: true,
    manualReviewRequired: true,
    requiresHumanApproval: true,
  };
}
