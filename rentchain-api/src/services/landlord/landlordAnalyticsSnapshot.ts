import { db } from "../../config/firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../../lib/events/buildEvent";
import type { CanonicalEventV1 } from "../../lib/events/eventTypes";
import {
  asAnalyticsString,
  clampAnalyticsPeriod,
  isAnalyticsVisibleCanonicalEvent,
  latestOrderByApplication,
  resolveAnalyticsWindow,
  shouldDeriveScreeningReconciliation,
} from "../../lib/analytics/analyticsCore";
import type { AdminAnalyticsDerivedInput, LandlordAnalyticsSnapshot } from "../../lib/analytics/analyticsTypes";
import { applyDecisionAutomationRules } from "../../lib/analytics/deriveDecisionAutomationRules";
import { applyDecisionExecutionMappings } from "../../lib/analytics/deriveDecisionExecutionMappings";
import { applyDecisionExecutionState } from "../../lib/analytics/deriveDecisionExecutionState";
import { deriveLandlordAnalyticsSnapshot } from "../../lib/analytics/deriveLandlordAnalyticsSnapshot";
import { deriveScreeningReconciliation } from "../../lib/reconciliation/deriveScreeningReconciliation";
import { buildReviewSummary } from "../../lib/reviewSummary";
import { deriveLandlordTrustContext } from "../../lib/trust/deriveLandlordTrustContext";
import { emitLandlordDecisionAppearanceEvents } from "./landlordDecisionAppearanceEvents";
import { loadLandlordDecisionStates, mergeLandlordDecisionStates } from "./landlordDecisionStates";
import { deriveLandlordDecisionOutcomeAnalytics } from "./landlordDecisionOutcomeAnalytics";
import {
  deriveLandlordSafeApplicationReusableFromApplication,
  loadLandlordSafeTenantIdentitySummary,
} from "../tenantPortal/tenantProfileService";

type LandlordAnalyticsParams = {
  landlordId: string;
  period?: string;
  propertyId?: string;
  now?: number;
};

function hasLandlordScope(doc: any, landlordId: string) {
  return [doc?.landlordId, doc?.ownerId, doc?.userId].some((value) => asAnalyticsString(value, 240) === landlordId);
}

function normalizePortfolioStatus(value: unknown): "active" | "archived" {
  return asAnalyticsString(value, 40).toLowerCase() === "archived" ? "archived" : "active";
}

function isVisibleAnalyticsProperty(doc: any) {
  if (!doc) return false;
  if (normalizePortfolioStatus(doc?.portfolioStatus) === "archived") return false;
  if (Boolean(doc?.archivedAt)) return false;
  if (doc?.hiddenFromActiveLists === true) return false;
  return true;
}

function docPropertyId(doc: any) {
  return asAnalyticsString(doc?.propertyId || doc?.property?.id, 240);
}

function docApplicationId(doc: any) {
  return asAnalyticsString(doc?.applicationId, 240);
}

function matchesPropertyScope(doc: any, propertyIds: Set<string>) {
  const propertyId = docPropertyId(doc);
  return propertyId ? propertyIds.has(propertyId) : false;
}

function matchesScopedDoc(doc: any, landlordId: string, propertyIds: Set<string>, propertyFilterActive: boolean) {
  if (propertyFilterActive) return matchesPropertyScope(doc, propertyIds);
  return hasLandlordScope(doc, landlordId) || matchesPropertyScope(doc, propertyIds);
}

function isCanonicalEventScoped(params: {
  event: CanonicalEventV1;
  landlordId: string;
  propertyIds: Set<string>;
  applicationIds: Set<string>;
  leaseIds: Set<string>;
  workOrderIds: Set<string>;
}) {
  const { event, landlordId, propertyIds, applicationIds, leaseIds, workOrderIds } = params;
  if (asAnalyticsString((event as any)?.landlordId, 240) === landlordId) return true;
  if (propertyIds.has(asAnalyticsString((event as any)?.propertyId, 240))) return true;
  if (propertyIds.has(asAnalyticsString(event.metadata?.propertyId, 240))) return true;
  if (propertyIds.has(asAnalyticsString(event.resource?.id, 240)) && asAnalyticsString(event.resource?.type, 80) === "property") {
    return true;
  }
  if (applicationIds.has(asAnalyticsString(event.metadata?.applicationId, 240))) return true;
  if (applicationIds.has(asAnalyticsString(event.resource?.id, 240)) && asAnalyticsString(event.resource?.type, 80) === "rental_application") {
    return true;
  }
  if (leaseIds.has(asAnalyticsString(event.metadata?.leaseId, 240))) return true;
  if (leaseIds.has(asAnalyticsString(event.resource?.id, 240)) && asAnalyticsString(event.resource?.type, 80) === "lease") {
    return true;
  }
  if (workOrderIds.has(asAnalyticsString(event.metadata?.maintenanceRequestId, 240))) return true;
  if (workOrderIds.has(asAnalyticsString(event.metadata?.workOrderId, 240))) return true;
  if (
    workOrderIds.has(asAnalyticsString(event.resource?.id, 240)) &&
    ["maintenance_request", "work_order"].includes(asAnalyticsString(event.resource?.type, 80))
  ) {
    return true;
  }
  return false;
}

