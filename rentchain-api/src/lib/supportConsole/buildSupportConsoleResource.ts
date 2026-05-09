import { db } from "../../config/firebase";
import { loadAssignmentRecord } from "../assignment/loadAssignmentRecord";
import { CANONICAL_EVENTS_COLLECTION } from "../events/buildEvent";
import type { CanonicalEventV1 } from "../events/eventTypes";
import { deriveInsightForResource } from "../insights/deriveInsights";
import { deriveScreeningReconciliation } from "../reconciliation/deriveScreeningReconciliation";
import { loadResolutionRecord } from "../resolution/loadResolutionRecord";
import { deriveSlaState } from "../sla/deriveSlaState";
import { deriveAdminTriageQueue } from "../triage/deriveAdminTriageQueue";
import { loadWatchlistEntries } from "../watchlist/loadWatchlistEntries";
import { canonicalEventToTimelineItem } from "../timeline/timelineAdapter";
import { redactIdentifier, redactIdentifierMap } from "../governance/platformGovernance";
import { getSupportInstitutionAccessDiagnostic } from "../../services/tenantPortal/tenantInstitutionAccessService";
import { buildOperatorAuditTimeline } from "./operatorAuditTimeline";
import type {
  SupportConsoleAutomationItem,
  SupportConsolePolicyDecision,
  SupportConsoleResourceResponse,
} from "./supportConsoleTypes";

type SupportedResourceType = "application" | "maintenance" | "lease" | "institution_access";

