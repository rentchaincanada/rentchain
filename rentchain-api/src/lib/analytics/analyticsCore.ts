import type { AdminAnalyticsGranularity, AdminAnalyticsPeriod } from "./analyticsTypes";
import type { CanonicalEventV1 } from "../events/eventTypes";

export function asAnalyticsString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

export function clampAnalyticsPeriod(value: unknown): AdminAnalyticsPeriod {
  const raw = asAnalyticsString(value, 40).toLowerCase();
  if (raw === "90d") return "90d";
  if (raw === "365d") return "365d";
  if (raw === "month_to_date") return "month_to_date";
  return "30d";
}

export function clampAnalyticsGranularity(value: unknown): AdminAnalyticsGranularity {
  const raw = asAnalyticsString(value, 40).toLowerCase();
  if (raw === "weekly") return "weekly";
  if (raw === "monthly") return "monthly";
  return "daily";
}

export function resolveAnalyticsWindow(period: AdminAnalyticsPeriod, now: number) {
  if (period === "month_to_date") {
    const current = new Date(now);
    const from = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), 1, 0, 0, 0, 0);
    return { from, to: now };
  }

  const days = period === "365d" ? 365 : period === "90d" ? 90 : 30;
  return {
    from: now - days * 24 * 60 * 60 * 1000,
    to: now,
  };
}

export function isAnalyticsVisibleCanonicalEvent(event: CanonicalEventV1) {
  return event.visibility !== "tenant";
}

export function latestOrderByApplication(orders: any[]) {
  const grouped = new Map<string, any[]>();
  for (const order of orders || []) {
    const applicationId = asAnalyticsString(order?.applicationId, 240);
    if (!applicationId) continue;
    if (!grouped.has(applicationId)) grouped.set(applicationId, []);
    grouped.get(applicationId)!.push(order);
  }

  const latest = new Map<string, any>();
  for (const [applicationId, items] of grouped.entries()) {
    const ordered = [...items].sort(
      (a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)
    );
    latest.set(applicationId, ordered[0]);
  }

  return latest;
}

export function shouldDeriveScreeningReconciliation(
  application: any,
  latestOrder: any,
  transactionsByApplication: Set<string>
) {
  const applicationId = asAnalyticsString(application?.id, 240);
  return Boolean(
    application?.screeningMonetization ||
      application?.screeningStatus ||
      latestOrder ||
      (applicationId && transactionsByApplication.has(applicationId))
  );
}

