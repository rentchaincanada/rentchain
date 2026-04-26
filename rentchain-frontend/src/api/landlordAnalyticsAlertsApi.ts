import { apiFetch } from "./apiFetch";
import type { AnalyticsPeriod } from "./landlordAnalyticsApi";

export type AnalyticsAlertStatus = "active" | "resolved" | "all";

export type AnalyticsAlert = {
  id: string;
  type: string;
  severity: "low" | "medium" | "high";
  status: "active" | "resolved";
  title: string;
  message: string;
  propertyId?: string | null;
  propertyName?: string | null;
  metricValue?: number | null;
  previousMetricValue?: number | null;
  period?: AnalyticsPeriod;
  detectedAt: string;
  lastEvaluatedAt: string;
  notification: {
    inAppEligible: boolean;
    emailEligible: boolean;
    automationEligible: boolean;
  };
  actions?: Array<{
    type: string;
    label: string;
    href?: string;
  }>;
};

export type LandlordAnalyticsAlertsResponse = {
  summary: {
    activeCount: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    lowSeverityCount: number;
  };
  alerts: AnalyticsAlert[];
  filters: {
    period: AnalyticsPeriod;
    propertyId: string | null;
    status: AnalyticsAlertStatus;
  };
};

export async function fetchLandlordAnalyticsAlerts(params?: {
  period?: AnalyticsPeriod;
  propertyId?: string | null;
  status?: AnalyticsAlertStatus;
}): Promise<LandlordAnalyticsAlertsResponse> {
  const search = new URLSearchParams();
  if (params?.period) search.set("period", params.period);
  if (params?.propertyId) search.set("propertyId", params.propertyId);
  if (params?.status) search.set("status", params.status);
  const suffix = search.toString() ? `?${search.toString()}` : "";
  return await apiFetch<LandlordAnalyticsAlertsResponse>(`/landlord/analytics/alerts${suffix}`);
}
