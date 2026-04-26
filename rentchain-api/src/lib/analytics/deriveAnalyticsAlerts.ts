import crypto from "crypto";
import type { AnalyticsAlert, AnalyticsAlertsStatusFilter, LandlordAnalyticsAlertsResponse } from "./alertTypes";
import type { LandlordAnalyticsSnapshotBase } from "./analyticsTypes";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function alertId(type: string, propertyId: string | null, period: string) {
  return crypto.createHash("sha256").update(`${type}:${propertyId || "portfolio"}:${period}`).digest("hex");
}

function severityCounts(alerts: AnalyticsAlert[]) {
  const active = alerts.filter((alert) => alert.status === "active");
  return {
    activeCount: active.length,
    highSeverityCount: active.filter((alert) => alert.severity === "high").length,
    mediumSeverityCount: active.filter((alert) => alert.severity === "medium").length,
    lowSeverityCount: active.filter((alert) => alert.severity === "low").length,
  };
}

function buildAlert(input: Omit<AnalyticsAlert, "id" | "notification"> & { period: string }) {
  return {
    ...input,
    id: alertId(input.type, input.propertyId || null, input.period),
    notification: {
      inAppEligible: true,
      emailEligible: input.status === "active" && input.severity !== "low",
      automationEligible: false,
    },
  } satisfies AnalyticsAlert;
}

function propertyNameById(snapshot: LandlordAnalyticsSnapshotBase, propertyId?: string | null) {
  if (!propertyId) return null;
  return snapshot.properties.find((property) => property.id === propertyId)?.name || null;
}

function actionLink(type: AnalyticsAlert["type"], propertyId?: string | null) {
  if (type === "lease_expiry") return { type: "review_leases", label: "Review leases", href: "/portfolio-health" };
  if (type === "high_vacancy" || type === "vacancy_increase") {
    return {
      type: "view_analytics",
      label: propertyId ? "View property analytics" : "View analytics",
      href: propertyId ? `/analytics?propertyId=${encodeURIComponent(propertyId)}` : "/analytics",
    };
  }
  if (type === "application_drop" || type === "application_conversion_drop" || type === "low_application_activity") {
    return { type: "review_applications", label: "Review applications", href: "/applications" };
  }
  return { type: "review_work_orders", label: "Review work orders", href: "/work-orders" };
}

