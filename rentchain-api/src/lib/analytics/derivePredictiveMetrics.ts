import type {
  AnalyticsDeltaValue,
  LandlordAnalyticsSnapshot,
  LandlordPredictiveMetric,
  LandlordPredictiveMetrics,
  LandlordPropertyAnalytics,
} from "./analyticsTypes";

type PredictiveInput = Pick<LandlordAnalyticsSnapshot, "summary" | "leasing" | "maintenance" | "revenue" | "comparisons" | "propertyMetrics">;

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function worsenBy(delta: AnalyticsDeltaValue | undefined) {
  return delta?.direction === "worse" ? asNumber(delta.absoluteDelta) : null;
}

function highestBy<T>(items: T[], getValue: (item: T) => number | null) {
  let top: T | null = null;
  let topValue: number | null = null;

  for (const item of items) {
    const value = getValue(item);
    if (value == null) continue;
    if (topValue == null || value > topValue) {
      top = item;
      topValue = value;
    }
  }

  return { item: top, value: topValue };
}

function buildMetric(metric: LandlordPredictiveMetric): LandlordPredictiveMetric {
  return metric;
}

function deriveVacancyRisk(input: PredictiveInput): LandlordPredictiveMetric {
  if (input.leasing.totalUnits <= 0) {
    return buildMetric({
      key: "projected_vacancy_risk",
      label: "Projected vacancy risk",
      riskLevel: null,
      status: "insufficient_data",
      explanation: "Not enough occupied or rentable unit data is available to project vacancy risk yet.",
      supportingValues: {
        totalUnits: input.leasing.totalUnits,
        vacancyRate: input.summary.vacancyRate,
      },
    });
  }

  const vacancyRate = input.summary.vacancyRate || 0;
  const vacancyWorsening = worsenBy(input.comparisons.deltas.summary.vacancyRate) || 0;
  const topVacancy = highestBy(input.propertyMetrics, (property) => property.metrics.vacancyRate);
  const topVacancyRate = topVacancy.value || 0;

  if (vacancyRate >= 0.25 || vacancyWorsening >= 0.1 || topVacancyRate >= 0.35) {
    return buildMetric({
      key: "projected_vacancy_risk",
      label: "Projected vacancy risk",
      riskLevel: "high",
      status: "supported",
      explanation:
        topVacancy.item && topVacancyRate >= 0.35
          ? `${topVacancy.item.propertyName} already carries concentrated vacancy pressure, so near-term vacancy risk is elevated.`
          : "Vacancy is already elevated or worsening versus the prior period, so near-term vacancy risk is elevated.",
      supportingValues: {
        vacancyRate,
        worseningVsPrior: vacancyWorsening,
        topPropertyVacancyRate: topVacancyRate,
        topPropertyId: topVacancy.item?.propertyId || null,
      },
    });
  }

  if (vacancyRate >= 0.1 || vacancyWorsening > 0 || input.leasing.vacantUnits > 0) {
    return buildMetric({
      key: "projected_vacancy_risk",
      label: "Projected vacancy risk",
      riskLevel: "medium",
      status: "supported",
      explanation: "Vacancy pressure is present in the current view, but it is not yet at the highest-risk threshold.",
      supportingValues: {
        vacancyRate,
        worseningVsPrior: vacancyWorsening,
        vacantUnits: input.leasing.vacantUnits,
      },
    });
  }

  return buildMetric({
    key: "projected_vacancy_risk",
    label: "Projected vacancy risk",
    riskLevel: "low",
    status: "supported",
    explanation: "Current occupancy is stable and vacancy is not worsening materially versus the prior period.",
    supportingValues: {
      vacancyRate,
      worseningVsPrior: vacancyWorsening,
      vacantUnits: input.leasing.vacantUnits,
    },
  });
}

