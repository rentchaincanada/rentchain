import { describe, expect, it } from "vitest";
import { getStateMachine, listStateMachineWorkflowTypes } from "../stateMachineRegistry";
import {
  buildValidationSummary,
  validateDecisionTransition,
  validateLeaseTransition,
  validateMaintenanceTransition,
  validatePaymentTransition,
  validateScreeningTransition,
} from "../transitionValidation";

describe("transitionValidation", () => {
  it("validates screening transitions from computed records", () => {
    const result = validateScreeningTransition(
      { id: "application-1" },
      {
        to: "OrderCreated",
        event: "create_order",
        context: {
          actorRole: "landlord",
          authorized: true,
          applicationId: "application-1",
          landlordId: "landlord-1",
          orderId: "order-1",
        },
      }
    );

    expect(result.valid).toBe(true);
    expect(buildValidationSummary(result)).toEqual({ valid: true, allowedTransitions: ["OrderCreated", "Cancelled"] });
  });

  it("validates lease transitions from computed records", () => {
    const result = validateLeaseTransition(
      { status: "ended" },
      {
        to: "Restored",
        event: "restore",
        context: {
          actorRole: "landlord",
          authorized: true,
          leaseId: "lease-1",
          landlordId: "landlord-1",
          restoreRequested: true,
        },
      }
    );

    expect(result.valid).toBe(true);
  });

  it("validates maintenance transitions from computed records", () => {
    const result = validateMaintenanceTransition(
      { status: "in_progress" },
      {
        to: "CostReview",
        event: "request_cost_review",
        context: {
          actorRole: "contractor",
          authorized: true,
          workOrderId: "work-order-1",
          costTotalCents: 5000,
        },
      }
    );

    expect(result.valid).toBe(true);
  });

  it("validates payment transitions from computed records", () => {
    const result = validatePaymentTransition(
      { status: "payment_pending" },
      {
        to: "Confirmed",
        event: "confirm",
        context: {
          actorRole: "system",
          authorized: true,
          paymentId: "payment-1",
          paymentIntentId: "intent-1",
          providerStatus: "succeeded",
        },
      }
    );

    expect(result.valid).toBe(true);
  });

  it("validates decision transitions from computed records", () => {
    const result = validateDecisionTransition(
      { state: "reviewed" },
      {
        to: "Executed",
        event: "execute",
        context: {
          actorRole: "landlord",
          authorized: true,
          decisionId: "decision-1",
          landlordId: "landlord-1",
          actionRecordExists: true,
          sourceValid: true,
        },
      }
    );

    expect(result.valid).toBe(true);
  });

  it("exposes immutable registry descriptors", () => {
    expect(listStateMachineWorkflowTypes()).toEqual(["screening", "lease", "maintenance", "payment", "decision"]);
    expect(getStateMachine("screening").workflowType).toBe("screening");
    expect(getStateMachine("decision").snapshot("Derived").allowedTransitions).toEqual(["Appeared"]);
  });
});
