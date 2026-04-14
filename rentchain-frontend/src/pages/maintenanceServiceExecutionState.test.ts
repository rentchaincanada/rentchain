import { describe, expect, it } from "vitest";
import { buildMaintenanceServiceExecutionView } from "./maintenanceServiceExecutionState";

const baseItem = {
  id: "maint-1",
  tenantId: "tenant-1",
  landlordId: "landlord-1",
  propertyId: "prop-1",
  unitId: "unit-1",
  title: "Leaky faucet",
  description: "Kitchen sink is leaking",
  category: "PLUMBING",
  priority: "normal" as const,
  status: "submitted" as const,
  createdAt: 100,
  updatedAt: 200,
};

describe("maintenance service execution state", () => {
  it("marks a scheduled and confirmed request as ready for service", () => {
    const view = buildMaintenanceServiceExecutionView(
      {
        ...baseItem,
        status: "scheduled",
        serviceWindowStartAt: 400,
        tenantConfirmationStatus: "confirmed",
        accessRequired: true,
        accessAcknowledgedAt: 420,
      },
      "landlord"
    );

    expect(view.executionState).toBe("ready_for_service");
    expect(view.nextActions[0]).toMatch(/mark service started/i);
  });

  it("marks a started request as in progress", () => {
    const view = buildMaintenanceServiceExecutionView(
      {
        ...baseItem,
        status: "in_progress",
        serviceStartedAt: 500,
      },
      "tenant"
    );

    expect(view.executionState).toBe("in_progress");
    expect(view.completionState).toBe("awaiting_completion");
    expect(view.tenantVisibleState).toBe("work_in_progress");
  });

  it("marks a completed request with follow-up as completion_needs_attention", () => {
    const view = buildMaintenanceServiceExecutionView(
      {
        ...baseItem,
        status: "completed",
        serviceStartedAt: 500,
        serviceCompletedAt: 700,
        completionSummary: "Replaced the faucet cartridge.",
        followUpRequired: true,
        resolutionStatus: "follow_up_required",
      },
      "landlord"
    );

    expect(view.completionState).toBe("completion_needs_attention");
    expect(view.blockers.join(" ")).toMatch(/follow-up/i);
    expect(view.timelineEvents.map((event) => event.kind)).toEqual(["service_completed", "service_started"]);
  });
});