function deriveLeaseExpiryConcentration(input: PredictiveInput): LandlordPredictiveMetric {
  if (input.summary.occupiedUnits <= 0) {
    return buildMetric({
      key: "projected_lease_expiry_concentration",
      label: "Projected lease expiry concentration",
      riskLevel: null,
      status: "insufficient_data",
      explanation: "No active occupied-unit base is available to evaluate lease expiry concentration.",
      supportingValues: {
        occupiedUnits: input.summary.occupiedUnits,
        leasesEndingSoon: input.summary.leasesEndingSoon,
      },
    });
  }

  const leasesEndingSoon = input.summary.leasesEndingSoon;
  const topLeaseRisk = highestBy(input.propertyMetrics, (property) => property.metrics.leasesEndingSoon);
  const topLeaseShare =
    leasesEndingSoon > 0 && (topLeaseRisk.value || 0) > 0 ? (topLeaseRisk.value || 0) / leasesEndingSoon : 0;

  if (leasesEndingSoon >= 3 || (leasesEndingSoon >= 2 && topLeaseShare >= 0.5)) {
    return buildMetric({
      key: "projected_lease_expiry_concentration",
      label: "Projected lease expiry concentration",
      riskLevel: "high",
      status: "supported",
      explanation:
        topLeaseRisk.item && topLeaseShare >= 0.5
          ? `Lease rollover risk is concentrated in ${topLeaseRisk.item.propertyName}, which carries most of the near-term expiries.`
          : "Several leases are ending soon, which raises concentrated rollover risk in the near term.",
      supportingValues: {
        leasesEndingSoon,
        topPropertyLeaseExpiries: topLeaseRisk.value || 0,
        topPropertyShare: topLeaseShare,
        topPropertyId: topLeaseRisk.item?.propertyId || null,
      },
    });
  }

  if (leasesEndingSoon > 0) {
    return buildMetric({
      key: "projected_lease_expiry_concentration",
      label: "Projected lease expiry concentration",
      riskLevel: "medium",
      status: "supported",
      explanation: "Some leases are ending soon, so renewal and turnover planning should stay active.",
      supportingValues: {
        leasesEndingSoon,
        topPropertyLeaseExpiries: topLeaseRisk.value || 0,
        topPropertyShare: topLeaseShare,
      },
    });
  }

  return buildMetric({
    key: "projected_lease_expiry_concentration",
    label: "Projected lease expiry concentration",
    riskLevel: "low",
    status: "supported",
    explanation: "Near-term lease expiries are limited in the current view.",
    supportingValues: {
      leasesEndingSoon,
      topPropertyLeaseExpiries: topLeaseRisk.value || 0,
    },
  });
}

function deriveMaintenanceBurden(input: PredictiveInput): LandlordPredictiveMetric {
  if (input.leasing.totalUnits <= 0) {
    return buildMetric({
      key: "projected_maintenance_burden_risk",
      label: "Projected maintenance burden risk",
      riskLevel: null,
      status: "insufficient_data",
      explanation: "Not enough portfolio footprint is available to evaluate maintenance burden.",
      supportingValues: {
        totalUnits: input.leasing.totalUnits,
        openWorkOrders: input.maintenance.openWorkOrders,
      },
    });
  }

  const maintenanceWorsening = worsenBy(input.comparisons.deltas.summary.maintenanceCostCents) || 0;
  const topMaintenance = highestBy(input.propertyMetrics, (property) => property.metrics.maintenanceCostCents);
  const totalMaintenance = input.maintenance.maintenanceCostCents;
  const concentrationShare = totalMaintenance > 0 && (topMaintenance.value || 0) > 0 ? (topMaintenance.value || 0) / totalMaintenance : 0;

  if (
    input.maintenance.openWorkOrders >= 3 ||
    maintenanceWorsening >= 50_000 ||
    (totalMaintenance >= 100_000 && concentrationShare >= 0.5)
  ) {
    return buildMetric({
      key: "projected_maintenance_burden_risk",
      label: "Projected maintenance burden risk",
      riskLevel: "high",
      status: "supported",
      explanation:
        topMaintenance.item && concentrationShare >= 0.5
          ? `Maintenance burden is heavily concentrated in ${topMaintenance.item.propertyName}, which increases near-term operational drag.`
          : "Maintenance volume or cost is already elevated enough to create sustained near-term operational drag.",
      supportingValues: {
        openWorkOrders: input.maintenance.openWorkOrders,
        maintenanceCostCents: totalMaintenance,
        worseningVsPriorCents: maintenanceWorsening,
        topPropertyMaintenanceShare: concentrationShare,
        topPropertyId: topMaintenance.item?.propertyId || null,
      },
    });
  }

  if (input.maintenance.openWorkOrders > 0 || totalMaintenance > 0 || maintenanceWorsening > 0) {
    return buildMetric({
      key: "projected_maintenance_burden_risk",
      label: "Projected maintenance burden risk",
      riskLevel: "medium",
      status: "supported",
      explanation: "Maintenance activity is active in the current view and should be monitored for additional drag.",
      supportingValues: {
        openWorkOrders: input.maintenance.openWorkOrders,
        maintenanceCostCents: totalMaintenance,
        worseningVsPriorCents: maintenanceWorsening,
      },
    });
  }

  return buildMetric({
    key: "projected_maintenance_burden_risk",
    label: "Projected maintenance burden risk",
    riskLevel: "low",
    status: "supported",
    explanation: "Maintenance activity is currently light and not worsening materially versus the prior period.",
    supportingValues: {
      openWorkOrders: input.maintenance.openWorkOrders,
      maintenanceCostCents: totalMaintenance,
      worseningVsPriorCents: maintenanceWorsening,
    },
  });
}

