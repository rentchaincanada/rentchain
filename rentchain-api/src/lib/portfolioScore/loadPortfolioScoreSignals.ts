import { db } from "../../firebase";
import type { CanonicalEventV1 } from "../events/eventTypes";
import { deriveInsightForResource } from "../insights/deriveInsights";
import { deriveScreeningReconciliation } from "../reconciliation/deriveScreeningReconciliation";
import type { ScreeningReconciliationV1 } from "../reconciliation/reconciliationTypes";
import { deriveAdminTriageQueue } from "../triage/deriveAdminTriageQueue";
import type { AdminTriageItemV1 } from "../triage/triageTypes";
import { CANONICAL_EVENTS_COLLECTION } from "../events/buildEvent";

type PortfolioResource = {
  id: string;
  landlordId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  status?: string | null;
  [key: string]: unknown;
};

export type PortfolioScoreSignals = {
  portfolioId: string;
  applications: PortfolioResource[];
  maintenanceRequests: PortfolioResource[];
  leases: PortfolioResource[];
  canonicalEvents: CanonicalEventV1[];
  screeningOrders: any[];
  financialTransactions: any[];
  applicationInsights: Array<ReturnType<typeof deriveInsightForResource>>;
  maintenanceInsights: Array<ReturnType<typeof deriveInsightForResource>>;
  leaseInsights: Array<ReturnType<typeof deriveInsightForResource>>;
  screeningReconciliations: ScreeningReconciliationV1[];
  triageItems: AdminTriageItemV1[];
  policyEvents: CanonicalEventV1[];
  automationEvents: CanonicalEventV1[];
};

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function loadDocs(name: string) {
  return db
    .collection(name)
    .get()
    .then((snap) => (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })));
}

function isVisibleToAdmin(event: CanonicalEventV1) {
  return event.visibility !== "tenant";
}

function matchesApplicationResource(resourceId: string, event: CanonicalEventV1) {
  const exactType = asString(event.resource?.type, 120);
  const exactId = asString(event.resource?.id, 240);
  const parentId = asString(event.resource?.parentId, 240);
  const metadataApplicationId = asString(event.metadata?.applicationId, 240);
  return (
    (exactType === "rental_application" && exactId === resourceId) ||
    parentId === resourceId ||
    metadataApplicationId === resourceId
  );
}

function matchesMaintenanceResource(resourceId: string, event: CanonicalEventV1) {
  const exactType = asString(event.resource?.type, 120);
  const exactId = asString(event.resource?.id, 240);
  const parentId = asString(event.resource?.parentId, 240);
  const metadataMaintenanceRequestId = asString(event.metadata?.maintenanceRequestId, 240);
  return (
    (exactType === "maintenance_request" && exactId === resourceId) ||
    parentId === resourceId ||
    metadataMaintenanceRequestId === resourceId
  );
}

function matchesLeaseResource(resourceId: string, event: CanonicalEventV1) {
  return (
    (asString(event.resource?.type, 120) === "lease" && asString(event.resource?.id, 240) === resourceId) ||
    asString(event.resource?.parentId, 240) === resourceId
  );
}

function relatedApplicationEvents(resourceId: string, canonicalEvents: CanonicalEventV1[]) {
  return canonicalEvents.filter((event) => matchesApplicationResource(resourceId, event));
}

function relatedMaintenanceEvents(resourceId: string, canonicalEvents: CanonicalEventV1[]) {
  return canonicalEvents.filter((event) => matchesMaintenanceResource(resourceId, event));
}

function relatedLeaseEvents(resourceId: string, canonicalEvents: CanonicalEventV1[]) {
  return canonicalEvents.filter((event) => matchesLeaseResource(resourceId, event));
}

function latestOrderByApplication(orders: any[]) {
  const latest = new Map<string, any>();
  for (const order of orders || []) {
    const applicationId = asString(order?.applicationId, 240);
    if (!applicationId) continue;
    const current = latest.get(applicationId);
    const currentTs = Number(current?.updatedAt || current?.createdAt || 0);
    const nextTs = Number(order?.updatedAt || order?.createdAt || 0);
    if (!current || nextTs >= currentTs) {
      latest.set(applicationId, order);
    }
  }
  return latest;
}

function transactionsByApplication(transactions: any[]) {
  const grouped = new Map<string, any[]>();
  for (const transaction of transactions || []) {
    const applicationId = asString(transaction?.applicationId, 240);
    if (!applicationId) continue;
    if (!grouped.has(applicationId)) grouped.set(applicationId, []);
    grouped.get(applicationId)!.push(transaction);
  }
  return grouped;
}

