import { describe, expect, it } from "vitest";
import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";
import { buildMaintenancePortfolioCostRollupView } from "./maintenancePortfolioCostRollupState";

function makeItem(overrides: Partial<MaintenanceWorkflowItem>): MaintenanceWorkflowItem {
  return {
    id: "maint-1",
    tenantId: "tenant-1",
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    propertyLabel: "Harbour View",
    unitLabel: "Unit 101",
    title: "Leaky faucet",
    description: "Kitchen sink is leaking",
    category: "PLUMBING",
    priority: "normal",
    status: "submitted",
    createdAt: 100,
    updatedAt: 200,
    ...overrides,
  };
}

describe("maintenance portfolio cost rollup state", () => {
  it("summarizes property-level recorded, linked, and unlinked cost totals", () => {
    const view = buildMaintenancePortfolioCostRollupView([
      makeItem({
        id: "maint-1",
        status: "completed",
        cost: { actualCostCents: 24000, linkedExpenseStatus: "linked", currency: "CAD" },
        expenseLink: { status: "linked", expenseId: "expense-1" },
      }),
      makeItem({
        id: "maint-2",
        unitId: "unit-2",
        unitLabel: "Unit 102",
        status: "completed",
        cost: { actualCostCents: 18000, linkedExpenseStatus: "not_linked", currency: "CAD" },
      }),
    ]);

    expect(view.propertyCount).toBe(1);
    expect(view.totalRecordedCostCents).toBe(42000);
    expect(view.totalLinkedExpenseCostCents).toBe(24000);
    expect(view.totalUnlinkedCostCents).toBe(18000);
    expect(view.unlinkedRecordedCostCount).toBe(1);
    expect(view.propertySummaries[0]?.unitSummaries).toHaveLength(2);
  });

  it("tracks open, in-progress, completed, and reopened attention counts", () => {
    const view = buildMaintenancePortfolioCostRollupView([
      makeItem({ id: "maint-1", status: "submitted" }),
      makeItem({ id: "maint-2", status: "scheduled" }),
      makeItem({ id: "maint-3", status: "completed" }),
      makeItem({
        id: "maint-4",
        status: "completed",
        reopenedAt: Date.UTC(2026, 3, 20, 10, 0),
        followUpRequired: true,
        resolutionStatus: "follow_up_required",
      }),
    ]);

    expect(view.openCount).toBe(2);
    expect(view.inProgressCount).toBe(1);
    expect(view.completedCount).toBe(2);
    expect(view.reopenedOrEscalatedCount).toBe(1);
    expect(view.nextSteps.join(" ")).toMatch(/reopened issues/i);
  });

  it("splits summaries by property and sorts the highest-cost property first", () => {
    const view = buildMaintenancePortfolioCostRollupView([
      makeItem({
        id: "maint-1",
        propertyId: "prop-1",
        propertyLabel: "Harbour View",
        cost: { actualCostCents: 12000, linkedExpenseStatus: "not_linked", currency: "CAD" },
        status: "completed",
      }),
      makeItem({
        id: "maint-2",
        propertyId: "prop-2",
        propertyLabel: "Maple Court",
        cost: { actualCostCents: 48000, linkedExpenseStatus: "linked", currency: "CAD" },
        expenseLink: { status: "linked", expenseId: "expense-2" },
        status: "completed",
      }),
    ]);

    expect(view.propertyCount).toBe(2);
    expect(view.propertySummaries[0]?.propertyLabel).toBe("Maple Court");
    expect(view.propertySummaries[1]?.propertyLabel).toBe("Harbour View");
  });
});
