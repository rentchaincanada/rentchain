import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { LandlordAgentDecision } from "@/api/landlordAnalyticsApi";
import DecisionQueueSummary from "./DecisionQueueSummary";

afterEach(() => {
  cleanup();
});

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

describe("DecisionQueueSummary", () => {
  it("renders deterministic counts using the existing execution-state labels", () => {
    render(
      <DecisionQueueSummary
        decisions={[
          buildDecision({
            id: "ready",
            automationState: "ready",
            executionMappingState: "mapped",
            executionInputState: "complete",
          }),
          buildDecision({ id: "blocked" }),
          buildDecision({ id: "executed", state: "executed" }),
          buildDecision({ id: "duplicate", executionState: "unsafe_duplicate" }),
        ]}
        filter="all"
        onFilterChange={() => undefined}
      />
    );

    expect(screen.getByRole("region", { name: /Operator queue/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /All decisions · 4/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ready to run · 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Action required · 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Completed · 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Already processed · 1/i })).toBeInTheDocument();
  });

  it("reflects the active in-memory filter state in the summary controls", () => {
    render(
      <DecisionQueueSummary
        decisions={[buildDecision()]}
        filter="blocked"
        onFilterChange={() => undefined}
      />
    );

    const blockedFilter = screen
      .getAllByRole("button")
      .find((element) => element.textContent === "Action required · 1");
    const allFilter = screen
      .getAllByRole("button")
      .find((element) => element.textContent === "All decisions · 1");

    expect(blockedFilter).toHaveAttribute("aria-pressed", "true");
    expect(allFilter).toHaveAttribute("aria-pressed", "false");
  });
});
