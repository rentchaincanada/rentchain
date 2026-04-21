import type {
  AnalyticsDeltaDirection,
  AnalyticsDeltaValue,
  LandlordPropertyAnalytics,
  LandlordPropertyAnalyticsMetrics,
} from "./analyticsTypes";

type DeltaPreference = "higher_better" | "lower_better";

function round(value: number) {
  return Math.round(value * 10000) / 10000;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function directionForDelta(params: {
  current: number | null;
  prior: number | null;
  preference: DeltaPreference;
}): AnalyticsDeltaDirection {
  const { current, prior, preference } = params;
  if (current == null || prior == null) return "insufficient_data";
  if (Math.abs(current - prior) < 0.0001) return "flat";
  if (preference === "higher_better") return current > prior ? "better" : "worse";
  return current < prior ? "better" : "worse";
}

export function deriveAnalyticsDelta(params: {
  current: number | null;
  prior: number | null;
  preference: DeltaPreference;
}): AnalyticsDeltaValue {
  const current = asNumber(params.current);
  const prior = asNumber(params.prior);
  if (current == null || prior == null) {
    return {
      current,
      prior,
      absoluteDelta: null,
      relativeDelta: null,
      direction: "insufficient_data",
    };
  }

  const absoluteDelta = round(current - prior);
  const relativeDelta = Math.abs(prior) > 0.0001 ? round((current - prior) / Math.abs(prior)) : null;

  return {
    current,
    prior,
    absoluteDelta,
    relativeDelta,
    direction: directionForDelta({
      current,
      prior,
      preference: params.preference,
    }),
  };
}

export function derivePropertyMetricDeltas(params: {
  current: LandlordPropertyAnalytics[];
  previous: LandlordPropertyAnalytics[];
}) {
  const previousById = new Map(params.previous.map((property) => [property.propertyId, property]));

  return params.current.map((property) => {
    const previous = previousById.get(property.propertyId);
    const currentMetrics = property.metrics;
    const previousMetrics = previous?.metrics;

    return {
      ...property,
      deltas: {
        vacancyRate: deriveAnalyticsDelta({
          current: currentMetrics.vacancyRate,
          prior: previousMetrics?.vacancyRate ?? null,
          preference: "lower_better",
        }),
        occupancyRate: deriveAnalyticsDelta({
          current: currentMetrics.occupancyRate,
          prior: previousMetrics?.occupancyRate ?? null,
          preference: "higher_better",
        }),
        applicationVolume: deriveAnalyticsDelta({
          current: currentMetrics.applicationVolume,
          prior: previousMetrics?.applicationVolume ?? null,
          preference: "higher_better",
        }),
        applicationConversionRate: deriveAnalyticsDelta({
          current: currentMetrics.applicationConversionRate,
          prior: previousMetrics?.applicationConversionRate ?? null,
          preference: "higher_better",
        }),
        openWorkOrders: deriveAnalyticsDelta({
          current: currentMetrics.openWorkOrders,
          prior: previousMetrics?.openWorkOrders ?? null,
          preference: "lower_better",
        }),
        maintenanceCostCents: deriveAnalyticsDelta({
          current: currentMetrics.maintenanceCostCents,
          prior: previousMetrics?.maintenanceCostCents ?? null,
          preference: "lower_better",
        }),
        maintenanceCostPerUnitCents: deriveAnalyticsDelta({
          current: currentMetrics.maintenanceCostPerUnitCents,
          prior: previousMetrics?.maintenanceCostPerUnitCents ?? null,
          preference: "lower_better",
        }),
        leasesEndingSoon: deriveAnalyticsDelta({
          current: currentMetrics.leasesEndingSoon,
          prior: previousMetrics?.leasesEndingSoon ?? null,
          preference: "lower_better",
        }),
        estimatedScheduledRentCents: deriveAnalyticsDelta({
          current: currentMetrics.estimatedScheduledRentCents,
          prior: previousMetrics?.estimatedScheduledRentCents ?? null,
          preference: "higher_better",
        }),
        estimatedRentPerOccupiedUnitCents: deriveAnalyticsDelta({
          current: currentMetrics.estimatedRentPerOccupiedUnitCents,
          prior: previousMetrics?.estimatedRentPerOccupiedUnitCents ?? null,
          preference: "higher_better",
        }),
        totalUnits: deriveAnalyticsDelta({
          current: currentMetrics.totalUnits,
          prior: previousMetrics?.totalUnits ?? null,
          preference: "higher_better",
        }),
        occupiedUnits: deriveAnalyticsDelta({
          current: currentMetrics.occupiedUnits,
          prior: previousMetrics?.occupiedUnits ?? null,
          preference: "higher_better",
        }),
        vacantUnits: deriveAnalyticsDelta({
          current: currentMetrics.vacantUnits,
          prior: previousMetrics?.vacantUnits ?? null,
          preference: "lower_better",
        }),
      } satisfies Partial<Record<keyof LandlordPropertyAnalyticsMetrics, AnalyticsDeltaValue>>,
    };
  });
}
