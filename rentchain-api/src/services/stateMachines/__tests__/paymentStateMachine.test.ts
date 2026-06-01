import { describe, expect, it } from "vitest";
import { paymentStateMachine } from "../paymentStateMachine";
import type { PaymentContext } from "../types";

const context: PaymentContext = {
  actorRole: "landlord",
  actorId: "actor-1",
  authorized: true,
  paymentId: "payment-1",
  paymentIntentId: "intent-1",
  providerStatus: "succeeded",
};

describe("paymentStateMachine", () => {
  it("allows processing, confirmation, refund, and retry paths", () => {
    const results = [
      paymentStateMachine.validateTransition({ currentState: "Pending", proposedState: "Processing", event: "start_processing", context }),
      paymentStateMachine.validateTransition({ currentState: "Processing", proposedState: "Confirmed", event: "confirm", context }),
      paymentStateMachine.validateTransition({ currentState: "Confirmed", proposedState: "Refunded", event: "refund", context }),
      paymentStateMachine.validateTransition({ currentState: "Refunded", proposedState: "Pending", event: "reattempt", context }),
      paymentStateMachine.validateTransition({ currentState: "Processing", proposedState: "Failed", event: "fail", context }),
      paymentStateMachine.validateTransition({ currentState: "Failed", proposedState: "Pending", event: "retry", context }),
    ];

    expect(results.every((result) => result.valid)).toBe(true);
  });

  it("rejects skipped confirmation and ambiguous processor state", () => {
    const skipped = paymentStateMachine.validateTransition({
      currentState: "Pending",
      proposedState: "Confirmed",
      event: "confirm",
      context,
    });
    const ambiguous = paymentStateMachine.validateTransition({
      currentState: "Processing",
      proposedState: "Confirmed",
      event: "confirm",
      context: { ...context, providerStatus: null },
    });

    expect(skipped.valid).toBe(false);
    expect(ambiguous.valid).toBe(false);
    expect(ambiguous.reason).toContain("Persisted payment transaction status");
  });
});
