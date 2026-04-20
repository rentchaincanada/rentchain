import { db } from "../../config/firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../../lib/events/buildEvent";
import type { CanonicalEventV1 } from "../../lib/events/eventTypes";
import { deriveAdminAnalyticsSnapshot } from "../../lib/analytics/deriveAdminAnalyticsSnapshot";
import type {
  AdminAnalyticsGranularity,
  AdminAnalyticsPeriod,
  AdminAnalyticsSnapshot,
} from "../../lib/analytics/analyticsTypes";
import { deriveScreeningReconciliation } from "../../lib/reconciliation/deriveScreeningReconciliation";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function clampPeriod(value: unknown): AdminAnalyticsPeriod {
  const raw = asString(value, 40).toLowerCase();
  if (raw === "90d") return "90d";
  if (raw === "365d") return "365d";
  if (raw === "month_to_date") return "month_to_date";
  return "30d";
}

function clampGranularity(value: unknown): AdminAnalyticsGranularity {
  const raw = asString(value, 40).toLowerCase();
  if (raw === "weekly") return "weekly";
  if (raw === "monthly") return "monthly";
  return "daily";
}

function resolveWindow(period: AdminAnalyticsPeriod, now: number) {
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

function isVisibleToAdmin(event: CanonicalEventV1) {
  return event.visibility !== "tenant";
}

function latestOrderByApplication(orders: any[]) {
  const grouped = new Map<string, any[]>();
  for (const order of orders || []) {
    const applicationId = asString(order?.applicationId, 240);
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

function shouldDeriveScreeningReconciliation(application: any, latestOrder: any, transactionsByApplication: Set<string>) {
  const applicationId = asString(application?.id, 240);
  return Boolean(
    application?.screeningMonetization ||
      application?.screeningStatus ||
      latestOrder ||
      (applicationId && transactionsByApplication.has(applicationId))
  );
}

export async function loadAdminAnalyticsSnapshot(params?: {
  period?: string;
  granularity?: string;
  now?: number;
}): Promise<AdminAnalyticsSnapshot> {
  const now = typeof params?.now === "number" ? params.now : Date.now();
  const period = clampPeriod(params?.period);
  const granularity = clampGranularity(params?.granularity);
  const { from, to } = resolveWindow(period, now);

  const [
    applicationsSnap,
    workOrdersSnap,
    propertiesSnap,
    unitsSnap,
    leasesSnap,
    eventsSnap,
    canonicalEventsSnap,
    financialTransactionsSnap,
    screeningOrdersSnap,
  ] = await Promise.all([
    db.collection("rentalApplications").get().catch(() => ({ docs: [] } as any)),
    db.collection("workOrders").get().catch(() => ({ docs: [] } as any)),
    db.collection("properties").get().catch(() => ({ docs: [] } as any)),
    db.collection("units").get().catch(() => ({ docs: [] } as any)),
    db.collection("leases").get().catch(() => ({ docs: [] } as any)),
    db.collection("events").get().catch(() => ({ docs: [] } as any)),
    db.collection(CANONICAL_EVENTS_COLLECTION).get().catch(() => ({ docs: [] } as any)),
    db.collection("financialTransactions").get().catch(() => ({ docs: [] } as any)),
    db.collection("screeningOrders").get().catch(() => ({ docs: [] } as any)),
  ]);

  const applications = (applicationsSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
  const workOrders = (workOrdersSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
  const properties = (propertiesSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
  const units = (unitsSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
  const leases = (leasesSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
  const events = (eventsSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
  const canonicalEvents = (canonicalEventsSnap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as CanonicalEventV1)
    .filter(isVisibleToAdmin);
  const financialTransactions = (financialTransactionsSnap.docs || []).map((doc: any) => ({
    id: doc.id,
    ...(doc.data() || {}),
  }));
  const screeningOrders = (screeningOrdersSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));

  const latestOrders = latestOrderByApplication(screeningOrders);
  const transactionApplications = new Set<string>(
    financialTransactions.map((tx: any) => asString(tx?.applicationId, 240)).filter(Boolean)
  );
  const screeningReconciliations = applications
    .filter((application: any) =>
      shouldDeriveScreeningReconciliation(application, latestOrders.get(asString(application?.id, 240)), transactionApplications)
    )
    .map((application: any) =>
      deriveScreeningReconciliation({
        applicationId: application.id,
        application,
        latestOrder: latestOrders.get(asString(application?.id, 240)) || null,
        canonicalEvents,
        financialTransactions,
        now,
      })
    );

  return deriveAdminAnalyticsSnapshot({
    from,
    to,
    now,
    period,
    granularity,
    applications,
    screeningReconciliations,
    financialTransactions,
    workOrders,
    properties,
    units,
    leases,
    events,
    canonicalEvents,
  });
}
