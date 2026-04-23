import type {
  LandlordAgentDecision,
  LandlordDecisionExecutionState,
} from "@/api/landlordAnalyticsApi";

export type DecisionExecutionFilter = LandlordDecisionExecutionState | "all";

export type DecisionExecutionAggregate = {
  total: number;
  counts: Record<LandlordDecisionExecutionState, number>;
};

export function deriveDecisionExecutionState(
  decision: LandlordAgentDecision
): LandlordDecisionExecutionState {
  if (decision.executionState) return decision.executionState;
  if (decision.state === "executed") return "already_executed";
  if (
    decision.automationState === "ready" &&
    decision.executionMappingState === "mapped" &&
    decision.executionInputState === "complete"
  ) {
    return "executable";
  }
  return "blocked";
}

export function aggregateDecisionStates(
  decisions: LandlordAgentDecision[]
): DecisionExecutionAggregate {
  const counts: Record<LandlordDecisionExecutionState, number> = {
    executable: 0,
    blocked: 0,
    already_executed: 0,
    unsafe_duplicate: 0,
  };

  for (const decision of decisions) {
    counts[deriveDecisionExecutionState(decision)] += 1;
  }

  return {
    total: decisions.length,
    counts,
  };
}

export function filterDecisionsByExecutionState(
  decisions: LandlordAgentDecision[],
  filter: DecisionExecutionFilter
) {
  if (filter === "all") return decisions;
  return decisions.filter((decision) => deriveDecisionExecutionState(decision) === filter);
}