async function loadCollection(name: string) {
  return await db.collection(name).get().catch(() => ({ docs: [] } as any));
}

function buildDerivedInput(params: {
  landlordId: string;
  propertyId?: string;
  now: number;
  period: ReturnType<typeof clampAnalyticsPeriod>;
  from: number;
  to: number;
  applicationsRaw: any[];
  workOrdersRaw: any[];
  propertiesRaw: any[];
  unitsRaw: any[];
  leasesRaw: any[];
  eventsRaw: any[];
  canonicalEventsRaw: CanonicalEventV1[];
  financialTransactionsRaw: any[];
  screeningOrdersRaw: any[];
}): AdminAnalyticsDerivedInput & { propertyId?: string | null } {
  const scopedProperties = params.propertiesRaw.filter(
    (doc) => hasLandlordScope(doc, params.landlordId) && isVisibleAnalyticsProperty(doc)
  );
  const initialPropertyIds = new Set(scopedProperties.map((doc) => asAnalyticsString(doc?.id, 240)).filter(Boolean));
  const propertyIdFilter = asAnalyticsString(params.propertyId, 240);
  const propertyFilterActive = Boolean(propertyIdFilter);
  const propertyIds = propertyIdFilter
    ? new Set(Array.from(initialPropertyIds).filter((id) => id === propertyIdFilter))
    : initialPropertyIds;
  const properties = scopedProperties.filter((doc) => propertyIds.has(asAnalyticsString(doc?.id, 240)));

  const applications = params.applicationsRaw.filter((doc) =>
    matchesScopedDoc(doc, params.landlordId, propertyIds, propertyFilterActive)
  );
  const applicationIds = new Set(applications.map((doc) => asAnalyticsString(doc?.id, 240)).filter(Boolean));

  const workOrders = params.workOrdersRaw.filter((doc) =>
    matchesScopedDoc(doc, params.landlordId, propertyIds, propertyFilterActive)
  );
  const workOrderIds = new Set(workOrders.map((doc) => asAnalyticsString(doc?.id, 240)).filter(Boolean));

  const units = params.unitsRaw.filter((doc) => matchesScopedDoc(doc, params.landlordId, propertyIds, propertyFilterActive));
  const leases = params.leasesRaw.filter((doc) => matchesScopedDoc(doc, params.landlordId, propertyIds, propertyFilterActive));
  const leaseIds = new Set(leases.map((doc) => asAnalyticsString(doc?.id, 240)).filter(Boolean));

  const events = params.eventsRaw.filter((doc) => {
    if (!propertyFilterActive && hasLandlordScope(doc, params.landlordId)) return true;
    if (matchesPropertyScope(doc, propertyIds)) return true;
    if (applicationIds.has(docApplicationId(doc))) return true;
    if (leaseIds.has(asAnalyticsString(doc?.leaseId, 240))) return true;
    return false;
  });

  const canonicalEvents = params.canonicalEventsRaw.filter((event) =>
    isCanonicalEventScoped({
      event,
      landlordId: params.landlordId,
      propertyIds,
      applicationIds,
      leaseIds,
      workOrderIds,
    })
  );

  const financialTransactions = params.financialTransactionsRaw.filter(
    (doc) => (!propertyFilterActive && hasLandlordScope(doc, params.landlordId)) || applicationIds.has(docApplicationId(doc))
  );
  const screeningOrders = params.screeningOrdersRaw.filter(
    (doc) => (!propertyFilterActive && hasLandlordScope(doc, params.landlordId)) || applicationIds.has(docApplicationId(doc))
  );

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
        now: params.now,
      })
    )
    .map((reconciliation: any) => ({
      applicationId: asAnalyticsString(reconciliation?.applicationId, 240),
      status: reconciliation.status,
      summary: {
        hasQuote: Boolean(reconciliation?.summary?.hasQuote),
        hasCheckout: Boolean(reconciliation?.summary?.hasCheckout),
        hasPaidEvent: Boolean(reconciliation?.summary?.hasPaidEvent),
        hasFulfillment: Boolean(reconciliation?.summary?.hasFulfillment),
        lastMeaningfulEventAt:
          typeof reconciliation?.summary?.lastMeaningfulEventAt === "string"
            ? reconciliation.summary.lastMeaningfulEventAt
            : null,
      },
    }));

  return {
    now: params.now,
    from: params.from,
    to: params.to,
    period: params.period,
    granularity: "daily",
    propertyId: propertyIdFilter || null,
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
  };
}