export function deriveAnalyticsAlerts(params: {
  snapshot: LandlordAnalyticsSnapshotBase;
  status?: AnalyticsAlertsStatusFilter;
  now?: number;
}): LandlordAnalyticsAlertsResponse {
  const snapshot = params.snapshot;
  const period = snapshot.filters.period;
  const propertyId = snapshot.filters.propertyId;
  const currentIso =
    typeof params.now === "number" ? new Date(params.now).toISOString() : new Date(snapshot.filters.to).toISOString();
  const previous = snapshot.comparisons.previousPeriod;
  const deltas = snapshot.comparisons.deltas;
  const alerts: AnalyticsAlert[] = [];

  const leaseExpiryCount = snapshot.leasing.leasesEndingIn30Days;
  alerts.push(
    buildAlert({
      type: "lease_expiry",
      severity: leaseExpiryCount >= 3 ? "high" : "medium",
      status: leaseExpiryCount > 0 ? "active" : "resolved",
      title: "Leases ending soon",
      message:
        leaseExpiryCount > 0
          ? leaseExpiryCount === 1
            ? "1 lease ends within 30 days."
            : `${leaseExpiryCount} leases end within 30 days.`
          : "No leases are ending within the next 30 days.",
      propertyId,
      propertyName: propertyNameById(snapshot, propertyId),
      metricValue: leaseExpiryCount,
      previousMetricValue: null,
      period,
      detectedAt: snapshot.filters.to,
      lastEvaluatedAt: currentIso,
      actions: [actionLink("lease_expiry", propertyId)],
    })
  );

  const vacancyRate = snapshot.summary.vacancyRate || 0;
  const previousVacancyRate = previous.summary.vacancyRate || 0;
  alerts.push(
    buildAlert({
      type: "high_vacancy",
      severity: vacancyRate >= 0.35 ? "high" : "medium",
      status: snapshot.leasing.totalUnits > 0 && vacancyRate >= 0.2 ? "active" : "resolved",
      title: "Vacancy is elevated",
      message:
        snapshot.leasing.totalUnits > 0 && vacancyRate >= 0.2
          ? `Vacancy is ${Math.round(vacancyRate * 100)}% in the current view.`
          : "Vacancy is not elevated for this view.",
      propertyId,
      propertyName: propertyNameById(snapshot, propertyId),
      metricValue: vacancyRate,
      previousMetricValue: previousVacancyRate,
      period,
      detectedAt: snapshot.filters.to,
      lastEvaluatedAt: currentIso,
      actions: [actionLink("high_vacancy", propertyId)],
    })
  );

  const vacancyDelta = deltas.summary.vacancyRate.absoluteDelta || 0;
  alerts.push(
    buildAlert({
      type: "vacancy_increase",
      severity: vacancyDelta >= 0.2 ? "high" : "medium",
      status: deltas.summary.vacancyRate.direction === "worse" && vacancyDelta >= 0.1 ? "active" : "resolved",
      title: "Vacancy worsened",
      message:
        deltas.summary.vacancyRate.direction === "worse" && vacancyDelta >= 0.1
          ? `Vacancy increased from ${Math.round(previousVacancyRate * 100)}% to ${Math.round(vacancyRate * 100)}%.`
          : "Vacancy has not worsened meaningfully versus the prior period.",
      propertyId,
      propertyName: propertyNameById(snapshot, propertyId),
      metricValue: vacancyRate,
      previousMetricValue: previousVacancyRate,
      period,
      detectedAt: snapshot.filters.to,
      lastEvaluatedAt: currentIso,
      actions: [actionLink("vacancy_increase", propertyId)],
    })
  );

  const lowApplicationActive =
    snapshot.leasing.totalUnits > 0 &&
    (snapshot.applications.started === 0 ||
      (snapshot.applications.started <= 1 && snapshot.leasing.totalUnits >= 3));
  alerts.push(
    buildAlert({
      type: "low_application_activity",
      severity: snapshot.applications.started === 0 ? "medium" : "low",
      status: lowApplicationActive ? "active" : "resolved",
      title: "Application activity is low",
      message: lowApplicationActive
        ? snapshot.applications.started === 0
          ? "No applications started in the selected period."
          : "Application activity is light for the selected period."
        : "Application activity is not currently low for this view.",
      propertyId,
      propertyName: propertyNameById(snapshot, propertyId),
      metricValue: snapshot.applications.started,
      previousMetricValue: previous.applications.started,
      period,
      detectedAt: snapshot.filters.to,
      lastEvaluatedAt: currentIso,
      actions: [actionLink("low_application_activity", propertyId)],
    })
  );

  const conversionRate = snapshot.applications.conversionRate || 0;
  const previousConversionRate = previous.summary.applicationConversionRate || 0;
  const conversionDropActive =
    deltas.summary.applicationConversionRate.direction === "worse" &&
    previous.summary.applicationConversionRate != null &&
    previousConversionRate >= 0.2 &&
    previousConversionRate - conversionRate >= 0.2;
  alerts.push(
    buildAlert({
      type: "application_conversion_drop",
      severity: previousConversionRate - conversionRate >= 0.35 ? "high" : "medium",
      status: conversionDropActive ? "active" : "resolved",
      title: "Application conversion dropped",
      message: conversionDropActive
        ? `Application conversion fell from ${Math.round(previousConversionRate * 100)}% to ${Math.round(conversionRate * 100)}%.`
        : "Application conversion has not dropped materially versus the prior period.",
      propertyId,
      propertyName: propertyNameById(snapshot, propertyId),
      metricValue: conversionRate,
      previousMetricValue: previousConversionRate,
      period,
      detectedAt: snapshot.filters.to,
      lastEvaluatedAt: currentIso,
      actions: [actionLink("application_conversion_drop", propertyId)],
    })
  );

  const applicationsDropInsight = snapshot.insights.find((insight) => insight.type === "applications_drop");
  alerts.push(
    buildAlert({
      type: "application_drop",
      severity: applicationsDropInsight?.severity || "low",
      status: applicationsDropInsight ? "active" : "resolved",
      title: "Applications declined",
      message: applicationsDropInsight?.message || "Applications have not declined meaningfully versus the prior period.",
      propertyId: applicationsDropInsight?.propertyId || propertyId,
      propertyName: propertyNameById(snapshot, applicationsDropInsight?.propertyId || propertyId),
      metricValue: snapshot.applications.submitted,
      previousMetricValue: previous.applications.submitted,
      period,
      detectedAt: snapshot.filters.to,
      lastEvaluatedAt: currentIso,
      actions: [actionLink("application_drop", applicationsDropInsight?.propertyId || propertyId)],
    })
  );

  const maintenanceInsight = snapshot.insights.find((insight) => insight.type === "maintenance_cost_increase");
  const maintenanceCost = snapshot.maintenance.maintenanceCostCents;
  const previousMaintenanceCost = previous.summary.maintenanceCostCents;
  const maintenanceActive =
    Boolean(maintenanceInsight) ||
    (previousMaintenanceCost > 0 && maintenanceCost >= Math.max(50_000, previousMaintenanceCost * 1.5));
  alerts.push(
    buildAlert({
      type: "maintenance_cost_spike",
      severity: maintenanceCost >= Math.max(100_000, previousMaintenanceCost * 2) ? "high" : "medium",
      status: maintenanceActive ? "active" : "resolved",
      title: "Maintenance costs spiked",
      message: maintenanceActive
        ? maintenanceInsight?.message || "Maintenance costs are materially above the prior period."
        : "Maintenance costs are not elevated versus the prior period.",
      propertyId,
      propertyName: propertyNameById(snapshot, propertyId),
      metricValue: maintenanceCost,
      previousMetricValue: previousMaintenanceCost,
      period,
      detectedAt: snapshot.filters.to,
      lastEvaluatedAt: currentIso,
      actions: [actionLink("maintenance_cost_spike", propertyId)],
    })
  );

  const workOrderInsight = snapshot.insights.find((insight) => insight.type === "work_order_concentration");
  alerts.push(
    buildAlert({
      type: "work_order_concentration",
      severity: workOrderInsight?.severity || "medium",
      status: workOrderInsight ? "active" : "resolved",
      title: "Work orders are concentrated",
      message: workOrderInsight?.message || "Open work orders are not concentrated in one property right now.",
      propertyId: workOrderInsight?.propertyId || propertyId,
      propertyName: propertyNameById(snapshot, workOrderInsight?.propertyId || propertyId),
      metricValue: snapshot.maintenance.openWorkOrders,
      previousMetricValue: previous.summary.openWorkOrders,
      period,
      detectedAt: snapshot.filters.to,
      lastEvaluatedAt: currentIso,
      actions: [actionLink("work_order_concentration", workOrderInsight?.propertyId || propertyId)],
    })
  );

  const statusFilter = params.status || "active";
  const filtered =
    statusFilter === "all" ? alerts : alerts.filter((alert) => alert.status === statusFilter);

  return {
    summary: severityCounts(alerts),
    alerts: filtered.sort((a, b) => {
      const severityRank = { high: 3, medium: 2, low: 1 };
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      if (severityRank[b.severity] !== severityRank[a.severity]) return severityRank[b.severity] - severityRank[a.severity];
      return a.title.localeCompare(b.title);
    }),
    filters: {
      period,
      propertyId: asString(propertyId, 240) || null,
      status: statusFilter,
    },
  };
}
