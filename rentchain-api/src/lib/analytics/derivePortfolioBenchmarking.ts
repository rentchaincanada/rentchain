import type {
  LandlordBenchmarkDimension,
  LandlordBenchmarkInsight,
  LandlordBenchmarkMetricComparison,
  LandlordBenchmarkingComparison,
  LandlordPortfolioBenchmarking,
  LandlordPropertyAnalytics,
  LandlordPropertyAnalyticsMetrics,
  LandlordAnalyticsSnapshotBase,
} from "./analyticsTypes";

const DIMENSIONS: Array<{
  key: LandlordBenchmarkDimension;
  better: "higher" | "lower";
  minSample?: (property: LandlordPropertyAnalytics) => boolean;
}> = [
  { key: "vacancyRate", better: "lower" },
  { key: "applicationVolume", better: "higher" },
  {
    key: "applicationConversionRate",
    better: "higher",
    minSample: (property) => property.metrics.applicationVolume >= 2,
  },
  { key: "openWorkOrders", better: "lower" },
  { key: "maintenanceCostCents", better: "lower" },
  { key: "maintenanceCostPerUnitCents", better: "lower" },
  { key: "leasesEndingSoon", better: "lower" },
  { key: "estimatedScheduledRentCents", better: "higher" },
  { key: "estimatedRentPerOccupiedUnitCents", better: "higher" },
];