function hasDemandSignal(properties: LandlordPropertyAnalytics[]) {
  return properties.some((property) => property.metrics.applicationVolume > 0);
}

function deriveApplicationSlowdown(input: PredictiveInput): LandlordPredictiveMetric {
  const submittedCurrent = input.comparisons.deltas.applications.submitted.current;
  const submittedPrior = input.comparisons.deltas.applications.submitted.prior;
  const conversionCurrent = input.summary.applicationConversionRate;
  const conversionPrior = input.comparisons.deltas.summary.applicationConversionRate.prior;
  const applicationsWorsening = worsenBy(input.comparisons.deltas.applications.submitted) || 0;

  if (!hasDemandSignal(input.propertyMetrics) && (submittedPrior == null || submittedPrior <= 0) && (submittedCurrent == null || submittedCurrent <= 0)) {
    return buildMetric({
      key: "projected_application_slowdown_risk",
      label: "Projected application slowdown risk",
      riskLevel: null,
      status: "insufficient_data",
      explanation: "There is not enough application history in this view to evaluate slowdown risk reliably.",
      supportingValues: {
        submittedCurrent,
        submittedPrior,
        conversionCurrent,
      },
    });
  }

  const severeConversionDrop =
    conversionCurrent != null &&
    conversionPrior != null &&
    conversionPrior >= 0.2 &&
    conversionPrior - conversionCurrent >= 0.2;

  if ((submittedPrior || 0) >= 3 && (submittedCurrent || 0) === 0) {
    return buildMetric({
      key: "projected_application_slowdown_risk",
      label: "Projected application slowdown risk",
      riskLevel: "high",
      status: "supported",
      explanation: "Application demand fell from an active prior period to no current submissions, which signals elevated slowdown risk.",
      supportingValues: {
        submittedCurrent,
        submittedPrior,
        conversionCurrent,
        conversionPrior,
      },
    });
  }

  if (applicationsWorsening >= 2 || severeConversionDrop) {
    return buildMetric({
      key: "projected_application_slowdown_risk",
      label: "Projected application slowdown risk",
      riskLevel: "high",
      status: "supported",
      explanation: "Application demand or conversion efficiency has dropped materially versus the prior period.",
      supportingValues: {
        submittedCurrent,
        submittedPrior,
        worseningVsPrior: applicationsWorsening,
        conversionCurrent,
        conversionPrior,
      },
    });
  }

  if (
    input.comparisons.deltas.applications.submitted.direction === "worse" ||
    input.comparisons.deltas.summary.applicationConversionRate.direction === "worse" ||
    (submittedCurrent || 0) <= 1
  ) {
    return buildMetric({
      key: "projected_application_slowdown_risk",
      label: "Projected application slowdown risk",
      riskLevel: "medium",
      status: "supported",
      explanation: "Application activity is soft or trending down, so leasing demand should be watched closely.",
      supportingValues: {
        submittedCurrent,
        submittedPrior,
        conversionCurrent,
        conversionPrior,
      },
    });
  }

  return buildMetric({
    key: "projected_application_slowdown_risk",
    label: "Projected application slowdown risk",
    riskLevel: "low",
    status: "supported",
    explanation: "Application volume and conversion remain stable enough to avoid a current slowdown signal.",
    supportingValues: {
      submittedCurrent,
      submittedPrior,
      conversionCurrent,
      conversionPrior,
    },
  });
}

