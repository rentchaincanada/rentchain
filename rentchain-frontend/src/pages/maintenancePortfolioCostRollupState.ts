import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";

export type MaintenancePortfolioUnitSummary = {
  unitId: string | null;
  unitLabel: string;
  activityCount: number;
  openCount: number;
  inProgressCount: number;
  reopenedOrEscalatedCount: number;
  recordedCostCents: number;
};

export type MaintenancePortfolioPropertySummary = {
  propertyId: string;
  propertyLabel: string;
  totalRecordedCostCents: number;
  totalLinkedExpenseCostCents: number;
  totalUnlinkedCostCents: number;
  requestCount: number;
  openCount: number;
  inProgressCount: number;
  completedCount: number;
  reopenedOrEscalatedCount: number;
  linkedExpenseCount: number;
  unlinkedRecordedCostCount: number;
  nextActions: string[];
  insightFlags: Array<"has_unlinked_cost" | "has_open_work" | "has_reopened_attention">;
  unitSummaries: MaintenancePortfolioUnitSummary[];
};

export type MaintenancePortfolioCostRollupView = {
  propertyCount: number;
  totalRecordedCostCents: number;
  totalLinkedExpenseCostCents: number;
  totalUnlinkedCostCents: number;
  requestCount: number;
  openCount: number;
  inProgressCount: number;
  completedCount: number;
  reopenedOrEscalatedCount: number;
  linkedExpenseCount: number;
  unlinkedRecordedCostCount: number;
  summaryTitle: string;
  summaryDescription: string;
  nextSteps: string[];
  insightFlags: Array<"has_unlinked_cost" | "has_open_work" | "has_reopened_attention">;
  propertySummaries: MaintenancePortfolioPropertySummary[];
};

function normalizedStatus(item: MaintenanceWorkflowItem) {
  return String(item.status || "").trim().toLowerCase();
}

function propertyLabel(item: MaintenanceWorkflowItem) {
  return String(item.propertyLabel || item.propertyId || "Unassigned property").trim() || "Unassigned property";
}

function unitLabel(item: MaintenanceWorkflowItem) {
  return String(item.unitLabel || item.unitId || "General property area").trim() || "General property area";
}

function recordedCostCents(item: MaintenanceWorkflowItem) {
  return typeof item.cost?.actualCostCents === "number" ? Math.max(0, item.cost.actualCostCents) : 0;
}

function hasLinkedExpense(item: MaintenanceWorkflowItem) {
  return item.expenseLink?.status === "linked" || item.cost?.linkedExpenseStatus === "linked";
}

function isOpenRequest(item: MaintenanceWorkflowItem) {
  return !["completed", "cancelled"].includes(normalizedStatus(item));
}

function isInProgressRequest(item: MaintenanceWorkflowItem) {
  return ["assigned", "scheduled", "in_progress", "blocked"].includes(normalizedStatus(item));
}

function isCompletedRequest(item: MaintenanceWorkflowItem) {
  return normalizedStatus(item) === "completed";
}

function isReopenedOrEscalated(item: MaintenanceWorkflowItem) {
  return (
    typeof item.reopenedAt === "number" ||
    item.followUpRequired === true ||
    item.resolutionStatus === "follow_up_required" ||
    item.tenantSignoffStatus === "declined" ||
    item.reworkReview?.status === "follow_up_required" ||
    item.reworkReview?.tenantSignoffStatus === "declined"
  );
}

function unitKey(item: MaintenanceWorkflowItem) {
  return String(item.unitId || item.unitLabel || "__general__");
}

function sortUnits(units: MaintenancePortfolioUnitSummary[]) {
  return [...units].sort((a, b) => {
    if (b.activityCount !== a.activityCount) return b.activityCount - a.activityCount;
    if (b.recordedCostCents !== a.recordedCostCents) return b.recordedCostCents - a.recordedCostCents;
    return a.unitLabel.localeCompare(b.unitLabel);
  });
}

