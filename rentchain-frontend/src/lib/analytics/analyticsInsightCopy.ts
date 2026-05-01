import type { AnalyticsAlert } from "@/api/landlordAnalyticsAlertsApi";
import type {
  LandlordAgentDecision,
  LandlordAnalyticsInsight,
  LandlordPredictiveMetric,
} from "@/api/landlordAnalyticsApi";

export type AnalyticsTheme =
  | "vacancy"
  | "lease_expiry"
  | "applications"
  | "maintenance"
  | "revenue"
  | "property_focus"
  | "other";

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${Math.round(value * 100)}%`;
}

function formatCurrency(cents: number | null | undefined) {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCount(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.round(value));
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

function isHiddenSupportKey(key: string) {
  return key === "propertyId" || key === "topPropertyId" || key.endsWith("Id");
}

function hasDisplayValue(value: unknown) {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  return false;
}

function mappedSupportLine(metric: LandlordPredictiveMetric, key: string, value: unknown): string | null {
  if (isHiddenSupportKey(key) || !hasDisplayValue(value)) return null;

  switch (key) {
    case "vacancyRate": {
      const formatted = formatPercent(typeof value === "number" ? value : null);
      return formatted ? `Current vacancy: ${formatted}` : null;
    }
    case "worseningVsPrior": {
      const numeric = typeof value === "number" ? value : null;
      if (numeric == null) return null;
      if (metric.key === "projected_vacancy_risk") {
        const formatted = formatPercent(numeric);
        return formatted ? `Vacancy change vs prior period: ${formatted}` : null;
      }
      if (metric.key === "projected_application_slowdown_risk") {
        return `Applications down vs prior period: ${Math.round(numeric)}`;
      }
      return null;
    }
    case "vacantUnits": {
      const formatted = formatCount(value as number | string | null | undefined);
      return formatted ? `Vacant units: ${formatted}` : null;
    }
    case "leasesEndingSoon": {
      const formatted = formatCount(value as number | string | null | undefined);
      return formatted ? `Leases ending soon: ${formatted}` : null;
    }
    case "topPropertyVacancyRate": {
      const formatted = formatPercent(typeof value === "number" ? value : null);
      return formatted ? `Highest property vacancy: ${formatted}` : null;
    }
    case "topPropertyLeaseExpiries": {
      const formatted = formatCount(value as number | string | null | undefined);
      return formatted ? `Most lease expiries at one property: ${formatted}` : null;
    }
    case "topPropertyShare":
    case "topPropertyMaintenanceShare": {
      const formatted = formatPercent(typeof value === "number" ? value : null);
      return formatted ? `Share concentrated in one property: ${formatted}` : null;
    }
    case "openWorkOrders": {
      const formatted = formatCount(value as number | string | null | undefined);
      return formatted ? `Open work orders: ${formatted}` : null;
    }
    case "maintenanceCostCents": {
      const formatted = formatCurrency(typeof value === "number" ? value : null);
      return formatted ? `Maintenance cost in view: ${formatted}` : null;
    }
    case "worseningVsPriorCents": {
      const formatted = formatCurrency(typeof value === "number" ? value : null);
      return formatted ? `Cost change vs prior period: ${formatted}` : null;
    }
    case "submittedCurrent": {
      const formatted = formatCount(value as number | string | null | undefined);
      return formatted ? `Current submitted applications: ${formatted}` : null;
    }
    case "submittedPrior": {
      const formatted = formatCount(value as number | string | null | undefined);
      return formatted ? `Prior submitted applications: ${formatted}` : null;
    }
    case "conversionCurrent": {
      const formatted = formatPercent(typeof value === "number" ? value : null);
      return formatted ? `Current conversion rate: ${formatted}` : null;
    }
    case "conversionPrior": {
      const formatted = formatPercent(typeof value === "number" ? value : null);
      return formatted ? `Prior conversion rate: ${formatted}` : null;
    }
    case "estimatedScheduledRentCents": {
      const formatted = formatCurrency(typeof value === "number" ? value : null);
      return formatted ? `Scheduled rent: ${formatted}` : null;
    }
    case "priorEstimatedScheduledRentCents": {
      const formatted = formatCurrency(typeof value === "number" ? value : null);
      return formatted ? `Prior scheduled rent: ${formatted}` : null;
    }
    case "relativeDelta": {
      const formatted = formatPercent(typeof value === "number" ? value : null);
      return formatted ? `Relative change: ${formatted}` : null;
    }
    case "applicationVolume": {
      const formatted = formatCount(value as number | string | null | undefined);
      return formatted ? `Applications in view: ${formatted}` : null;
    }
    default:
      return null;
  }
}

export function formatPredictiveSupportingValues(metric: LandlordPredictiveMetric): string | null {
  const supportingValues = metric.supportingValues;
  if (!supportingValues) return null;

  const lines = Object.entries(supportingValues)
    .map(([key, value]) => mappedSupportLine(metric, key, value))
    .filter((line): line is string => Boolean(line))
    .slice(0, 2);

  return lines.length ? lines.join(" • ") : null;
}

export function derivePredictiveMetricTheme(metric: LandlordPredictiveMetric): AnalyticsTheme {
  switch (metric.key) {
    case "projected_vacancy_risk":
      return "vacancy";
    case "projected_lease_expiry_concentration":
      return "lease_expiry";
    case "projected_maintenance_burden_risk":
      return "maintenance";
    case "projected_application_slowdown_risk":
      return "applications";
    case "projected_revenue_pressure_signal":
      return "revenue";
    default:
      return "other";
  }
}

export function deriveAlertTheme(alert: AnalyticsAlert): AnalyticsTheme {
  switch (alert.type) {
    case "high_vacancy":
    case "vacancy_increase":
      return "vacancy";
    case "lease_expiry":
      return "lease_expiry";
    case "application_drop":
    case "application_conversion_drop":
    case "low_application_activity":
      return "applications";
    case "maintenance_cost_spike":
    case "work_order_concentration":
      return "maintenance";
    default:
      return "other";
  }
}

export function deriveDecisionTheme(decision: LandlordAgentDecision): AnalyticsTheme {
  switch (decision.decisionType) {
    case "reduce_vacancy_risk":
      return "vacancy";
    case "review_lease_renewals":
      return "lease_expiry";
    case "improve_application_conversion":
      return "applications";
    case "address_maintenance_backlog":
    case "approve_maintenance_cost":
      return "maintenance";
    case "review_revenue_pressure":
      return "revenue";
    case "focus_highest_risk_property":
      return "property_focus";
    default:
      return "other";
  }
}

export function deriveInsightTheme(insight: LandlordAnalyticsInsight): AnalyticsTheme {
  switch (insight.type) {
    case "vacancy_concentration":
    case "vacancy_risk":
      return "vacancy";
    case "lease_expiry":
    case "lease_expiry_concentration":
      return "lease_expiry";
    case "applications_drop":
      return "applications";
    case "maintenance_cost_increase":
    case "maintenance_concentration":
    case "work_order_concentration":
      return "maintenance";
    case "vacancy_leader":
    case "application_conversion_leader":
    case "rent_leader":
      return "other";
    default:
      return "other";
  }
}

function isComparativeLeaderInsight(insight: LandlordAnalyticsInsight) {
  return (
    insight.type === "vacancy_leader" ||
    insight.type === "application_conversion_leader" ||
    insight.type === "rent_leader"
  );
}

export function shouldRenderInsightCard(params: {
  insight: LandlordAnalyticsInsight;
  alerts: AnalyticsAlert[];
  decisions: LandlordAgentDecision[];
}): boolean {
  const { insight, alerts, decisions } = params;
  if (isComparativeLeaderInsight(insight)) return true;

  const theme = deriveInsightTheme(insight);
  if (theme === "other") return true;

  const coveredByAlert = alerts.some((alert) => alert.status === "active" && deriveAlertTheme(alert) === theme);
  const coveredByDecision = decisions.some((decision) => deriveDecisionTheme(decision) === theme);

  return !(coveredByAlert || coveredByDecision);
}

export function analyticsInsightIntroCopy() {
  return "Distinct portfolio patterns worth reviewing after alerts and next actions.";
}

export function analyticsAlertNextStepCopy(alert: AnalyticsAlert): string {
  const theme = deriveAlertTheme(alert);

  switch (theme) {
    case "vacancy":
      return "Next step: review the affected property view, then check pricing, listing quality, and lead follow-up before dismissing this alert.";
    case "lease_expiry":
      return "Next step: open lease renewals and confirm the leases, dates, and renewal inputs that need landlord follow-through.";
    case "applications":
      return "Next step: review submitted applications and conversion friction before changing leasing or applicant follow-up.";
    case "maintenance":
      return "Next step: review the affected work orders and costs, then decide which records need landlord follow-up first.";
    default:
      return "Next step: open the linked workspace and review the affected records before dismissing this alert.";
  }
}

export function predictiveMetricNextReviewCopy(metric: LandlordPredictiveMetric): string {
  const theme = derivePredictiveMetricTheme(metric);

  switch (theme) {
    case "vacancy":
      return "Next review: check vacancy readiness, listing quality, pricing, and lead follow-up for the affected property.";
    case "lease_expiry":
      return "Next review: check renewal timing, tenant response status, and the lease inputs needed before notices or turnover planning.";
    case "applications":
      return "Next review: compare current submitted applications with prior demand and inspect where applicants may be stalling.";
    case "maintenance":
      return "Next review: inspect open work orders, cost concentration, and follow-up records before changing maintenance priorities.";
    case "revenue":
      return "Next review: compare scheduled rent movement with vacancy and renewal pressure before changing portfolio assumptions.";
    default:
      return "Next review: compare this signal with alerts and recommended actions before changing operations.";
  }
}

export function insightNextStepCopy(insight: LandlordAnalyticsInsight): string {
  const theme = deriveInsightTheme(insight);

  switch (theme) {
    case "vacancy":
      return "Next step: compare this vacancy pattern with alerts and recommended actions, then review the affected property context.";
    case "lease_expiry":
      return "Next step: compare this renewal pattern with the lease-renewal workspace before changing follow-up timing.";
    case "applications":
      return "Next step: compare this application pattern with submitted applications and applicant follow-up before changing process.";
    case "maintenance":
      return "Next step: compare this maintenance pattern with work orders and cost records before changing priorities.";
    case "revenue":
      return "Next step: compare this revenue pattern with vacancy, renewals, and scheduled rent before changing assumptions.";
    case "property_focus":
      return "Next step: review the focused property alongside alerts and recommended actions before shifting operational attention.";
    default:
      return "Next step: compare this pattern with alerts and recommended actions before changing operations.";
  }
}

export function decisionNextStepCopy(decision: LandlordAgentDecision): string {
  const theme = deriveDecisionTheme(decision);

  switch (theme) {
    case "vacancy":
      return "Recommended next step: open the linked workspace to review vacancy readiness and decide the landlord follow-up.";
    case "lease_expiry":
      return "Recommended next step: open the linked renewal view to review dates, tenant response state, and required inputs.";
    case "applications":
      return "Recommended next step: open the linked applications view to inspect submitted applications and conversion friction.";
    case "maintenance":
      return "Recommended next step: open the linked work order view to inspect the affected records before changing priorities.";
    case "revenue":
      return "Recommended next step: open the linked analytics view to review revenue pressure in context.";
    case "property_focus":
      return "Recommended next step: open the linked property focus view and compare the current signals before shifting attention.";
    default:
      return "Recommended next step: open the linked workspace and review the affected records.";
  }
}
