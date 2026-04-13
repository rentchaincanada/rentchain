import { describe, expect, it } from "vitest";
import {
  buildMaintenanceSchedulingAccessView,
  buildMaintenanceSchedulingCalendarEvents,
} from "./maintenanceSchedulingAccessState";
import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";

function makeItem(overrides: Partial<MaintenanceWorkflowItem> = {}): MaintenanceWorkflowItem {
  return {
    id: "maint-1",
    tenantId: "tenant-1",
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    title: "Broken heater",
    description: "Heat is not working.",
    category: "HVAC",
    priority: "urgent",
    status: "assigned",
    createdAt: 100,
    updatedAt: 200,
    statusHistory: [],
    ...overrides,
  };
}

describe("maintenanceSchedulingAccessState", () => {
  it("shows access coordination when access is required", () => {
    const view = buildMaintenanceSchedulingAccessView(
      makeItem({
        status: "assigned",
        accessRequired: true,
      }),
      "tenant"
    );

    expect(view.schedulingState).toBe("access_coordination_needed");
    expect(view.accessLabel).toBe("Access needed");
    expect(view.tenantVisibleLabel).toBe("Access coordination needed");
  });

  it("shows ready for service when a scheduled window exists without access requirements", () => {
    const view = buildMaintenanceSchedulingAccessView(
      makeItem({
        status: "scheduled",
        serviceWindowStartAt: Date.UTC(2026, 3, 15, 13, 0),
        serviceWindowEndAt: Date.UTC(2026, 3, 15, 15, 0),
        accessRequired: false,
      }),
      "landlord"
    );

    expect(view.schedulingState).toBe("ready_for_service");
    expect(view.calendarEvent?.startAt).toBe(Date.UTC(2026, 3, 15, 13, 0));
  });

  it("derives scheduled calendar events from explicit service windows", () => {
    const events = buildMaintenanceSchedulingCalendarEvents([
      makeItem({
        id: "maint-1",
        title: "Fix faucet",
        status: "scheduled",
        priority: "normal",
        serviceWindowStartAt: Date.UTC(2026, 3, 10, 14, 0),
      }),
      makeItem({
        id: "maint-2",
        title: "Replace smoke detector",
        status: "submitted",
      }),
    ]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      requestId: "maint-1",
      title: "Fix faucet",
      priority: "normal",
    });
  });
});
