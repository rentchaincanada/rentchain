import { describe, expect, it } from "vitest";
import { buildLeaseExecutionWorkspace } from "./leaseExecutionWorkspace";

describe("leaseExecutionWorkspace", () => {
  it("stays not ready when execution readiness is still blocked", () => {
    const result = buildLeaseExecutionWorkspace({
      audience: "landlord",
      executionReadiness: {
        readinessState: "not_ready_for_execution",
        label: "Not ready for execution",
        summary: "Lease execution readiness",
        explanation: "Not ready.",
        completedItems: [],
        outstandingItems: [],
        blockers: ["Lease preparation is still earlier in the workflow."],
        nextActions: ["Wait."],
        timelineEvent: null,
      },
    });

    expect(result.executionState).toBe("not_ready_for_execution");
    expect(result.timelineEvent).toBeNull();
  });

  it("shows awaiting execution action when the final handoff is still pending", () => {
    const result = buildLeaseExecutionWorkspace({
      audience: "tenant",
      executionReadiness: {
        readinessState: "awaiting_next_action",
        label: "Awaiting final requirements",
        summary: "Lease execution readiness",
        explanation: "Awaiting.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Watch for the next update."],
        timelineEvent: {
          title: "Lease execution readiness updated",
          description: "Updated.",
          actionRequired: false,
        },
      },
    });

    expect(result.executionState).toBe("awaiting_execution_action");
    expect(result.explanation).toMatch(/Preparing to complete your lease/i);
  });

  it("shows ready for execution when the handoff can proceed but has not started", () => {
    const result = buildLeaseExecutionWorkspace({
      audience: "landlord",
      executionReadiness: {
        readinessState: "ready_for_execution",
        label: "Ready for execution",
        summary: "Lease execution readiness",
        explanation: "Ready.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Proceed."],
        timelineEvent: {
          title: "Ready for execution",
          description: "Ready.",
          actionRequired: false,
        },
      },
    });

    expect(result.executionState).toBe("ready_for_execution");
    expect(result.timelineEvent?.title).toBe("Ready for execution");
  });

  it("shows execution in progress when a visible lease record and document are present", () => {
    const result = buildLeaseExecutionWorkspace({
      audience: "tenant",
      executionReadiness: {
        readinessState: "ready_for_execution",
        label: "Ready for execution",
        summary: "Lease execution readiness",
        explanation: "Ready.",
        completedItems: [],
        outstandingItems: [],
        blockers: [],
        nextActions: ["Proceed."],
        timelineEvent: {
          title: "Ready for execution",
          description: "Ready.",
          actionRequired: false,
        },
      },
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 180000,
        status: "draft",
        documentUrl: "https://example.com/lease.pdf",
      },
    });

    expect(result.executionState).toBe("execution_in_progress");
    expect(result.timelineEvent?.title).toBe("Execution started");
  });
});