export async function loadPortfolioScoreSignals(portfolioId: string): Promise<PortfolioScoreSignals> {
  const landlordId = asString(portfolioId, 240);
  const [applicationsRaw, maintenanceRequestsRaw, leasesRaw, screeningOrdersRaw, financialTransactionsRaw, canonicalEventsRaw] =
    await Promise.all([
      loadDocs("rentalApplications"),
      loadDocs("maintenanceRequests"),
      loadDocs("leases"),
      loadDocs("screeningOrders"),
      loadDocs("financialTransactions"),
      db
        .collection(CANONICAL_EVENTS_COLLECTION)
        .get()
        .then((snap) =>
          (snap.docs || [])
            .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as CanonicalEventV1)
            .filter(isVisibleToAdmin)
        ),
    ]);

  const applications = applicationsRaw.filter((doc) => asString(doc?.landlordId, 240) === landlordId);
  const maintenanceRequests = maintenanceRequestsRaw.filter((doc) => asString(doc?.landlordId, 240) === landlordId);
  const leases = leasesRaw.filter((doc) => asString(doc?.landlordId, 240) === landlordId);
  const applicationIds = new Set(applications.map((doc) => asString(doc.id, 240)).filter(Boolean));

  const screeningOrders = screeningOrdersRaw.filter(
    (doc) =>
      asString(doc?.landlordId, 240) === landlordId ||
      applicationIds.has(asString(doc?.applicationId, 240))
  );
  const financialTransactions = financialTransactionsRaw.filter(
    (doc) =>
      asString(doc?.landlordId, 240) === landlordId ||
      applicationIds.has(asString(doc?.applicationId, 240))
  );

  const scopedCanonicalEvents = canonicalEventsRaw.filter((event) => {
    const applicationId = asString(event.metadata?.applicationId, 240);
    const maintenanceRequestId = asString(event.metadata?.maintenanceRequestId, 240);
    const resourceId = asString(event.resource?.id, 240);
    return (
      applications.some((doc) => matchesApplicationResource(asString(doc.id, 240), event)) ||
      maintenanceRequests.some((doc) => matchesMaintenanceResource(asString(doc.id, 240), event)) ||
      leases.some((doc) => matchesLeaseResource(asString(doc.id, 240), event)) ||
      applicationIds.has(applicationId) ||
      maintenanceRequests.some((doc) => asString(doc.id, 240) === maintenanceRequestId) ||
      applicationIds.has(resourceId)
    );
  });

  const latestOrders = latestOrderByApplication(screeningOrders);
  const txByApplication = transactionsByApplication(financialTransactions);

  const applicationInsights = applications.map((application) => {
    const resourceId = asString(application.id, 240);
    const events = relatedApplicationEvents(resourceId, scopedCanonicalEvents);
    const hasScreening = events.some((event) => event.domain === "screening");
    return deriveInsightForResource(events, {
      resourceType: "rental_application",
      resourceId,
      domain: hasScreening ? "screening" : "application",
    });
  });

  const maintenanceInsights = maintenanceRequests.map((maintenance) =>
    deriveInsightForResource(relatedMaintenanceEvents(asString(maintenance.id, 240), scopedCanonicalEvents), {
      resourceType: "maintenance_request",
      resourceId: asString(maintenance.id, 240),
      domain: "maintenance",
    })
  );

  const leaseInsights = leases.map((lease) =>
    deriveInsightForResource(relatedLeaseEvents(asString(lease.id, 240), scopedCanonicalEvents), {
      resourceType: "lease",
      resourceId: asString(lease.id, 240),
      domain: "lease",
    })
  );

  const screeningReconciliations = applications.map((application) =>
    deriveScreeningReconciliation({
      applicationId: asString(application.id, 240),
      application,
      latestOrder: latestOrders.get(asString(application.id, 240)) || null,
      canonicalEvents: scopedCanonicalEvents,
      financialTransactions: txByApplication.get(asString(application.id, 240)) || [],
    })
  );

  const triageItems = deriveAdminTriageQueue({
    applications,
    maintenanceRequests,
    leases,
    canonicalEvents: scopedCanonicalEvents,
    screeningOrders,
    financialTransactions,
  });

  const policyEvents = scopedCanonicalEvents.filter((event) => event.type === "policy.evaluated");
  const automationEvents = scopedCanonicalEvents.filter(
    (event) => event.type === "automation.executed" || event.type === "automation.skipped"
  );

  return {
    portfolioId: landlordId,
    applications,
    maintenanceRequests,
    leases,
    canonicalEvents: scopedCanonicalEvents,
    screeningOrders,
    financialTransactions,
    applicationInsights,
    maintenanceInsights,
    leaseInsights,
    screeningReconciliations,
    triageItems,
    policyEvents,
    automationEvents,
  };
}

