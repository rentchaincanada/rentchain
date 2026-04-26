import { derivePortfolioBenchmarking } from "../../lib/analytics/derivePortfolioBenchmarking";
import type { LandlordPortfolioBenchmarking } from "../../lib/analytics/analyticsTypes";
import { loadLandlordAnalyticsSnapshot } from "./landlordAnalyticsSnapshot";

export async function loadLandlordAnalyticsBenchmarking(params: {
  landlordId: string;
  period?: string;
  propertyId?: string;
  now?: number;
}): Promise<LandlordPortfolioBenchmarking> {
  const snapshot = await loadLandlordAnalyticsSnapshot({
    landlordId: params.landlordId,
    period: params.period,
    propertyId: undefined,
    now: params.now,
  });

  return derivePortfolioBenchmarking({
    snapshot,
    propertyId: params.propertyId,
  });
}
