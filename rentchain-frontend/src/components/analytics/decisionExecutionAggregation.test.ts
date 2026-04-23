import { describe, expect, it } from "vitest";
import type { LandlordAgentDecision } from "@/api/landlordAnalyticsApi";
import {
  aggregateDecisionStates,
  deriveDecisionExecutionState,
  filterDecisionsByExecutionState,
} from "./decisionExecutionAggregation";

function buildDecision(
  overrides?: Partial<LandlordAgentDecision>
): LandlordAgentDecision {
  return {
    id: "decision-1",
    decisionType: "review_lease_renewals",
    priority: "medium",
    explanation: "Review renewals",
    supportingSignals: [],
    recommendedAction: "Review renewals",
    href: "/leases",
    state: "pending",
    reviewedAt: null,
    actionKey: "open_lease_renewals_flow",
    actionLabel: "Open lease renewals",
    destination: "/leases",
    workflowCategory: "lease_renewals",
    automationEligible: false,
    automationState: "blocked",
    automationReason: "Blocked",
    executionMappingState: "none",
    executionMapping: null,
    executionInputState: "none",
    executionInputReason: null,
    executionInputMissingFields: [],
    executionInput: null,
    executionState: undefined,
    blockedReason: null,
    executionGuardKey: null,
    duplicateGuardActive: false,
    executionSummary: undefined,
    executedAt: null,
    executionOutcomeStatus: "none",
    executionOutcomeAt: null,
    executionOutcomeReason: null,
    ...overrides,
  };
}

describe("decisionExecutionAggregation", () => {
  it("derives execution state from existing decision fields when explicit state is absent", () => {
    expect(
      deriveDecisionExecutionState(
        buildDecision({
          automationState: "ready",
          executionMappingState: "mapped",
          executionInputState: "complete",
        })
      )
    ).toBe("executable");

    expect(deriveDecisionExecutionState(buildDecision({ state: "executed" }))).toBe("already_executed");
    expect(
      deriveDecisionExecutionState(buildDecision({ executionState: "unsafe_duplicate" }))
    ).toBe("unsafe_duplicate");
  });

  it("aggregates counts by execution state deterministically", () => {
    const decisions = [
      buildDecision({
        id: "ready",
        automationState: "ready",
        executionMappingState: "mapped",
        executionInputState: "complete",
      }),
      buildDecision({ id: "blocked" }),
      buildDecision({ id: "executed", state: "executed" }),
      buildDecision({ id: "duplicate", executionState: "unsafe_duplicate" }),
    ];

    expect(aggregateDecisionStates(decisions)).toEqual({
      total: 4,
      counts: {
        executable: 1,
        blocked: 1,
        already_executed: 1,
        unsafe_duplicate: 1,
      },
    });
  });

  it("filters the in-memory decision list by execution state", () => {
    const ready = buildDecision({
      id: "ready",
      automationState: "ready",
      executionMappingState: "mapped",
      executionInputState: "complete",
    });
    const blocked = buildDecision({ id: "blocked" });

    expect(filterDecisionsByExecutionState([ready, blocked], "all")).toEqual([ready, blocked]);
    expect(filterDecisionsByExecutionState([ready, blocked], "executable")).toEqual([ready]);
    expect(filterDecisionsByExecutionState([ready, blocked], "blocked")).toEqual([blocked]);
  });
});
