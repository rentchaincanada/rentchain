import { describe, expect, it } from "vitest";
import { decisionStateMachine } from "../decisionStateMachine";
import type { DecisionContext } from "../types";

const context: DecisionContext = {
  actorRole: "landlord",
  actorId: "actor-1",
  authorized: true,
  decisionId: "decision-1",
  landlordId: "landlord-1",
  actionRecordExists: true,
  sourceValid: true,
  snoozedUntil: "2026-07-01T00:00:00.000Z",
};

describe("decisionStateMachine", () => {
  it("allows appearance, review, execution, failure, and reopen paths", () => {
    const results = [
      decisionStateMachine.validateTransition({ currentState: "Derived", proposedState: "Appeared", event: "appear", context }),
      decisionStateMachine.validateTransition({ currentState: "Appeared", proposedState: "Reviewed", event: "review", context }),
      decisionStateMachine.validateTransition({ currentState: "Reviewed", proposedState: "Executed", event: "execute", context }),
      decisionStateMachine.validateTransition({ currentState: "Executed", proposedState: "Failed", event: "mark_failed", context }),
      decisionStateMachine.validateTransition({ currentState: "Failed", proposedState: "Reviewed", event: "reopen", context }),
    ];

    expect(results.every((result) => result.valid)).toBe(true);
  });

  it("allows snooze, dismiss, and reopen flows", () => {
    const results = [
      decisionStateMachine.validateTransition({ currentState: "Reviewed", proposedState: "Snoozed", event: "snooze", context }),
      decisionStateMachine.validateTransition({ currentState: "Snoozed", proposedState: "Reviewed", event: "review", context }),
      decisionStateMachine.validateTransition({ currentState: "Appeared", proposedState: "Dismissed", event: "dismiss", context }),
      decisionStateMachine.validateTransition({ currentState: "Dismissed", proposedState: "Reviewed", event: "reopen", context }),
    ];

    expect(results.every((result) => result.valid)).toBe(true);
  });

  it("requires valid source and action records", () => {
    const invalidSource = decisionStateMachine.validateTransition({
      currentState: "Appeared",
      proposedState: "Reviewed",
      event: "review",
      context: { ...context, sourceValid: false },
    });
    const missingRecord = decisionStateMachine.validateTransition({
      currentState: "Reviewed",
      proposedState: "Executed",
      event: "execute",
      context: { ...context, actionRecordExists: false },
    });

    expect(invalidSource.valid).toBe(false);
    expect(missingRecord.valid).toBe(false);
  });
});