type NormalizedResourceSpec = {
  requestedType: SupportedResourceType;
  canonicalType:
    | "rental_application"
    | "maintenance_request"
    | "lease"
    | "tenant_institution_access_grant";
  collectionName: "rentalApplications" | "maintenanceRequests" | "leases" | "tenantInstitutionAccessGrants";
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
  if (
    raw === "institution_access" ||
    raw === "tenant_institution_access" ||
    raw === "tenant_institution_access_grant"
  ) {
    return {
      requestedType: "institution_access",
      canonicalType: "tenant_institution_access_grant",
      collectionName: "tenantInstitutionAccessGrants",
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

function matchesInstitutionAccessResource(resourceId: string, event: CanonicalEventV1) {
  return (
    (asString(event.resource?.type, 120) === "tenant_institution_access_grant" &&
      asString(event.resource?.id, 240) === resourceId) ||
    asString(event.resource?.parentId, 240) === resourceId ||
    asString(event.metadata?.grantId, 240) === resourceId ||
    asString(event.metadata?.resourceId, 240) === resourceId
  );
}

function isRelatedResource(spec: NormalizedResourceSpec, resourceId: string, event: CanonicalEventV1) {
  if (spec.requestedType === "application") return matchesApplicationResource(resourceId, event);
  if (spec.requestedType === "maintenance") return matchesMaintenanceResource(resourceId, event);
  if (spec.requestedType === "institution_access") return matchesInstitutionAccessResource(resourceId, event);
  return matchesLeaseResource(resourceId, event);
}

function preferredInsightDomain(spec: NormalizedResourceSpec, events: CanonicalEventV1[]) {
  const domains = new Set(events.map((event) => asString(event.domain, 40)));
  if (spec.requestedType === "application") {
    if (domains.has("screening")) return "screening";
    return "application";
  }
  if (spec.requestedType === "maintenance") return "maintenance";
  if (spec.requestedType === "institution_access") return "system";
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

function buildInstitutionAccessHeader(resourceId: string, doc: any, diagnostic: any) {
  const audience = asOptionalString(diagnostic?.audience || doc?.audience, 80);
  const purpose = asOptionalString(diagnostic?.purpose || doc?.purpose, 120);
  const organizationName = asOptionalString(diagnostic?.recipient?.organizationName || doc?.recipient?.organizationName, 160);
  return {
    type: "institution_access",
    id: resourceId,
    title: organizationName ? `Institution access for ${organizationName}` : `Institution access ${resourceId}`,
    subtitle: [audience ? `Audience ${audience}` : null, purpose ? `Purpose ${purpose}` : null]
      .filter(Boolean)
      .join(" • ") || null,
    status: asOptionalString(diagnostic?.lifecycle || doc?.lifecycle, 120),
    parentType: "tenant",
    parentId: asOptionalString(diagnostic?.tenant?.redactedTenantId, 120),
  };
}

function buildDebugIdentifiers(spec: NormalizedResourceSpec, doc: any, reconciliation: any) {
  if (spec.requestedType === "institution_access") {
    return {
      grantReference: redactIdentifier(doc?.grantId),
      tenantReference: redactIdentifier(doc?.tenantId),
      recipientEmail: asOptionalString(doc?.recipient?.email, 240),
    };
  }

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

async function loadTenantTrustExportsForInstitutionGrant(doc: any) {
  const tenantId = asString(doc?.tenantId, 240);
  const audience = asString(doc?.audience, 120);
  const purpose = asString(doc?.purpose, 120);
  if (!tenantId) return [];
  const collection = db.collection("tenantTrustExports") as any;
  const tenantQuery =
    typeof collection.where === "function"
      ? collection.where("tenantId", "==", tenantId)
      : collection;
  const limitedQuery = typeof tenantQuery.limit === "function" ? tenantQuery.limit(50) : tenantQuery;
  const snap = await limitedQuery.get();
  return (snap.docs || [])
    .map((exportDoc: any) => ({ exportId: String(exportDoc.id || ""), ...(exportDoc.data?.() || {}) }))
    .filter((record: any) => {
      if (asString(record?.tenantId, 240) !== tenantId) return false;
      if (audience && asString(record?.audience, 120) !== audience) return false;
      if (purpose && asString(record?.purpose, 120) !== purpose) return false;
      return true;
    });
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
    sla: null,
    assignment: null,
    resolution: null,
    watch: null,
    debug: {
      canonicalEventCount: 0,
      domainsPresent: [],
      identifiers: {},
    },
    governance: {
      sensitivity: "restricted",
      metadataOnly: true,
      retentionCategory: "support_diagnostics",
      redactionApplied: true,
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

  if (spec.requestedType === "institution_access") {
    const diagnostic = await getSupportInstitutionAccessDiagnostic({ grantId: resourceId });
    const tenantTrustExports = await loadTenantTrustExportsForInstitutionGrant(doc);
    const operatorAuditTimeline = buildOperatorAuditTimeline({
      grantId: resourceId,
      grant: doc,
      diagnostic,
      canonicalEvents: sortedEvents,
      tenantTrustExports,
    });
    return {
      resource: buildInstitutionAccessHeader(resourceId, doc, diagnostic),
      timeline: sortedEvents.map(canonicalEventToTimelineItem),
      insight: diagnostic
        ? {
            lifecycle: diagnostic.lifecycle,
            audience: diagnostic.audience,
            purpose: diagnostic.purpose,
            lastOutcome: diagnostic.audit.lastOutcome,
            lastReason: diagnostic.audit.lastReason,
          }
        : null,
      policyDecisions: [],
      automation: [],
      reconciliation: null,
      sla: null,
      assignment: null,
      resolution: null,
      watch: null,
      institutionAccessDiagnostic: diagnostic,
      operatorAuditTimeline,
      debug: {
        canonicalEventCount: relatedEvents.length,
        domainsPresent: domainsPresent(relatedEvents),
        identifiers: redactIdentifierMap(buildDebugIdentifiers(spec, doc, null)),
      },
      governance: {
        sensitivity: "restricted",
        metadataOnly: true,
        retentionCategory: "support_diagnostics",
        redactionApplied: true,
      },
    };
  }

  const insight = deriveInsightForResource(relatedEvents, {
    resourceType: spec.canonicalType,
    resourceId,
    domain: preferredInsightDomain(spec, relatedEvents) as any,
  });

  let reconciliation: Record<string, unknown> | null = null;
  let latestOrder: any = null;
  let financialTransactions: any[] = [];
  const [assignment, resolution, watchlist] = await Promise.all([
    loadAssignmentRecord({
      resourceType: spec.requestedType,
      resourceId,
    }),
    loadResolutionRecord({
      resourceType: spec.requestedType,
      resourceId,
    }),
    loadWatchlistEntries(),
  ]);
  const watch =
    watchlist.find(
      (entry) => entry.isActive && entry.target.type === spec.requestedType && entry.target.id === resourceId
    ) || null;
  if (spec.requestedType === "application") {
    [latestOrder, financialTransactions] = await Promise.all([
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

  const triageItem =
    deriveAdminTriageQueue({
      applications: spec.requestedType === "application" ? [{ id: resourceId, ...doc }] : [],
      maintenanceRequests: spec.requestedType === "maintenance" ? [{ id: resourceId, ...doc }] : [],
      leases: spec.requestedType === "lease" ? [{ id: resourceId, ...doc }] : [],
      canonicalEvents: relatedEvents,
      screeningOrders: latestOrder ? [latestOrder] : [],
      financialTransactions,
      resolutions: resolution ? [resolution] : [],
      assignments: assignment ? [assignment] : [],
      watchlist: watch ? [watch] : [],
    }).find((item) => item.resource.type === spec.requestedType && item.resource.id === resourceId) || null;

  const sla = triageItem
    ? deriveSlaState({
        resourceType: triageItem.resource.type,
        resourceId: triageItem.resource.id,
        triageCategory: triageItem.category,
        triageSeverity: triageItem.severity,
        resolutionStatus: resolution?.status || null,
        assignmentOwnerId: assignment?.currentOwner?.ownerId || null,
        assignmentOwnerLabel: assignment?.currentOwner?.ownerLabel || null,
        firstSeenAt: triageItem.timestamps.firstSeenAt || triageItem.timestamps.surfacedAt,
        lastSeenAt: triageItem.timestamps.lastSeenAt || triageItem.timestamps.surfacedAt,
      })
    : null;

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
    sla,
    assignment,
    resolution,
    watch,
    debug: {
      canonicalEventCount: relatedEvents.length,
      domainsPresent: domainsPresent(relatedEvents),
      identifiers: redactIdentifierMap(buildDebugIdentifiers(spec, doc, reconciliation)),
    },
    governance: {
      sensitivity: "restricted",
      metadataOnly: true,
      retentionCategory: "support_diagnostics",
      redactionApplied: true,
    },
  };
}
