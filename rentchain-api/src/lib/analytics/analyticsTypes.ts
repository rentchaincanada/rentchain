import type { AutomationAction } from "../automation/automationTypes";
import type { LeaseNoticeType, LeaseType, RentChangeMode } from "../../config/leaseNoticeRules";
import type { LeaseNoticeExecutionInputMissingField } from "../../services/leaseNoticeWorkflowService";
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
    applicationId?: string;
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

export type AnalyticsDeltaDirection =
  | "better"
  | "worse"
  | "flat"
  | "insufficient_data";

export type AnalyticsDeltaValue = {
  current: number | null;
  prior: number | null;
  absoluteDelta: number | null;
  relativeDelta: number | null;
  direction: AnalyticsDeltaDirection;
};

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

export type LandlordPropertyAnalyticsMetrics = {
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

export type LandlordPropertyAnalytics = {
  propertyId: string;
  propertyName: string;
  metrics: LandlordPropertyAnalyticsMetrics;
  deltas?: Partial<Record<keyof LandlordPropertyAnalyticsMetrics, AnalyticsDeltaValue>>;
};

export type LandlordBenchmarkMetricComparison = {
  portfolioAverage: number | null;
  rank: number | null;
  direction: "better" | "worse" | "neutral" | "insufficient_data";
  deltaFromAverage: number | null;
};

export type LandlordBenchmarkInsight = {
  type:
    | "vacancy_leader"
    | "vacancy_risk"
    | "application_conversion_leader"
    | "maintenance_concentration"
    | "lease_expiry_concentration"
    | "rent_leader";
  severity: "low" | "medium" | "high";
  message: string;
  propertyId?: string | null;
};

export type LandlordBenchmarkingComparison = {
  propertyId: string;
  propertyName: string;
  metrics: LandlordPropertyAnalyticsMetrics;
  benchmarks: Partial<Record<LandlordBenchmarkDimension, LandlordBenchmarkMetricComparison>>;
};

export type LandlordPortfolioBenchmarking = {
  summary: {
    propertyCount: number;
    comparedPropertyCount: number;
    benchmarkDimensions: LandlordBenchmarkDimension[];
  };
  comparisons: LandlordBenchmarkingComparison[];
  insights: LandlordBenchmarkInsight[];
  filters: {
    period: AdminAnalyticsPeriod;
    propertyId: string | null;
    from: string;
    to: string;
  };
};

export type LandlordRevenueAnalytics = {
  estimatedScheduledRentCents: number;
  averageRentPerOccupiedUnitCents: number | null;
};

export type LandlordPredictiveMetricKey =
  | "projected_vacancy_risk"
  | "projected_lease_expiry_concentration"
  | "projected_maintenance_burden_risk"
  | "projected_application_slowdown_risk"
  | "projected_revenue_pressure_signal";

export type LandlordPredictiveMetric = {
  key: LandlordPredictiveMetricKey;
  label: string;
  riskLevel: "low" | "medium" | "high" | null;
  status: "supported" | "insufficient_data";
  explanation: string;
  supportingValues?: Record<string, number | string | null>;
};

export type LandlordPredictiveMetrics = {
  metrics: LandlordPredictiveMetric[];
};

export type LandlordAgentDecisionType =
  | "review_lease_renewals"
  | "reduce_vacancy_risk"
  | "improve_application_conversion"
  | "address_maintenance_backlog"
  | "review_revenue_pressure"
  | "focus_highest_risk_property";

export type LandlordAgentDecisionPriority = "low" | "medium" | "high";
export type AgentDecisionState = "pending" | "reviewed" | "snoozed" | "dismissed";

export type LandlordAgentDecisionSupportingSignal = {
  source: "alert" | "predictive_metric" | "benchmarking_insight" | "delta";
  key: string;
  label: string;
  propertyId?: string | null;
  value?: number | string | null;
  direction?: AnalyticsDeltaDirection | null;
};

export type LandlordDecisionWorkflowCategory =
  | "lease_renewals"
  | "vacancy_readiness"
  | "application_funnel"
  | "maintenance_backlog"
  | "revenue_follow_up"
  | "property_focus";

export type LandlordDecisionActionKey =
  | "open_lease_renewals_flow"
  | "open_vacancy_readiness_flow"
  | "open_application_funnel_review_flow"
  | "open_maintenance_backlog_flow"
  | "open_revenue_pressure_follow_up_flow"
  | "open_property_focus_flow";

export type LandlordDecisionAutomationState = "manual_only" | "ready" | "blocked";
export type LandlordDecisionExecutionMappingState = "none" | "mapped";
export type LandlordDecisionExecutionResourceType = "lease" | "rental_application" | "work_order";

export type LandlordDecisionExecutionMapping = {
  action: AutomationAction;
  resourceType: LandlordDecisionExecutionResourceType;
  resourceId: string;
  prerequisitesMet: boolean;
  prerequisiteReason: string | null;
};

export type LandlordDecisionExecutionInputState = "none" | "partial" | "complete";

export type LandlordDecisionLeaseNoticeExecutionInput = {
  noticeType: LeaseNoticeType | null;
  legalTemplateKey: string | null;
  noticeRuleVersion: string | null;
  province: string | null;
  leaseType: LeaseType | null;
  currentRent: number | null;
  noticeDueAt: number | null;
  rentChangeMode: RentChangeMode | null;
  proposedRent: number | null;
  newTermType: LeaseType | null;
  newLeaseStartDate: string | null;
  newLeaseEndDate: string | null;
  responseDeadlineAt: number | null;
};

export type LandlordAgentDecision = {
  id: string;
  decisionType: LandlordAgentDecisionType;
  priority: LandlordAgentDecisionPriority;
  explanation: string;
  supportingSignals: LandlordAgentDecisionSupportingSignal[];
  recommendedAction: string;
  href?: string;
  state: AgentDecisionState;
  reviewedAt?: string | null;
  actionKey: LandlordDecisionActionKey;
  actionLabel: string;
  destination: string;
  workflowCategory?: LandlordDecisionWorkflowCategory;
  automationEligible: boolean;
  automationState: LandlordDecisionAutomationState;
  automationReason: string | null;
  executionMappingState: LandlordDecisionExecutionMappingState;
  executionMapping: LandlordDecisionExecutionMapping | null;
  executionInputState: LandlordDecisionExecutionInputState;
  executionInputReason: string | null;
  executionInputMissingFields: LeaseNoticeExecutionInputMissingField[];
  executionInput: LandlordDecisionLeaseNoticeExecutionInput | null;
};

export type LandlordAgentDecisions = {
  items: LandlordAgentDecision[];
};

export type PersistedAgentDecisionState = {
  id: string;
  landlordId: string;
  decisionId: string;
  state: AgentDecisionState;
  reviewedAt?: string | null;
  snoozedUntil?: string | null;
  snoozedAt?: string | null;
  dismissedAt?: string | null;
  createdAt: string;
  updatedAt: string;
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

export type LandlordAnalyticsSnapshotBase = {
  summary: LandlordAnalyticsSummary;
  applications: AdminApplicationsAnalytics;
  leasing: AdminPortfolioAnalytics;
  maintenance: AdminMaintenanceAnalytics;
  revenue: LandlordRevenueAnalytics;
  predictive: LandlordPredictiveMetrics;
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
      applications: AdminApplicationsAnalytics;
      leasing: AdminPortfolioAnalytics;
      maintenance: AdminMaintenanceAnalytics;
      revenue: LandlordRevenueAnalytics;
    };
    deltas: {
      summary: {
        occupiedUnits: AnalyticsDeltaValue;
        vacancyRate: AnalyticsDeltaValue;
        activeApplications: AnalyticsDeltaValue;
        applicationConversionRate: AnalyticsDeltaValue;
        openWorkOrders: AnalyticsDeltaValue;
        maintenanceCostCents: AnalyticsDeltaValue;
        estimatedScheduledRentCents: AnalyticsDeltaValue;
        leasesEndingSoon: AnalyticsDeltaValue;
      };
      applications: {
        started: AnalyticsDeltaValue;
        submitted: AnalyticsDeltaValue;
        approved: AnalyticsDeltaValue;
        rejected: AnalyticsDeltaValue;
        declined: AnalyticsDeltaValue;
        pendingReviewCount: AnalyticsDeltaValue;
        conversionRate: AnalyticsDeltaValue;
      };
      leasing: {
        occupiedUnits: AnalyticsDeltaValue;
        vacantUnits: AnalyticsDeltaValue;
        occupancyRate: AnalyticsDeltaValue;
        leasesEndingIn30Days: AnalyticsDeltaValue;
        leasesEndingIn60Days: AnalyticsDeltaValue;
        leasesEndingIn90Days: AnalyticsDeltaValue;
      };
      maintenance: {
        openWorkOrders: AnalyticsDeltaValue;
        completedWorkOrders: AnalyticsDeltaValue;
        reopenedWorkOrders: AnalyticsDeltaValue;
        maintenanceCostCents: AnalyticsDeltaValue;
        averageCostPerCompletedWorkOrderCents: AnalyticsDeltaValue;
      };
      revenue: {
        estimatedScheduledRentCents: AnalyticsDeltaValue;
        averageRentPerOccupiedUnitCents: AnalyticsDeltaValue;
      };
    };
  };
  properties: Array<{
    id: string;
    name: string;
  }>;
  propertyMetrics: LandlordPropertyAnalytics[];
  filters: {
    period: AdminAnalyticsPeriod;
    propertyId: string | null;
    from: string;
    to: string;
  };
};

export type LandlordAnalyticsSnapshot = LandlordAnalyticsSnapshotBase & {
  decisions: LandlordAgentDecisions;
};
