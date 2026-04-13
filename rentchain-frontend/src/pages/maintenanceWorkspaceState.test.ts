import { describe, expect, it } from "vitest";
import {
  buildMaintenanceLifecycleView,
  buildMaintenanceWorkspaceState,
} from "./maintenanceWorkspaceState";

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

describe("maintenance workspace state", () => {
  it("maps submitted requests into the submitted lifecycle", () => {
    const result = buildMaintenanceLifecycleView(baseItem, "tenant");
    expect(result.lifecycleState).toBe("submitted");
    expect(result.nextSteps[0]).toMatch(/Wait for landlord review/i);
  });

  it("maps reviewed requests into acknowledged", () => {
    const result = buildMaintenanceLifecycleView({ ...baseItem, status: "reviewed" }, "landlord");
    expect(result.lifecycleState).toBe("acknowledged");
    expect(result.summary).toMatch(/acknowledged/i);
  });

  it("maps in-progress and completed requests correctly", () => {
    expect(buildMaintenanceLifecycleView({ ...baseItem, status: "in_progress" }, "tenant").lifecycleState).toBe(
      "in_progress"
    );
    expect(buildMaintenanceLifecycleView({ ...baseItem, status: "completed" }, "tenant").lifecycleState).toBe(
      "completed"
    );
  });

  it("treats cancelled requests as needs attention", () => {
    const result = buildMaintenanceLifecycleView({ ...baseItem, status: "cancelled" }, "tenant");
    expect(result.lifecycleState).toBe("needs_attention");
    expect(result.needsAttention).toBe(true);
  });

  it("summarizes workspace counts and priority state", () => {
    const view = buildMaintenanceWorkspaceState(
      [
        baseItem,
        { ...baseItem, id: "maint-2", status: "reviewed" },
        { ...baseItem, id: "maint-3", status: "completed" },
      ],
      "landlord"
    );

    expect(view.counts.submitted).toBe(1);
    expect(view.counts.acknowledged).toBe(1);
    expect(view.counts.completed).toBe(1);
    expect(view.summaryTitle).toMatch(/waiting for review/i);
  });
});