function metricValue(metrics: LandlordPropertyAnalyticsMetrics, key: LandlordBenchmarkDimension) {
  return metrics[key];
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function rankDirection(params: {
  key: LandlordBenchmarkDimension;
  value: number | null;
  portfolioAverage: number | null;
  better: "higher" | "lower";
}): LandlordBenchmarkMetricComparison["direction"] {
  const { value, portfolioAverage, better } = params;
  if (value == null || portfolioAverage == null) return "insufficient_data";
  if (Math.abs(value - portfolioAverage) < 0.0001) return "neutral";
  if (better === "higher") return value > portfolioAverage ? "better" : "worse";
  return value < portfolioAverage ? "better" : "worse";
}

function deriveBenchmarks(properties: LandlordPropertyAnalytics[]) {
  return properties.map<LandlordBenchmarkingComparison>((property) => {
    const benchmarks: Partial<Record<LandlordBenchmarkDimension, LandlordBenchmarkMetricComparison>> = {};

    for (const dimension of DIMENSIONS) {
      const eligible = properties.filter((item) => {
        const value = metricValue(item.metrics, dimension.key);
        if (typeof value !== "number" || !Number.isFinite(value)) return false;
        return dimension.minSample ? dimension.minSample(item) : true;
      });

      const propertyValue = metricValue(property.metrics, dimension.key);
      const portfolioAverage = average(eligible.map((item) => metricValue(item.metrics, dimension.key) as number));

      if (
        typeof propertyValue !== "number" ||
        !Number.isFinite(propertyValue) ||
        (dimension.minSample && !dimension.minSample(property)) ||
        eligible.length < 2
      ) {
        benchmarks[dimension.key] = {
          portfolioAverage,
          rank: null,
          direction: "insufficient_data",
          deltaFromAverage: null,
        };
        continue;
      }

      const ranked = [...eligible].sort((a, b) => {
        const aValue = metricValue(a.metrics, dimension.key) as number;
        const bValue = metricValue(b.metrics, dimension.key) as number;
        if (aValue === bValue) return a.propertyName.localeCompare(b.propertyName);
        return dimension.better === "higher" ? bValue - aValue : aValue - bValue;
      });

      const rank = ranked.findIndex((item) => item.propertyId === property.propertyId) + 1;
      benchmarks[dimension.key] = {
        portfolioAverage,
        rank: rank > 0 ? rank : null,
        direction: rankDirection({
          key: dimension.key,
          value: propertyValue,
          portfolioAverage,
          better: dimension.better,
        }),
        deltaFromAverage: portfolioAverage == null ? null : propertyValue - portfolioAverage,
      };
    }

    return {
      propertyId: property.propertyId,
      propertyName: property.propertyName,
      metrics: property.metrics,
      benchmarks,
    };
  });
}

function topByMetric(
  properties: LandlordPropertyAnalytics[],
  key: LandlordBenchmarkDimension,
  direction: "highest" | "lowest",
  minSample?: (property: LandlordPropertyAnalytics) => boolean
) {
  const eligible = properties.filter((item) => {
    const value = metricValue(item.metrics, key);
    if (typeof value !== "number" || !Number.isFinite(value)) return false;
    return minSample ? minSample(item) : true;
  });
  if (!eligible.length) return null;
  return [...eligible].sort((a, b) => {
    const aValue = metricValue(a.metrics, key) as number;
    const bValue = metricValue(b.metrics, key) as number;
    if (aValue === bValue) return a.propertyName.localeCompare(b.propertyName);
    return direction === "highest" ? bValue - aValue : aValue - bValue;
  })[0];
}

function deriveInsights(properties: LandlordPropertyAnalytics[]): LandlordBenchmarkInsight[] {
  if (properties.length < 2) return [];

  const insights: LandlordBenchmarkInsight[] = [];

  const lowestVacancy = topByMetric(properties, "vacancyRate", "lowest");
  const highestVacancy = topByMetric(properties, "vacancyRate", "highest");
  const totalVacancy = properties.reduce((sum, property) => sum + property.metrics.vacantUnits, 0);
  if (lowestVacancy && highestVacancy && highestVacancy.metrics.vacancyRate != null) {
    insights.push({
      type: "vacancy_leader",
      severity: "low",
      propertyId: lowestVacancy.propertyId,
      message: `${lowestVacancy.propertyName} currently has the lowest vacancy rate in your portfolio.`,
    });
    if (
      totalVacancy > 0 &&
      highestVacancy.metrics.vacantUnits >= Math.max(2, Math.ceil(totalVacancy / 2))
    ) {
      insights.push({
        type: "vacancy_risk",
        severity: highestVacancy.metrics.vacancyRate >= 0.35 ? "high" : "medium",
        propertyId: highestVacancy.propertyId,
        message: `${highestVacancy.propertyName} currently has the highest vacancy pressure in your portfolio.`,
      });
    }
  }

  const bestConversion = topByMetric(properties, "applicationConversionRate", "highest", (property) => property.metrics.applicationVolume >= 2);
  if (bestConversion && bestConversion.metrics.applicationConversionRate != null) {
    insights.push({
      type: "application_conversion_leader",
      severity: "low",
      propertyId: bestConversion.propertyId,
      message: `Application conversion is strongest at ${bestConversion.propertyName}.`,
    });
  }

  const topMaintenance = topByMetric(properties, "maintenanceCostCents", "highest");
  const totalMaintenance = properties.reduce((sum, property) => sum + property.metrics.maintenanceCostCents, 0);
  if (
    topMaintenance &&
    totalMaintenance > 0 &&
    topMaintenance.metrics.maintenanceCostCents >= Math.ceil(totalMaintenance * 0.5)
  ) {
    insights.push({
      type: "maintenance_concentration",
      severity: topMaintenance.metrics.maintenanceCostCents >= 100_000 ? "high" : "medium",
      propertyId: topMaintenance.propertyId,
      message: `Most maintenance cost this period is concentrated in ${topMaintenance.propertyName}.`,
    });
  }

  const topLeaseRisk = topByMetric(properties, "leasesEndingSoon", "highest");
  if (topLeaseRisk && topLeaseRisk.metrics.leasesEndingSoon > 0) {
    insights.push({
      type: "lease_expiry_concentration",
      severity: topLeaseRisk.metrics.leasesEndingSoon >= 3 ? "high" : "medium",
      propertyId: topLeaseRisk.propertyId,
      message: `Near-term lease expiry risk is concentrated in ${topLeaseRisk.propertyName}.`,
    });
  }

  const topRent = topByMetric(properties, "estimatedRentPerOccupiedUnitCents", "highest");
  if (topRent && topRent.metrics.estimatedRentPerOccupiedUnitCents != null) {
    insights.push({
      type: "rent_leader",
      severity: "low",
      propertyId: topRent.propertyId,
      message: `${topRent.propertyName} currently has the strongest scheduled rent per occupied unit.`,
    });
  }

  return insights.slice(0, 5);
}

export function derivePortfolioBenchmarking(params: {
  snapshot: LandlordAnalyticsSnapshotBase;
  propertyId?: string | null;
}): LandlordPortfolioBenchmarking {
  const snapshot = params.snapshot;
  const properties = snapshot.propertyMetrics || [];
  const comparisons = deriveBenchmarks(properties);
  const propertyId = params.propertyId || snapshot.filters.propertyId || null;
  const filteredComparisons = propertyId
    ? comparisons.filter((comparison) => comparison.propertyId === propertyId)
    : comparisons;

  return {
    summary: {
      propertyCount: properties.length,
      comparedPropertyCount: filteredComparisons.length,
      benchmarkDimensions: DIMENSIONS.map((item) => item.key),
    },
    comparisons: filteredComparisons,
    insights: deriveInsights(properties),
    filters: {
      period: snapshot.filters.period,
      propertyId,
      from: snapshot.filters.from,
      to: snapshot.filters.to,
    },
  };
}