function deriveRevenuePressure(input: PredictiveInput): LandlordPredictiveMetric {
  const revenueCurrent = input.revenue.estimatedScheduledRentCents;
  const revenuePrior = input.comparisons.deltas.summary.estimatedScheduledRentCents.prior;
  const revenueRelativeDelta = input.comparisons.deltas.summary.estimatedScheduledRentCents.relativeDelta;
  const vacancyRate = input.summary.vacancyRate || 0;
  const leaseExpiryCount = input.summary.leasesEndingSoon;

  if (revenueCurrent <= 0 && (revenuePrior == null || revenuePrior <= 0)) {
    return buildMetric({
      key: "projected_revenue_pressure_signal",
      label: "Projected revenue pressure signal",
      riskLevel: null,
      status: "insufficient_data",
      explanation: "There is not enough scheduled-rent baseline in this view to evaluate revenue pressure.",
      supportingValues: {
        estimatedScheduledRentCents: revenueCurrent,
        priorEstimatedScheduledRentCents: revenuePrior,
      },
    });
  }

  const strongRevenueDrop = input.comparisons.deltas.summary.estimatedScheduledRentCents.direction === "worse" && (revenueRelativeDelta || 0) <= -0.1;

  if (strongRevenueDrop || vacancyRate >= 0.2 || leaseExpiryCount >= 3) {
    return buildMetric({
      key: "projected_revenue_pressure_signal",
      label: "Projected revenue pressure signal",
      riskLevel: "high",
      status: "supported",
      explanation:
        strongRevenueDrop
          ? "Scheduled rent is already trending down versus the prior period, which creates elevated near-term revenue pressure."
          : "Current vacancy or near-term lease rollover is high enough to create elevated revenue pressure.",
      supportingValues: {
        estimatedScheduledRentCents: revenueCurrent,
        priorEstimatedScheduledRentCents: revenuePrior,
        relativeDelta: revenueRelativeDelta,
        vacancyRate,
        leasesEndingSoon: leaseExpiryCount,
      },
    });
  }

  if (
    input.comparisons.deltas.summary.estimatedScheduledRentCents.direction === "worse" ||
    vacancyRate > 0 ||
    leaseExpiryCount > 0
  ) {
    return buildMetric({
      key: "projected_revenue_pressure_signal",
      label: "Projected revenue pressure signal",
      riskLevel: "medium",
      status: "supported",
      explanation: "Revenue pressure is present, but the current portfolio signals do not yet indicate the highest-risk case.",
      supportingValues: {
        estimatedScheduledRentCents: revenueCurrent,
        priorEstimatedScheduledRentCents: revenuePrior,
        relativeDelta: revenueRelativeDelta,
        vacancyRate,
        leasesEndingSoon: leaseExpiryCount,
      },
    });
  }

  return buildMetric({
    key: "projected_revenue_pressure_signal",
    label: "Projected revenue pressure signal",
    riskLevel: "low",
    status: "supported",
    explanation: "Scheduled rent is stable and current vacancy or rollover signals are limited.",
    supportingValues: {
      estimatedScheduledRentCents: revenueCurrent,
      priorEstimatedScheduledRentCents: revenuePrior,
      relativeDelta: revenueRelativeDelta,
      vacancyRate,
      leasesEndingSoon: leaseExpiryCount,
    },
  });
}

export function derivePredictiveMetrics(input: PredictiveInput): LandlordPredictiveMetrics {
  return {
    metrics: [
      deriveVacancyRisk(input),
      deriveLeaseExpiryConcentration(input),
      deriveMaintenanceBurden(input),
      deriveApplicationSlowdown(input),
      deriveRevenuePressure(input),
    ],
  };
}
