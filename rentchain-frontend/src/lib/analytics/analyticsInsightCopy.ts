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
