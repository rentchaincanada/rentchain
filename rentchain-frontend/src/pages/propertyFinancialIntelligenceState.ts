import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";
import { buildMaintenancePortfolioCostRollupView, type MaintenancePortfolioPropertySummary } from "./maintenancePortfolioCostRollupState";

export type PropertyFinancialIntelligenceFlag =
  | "high_maintenance_load"
  | "follow_up_heavy"
  | "needs_expense_review"
  | "cost_mostly_linked";

export type PropertyFinancialIntelligenceSummary = {
  propertyId: string;
  propertyLabel: string;
  maintenanceLoad: "high" | "moderate" | "stable";
  maintenanceLoadLabel: string;
  followUpPressure: "high" | "moderate" | "low";
  followUpPressureLabel: string;
  totalRecordedCostCents: number;
  totalLinkedCostCents: number;
  totalUnlinkedCostCents: number;
  openCount: number;
  inProgressCount: number;
  completedCount: number;
  reopenedOrEscalatedCount: number;
  topUnitLabel: string | null;
  unitActivityLabel: string;
  attentionFlags: PropertyFinancialIntelligenceFlag[];
  nextSteps: string[];
};

export type PropertyFinancialIntelligenceSpotlight = {
  label: string;
  propertyId: string | null;
  propertyLabel: string;
  valueLabel: string;
  supportingLabel: string;
};

export type PropertyFinancialIntelligenceView = {
  summaryTitle: string;
  summaryDescription: string;
  nextSteps: string[];
  highMaintenanceLoadCount: number;
  followUpHeavyCount: number;
  expenseReviewCount: number;
  propertySummaries: PropertyFinancialIntelligenceSummary[];
  rankedAttention: PropertyFinancialIntelligenceSummary[];
  spotlights: PropertyFinancialIntelligenceSpotlight[];
};

function fmtMoney(cents: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "CAD" }).format(cents / 100);
}

function maintenanceLoad(summary: MaintenancePortfolioPropertySummary) {
  if (summary.openCount >= 2 || summary.requestCount >= 4 || summary.totalRecordedCostCents >= 50000) {
    return { level: "high" as const, label: "High maintenance load" };
  }
  if (summary.openCount >= 1 || summary.requestCount >= 2 || summary.totalRecordedCostCents >= 20000) {
    return { level: "moderate" as const, label: "Moderate maintenance load" };
  }
  return { level: "stable" as const, label: "Stable maintenance load" };
}

function followUpPressure(summary: MaintenancePortfolioPropertySummary) {
  if (summary.reopenedOrEscalatedCount >= 2) {
    return { level: "high" as const, label: "Follow-up heavy" };
  }
  if (summary.reopenedOrEscalatedCount >= 1) {
    return { level: "moderate" as const, label: "Some follow-up pressure" };
  }
  return { level: "low" as const, label: "Follow-up pressure is low" };
}

function describeUnitActivity(summary: MaintenancePortfolioPropertySummary) {
  const topUnit = summary.unitSummaries[0];
  if (!topUnit) {
    return { topUnitLabel: null, label: "Activity is currently spread at the property level." };
  }
  if (summary.requestCount <= 1) {
    return { topUnitLabel: topUnit.unitLabel, label: `${topUnit.unitLabel} is the main visible activity area.` };
  }
  const share = topUnit.activityCount / summary.requestCount;
  if (share >= 0.5) {
    return { topUnitLabel: topUnit.unitLabel, label: `${topUnit.unitLabel} carries most visible maintenance activity.` };
  }
  return { topUnitLabel: topUnit.unitLabel, label: "Activity is spread across multiple units." };
}

function flagsFor(summary: MaintenancePortfolioPropertySummary): PropertyFinancialIntelligenceFlag[] {
  const flags: PropertyFinancialIntelligenceFlag[] = [];
  if (summary.openCount >= 2 || summary.requestCount >= 4 || summary.totalRecordedCostCents >= 50000) {
    flags.push("high_maintenance_load");
  }
  if (summary.reopenedOrEscalatedCount >= 1) {
    flags.push("follow_up_heavy");
  }
  if (summary.totalUnlinkedCostCents > 0) {
    flags.push("needs_expense_review");
  }
  if (
    summary.totalRecordedCostCents > 0 &&
    summary.totalLinkedExpenseCostCents === summary.totalRecordedCostCents &&
    summary.totalUnlinkedCostCents === 0
  ) {
    flags.push("cost_mostly_linked");
  }
  return flags;
}

function nextStepsFor(summary: MaintenancePortfolioPropertySummary, flags: PropertyFinancialIntelligenceFlag[]) {
  const steps: string[] = [];
  if (flags.includes("follow_up_heavy")) {
    steps.push("Review reopened or escalated requests to see whether follow-up work is repeating at this property.");
  }
  if (flags.includes("needs_expense_review")) {
    steps.push("Review recorded maintenance cost that still needs to be linked to an expense record.");
  }
  if (flags.includes("high_maintenance_load")) {
    steps.push("Prioritize open work at this property so operational pressure does not keep building.");
  }
  if (!steps.length) {
    steps.push("This property’s visible maintenance activity is currently in a stable tracked state.");
  }
  return steps;
}