function sortProperties(properties: MaintenancePortfolioPropertySummary[]) {
  return [...properties].sort((a, b) => {
    if (b.totalRecordedCostCents !== a.totalRecordedCostCents) return b.totalRecordedCostCents - a.totalRecordedCostCents;
    if (b.reopenedOrEscalatedCount !== a.reopenedOrEscalatedCount) return b.reopenedOrEscalatedCount - a.reopenedOrEscalatedCount;
    if (b.openCount !== a.openCount) return b.openCount - a.openCount;
    return a.propertyLabel.localeCompare(b.propertyLabel);
  });
}

export function buildMaintenancePortfolioCostRollupView(
  items: MaintenanceWorkflowItem[]
): MaintenancePortfolioCostRollupView {
  const propertyMap = new Map<
    string,
    {
      propertyId: string;
      propertyLabel: string;
      totalRecordedCostCents: number;
      totalLinkedExpenseCostCents: number;
      totalUnlinkedCostCents: number;
      requestCount: number;
      openCount: number;
      inProgressCount: number;
      completedCount: number;
      reopenedOrEscalatedCount: number;
      linkedExpenseCount: number;
      unlinkedRecordedCostCount: number;
      unitMap: Map<string, MaintenancePortfolioUnitSummary>;
    }
  >();

  let totalRecordedCostCents = 0;
  let totalLinkedExpenseCostCents = 0;
  let totalUnlinkedCostCents = 0;
  let openCount = 0;
  let inProgressCount = 0;
  let completedCount = 0;
  let reopenedOrEscalatedCount = 0;
  let linkedExpenseCount = 0;
  let unlinkedRecordedCostCount = 0;

  items.forEach((item) => {
    const propertyId = String(item.propertyId || "__unassigned__");
    const nextProperty =
      propertyMap.get(propertyId) ||
      {
        propertyId,
        propertyLabel: propertyLabel(item),
        totalRecordedCostCents: 0,
        totalLinkedExpenseCostCents: 0,
        totalUnlinkedCostCents: 0,
        requestCount: 0,
        openCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        reopenedOrEscalatedCount: 0,
        linkedExpenseCount: 0,
        unlinkedRecordedCostCount: 0,
        unitMap: new Map<string, MaintenancePortfolioUnitSummary>(),
      };

    nextProperty.requestCount += 1;
    const recordedCost = recordedCostCents(item);
    const linkedExpense = hasLinkedExpense(item);
    const reopened = isReopenedOrEscalated(item);
    const isOpen = isOpenRequest(item);
    const isProgress = isInProgressRequest(item);
    const isCompleted = isCompletedRequest(item);

    nextProperty.totalRecordedCostCents += recordedCost;
    totalRecordedCostCents += recordedCost;

    if (linkedExpense && recordedCost > 0) {
      nextProperty.totalLinkedExpenseCostCents += recordedCost;
      totalLinkedExpenseCostCents += recordedCost;
      nextProperty.linkedExpenseCount += 1;
      linkedExpenseCount += 1;
    } else if (recordedCost > 0) {
      nextProperty.totalUnlinkedCostCents += recordedCost;
      totalUnlinkedCostCents += recordedCost;
      nextProperty.unlinkedRecordedCostCount += 1;
      unlinkedRecordedCostCount += 1;
    }

    if (isOpen) {
      nextProperty.openCount += 1;
      openCount += 1;
    }
    if (isProgress) {
      nextProperty.inProgressCount += 1;
      inProgressCount += 1;
    }
    if (isCompleted) {
      nextProperty.completedCount += 1;
      completedCount += 1;
    }
    if (reopened) {
      nextProperty.reopenedOrEscalatedCount += 1;
      reopenedOrEscalatedCount += 1;
    }

    const currentUnit =
      nextProperty.unitMap.get(unitKey(item)) || {
        unitId: item.unitId || null,
        unitLabel: unitLabel(item),
        activityCount: 0,
        openCount: 0,
        inProgressCount: 0,
        reopenedOrEscalatedCount: 0,
        recordedCostCents: 0,
      };
    currentUnit.activityCount += 1;
    currentUnit.recordedCostCents += recordedCost;
    if (isOpen) currentUnit.openCount += 1;
    if (isProgress) currentUnit.inProgressCount += 1;
    if (reopened) currentUnit.reopenedOrEscalatedCount += 1;
    nextProperty.unitMap.set(unitKey(item), currentUnit);
    propertyMap.set(propertyId, nextProperty);
  });

  const propertySummaries = sortProperties(
    Array.from(propertyMap.values()).map((property) => {
      const insightFlags: MaintenancePortfolioPropertySummary["insightFlags"] = [];
      const nextActions: string[] = [];
      if (property.totalUnlinkedCostCents > 0) {
        insightFlags.push("has_unlinked_cost");
        nextActions.push("Review recorded maintenance costs that are not linked to expenses yet.");
      }
      if (property.openCount > 0) {
        insightFlags.push("has_open_work");
        nextActions.push("Keep open maintenance work moving so requests do not linger at the property level.");
      }
      if (property.reopenedOrEscalatedCount > 0) {
        insightFlags.push("has_reopened_attention");
        nextActions.push("Review reopened or escalated requests to see where follow-up is recurring.");
      }
      if (!nextActions.length) {
        nextActions.push("This property’s maintenance record is currently in a stable tracked state.");
      }

      return {
        propertyId: property.propertyId,
        propertyLabel: property.propertyLabel,
        totalRecordedCostCents: property.totalRecordedCostCents,
        totalLinkedExpenseCostCents: property.totalLinkedExpenseCostCents,
        totalUnlinkedCostCents: property.totalUnlinkedCostCents,
        requestCount: property.requestCount,
        openCount: property.openCount,
        inProgressCount: property.inProgressCount,
        completedCount: property.completedCount,
        reopenedOrEscalatedCount: property.reopenedOrEscalatedCount,
        linkedExpenseCount: property.linkedExpenseCount,
        unlinkedRecordedCostCount: property.unlinkedRecordedCostCount,
        nextActions,
        insightFlags,
        unitSummaries: sortUnits(Array.from(property.unitMap.values())),
      };
    })
  );

  const insightFlags: MaintenancePortfolioCostRollupView["insightFlags"] = [];
  const nextSteps: string[] = [];
  if (totalUnlinkedCostCents > 0) {
    insightFlags.push("has_unlinked_cost");
    nextSteps.push("Review recorded maintenance cost that still needs an expense link.");
  }
  if (openCount > 0) {
    insightFlags.push("has_open_work");
    nextSteps.push("Use the request list to move open maintenance work through scheduling, service, and closure.");
  }
  if (reopenedOrEscalatedCount > 0) {
    insightFlags.push("has_reopened_attention");
    nextSteps.push("Pay attention to properties with repeated follow-up so reopened issues stay visible.");
  }
  if (!nextSteps.length) {
    nextSteps.push("The current maintenance portfolio in view is recorded and operationally stable.");
  }

  return {
    propertyCount: propertySummaries.length,
    totalRecordedCostCents,
    totalLinkedExpenseCostCents,
    totalUnlinkedCostCents,
    requestCount: items.length,
    openCount,
    inProgressCount,
    completedCount,
    reopenedOrEscalatedCount,
    linkedExpenseCount,
    unlinkedRecordedCostCount,
    summaryTitle:
      propertySummaries.length > 0 ? "Maintenance cost and property insights" : "No maintenance portfolio activity in view",
    summaryDescription:
      propertySummaries.length > 0
        ? `${propertySummaries.length} propert${propertySummaries.length === 1 ? "y" : "ies"} currently have visible maintenance history in this workspace.`
        : "Property-level maintenance rollups will appear here once requests are visible in the landlord maintenance workspace.",
    nextSteps,
    insightFlags,
    propertySummaries,
  };
}
