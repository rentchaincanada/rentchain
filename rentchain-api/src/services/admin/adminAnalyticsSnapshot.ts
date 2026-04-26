import { db } from "../../config/firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../../lib/events/buildEvent";
import type { CanonicalEventV1 } from "../../lib/events/eventTypes";
import { deriveAdminAnalyticsSnapshot } from "../../lib/analytics/deriveAdminAnalyticsSnapshot";
import {
  asAnalyticsString,
  clampAnalyticsGranularity,
  clampAnalyticsPeriod,
  isAnalyticsVisibleCanonicalEvent,
  latestOrderByApplication,
  resolveAnalyticsWindow,
  shouldDeriveScreeningReconciliation,
} from "../../lib/analytics/analyticsCore";
import type {
  AdminAnalyticsSnapshot,
} from "../../lib/analytics/analyticsTypes";
import { deriveScreeningReconciliation } from "../../lib/reconciliation/deriveScreeningReconciliation";

export async function loadAdminAnalyticsSnapshot(params?: {
  period?: string;
  granularity?: string;
  now?: number;
}): Promise<AdminAnalyticsSnapshot> {
  const now = typeof params?.now === "number" ? params.now : Date.now();
  const period = clampAnalyticsPeriod(params?.period);
  const granularity = clampAnalyticsGranularity(params?.granularity);
  const { from, to } = resolveAnalyticsWindow(period, now);

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
    .filter(isAnalyticsVisibleCanonicalEvent);
  const financialTransactions = (financialTransactionsSnap.docs || []).map((doc: any) => ({
    id: doc.id,
    ...(doc.data() || {}),
  }));
  const screeningOrders = (screeningOrdersSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));

  const latestOrders = latestOrderByApplication(screeningOrders);
  const transactionApplications = new Set<string>(
    financialTransactions.map((tx: any) => asAnalyticsString(tx?.applicationId, 240)).filter(Boolean)
  );
  const screeningReconciliations = applications
    .filter((application: any) =>
      shouldDeriveScreeningReconciliation(
        application,
        latestOrders.get(asAnalyticsString(application?.id, 240)),
        transactionApplications
      )
    )
    .map((application: any) =>
      deriveScreeningReconciliation({
        applicationId: application.id,
        application,
        latestOrder: latestOrders.get(asAnalyticsString(application?.id, 240)) || null,
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
    screeningOrders,
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
