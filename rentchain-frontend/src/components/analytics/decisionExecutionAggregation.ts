import type {
  LandlordAgentDecision,
  LandlordDecisionExecutionState,
} from "@/api/landlordAnalyticsApi";

export type DecisionExecutionFilter = LandlordDecisionExecutionState | "all";

export type DecisionExecutionAggregate = {
  total: number;
  counts: Record<LandlordDecisionExecutionState, number>;
};

const EXECUTION_STATE_PRIORITY: Record<LandlordDecisionExecutionState, number> = {
  executable: 0,
  blocked: 1,
  unsafe_duplicate: 2,
  already_executed: 3,
};

const DECISION_PRIORITY_WEIGHT: Record<LandlordAgentDecision["priority"], number> = {
  high: 0,
  medium: 1,
  low: 2,
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

export function prioritizeDecisions(decisions: LandlordAgentDecision[]) {
  return decisions
    .map((decision, index) => ({ decision, index }))
    .sort((left, right) => {
      const stateDelta =
        EXECUTION_STATE_PRIORITY[deriveDecisionExecutionState(left.decision)] -
        EXECUTION_STATE_PRIORITY[deriveDecisionExecutionState(right.decision)];
      if (stateDelta !== 0) return stateDelta;

      const decisionPriorityDelta =
        DECISION_PRIORITY_WEIGHT[left.decision.priority] -
        DECISION_PRIORITY_WEIGHT[right.decision.priority];
      if (decisionPriorityDelta !== 0) return decisionPriorityDelta;

      return left.index - right.index;
    })
    .map(({ decision }) => decision);
}
