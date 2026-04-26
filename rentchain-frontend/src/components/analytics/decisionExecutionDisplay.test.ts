import { describe, expect, it } from "vitest";
import type { LandlordAgentDecision } from "@/api/landlordAnalyticsApi";
import {
  blockedReasonDisplay,
  canOpenExecutionConfirmation,
  deriveAutomationPreview,
  executionStateDisplay,
  formatExecutionSummary,
  getExecutionConfirmationDetails,
} from "./decisionExecutionDisplay";

function buildDecision(overrides?: Partial<LandlordAgentDecision>): LandlordAgentDecision {
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

describe("decisionExecutionDisplay", () => {
  it("maps execution states to operator-facing labels", () => {
    expect(executionStateDisplay.executable.label).toBe("Ready to run");
    expect(executionStateDisplay.blocked.label).toBe("Action required");
    expect(executionStateDisplay.already_executed.label).toBe("Completed");
    expect(executionStateDisplay.unsafe_duplicate.label).toBe("Already processed");
  });

  it("maps blocked reasons to readable copy", () => {
    expect(blockedReasonDisplay.missing_required_inputs.title).toBe("Missing required inputs");
    expect(blockedReasonDisplay.policy_blocked.description).toMatch(/policy or safety rule/i);
    expect(blockedReasonDisplay.duplicate_prevented.title).toBe("Duplicate execution prevented");
  });

  it("formats execution summary with count, outcome, and timestamp", () => {
    const result = formatExecutionSummary({
      lastExecutedAt: "2026-04-22T12:00:00.000Z",
      executionCount: 2,
      lastExecutionOutcome: "failed",
      lastExecutionOutcomeAt: "2026-04-22T12:00:00.000Z",
    });

    expect(result[0]).toBe("Executed 2 times");
    expect(result[1]).toBe("Last result: Failed");
    expect(result[2]).toMatch(/Last run:/);
  });

  it("returns an empty summary when there are no executions", () => {
    expect(
      formatExecutionSummary({
        lastExecutedAt: null,
        executionCount: 0,
        lastExecutionOutcome: "none",
        lastExecutionOutcomeAt: null,
      })
    ).toEqual([]);
  });

  it("derives a controlled preview for executable decisions", () => {
    const result = deriveAutomationPreview(
      buildDecision({
        automationEligible: true,
        automationState: "ready",
        executionMappingState: "mapped",
        executionInputState: "complete",
        executionGuardKey: "lease.auto_send_notice:lease:lease-1",
      })
    );

    expect(result.status).toBe("Eligible for human-confirmed execution");
    expect(result.safeguardLabel).toBe("Human confirmation required");
    expect(result.guardKeyLabel).toContain("lease.auto_send_notice:lease:lease-1");
    expect(result.nextStep).toMatch(/confirm manually/i);
  });

  it("derives a blocked preview without changing blocked-reason semantics", () => {
    const result = deriveAutomationPreview(
      buildDecision({
        blockedReason: "missing_required_inputs",
        automationReason: "Still missing notice inputs.",
      })
    );

    expect(result.status).toBe("Automation preview unavailable");
    expect(result.summary).toMatch(/required execution inputs/i);
  });

  it("derives a duplicate-guarded preview", () => {
    const result = deriveAutomationPreview(
      buildDecision({
        executionState: "unsafe_duplicate",
        duplicateGuardActive: true,
        executionGuardKey: "maintenance.auto_approve_cost:work_order:wo-1",
      })
    );

    expect(result.status).toBe("Duplicate protection active");
    expect(result.duplicateProtectionActive).toBe(true);
  });

  it("fails closed for manual-only decisions", () => {
    const result = deriveAutomationPreview(
      buildDecision({
        automationEligible: false,
        automationState: "manual_only",
      })
    );

    expect(result.status).toBe("Automation preview unavailable");
    expect(result.nextStep).toMatch(/Manual review required/i);
  });

  it("fails closed when the action label is missing", () => {
    const result = deriveAutomationPreview(
      buildDecision({
        actionLabel: "" as LandlordAgentDecision["actionLabel"],
        recommendedAction: "" as LandlordAgentDecision["recommendedAction"],
      })
    );

    expect(result.status).toBe("Automation preview unavailable");
    expect(result.summary).toMatch(/not available for preview/i);
  });

  it("allows confirmation only for executable decisions with valid action context", () => {
    expect(
      canOpenExecutionConfirmation(
        buildDecision({
          automationEligible: true,
          automationState: "ready",
          executionMappingState: "mapped",
          executionInputState: "complete",
        })
      )
    ).toBe(true);
    expect(canOpenExecutionConfirmation(buildDecision())).toBe(false);
    expect(
      canOpenExecutionConfirmation(
        buildDecision({
          executionState: "unsafe_duplicate",
          duplicateGuardActive: true,
        })
      )
    ).toBe(false);
  });

  it("returns fail-closed confirmation details when required context is missing", () => {
    const result = getExecutionConfirmationDetails(
      buildDecision({
        automationEligible: true,
        automationState: "ready",
        executionMappingState: "mapped",
        executionInputState: "complete",
        actionKey: "",
      })
    );

    expect(result.canConfirm).toBe(false);
    expect(result.unavailableReason).toMatch(/execution context is incomplete/i);
    expect(result.warning).toMatch(/guarded execution path/i);
  });
});
