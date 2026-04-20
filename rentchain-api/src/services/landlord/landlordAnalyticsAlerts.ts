import { deriveAnalyticsAlerts } from "../../lib/analytics/deriveAnalyticsAlerts";
import type { AnalyticsAlertsStatusFilter, LandlordAnalyticsAlertsResponse } from "../../lib/analytics/alertTypes";
import { loadLandlordAnalyticsSnapshot } from "./landlordAnalyticsSnapshot";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function clampStatus(value: unknown): AnalyticsAlertsStatusFilter {
  const raw = asString(value, 40).toLowerCase();
  if (raw === "resolved") return "resolved";
  if (raw === "all") return "all";
  return "active";
}

export async function loadLandlordAnalyticsAlerts(params: {
  landlordId: string;
  period?: string;
  propertyId?: string;
  status?: string;
  now?: number;
}): Promise<LandlordAnalyticsAlertsResponse> {
  const snapshot = await loadLandlordAnalyticsSnapshot({
    landlordId: params.landlordId,
    period: params.period,
    propertyId: params.propertyId,
    now: params.now,
  });

  return deriveAnalyticsAlerts({
    snapshot,
    status: clampStatus(params.status),
    now: params.now,
  });
}
