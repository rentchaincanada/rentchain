import { apiFetch } from "./apiFetch";
import type { AnalyticsPeriod } from "./landlordAnalyticsApi";

export type LandlordBenchmarkDimension =
  | "vacancyRate"
  | "applicationVolume"
  | "applicationConversionRate"
  | "openWorkOrders"
  | "maintenanceCostCents"
  | "maintenanceCostPerUnitCents"
  | "leasesEndingSoon"
  | "estimatedScheduledRentCents"
  | "estimatedRentPerOccupiedUnitCents";

export type LandlordBenchmarkMetricComparison = {
  portfolioAverage: number | null;
  rank: number | null;
  direction: "better" | "worse" | "neutral" | "insufficient_data";
  deltaFromAverage: number | null;
};

export type LandlordPropertyBenchmarkMetrics = {
  vacancyRate: number | null;
  occupancyRate: number | null;
  applicationVolume: number;
  applicationConversionRate: number | null;
  openWorkOrders: number;
  maintenanceCostCents: number;
  maintenanceCostPerUnitCents: number | null;
  leasesEndingSoon: number;
  estimatedScheduledRentCents: number;
  estimatedRentPerOccupiedUnitCents: number | null;
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
};

export type LandlordBenchmarkInsight = {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  propertyId?: string | null;
};

export type LandlordBenchmarkingComparison = {
  propertyId: string;
  propertyName: string;
  metrics: LandlordPropertyBenchmarkMetrics;
  benchmarks: Partial<Record<LandlordBenchmarkDimension, LandlordBenchmarkMetricComparison>>;
};

export type LandlordAnalyticsBenchmarkingResponse = {
  summary: {
    propertyCount: number;
    comparedPropertyCount: number;
    benchmarkDimensions: LandlordBenchmarkDimension[];
  };
  comparisons: LandlordBenchmarkingComparison[];
  insights: LandlordBenchmarkInsight[];
  filters: {
    period: AnalyticsPeriod;
    propertyId: string | null;
    from: string;
    to: string;
  };
};

export async function fetchLandlordAnalyticsBenchmarking(params?: {
  period?: AnalyticsPeriod;
  propertyId?: string | null;
}): Promise<LandlordAnalyticsBenchmarkingResponse> {
  const search = new URLSearchParams();
  if (params?.period) search.set("period", params.period);
  if (params?.propertyId) search.set("propertyId", params.propertyId);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return await apiFetch<LandlordAnalyticsBenchmarkingResponse>(`/landlord/analytics/benchmarking${suffix}`);
}
