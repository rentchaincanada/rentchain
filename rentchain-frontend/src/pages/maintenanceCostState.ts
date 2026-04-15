import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";

type Audience = "landlord";

export type MaintenanceCostState = "no_cost_recorded" | "cost_recorded" | "cost_needs_review";

export type MaintenanceCostBreakdown = {
  laborCostCents: number | null;
  materialCostCents: number | null;
  vendorCostCents: number | null;
};

export type MaintenanceCostView = {
  costState: MaintenanceCostState;
  costLabel: string;
  readinessLabel: string;
  summary: string;
  nextSteps: string[];
  blockers: string[];
  totalCostCents: number | null;
  currency: string;
  note: string | null;
  breakdown: MaintenanceCostBreakdown;
  lineItemTotalCents: number | null;
  hasExpenseLink: boolean;
  linkedExpenseId: string | null;
  canRecordCost: boolean;
  canLinkExpense: boolean;
};

function statusOf(item: MaintenanceWorkflowItem) {
  return String(item.status || "").trim().toLowerCase();
}

function hasResolvedClosure(item: MaintenanceWorkflowItem) {
  return (
    typeof item.finalResolvedAt === "number" ||
    item.resolutionStatus === "resolved" ||
    item.tenantSignoffStatus === "accepted" ||
    item.reworkReview?.status === "closed" ||
    item.reworkReview?.tenantSignoffStatus === "accepted"
  );
}

function needsFollowUp(item: MaintenanceWorkflowItem) {
  return (
    item.followUpRequired === true ||
    item.resolutionStatus === "follow_up_required" ||
    item.tenantSignoffStatus === "declined" ||
    item.reworkReview?.status === "follow_up_required" ||
    item.reworkReview?.tenantSignoffStatus === "declined" ||
    typeof item.reopenedAt === "number"
  );
}

function isClosureReady(item: MaintenanceWorkflowItem) {
  return statusOf(item) === "completed" && hasResolvedClosure(item) && !needsFollowUp(item);
}

function sumByCategory(item: MaintenanceWorkflowItem): MaintenanceCostBreakdown & { lineItemTotalCents: number | null } {
  const lineItems = Array.isArray(item.costLineItems) ? item.costLineItems : [];
  if (!lineItems.length) {
    return {
      laborCostCents: null,
      materialCostCents: null,
      vendorCostCents: null,
      lineItemTotalCents: null,
    };
  }

  let laborCostCents = 0;
  let materialCostCents = 0;
  let vendorCostCents = 0;
  let lineItemTotalCents = 0;

  lineItems.forEach((entry) => {
    const amount = typeof entry?.amountCents === "number" ? entry.amountCents : 0;
    lineItemTotalCents += amount;
    if (entry?.category === "labor") {
      laborCostCents += amount;
      return;
    }
    if (entry?.category === "materials") {
      materialCostCents += amount;
      return;
    }
    vendorCostCents += amount;
  });

  return {
    laborCostCents: laborCostCents || null,
    materialCostCents: materialCostCents || null,
    vendorCostCents: vendorCostCents || null,
    lineItemTotalCents,
  };
}

function costLabel(state: MaintenanceCostState) {
  switch (state) {
    case "cost_recorded":
      return "Cost recorded";
    case "cost_needs_review":
      return "Cost needs review";
    case "no_cost_recorded":
    default:
      return "No cost recorded";
  }
}

export function buildMaintenanceCostView(item: MaintenanceWorkflowItem, _audience: Audience): MaintenanceCostView {
  const blockers: string[] = [];
  const nextSteps: string[] = [];
  const totalCostCents = typeof item.cost?.actualCostCents === "number" ? item.cost.actualCostCents : null;
  const currency = String(item.cost?.currency || "CAD").trim() || "CAD";
  const note = typeof item.cost?.reviewNote === "string" ? item.cost.reviewNote : null;
  const hasExpenseLink = item.expenseLink?.status === "linked" || item.cost?.linkedExpenseStatus === "linked";
  const linkedExpenseId =
    (typeof item.expenseLink?.expenseId === "string" && item.expenseLink.expenseId) ||
    (typeof item.cost?.linkedExpenseId === "string" && item.cost.linkedExpenseId) ||
    null;
  const breakdown = sumByCategory(item);
  const closureReady = isClosureReady(item);
  const hasRecordedCost = typeof totalCostCents === "number" && totalCostCents > 0;
  const lineItemMismatch =
    hasRecordedCost &&
    typeof breakdown.lineItemTotalCents === "number" &&
    breakdown.lineItemTotalCents > 0 &&
    breakdown.lineItemTotalCents !== totalCostCents;
  const reviewStatus = item.cost?.reviewStatus || null;

  let costState: MaintenanceCostState = "no_cost_recorded";
  let summary = "No maintenance cost has been recorded for this request yet.";

  if (!closureReady) {
    blockers.push("Cost capture opens after service is resolved and the request has a clean closure state.");
  }
  if (!item.workOrderId) {
    blockers.push("A linked work order is required before cost can be recorded or linked to an expense.");
  }

  if (hasRecordedCost) {
    if (lineItemMismatch || reviewStatus === "rejected" || reviewStatus === "revision_requested") {
      costState = "cost_needs_review";
      summary =
        "A maintenance cost has been recorded, but the current cost details need review before this record is fully settled.";
      if (lineItemMismatch) {
        blockers.push("The recorded total cost does not match the current cost breakdown.");
      }
      if (reviewStatus === "rejected" || reviewStatus === "revision_requested") {
        blockers.push("The current cost record is not in a settled recorded state yet.");
      }
    } else {
      costState = "cost_recorded";
      summary = hasExpenseLink
        ? "Maintenance cost has been recorded and linked to an expense record."
        : "Maintenance cost has been recorded for this request.";
    }
  }

  if (!closureReady) {
    nextSteps.push("Finish the verification and closure steps before recording maintenance cost.");
  } else if (!hasRecordedCost) {
    nextSteps.push("Record the total cost and any labor, material, or vendor breakdown that is available.");
  } else if (costState === "cost_needs_review") {
    nextSteps.push("Review the cost totals and save an updated maintenance cost record.");
  } else if (!hasExpenseLink) {
    nextSteps.push("Link this recorded cost to an expense record when you are ready to track it in expenses.");
  } else {
    nextSteps.push("Cost is captured and linked. Keep this request for operational history and reporting context.");
  }

  return {
    costState,
    costLabel: costLabel(costState),
    readinessLabel: closureReady ? "Ready for cost capture" : "Not ready for cost capture",
    summary,
    nextSteps,
    blockers,
    totalCostCents,
    currency,
    note,
    breakdown: {
      laborCostCents: breakdown.laborCostCents,
      materialCostCents: breakdown.materialCostCents,
      vendorCostCents: breakdown.vendorCostCents,
    },
    lineItemTotalCents: breakdown.lineItemTotalCents,
    hasExpenseLink,
    linkedExpenseId,
    canRecordCost: closureReady && Boolean(item.workOrderId),
    canLinkExpense:
      closureReady &&
      Boolean(item.workOrderId) &&
      hasRecordedCost &&
      !hasExpenseLink &&
      (reviewStatus === "approved" || reviewStatus === null),
  };
}
