import type { ScreeningReconciliationStatus } from "../reconciliation/reconciliationTypes";

export type AdminAnalyticsPeriod = "30d" | "90d" | "365d" | "month_to_date";
export type AdminAnalyticsGranularity = "daily" | "weekly" | "monthly";

export type AdminAnalyticsSummary = {
  applicationsStarted: number;
  applicationsSubmitted: number;
  applicationConversionRate: number | null;
  screeningsPaid: number;
  screeningRevenueCents: number;
  openWorkOrders: number;
  maintenanceCostCents: number;
  occupiedUnits: number;
  vacancyRate: number | null;
};

export type AdminApplicationsAnalytics = {
  started: number;
  submitted: number;
  approved: number;
  rejected: number;
  declined: number;
  pendingReviewCount: number;
  conversionRate: number | null;
};

export type AdminScreeningAnalytics = {
  initiated: number;
  checkoutCreated: number;
  paid: number;
  fulfilled: number;
  blocked: number;
  expired: number;
  abandoned: number;
  needsReview: number;
  totalRevenueCents: number;
  averageRevenuePerPaidScreeningCents: number | null;
  statusCounts: Record<ScreeningReconciliationStatus, number>;
};

export type AdminMaintenanceAnalytics = {
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

export type AdminPortfolioAnalytics = {
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

export type AdminActivityAnalytics = {
  trackedEvents: number;
  canonicalEvents: number;
  activeActors: number;
};

export type AdminAnalyticsSnapshot = {
  summary: AdminAnalyticsSummary;
  applications: AdminApplicationsAnalytics;
  screening: AdminScreeningAnalytics;
  maintenance: AdminMaintenanceAnalytics;
  portfolio: AdminPortfolioAnalytics;
  activity: AdminActivityAnalytics;
  filters: {
    period: AdminAnalyticsPeriod;
    granularity: AdminAnalyticsGranularity;
    from: string;
    to: string;
  };
};

export type AdminAnalyticsDerivedInput = {
  from: number;
  to: number;
  now: number;
  period: AdminAnalyticsPeriod;
  granularity: AdminAnalyticsGranularity;
  applications: any[];
  screeningReconciliations: Array<{
    status: ScreeningReconciliationStatus;
    summary: {
      hasQuote: boolean;
      hasCheckout: boolean;
      hasPaidEvent: boolean;
      hasFulfillment: boolean;
      lastMeaningfulEventAt: string | null;
    };
  }>;
  financialTransactions: any[];
  workOrders: any[];
  properties: any[];
  units: any[];
  leases: any[];
  events: any[];
  canonicalEvents: any[];
};

export type LandlordAnalyticsInsight = {
  type:
    | "lease_expiry"
    | "vacancy_concentration"
    | "maintenance_cost_increase"
    | "applications_drop"
    | "work_order_concentration";
  severity: "low" | "medium" | "high";
  message: string;
  propertyId?: string | null;
};

export type LandlordRevenueAnalytics = {
  estimatedScheduledRentCents: number;
  averageRentPerOccupiedUnitCents: number | null;
};

export type LandlordAnalyticsSummary = {
  occupiedUnits: number;
  vacancyRate: number | null;
  activeApplications: number;
  applicationConversionRate: number | null;
  openWorkOrders: number;
  maintenanceCostCents: number;
  estimatedScheduledRentCents: number;
  leasesEndingSoon: number;
};

export type LandlordAnalyticsSnapshot = {
  summary: LandlordAnalyticsSummary;
  applications: AdminApplicationsAnalytics;
  leasing: AdminPortfolioAnalytics;
  maintenance: AdminMaintenanceAnalytics;
  revenue: LandlordRevenueAnalytics;
  insights: LandlordAnalyticsInsight[];
  properties: Array<{
    id: string;
    name: string;
  }>;
  filters: {
    period: AdminAnalyticsPeriod;
    propertyId: string | null;
    from: string;
    to: string;
  };
};