export async function loadLandlordAnalyticsSnapshot(params: LandlordAnalyticsParams): Promise<LandlordAnalyticsSnapshot> {
  const landlordId = asAnalyticsString(params.landlordId, 240);
  const now = typeof params.now === "number" ? params.now : Date.now();
  const occurredAt = new Date(now).toISOString();
  const period = clampAnalyticsPeriod(params.period);
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
    loadCollection("rentalApplications"),
    loadCollection("workOrders"),
    loadCollection("properties"),
    loadCollection("units"),
    loadCollection("leases"),
    loadCollection("events"),
    loadCollection(CANONICAL_EVENTS_COLLECTION),
    loadCollection("financialTransactions"),
    loadCollection("screeningOrders"),
  ]);

  const canonicalEventsRaw = (canonicalEventsSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as CanonicalEventV1);

  const derivedInput = buildDerivedInput({
    landlordId,
    propertyId: params.propertyId,
    now,
    period,
    from,
    to,
    applicationsRaw: (applicationsSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
    workOrdersRaw: (workOrdersSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
    propertiesRaw: (propertiesSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
    unitsRaw: (unitsSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
    leasesRaw: (leasesSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
    eventsRaw: (eventsSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
    canonicalEventsRaw: canonicalEventsRaw.filter(isAnalyticsVisibleCanonicalEvent),
    financialTransactionsRaw: (financialTransactionsSnap.docs || []).map((doc: any) => ({
      id: doc.id,
      ...(doc.data() || {}),
    })),
    screeningOrdersRaw: (screeningOrdersSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) })),
  });

  const snapshot = deriveLandlordAnalyticsSnapshot(derivedInput);
  const decisionStates = await loadLandlordDecisionStates(landlordId);
  const decisions = applyDecisionExecutionState({
    decisions: applyDecisionAutomationRules(
      applyDecisionExecutionMappings({
        decisions: mergeLandlordDecisionStates(snapshot.decisions.items, decisionStates),
        leases: derivedInput.leases,
        workOrders: derivedInput.workOrders,
        applications: derivedInput.applications,
        screeningOrders: derivedInput.screeningOrders,
        now,
      })
    ),
    canonicalEvents: canonicalEventsRaw,
  });

  const emittedAppearanceEvents = await emitLandlordDecisionAppearanceEvents({
    landlordId,
    decisions,
    canonicalEvents: canonicalEventsRaw,
    occurredAt,
  });

  const decisionsWithTrustContext = await Promise.all(
    decisions.map(async (decision) => {
      if (decision.decisionType !== "start_screening_checkout" && decision.decisionType !== "improve_application_conversion") {
        return decision;
      }

      let application: any | null = null;
      if (decision.decisionType === "start_screening_checkout") {
        const applicationId = String(decision.id || "").replace(/^start_screening_checkout:/, "").trim();
        application =
          derivedInput.applications.find((entry: any) => asAnalyticsString(entry?.id, 240) === applicationId) || null;
      } else {
        const eligibleApplications = (derivedInput.applications || []).filter((entry: any) => {
          const status = asAnalyticsString(entry?.status, 80)?.toLowerCase() || "";
          return ["submitted", "in_progress", "pending_review", "approved"].includes(status);
        });
        application = eligibleApplications.length === 1 ? eligibleApplications[0] : null;
      }

      if (!application || !asAnalyticsString(application?.id, 240)) {
        return decision;
      }

      const applicationId = asAnalyticsString(application.id, 240)!;
      const summary = buildReviewSummary(applicationId, application);
      const tenantIdentitySummary = await loadLandlordSafeTenantIdentitySummary({
        applicationId,
        application,
      });

      return {
        ...decision,
        trustContext: deriveLandlordTrustContext({
          tenantIdentitySummary,
          completenessScore: summary?.derived?.completeness?.score ?? null,
          completenessFlags: Array.isArray(summary?.derived?.flags) ? summary.derived.flags : [],
          screeningStatus: summary?.screening?.status,
          applicationReusable: deriveLandlordSafeApplicationReusableFromApplication(application),
        }),
      };
    })
  );

  return {
      ...snapshot,
      decisions: {
        ...snapshot.decisions,
        items: decisionsWithTrustContext,
      },
      decisionOutcomeAnalytics: deriveLandlordDecisionOutcomeAnalytics({
        landlordId,
        canonicalEvents: [...canonicalEventsRaw, ...emittedAppearanceEvents],
      }),
  };
}
