import { db } from "../../config/firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../events/buildEvent";
import type { CanonicalEventV1 } from "../events/eventTypes";
import { deriveInsightForResource } from "../insights/deriveInsights";
import { deriveScreeningReconciliation } from "../reconciliation/deriveScreeningReconciliation";
import { loadResolutionRecord } from "../resolution/loadResolutionRecord";
import { canonicalEventToTimelineItem } from "../timeline/timelineAdapter";
import type {
  SupportConsoleAutomationItem,
  SupportConsolePolicyDecision,
  SupportConsoleResourceResponse,
} from "./supportConsoleTypes";

type SupportedResourceType = "application" | "maintenance" | "lease";

type NormalizedResourceSpec = {
  requestedType: SupportedResourceType;
  canonicalType: "rental_application" | "maintenance_request" | "lease";
  collectionName: "rentalApplications" | "maintenanceRequests" | "leases";
};

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 240) {
  const next = asString(value, max);
  return next || null;
}

function parseTimestamp(value: unknown) {
  const raw = asString(value, 200);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeResourceType(value: unknown): NormalizedResourceSpec | null {
  const raw = asString(value, 120).toLowerCase();
  if (raw === "application" || raw === "rental_application") {
    return {
      requestedType: "application",
      canonicalType: "rental_application",
      collectionName: "rentalApplications",
    };
  }
  if (raw === "maintenance" || raw === "maintenance_request") {
    return {
      requestedType: "maintenance",
      canonicalType: "maintenance_request",
      collectionName: "maintenanceRequests",
    };
  }
  if (raw === "lease") {
    return {
      requestedType: "lease",
      canonicalType: "lease",
      collectionName: "leases",
    };
  }
  return null;
}

function compareEventsDescending(a: CanonicalEventV1, b: CanonicalEventV1) {
  const aTs = parseTimestamp(a.occurredAt) ?? parseTimestamp(a.recordedAt) ?? 0;
  const bTs = parseTimestamp(b.occurredAt) ?? parseTimestamp(b.recordedAt) ?? 0;
  if (bTs !== aTs) return bTs - aTs;
  return String(b.id || "").localeCompare(String(a.id || ""));
}

function domainsPresent(events: CanonicalEventV1[]) {
  return Array.from(new Set(events.map((event) => asString(event.domain, 40)).filter(Boolean))).sort();
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

function isRelatedResource(spec: NormalizedResourceSpec, resourceId: string, event: CanonicalEventV1) {
  if (spec.requestedType === "application") return matchesApplicationResource(resourceId, event);
  if (spec.requestedType === "maintenance") return matchesMaintenanceResource(resourceId, event);
  return matchesLeaseResource(resourceId, event);
}

function preferredInsightDomain(spec: NormalizedResourceSpec, events: CanonicalEventV1[]) {
  const domains = new Set(events.map((event) => asString(event.domain, 40)));
  if (spec.requestedType === "application") {
    if (domains.has("screening")) return "screening";
    return "application";
  }
  if (spec.requestedType === "maintenance") return "maintenance";
  return "lease";
}

function buildPolicyDecisions(events: CanonicalEventV1[]): SupportConsolePolicyDecision[] {
  return events
    .filter((event) => event.type === "policy.evaluated")
    .sort(compareEventsDescending)
    .map((event) => {
      const topReasonCode = asOptionalString(event.metadata?.topReasonCode, 120);
      return {
        id: event.id,
        timestamp: event.occurredAt || event.recordedAt,
        action: asOptionalString(event.metadata?.action, 120),
        outcome: asOptionalString(event.metadata?.outcome || event.status, 80),
        reasonCodes: topReasonCode ? [topReasonCode] : [],
        summary: asOptionalString(event.summary, 500),
      };
    });
}

function buildAutomationHistory(events: CanonicalEventV1[]): SupportConsoleAutomationItem[] {
  return events
    .filter((event) => event.type === "automation.executed" || event.type === "automation.skipped")
    .sort(compareEventsDescending)
    .map((event) => ({
      id: event.id,
      timestamp: event.occurredAt || event.recordedAt,
      action: asOptionalString(event.metadata?.action, 160),
      executed: Boolean(event.metadata?.executed === true || event.type === "automation.executed"),
      skipped: Boolean(event.metadata?.skipped === true || event.type === "automation.skipped"),
      reason: asOptionalString(event.metadata?.reason, 240),
      summary: asOptionalString(event.summary, 500),
    }));
}

function buildApplicationHeader(resourceId: string, application: any) {
  const applicantName =
    asOptionalString(application?.applicantName, 200) ||
    asOptionalString(application?.fullName, 200) ||
    asOptionalString(application?.applicantFullName, 200) ||
    asOptionalString(application?.tenantName, 200);
  const propertyId = asOptionalString(application?.propertyId, 120);
  const unitId = asOptionalString(application?.unitId, 120);
  return {
    type: "application",
    id: resourceId,
    title: applicantName || `Application ${resourceId}`,
    subtitle:
      [propertyId ? `Property ${propertyId}` : null, unitId ? `Unit ${unitId}` : null]
        .filter(Boolean)
        .join(" • ") || null,
    status:
      asOptionalString(application?.screeningStatus, 120) ||
      asOptionalString(application?.status, 120),
    parentType: null,
    parentId: null,
  };
}

function buildMaintenanceHeader(resourceId: string, maintenance: any) {
  const title =
    asOptionalString(maintenance?.title, 200) ||
    asOptionalString(maintenance?.issueTitle, 200) ||
    asOptionalString(maintenance?.category, 200) ||
    `Maintenance ${resourceId}`;
  const propertyId = asOptionalString(maintenance?.propertyId, 120);
  const unitId = asOptionalString(maintenance?.unitId, 120);
  return {
    type: "maintenance",
    id: resourceId,
    title,
    subtitle:
      [propertyId ? `Property ${propertyId}` : null, unitId ? `Unit ${unitId}` : null]
        .filter(Boolean)
        .join(" • ") || null,
    status: asOptionalString(maintenance?.status, 120),
    parentType: null,
    parentId: null,
  };
}

function buildLeaseHeader(resourceId: string, lease: any) {
  const tenantName =
    asOptionalString(lease?.tenantName, 200) ||
    asOptionalString(lease?.primaryTenantName, 200);
  const unitId = asOptionalString(lease?.unitId, 120);
  const propertyId = asOptionalString(lease?.propertyId, 120);
  return {
    type: "lease",
    id: resourceId,
    title: tenantName || (unitId ? `Lease for unit ${unitId}` : `Lease ${resourceId}`),
    subtitle:
      [propertyId ? `Property ${propertyId}` : null, unitId ? `Unit ${unitId}` : null]
        .filter(Boolean)
        .join(" • ") || null,
    status: asOptionalString(lease?.status, 120),
    parentType: null,
    parentId: null,
  };
}

function buildDebugIdentifiers(spec: NormalizedResourceSpec, doc: any, reconciliation: any) {
  const identifiers: Record<string, string | null | undefined> = {
    landlordId: asOptionalString(doc?.landlordId, 120),
    propertyId: asOptionalString(doc?.propertyId, 120),
    unitId: asOptionalString(doc?.unitId, 120),
    tenantId: asOptionalString(doc?.tenantId, 120),
  };

  if (spec.requestedType === "application") {
    identifiers.quoteId = asOptionalString(reconciliation?.linkedIds?.quoteId, 240);
    identifiers.checkoutSessionId = asOptionalString(reconciliation?.linkedIds?.checkoutSessionId, 240);
    identifiers.screeningOrderId = asOptionalString(reconciliation?.linkedIds?.screeningOrderId, 240);
  }

  if (spec.requestedType === "maintenance") {
    identifiers.workOrderId = asOptionalString(doc?.workOrderId, 120);
  }

  return identifiers;
}

async function loadCanonicalEvents() {
  const snap = await db.collection(CANONICAL_EVENTS_COLLECTION).get();
  return (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as CanonicalEventV1)
    .filter(isVisibleToAdmin);
}

async function loadLatestScreeningOrder(applicationId: string) {
  const snap = await db.collection("screeningOrders").get();
  const orders = (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((order: any) => asString(order?.applicationId, 240) === applicationId)
    .sort((a: any, b: any) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
  return orders[0] || null;
}

async function loadFinancialTransactions(applicationId: string) {
  const snap = await db.collection("financialTransactions").get();
  return (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
    .filter((tx: any) => asString(tx?.applicationId, 240) === applicationId);
}

function emptyResponse(spec: NormalizedResourceSpec, resourceId: string): SupportConsoleResourceResponse {
  return {
    resource: {
      type: spec.requestedType,
      id: resourceId,
      title: null,
      subtitle: null,
      status: null,
      parentType: null,
      parentId: null,
    },
    timeline: [],
    insight: null,
    policyDecisions: [],
    automation: [],
    reconciliation: null,
    resolution: null,
    debug: {
      canonicalEventCount: 0,
      domainsPresent: [],
      identifiers: {},
    },
  };
}

export async function buildSupportConsoleResource(input: {
  resourceType: string;
  resourceId: string;
}): Promise<SupportConsoleResourceResponse | null> {
  const spec = normalizeResourceType(input.resourceType);
  const resourceId = asString(input.resourceId, 240);
  if (!spec || !resourceId) return null;

  const snap = await db.collection(spec.collectionName).doc(resourceId).get();
  if (!snap.exists) {
    return emptyResponse(spec, resourceId);
  }

  const doc = snap.data() || {};
  const canonicalEvents = await loadCanonicalEvents();
  const relatedEvents = canonicalEvents.filter((event) => isRelatedResource(spec, resourceId, event));
  const sortedEvents = [...relatedEvents].sort(compareEventsDescending);
  const insight = deriveInsightForResource(relatedEvents, {
    resourceType: spec.canonicalType,
    resourceId,
    domain: preferredInsightDomain(spec, relatedEvents) as any,
  });

  let reconciliation: Record<string, unknown> | null = null;
  const resolution = await loadResolutionRecord({
    resourceType: spec.requestedType,
    resourceId,
  });
  if (spec.requestedType === "application") {
    const [latestOrder, financialTransactions] = await Promise.all([
      loadLatestScreeningOrder(resourceId),
      loadFinancialTransactions(resourceId),
    ]);
    reconciliation = deriveScreeningReconciliation({
      applicationId: resourceId,
      application: doc,
      latestOrder,
      canonicalEvents,
      financialTransactions,
    }) as Record<string, unknown>;
  }

  return {
    resource:
      spec.requestedType === "application"
        ? buildApplicationHeader(resourceId, doc)
        : spec.requestedType === "maintenance"
        ? buildMaintenanceHeader(resourceId, doc)
        : buildLeaseHeader(resourceId, doc),
    timeline: sortedEvents.map(canonicalEventToTimelineItem),
    insight: (insight as unknown as Record<string, unknown>) || null,
    policyDecisions: buildPolicyDecisions(relatedEvents),
    automation: buildAutomationHistory(relatedEvents),
    reconciliation,
    resolution,
    debug: {
      canonicalEventCount: relatedEvents.length,
      domainsPresent: domainsPresent(relatedEvents),
      identifiers: buildDebugIdentifiers(spec, doc, reconciliation),
    },
  };
}
