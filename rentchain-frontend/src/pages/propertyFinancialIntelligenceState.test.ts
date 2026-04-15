import { describe, expect, it } from "vitest";
import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";
import { buildPropertyFinancialIntelligenceView } from "./propertyFinancialIntelligenceState";

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

describe("property financial intelligence state", () => {
  it("derives transparent attention flags from visible maintenance activity", () => {
    const view = buildPropertyFinancialIntelligenceView([
      makeItem({
        id: "maint-1",
        propertyId: "prop-1",
        propertyLabel: "Harbour View",
        status: "scheduled",
        cost: { actualCostCents: 18000, linkedExpenseStatus: "not_linked", currency: "CAD" },
      }),
      makeItem({
        id: "maint-2",
        propertyId: "prop-1",
        propertyLabel: "Harbour View",
        unitId: "unit-2",
        unitLabel: "Unit 102",
        status: "completed",
        reopenedAt: Date.UTC(2026, 3, 20, 10, 0),
        followUpRequired: true,
        resolutionStatus: "follow_up_required",
      }),
    ]);

    expect(view.followUpHeavyCount).toBe(1);
    expect(view.expenseReviewCount).toBe(1);
    expect(view.rankedAttention[0]?.propertyLabel).toBe("Harbour View");
    expect(view.rankedAttention[0]?.attentionFlags).toContain("follow_up_heavy");
    expect(view.rankedAttention[0]?.attentionFlags).toContain("needs_expense_review");
  });

  it("identifies cost-heavy properties and stable linked-cost properties", () => {
    const view = buildPropertyFinancialIntelligenceView([
      makeItem({
        id: "maint-1",
        propertyId: "prop-1",
        propertyLabel: "Harbour View",
        status: "completed",
        cost: { actualCostCents: 52000, linkedExpenseStatus: "linked", currency: "CAD" },
        expenseLink: { status: "linked", expenseId: "expense-1" },
      }),
      makeItem({
        id: "maint-2",
        propertyId: "prop-2",
        propertyLabel: "Maple Court",
        status: "completed",
        cost: { actualCostCents: 12000, linkedExpenseStatus: "linked", currency: "CAD" },
        expenseLink: { status: "linked", expenseId: "expense-2" },
      }),
    ]);

    expect(view.highMaintenanceLoadCount).toBe(1);
    expect(view.spotlights[0]?.propertyLabel).toBe("Harbour View");
    expect(view.propertySummaries.find((item) => item.propertyLabel === "Maple Court")?.attentionFlags).toContain(
      "cost_mostly_linked"
    );
  });

  it("explains which unit carries most visible activity when requests concentrate in one place", () => {
    const view = buildPropertyFinancialIntelligenceView([
      makeItem({
        id: "maint-1",
        propertyId: "prop-1",
        propertyLabel: "Harbour View",
        unitId: "unit-1",
        unitLabel: "Unit 101",
      }),
      makeItem({
        id: "maint-2",
        propertyId: "prop-1",
        propertyLabel: "Harbour View",
        unitId: "unit-1",
        unitLabel: "Unit 101",
      }),
      makeItem({
        id: "maint-3",
        propertyId: "prop-1",
        propertyLabel: "Harbour View",
        unitId: "unit-2",
        unitLabel: "Unit 102",
      }),
    ]);

    expect(view.propertySummaries[0]?.topUnitLabel).toBe("Unit 101");
    expect(view.propertySummaries[0]?.unitActivityLabel).toMatch(/carries most visible maintenance activity/i);
  });
});
