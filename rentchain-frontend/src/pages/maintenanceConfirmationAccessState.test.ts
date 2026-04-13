import { describe, expect, it } from "vitest";
import { buildMaintenanceConfirmationAccessView } from "./maintenanceConfirmationAccessState";
import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";

function makeItem(overrides: Partial<MaintenanceWorkflowItem> = {}): MaintenanceWorkflowItem {
  return {
    id: "maint-1",
    tenantId: "tenant-1",
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    title: "Broken heater",
    description: "Heat is not turning on.",
    category: "HVAC",
    priority: "urgent",
    status: "scheduled",
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

describe("buildMaintenanceConfirmationAccessView", () => {
  it("marks a scheduled request as awaiting confirmation by default", () => {
    const view = buildMaintenanceConfirmationAccessView(
      makeItem({
        serviceWindowStartAt: Date.UTC(2026, 3, 15, 13, 0),
        serviceWindowEndAt: Date.UTC(2026, 3, 15, 15, 0),
        accessRequired: true,
      }),
      "tenant"
    );

    expect(view.confirmationState).toBe("awaiting_confirmation");
    expect(view.readinessState).toBe("not_ready");
    expect(view.accessState).toBe("access_required");
  });

  it("marks a request ready for service when the window is confirmed and access is acknowledged", () => {
    const view = buildMaintenanceConfirmationAccessView(
      makeItem({
        serviceWindowStartAt: Date.UTC(2026, 3, 15, 13, 0),
        serviceWindowEndAt: Date.UTC(2026, 3, 15, 15, 0),
        accessRequired: true,
        tenantConfirmationStatus: "confirmed",
        tenantConfirmationUpdatedAt: 500,
        accessAcknowledgedAt: 600,
      }),
      "landlord"
    );

    expect(view.confirmationState).toBe("confirmed");
    expect(view.readinessState).toBe("ready_for_service");
    expect(view.accessState).toBe("access_acknowledged");
  });

  it("surfaces a schedule-change request as needing attention", () => {
    const view = buildMaintenanceConfirmationAccessView(
      makeItem({
        serviceWindowStartAt: Date.UTC(2026, 3, 15, 13, 0),
        tenantConfirmationStatus: "needs_schedule_change",
        tenantConfirmationUpdatedAt: 500,
      }),
      "landlord"
    );

    expect(view.confirmationState).toBe("needs_schedule_change");
    expect(view.readinessState).toBe("needs_attention");
    expect(view.blockers.join(" ")).toMatch(/service window/i);
  });
});
