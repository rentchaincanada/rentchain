import { apiFetch } from "./apiFetch";

export type AnalyticsPeriod = "30d" | "90d" | "365d" | "month_to_date";

export type LandlordAnalyticsInsight = {
  type: string;
  severity: "low" | "medium" | "high";
  message: string;
  propertyId?: string | null;
};

export type LandlordPredictiveMetric = {
  key: string;
  label: string;
  riskLevel: "low" | "medium" | "high" | null;
  status: "supported" | "insufficient_data";
  explanation: string;
  supportingValues?: Record<string, number | string | null>;
};

export type LandlordAgentDecisionSupportingSignal = {
  source: "alert" | "predictive_metric" | "benchmarking_insight" | "delta";
  key: string;
  label: string;
  propertyId?: string | null;
  value?: number | string | null;
  direction?: "better" | "worse" | "flat" | "insufficient_data" | null;
};

export type LandlordAgentDecision = {
  id: string;
  decisionType: string;
  priority: "low" | "medium" | "high";
  explanation: string;
  supportingSignals: LandlordAgentDecisionSupportingSignal[];
  recommendedAction: string;
  href?: string;
  state: "pending" | "reviewed";
  reviewedAt?: string | null;
};

export type AnalyticsDeltaValue = {
  current: number | null;
  prior: number | null;
  absoluteDelta: number | null;
  relativeDelta: number | null;
  direction: "better" | "worse" | "flat" | "insufficient_data";
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
  decisions: {
    items: LandlordAgentDecision[];
  };
  predictive: {
    metrics: LandlordPredictiveMetric[];
  };
  insights: LandlordAnalyticsInsight[];
  comparisons: {
    previousPeriod: {
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
    };
    deltas: {
      summary: Record<string, AnalyticsDeltaValue>;
      applications: Record<string, AnalyticsDeltaValue>;
      leasing: Record<string, AnalyticsDeltaValue>;
      maintenance: Record<string, AnalyticsDeltaValue>;
      revenue: Record<string, AnalyticsDeltaValue>;
    };
  };
  properties: Array<{
    id: string;
    name: string;
  }>;
  propertyMetrics: Array<{
    propertyId: string;
    propertyName: string;
    metrics: {
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
    deltas?: Record<string, AnalyticsDeltaValue>;
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

export async function markLandlordDecisionReviewed(params: {
  decisionId: string;
  period?: AnalyticsPeriod;
  propertyId?: string | null;
}): Promise<{
  state: {
    decisionId: string;
    state: "reviewed";
    reviewedAt: string | null;
    updatedAt: string;
  };
}> {
  const search = new URLSearchParams();
  if (params.period) search.set("period", params.period);
  if (params.propertyId) search.set("propertyId", params.propertyId);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return await apiFetch(`/landlord/analytics/decisions/${encodeURIComponent(params.decisionId)}/review${suffix}`, {
    method: "POST",
  });
}
