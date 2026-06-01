import { describe, expect, it } from "vitest";
import { maintenanceStateMachine } from "../maintenanceStateMachine";
import type { MaintenanceContext } from "../types";

const context: MaintenanceContext = {
  actorRole: "landlord",
  actorId: "actor-1",
  authorized: true,
  workOrderId: "work-order-1",
  assignedContractorId: "contractor-1",
  scheduledFor: "2026-06-10T12:00:00.000Z",
  costTotalCents: 12500,
  evidenceCount: 2,
};

describe("maintenanceStateMachine", () => {
  it("allows the expected review path", () => {
    const results = [
      maintenanceStateMachine.validateTransition({ currentState: "Open", proposedState: "Assigned", event: "assign", context }),
      maintenanceStateMachine.validateTransition({ currentState: "Assigned", proposedState: "Scheduled", event: "schedule", context }),
      maintenanceStateMachine.validateTransition({ currentState: "Scheduled", proposedState: "InProgress", event: "start", context }),
      maintenanceStateMachine.validateTransition({
        currentState: "InProgress",
        proposedState: "CostReview",
        event: "request_cost_review",
        context,
      }),
      maintenanceStateMachine.validateTransition({ currentState: "CostReview", proposedState: "Completed", event: "complete", context }),
    ];

    expect(results.every((result) => result.valid)).toBe(true);
  });

  it("detects missing contractor, schedule, cost, and evidence context", () => {
    const assign = maintenanceStateMachine.validateTransition({
      currentState: "Open",
      proposedState: "Assigned",
      event: "assign",
      context: { ...context, assignedContractorId: null },
    });
    const schedule = maintenanceStateMachine.validateTransition({
      currentState: "Assigned",
      proposedState: "Scheduled",
      event: "schedule",
      context: { ...context, scheduledFor: null },
    });
    const cost = maintenanceStateMachine.validateTransition({
      currentState: "InProgress",
      proposedState: "CostReview",
      event: "request_cost_review",
      context: { ...context, costTotalCents: null },
    });
    const evidence = maintenanceStateMachine.validateTransition({
      currentState: "InProgress",
      proposedState: "Completed",
      event: "complete",
      context: { ...context, evidenceCount: 0 },
    });

    expect(assign.valid).toBe(false);
    expect(schedule.valid).toBe(false);
    expect(cost.valid).toBe(false);
    expect(evidence.valid).toBe(false);
  });

  it("allows rework from completed and back to assignment", () => {
    const rework = maintenanceStateMachine.validateTransition({
      currentState: "Completed",
      proposedState: "Rework",
      event: "request_rework",
      context,
    });
    const assigned = maintenanceStateMachine.validateTransition({
      currentState: "Rework",
      proposedState: "Assigned",
      event: "return_to_assignment",
      context,
    });

    expect(rework.valid).toBe(true);
    expect(assigned.valid).toBe(true);
  });
});
