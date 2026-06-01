import { describe, expect, it } from "vitest";
import {
  computeDecisionState,
  computeLeaseState,
  computeMaintenanceState,
  computePaymentState,
  computeScreeningState,
} from "../stateComputation";

describe("stateComputation", () => {
  it("computes screening state deterministically from available records", () => {
    expect(computeScreeningState({})).toBe("NotRequested");
    expect(computeScreeningState({ application: { id: "application-1" } })).toBe("ApplicationStarted");
    expect(computeScreeningState({ application: { id: "application-1" }, order: { id: "order-1" } })).toBe("OrderCreated");
    expect(
      computeScreeningState({
        application: { id: "application-1" },
        order: { id: "order-1", stripeCheckoutSessionId: "checkout-1" },
      })
    ).toBe("CheckoutInitiated");
    expect(computeScreeningState({ application: { screeningStatus: "paid" }, order: { id: "order-1" } })).toBe("CheckoutCompleted");
    expect(computeScreeningState({ application: { screeningResultId: "result-1" } })).toBe("ResultAvailable");
    expect(computeScreeningState({ application: { screeningStatus: "failed" } })).toBe("Failed");
    expect(computeScreeningState({ application: { screeningStatus: "cancelled" } })).toBe("Cancelled");
  });

  it("computes lease state from current lease fields", () => {
    expect(computeLeaseState(null)).toBe("Draft");
    expect(computeLeaseState({ status: "draft" })).toBe("Draft");
    expect(computeLeaseState({ status: "active" })).toBe("Active");
    expect(computeLeaseState({ status: "renewal_pending" })).toBe("NoticePending");
    expect(computeLeaseState({ latestNoticeId: "notice-1" })).toBe("NoticePending");
    expect(computeLeaseState({ status: "ended" })).toBe("Ended");
    expect(computeLeaseState({ status: "restored" })).toBe("Restored");
  });

  it("computes maintenance state from status, cost review, and rework fields", () => {
    expect(computeMaintenanceState({ status: "submitted" })).toBe("Open");
    expect(computeMaintenanceState({ assignedContractorId: "contractor-1" })).toBe("Assigned");
    expect(computeMaintenanceState({ status: "scheduled" })).toBe("Scheduled");
    expect(computeMaintenanceState({ status: "in_progress" })).toBe("InProgress");
    expect(computeMaintenanceState({ cost: { reviewStatus: "pending_review" } })).toBe("CostReview");
    expect(computeMaintenanceState({ status: "completed" })).toBe("Completed");
    expect(computeMaintenanceState({ status: "completed", reworkCycle: { status: "assigned" } })).toBe("Rework");
  });

  it("computes payment state from persisted payment status", () => {
    expect(computePaymentState({ status: "checkout_created" })).toBe("Processing");
    expect(computePaymentState({ status: "paid" })).toBe("Confirmed");
    expect(computePaymentState({ status: "Recorded" })).toBe("Confirmed");
    expect(computePaymentState({ status: "failed" })).toBe("Failed");
    expect(computePaymentState({ status: "refunded" })).toBe("Refunded");
    expect(computePaymentState({ amountCents: 1200 })).toBe("Pending");
  });

  it("computes decision state from action records", () => {
    expect(computeDecisionState(null)).toBe("Derived");
    expect(computeDecisionState({ state: "appeared" })).toBe("Appeared");
    expect(computeDecisionState({ state: "reviewed" })).toBe("Reviewed");
    expect(computeDecisionState({ state: "snoozed" })).toBe("Snoozed");
    expect(computeDecisionState({ state: "dismissed" })).toBe("Dismissed");
    expect(computeDecisionState({ state: "executed" })).toBe("Executed");
    expect(computeDecisionState({ state: "executed", executionOutcomeStatus: "failed" })).toBe("Failed");
  });
});
