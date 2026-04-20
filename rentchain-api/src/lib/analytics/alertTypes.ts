import type { AdminAnalyticsPeriod } from "./analyticsTypes";

export type AnalyticsAlertType =
  | "lease_expiry"
  | "vacancy_increase"
  | "high_vacancy"
  | "maintenance_cost_spike"
  | "work_order_concentration"
  | "application_drop"
  | "application_conversion_drop"
  | "low_application_activity";

export type AnalyticsAlertSeverity = "low" | "medium" | "high";
export type AnalyticsAlertStatus = "active" | "resolved";

export type AnalyticsAlertAction = {
  type: string;
  label: string;
  href?: string;
};

export type AnalyticsAlert = {
  id: string;
  type: AnalyticsAlertType;
  severity: AnalyticsAlertSeverity;
  status: AnalyticsAlertStatus;
  title: string;
  message: string;
  propertyId?: string | null;
  propertyName?: string | null;
  metricValue?: number | null;
  previousMetricValue?: number | null;
  period?: AdminAnalyticsPeriod;
  detectedAt: string;
  lastEvaluatedAt: string;
  notification: {
    inAppEligible: boolean;
    emailEligible: boolean;
    automationEligible: boolean;
  };
  actions?: AnalyticsAlertAction[];
};

export type AnalyticsAlertsSummary = {
  activeCount: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
};

export type AnalyticsAlertsStatusFilter = "active" | "resolved" | "all";

export type LandlordAnalyticsAlertsResponse = {
  summary: AnalyticsAlertsSummary;
  alerts: AnalyticsAlert[];
  filters: {
    period: AdminAnalyticsPeriod;
    propertyId: string | null;
    status: AnalyticsAlertsStatusFilter;
  };
};
