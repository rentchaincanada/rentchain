import { describe, expect, it } from "vitest";
import { screeningStateMachine } from "../screeningStateMachine";
import type { ScreeningContext, ScreeningEvent } from "../types";

const baseContext: ScreeningContext = {
  actorRole: "landlord",
  actorId: "actor-1",
  authorized: true,
  applicationId: "application-1",
  landlordId: "landlord-1",
  orderId: "order-1",
  checkoutSessionId: "checkout-1",
  resultId: "result-1",
  failureCode: "provider_failed",
};

function validate(to: Parameters<typeof screeningStateMachine.validateTransition>[0]["proposedState"], event: ScreeningEvent) {
  return screeningStateMachine.validateTransition({
    currentState: "CheckoutInitiated",
    proposedState: to,
    event,
    context: baseContext,
  });
}

describe("screeningStateMachine", () => {
  it("allows the ordered checkout flow", () => {
    const transitions = [
      screeningStateMachine.validateTransition({
        currentState: "NotRequested",
        proposedState: "ApplicationStarted",
        event: "start_application",
        context: baseContext,
      }),
      screeningStateMachine.validateTransition({
        currentState: "ApplicationStarted",
        proposedState: "OrderCreated",
        event: "create_order",
        context: baseContext,
      }),
      screeningStateMachine.validateTransition({
        currentState: "OrderCreated",
        proposedState: "CheckoutInitiated",
        event: "initiate_checkout",
        context: baseContext,
      }),
      validate("CheckoutCompleted", "complete_checkout"),
      screeningStateMachine.validateTransition({
        currentState: "CheckoutCompleted",
        proposedState: "ResultAvailable",
        event: "publish_result",
        context: baseContext,
      }),
    ];

    expect(transitions.every((transition) => transition.valid)).toBe(true);
  });

  it("rejects skipped states", () => {
    const result = screeningStateMachine.validateTransition({
      currentState: "NotRequested",
      proposedState: "OrderCreated",
      event: "create_order",
      context: baseContext,
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain("not allowed");
  });

  it("rejects missing authority and missing context", () => {
    const unauthorized = screeningStateMachine.validateTransition({
      currentState: "ApplicationStarted",
      proposedState: "OrderCreated",
      event: "create_order",
      context: { ...baseContext, authorized: false },
    });
    const missingOrder = screeningStateMachine.validateTransition({
      currentState: "ApplicationStarted",
      proposedState: "OrderCreated",
      event: "create_order",
      context: { ...baseContext, orderId: null },
    });

    expect(unauthorized.valid).toBe(false);
    expect(unauthorized.reason).toContain("not authorized");
    expect(missingOrder.valid).toBe(false);
    expect(missingOrder.reason).toContain("orderId");
  });

  it("allows cancellation from every non-cancelled state", () => {
    const states = screeningStateMachine.states.filter((state) => state !== "Cancelled");
    const results = states.map((state) =>
      screeningStateMachine.validateTransition({
        currentState: state,
        proposedState: "Cancelled",
        event: "cancel",
        context: baseContext,
      })
    );

    expect(results.every((result) => result.valid)).toBe(true);
  });
});
