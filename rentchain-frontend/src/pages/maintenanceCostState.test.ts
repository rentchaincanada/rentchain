import { describe, expect, it } from "vitest";
import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";
import { buildMaintenanceCostView } from "./maintenanceCostState";

function makeItem(overrides: Partial<MaintenanceWorkflowItem> = {}): MaintenanceWorkflowItem {
  return {
    id: "maint-1",
    workOrderId: "maintenance_maint-1",
    tenantId: "tenant-1",
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    title: "Repair sink",
    description: "Kitchen sink leak.",
    category: "PLUMBING",
    priority: "normal",
    status: "completed",
    createdAt: 1,
    updatedAt: 2,
    resolutionStatus: "resolved",
    tenantSignoffStatus: "accepted",
    finalResolvedAt: 5,
    statusHistory: [],
    ...overrides,
  };
}

describe("buildMaintenanceCostView", () => {
  it("returns no_cost_recorded when closure is ready but no cost exists", () => {
    const view = buildMaintenanceCostView(makeItem(), "landlord");
    expect(view.costState).toBe("no_cost_recorded");
    expect(view.canRecordCost).toBe(true);
    expect(view.nextSteps).toContain(
      "Record the total cost and any labor, material, or vendor breakdown that is available."
    );
  });

  it("returns cost_recorded with a breakdown when settled cost is present", () => {
    const view = buildMaintenanceCostView(
      makeItem({
        cost: {
          actualCostCents: 24500,
          currency: "CAD",
          reviewStatus: "approved",
          reviewNote: "Recorded after final closure.",
          linkedExpenseStatus: "not_linked",
        },
        costLineItems: [
          { id: "labor", label: "Labor cost", amountCents: 15000, category: "labor" },
          { id: "materials", label: "Material cost", amountCents: 5000, category: "materials" },
          { id: "vendor", label: "Vendor cost", amountCents: 4500, category: "other" },
        ],
      }),
      "landlord"
    );

    expect(view.costState).toBe("cost_recorded");
    expect(view.totalCostCents).toBe(24500);
    expect(view.breakdown.laborCostCents).toBe(15000);
    expect(view.breakdown.materialCostCents).toBe(5000);
    expect(view.breakdown.vendorCostCents).toBe(4500);
    expect(view.canLinkExpense).toBe(true);
  });

  it("returns cost_needs_review when the breakdown does not match the recorded total", () => {
    const view = buildMaintenanceCostView(
      makeItem({
        cost: {
          actualCostCents: 24500,
          currency: "CAD",
          reviewStatus: "approved",
          linkedExpenseStatus: "not_linked",
        },
        costLineItems: [{ id: "labor", label: "Labor cost", amountCents: 20000, category: "labor" }],
      }),
      "landlord"
    );

    expect(view.costState).toBe("cost_needs_review");
    expect(view.blockers).toContain("The recorded total cost does not match the current cost breakdown.");
  });

  it("blocks cost capture until the request reaches a clean closure state", () => {
    const view = buildMaintenanceCostView(
      makeItem({
        resolutionStatus: "follow_up_required",
        tenantSignoffStatus: "declined",
        finalResolvedAt: null,
      }),
      "landlord"
    );

    expect(view.canRecordCost).toBe(false);
    expect(view.readinessLabel).toBe("Not ready for cost capture");
  });
});
