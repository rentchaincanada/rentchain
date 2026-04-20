import { apiFetch } from "./apiFetch";

export type AnalyticsPeriod = "30d" | "90d" | "365d" | "month_to_date";

export type LandlordAnalyticsInsight = {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  propertyId?: string | null;
};

export type LandlordAnalyticsSnapshot = {
  summary: {
    occupiedUnits: number;
    vacancyRate: number | null;
    activeApplications: number;
    applicationConversionRate: number | null;
    openWorkOrders: number;
    maintenanceCostCents: number;
    estimatedScheduledRentCents: number;
    leasesEndingSoon: number;
  };
  applications: {
    started: number;
    submitted: number;
    approved: number;
    rejected: number;
    declined: number;
    pendingReviewCount: number;
    conversionRate: number | null;
  };
  leasing: {
    totalProperties: number;
    totalUnits: number;
    occupiedUnits: number;
    vacantUnits: number;
    occupancyRate: number | null;
    leasesEndingIn30Days: number;
    leasesEndingIn60Days: number;
    leasesEndingIn90Days: number;
    turnoverCount: number;
  };
  maintenance: {
    openWorkOrders: number;
    completedWorkOrders: number;
    reopenedWorkOrders: number;
    maintenanceCostCents: number;
    averageCostPerCompletedWorkOrderCents: number | null;
    costConcentrationByProperty: Array<{
      propertyId: string;
      workOrderCount: number;
      totalCostCents: number;
    }>;
  };
  revenue: {
    estimatedScheduledRentCents: number;
    averageRentPerOccupiedUnitCents: number | null;
  };
  insights: LandlordAnalyticsInsight[];
  comparisons: {
    previousPeriod: {
      vacancyRate: number | null;
      applicationConversionRate: number | null;
      applicationsStarted: number;
      applicationsSubmitted: number;
      maintenanceCostCents: number;
      openWorkOrders: number;
    };
  };
  properties: Array<{
    id: string;
    name: string;
  }>;
  filters: {
    period: AnalyticsPeriod;
    propertyId: string | null;
    from: string;
    to: string;
  };
};

export async function fetchLandlordAnalyticsSnapshot(params?: {
  period?: AnalyticsPeriod;
  propertyId?: string | null;
}): Promise<LandlordAnalyticsSnapshot> {
  const search = new URLSearchParams();
  if (params?.period) search.set("period", params.period);
  if (params?.propertyId) search.set("propertyId", params.propertyId);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return await apiFetch<LandlordAnalyticsSnapshot>(`/landlord/analytics${suffix}`);
}
