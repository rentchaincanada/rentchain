import { describe, expect, it } from "vitest";
import { blockedReasonDisplay, executionStateDisplay, formatExecutionSummary } from "./decisionExecutionDisplay";

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
});