function sortAttention(items: PropertyFinancialIntelligenceSummary[]) {
  return [...items].sort((a, b) => {
    if (b.reopenedOrEscalatedCount !== a.reopenedOrEscalatedCount) return b.reopenedOrEscalatedCount - a.reopenedOrEscalatedCount;
    if (b.openCount !== a.openCount) return b.openCount - a.openCount;
    if (b.totalUnlinkedCostCents !== a.totalUnlinkedCostCents) return b.totalUnlinkedCostCents - a.totalUnlinkedCostCents;
    if (b.totalRecordedCostCents !== a.totalRecordedCostCents) return b.totalRecordedCostCents - a.totalRecordedCostCents;
    return a.propertyLabel.localeCompare(b.propertyLabel);
  });
}

function buildSpotlight(
  label: string,
  summaries: PropertyFinancialIntelligenceSummary[],
  getValue: (item: PropertyFinancialIntelligenceSummary) => number,
  formatValue: (item: PropertyFinancialIntelligenceSummary) => string,
  emptyLabel: string,
  supportingLabel: (item: PropertyFinancialIntelligenceSummary) => string
): PropertyFinancialIntelligenceSpotlight {
  const winner = [...summaries].sort((a, b) => getValue(b) - getValue(a) || a.propertyLabel.localeCompare(b.propertyLabel))[0] || null;
  if (!winner || getValue(winner) <= 0) {
    return {
      label,
      propertyId: null,
      propertyLabel: "No property in view",
      valueLabel: emptyLabel,
      supportingLabel: "Visible maintenance requests will populate this insight.",
    };
  }
  return {
    label,
    propertyId: winner.propertyId,
    propertyLabel: winner.propertyLabel,
    valueLabel: formatValue(winner),
    supportingLabel: supportingLabel(winner),
  };
}

export function buildPropertyFinancialIntelligenceView(
  items: MaintenanceWorkflowItem[]
): PropertyFinancialIntelligenceView {
  const rollup = buildMaintenancePortfolioCostRollupView(items);

  const propertySummaries = rollup.propertySummaries.map((summary) => {
    const load = maintenanceLoad(summary);
    const pressure = followUpPressure(summary);
    const unitActivity = describeUnitActivity(summary);
    const attentionFlags = flagsFor(summary);

    return {
      propertyId: summary.propertyId,
      propertyLabel: summary.propertyLabel,
      maintenanceLoad: load.level,
      maintenanceLoadLabel: load.label,
      followUpPressure: pressure.level,
      followUpPressureLabel: pressure.label,
      totalRecordedCostCents: summary.totalRecordedCostCents,
      totalLinkedCostCents: summary.totalLinkedExpenseCostCents,
      totalUnlinkedCostCents: summary.totalUnlinkedCostCents,
      openCount: summary.openCount,
      inProgressCount: summary.inProgressCount,
      completedCount: summary.completedCount,
      reopenedOrEscalatedCount: summary.reopenedOrEscalatedCount,
      topUnitLabel: unitActivity.topUnitLabel,
      unitActivityLabel: unitActivity.label,
      attentionFlags,
      nextSteps: nextStepsFor(summary, attentionFlags),
    };
  });

  const rankedAttention = sortAttention(propertySummaries);
  const highMaintenanceLoadCount = propertySummaries.filter((item) => item.attentionFlags.includes("high_maintenance_load")).length;
  const followUpHeavyCount = propertySummaries.filter((item) => item.attentionFlags.includes("follow_up_heavy")).length;
  const expenseReviewCount = propertySummaries.filter((item) => item.attentionFlags.includes("needs_expense_review")).length;

  const nextSteps: string[] = [];
  if (followUpHeavyCount > 0) {
    nextSteps.push("Review properties with repeated follow-up first so closed work does not quietly come back.");
  }
  if (expenseReviewCount > 0) {
    nextSteps.push("Link recorded maintenance costs into expenses where they are still untracked.");
  }
  if (highMaintenanceLoadCount > 0) {
    nextSteps.push("Watch cost-heavy or open-heavy properties for rising operational pressure.");
  }
  if (!nextSteps.length) {
    nextSteps.push("Visible properties are currently in a stable maintenance state with no strong attention flags.");
  }

  return {
    summaryTitle: propertySummaries.length ? "Property financial intelligence" : "No property intelligence available yet",
    summaryDescription: propertySummaries.length
      ? "Property-level maintenance intelligence highlights cost burden, follow-up pressure, and expense review needs from visible requests."
      : "Property intelligence will appear here once maintenance requests are visible in the landlord workspace.",
    nextSteps,
    highMaintenanceLoadCount,
    followUpHeavyCount,
    expenseReviewCount,
    propertySummaries,
    rankedAttention,
    spotlights: [
      buildSpotlight(
        "Top maintenance cost",
        propertySummaries,
        (item) => item.totalRecordedCostCents,
        (item) => fmtMoney(item.totalRecordedCostCents),
        "-",
        (item) => `${item.openCount} open request${item.openCount === 1 ? "" : "s"} and ${item.completedCount} completed or closed.`
      ),
      buildSpotlight(
        "Top follow-up pressure",
        propertySummaries,
        (item) => item.reopenedOrEscalatedCount,
        (item) => `${item.reopenedOrEscalatedCount} reopened / escalated`,
        "No repeated follow-up",
        (item) => item.followUpPressureLabel
      ),
      buildSpotlight(
        "Unlinked cost burden",
        propertySummaries,
        (item) => item.totalUnlinkedCostCents,
        (item) => fmtMoney(item.totalUnlinkedCostCents),
        "No unlinked cost",
        () => "Recorded maintenance cost still needs expense review."
      ),
    ],
  };
}
