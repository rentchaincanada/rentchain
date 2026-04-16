import type { CanonicalEventV1 } from "../events/eventTypes";
import { deriveInsightForResource } from "../insights/deriveInsights";
import { deriveScreeningReconciliation } from "../reconciliation/deriveScreeningReconciliation";
import type { ScreeningReconciliationV1 } from "../reconciliation/reconciliationTypes";
import type { ResolutionRecordV1 } from "../resolution/resolutionTypes";
import type { AdminTriageItemV1, TriageCategory, TriageSeverity } from "./triageTypes";

type ScreeningOrderLike = {
  id?: string | null;
  applicationId?: string | null;
  updatedAt?: number | null;
  createdAt?: number | null;
  stripeCheckoutSessionId?: string | null;
  stripeSessionId?: string | null;
};

type FinancialTransactionLike = {
  type?: string | null;
  status?: string | null;
  applicationId?: string | null;
  createdAt?: number | null;
  metadata?: Record<string, unknown> | null;
};

type DeriveAdminTriageQueueInput = {
  applications?: any[];
  maintenanceRequests?: any[];
  leases?: any[];
  canonicalEvents?: CanonicalEventV1[];
  screeningOrders?: ScreeningOrderLike[];
  financialTransactions?: FinancialTransactionLike[];
  resolutions?: ResolutionRecordV1[];
  now?: number;
};

const MAINTENANCE_STALL_THRESHOLD_MS = 48 * 60 * 60 * 1000;

const IMPORTANT_POLICY_ACTIONS = new Set([
  "start_checkout",
  "approve_cost",
  "send_notice",
]);

const SEVERITY_ORDER: Record<TriageSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
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

function toIsoFromMs(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Date(value).toISOString() : null;
}

function compareEventsAscending(a: CanonicalEventV1, b: CanonicalEventV1) {
  const aTs = parseTimestamp(a.occurredAt) ?? parseTimestamp(a.recordedAt) ?? 0;
  const bTs = parseTimestamp(b.occurredAt) ?? parseTimestamp(b.recordedAt) ?? 0;
  if (aTs !== bTs) return aTs - bTs;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

function compareTriageItems(a: AdminTriageItemV1, b: AdminTriageItemV1) {
  const severityDelta = SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity];
  if (severityDelta !== 0) return severityDelta;
  const aTs = parseTimestamp(a.timestamps.surfacedAt) ?? 0;
  const bTs = parseTimestamp(b.timestamps.surfacedAt) ?? 0;
  if (bTs !== aTs) return bTs - aTs;
  return b.id.localeCompare(a.id);
}

function resourceSummaryFromApplication(application: any) {
  const title =
    asOptionalString(application?.applicantName, 200) ||
    asOptionalString(application?.fullName, 200) ||
    asOptionalString(application?.applicantFullName, 200) ||
    asOptionalString(application?.tenantName, 200) ||
    `Application ${asString(application?.id, 120)}`;
  const propertyId = asOptionalString(application?.propertyId, 120);
  const unitId = asOptionalString(application?.unitId, 120);
  return {
    type: "application",
    id: asString(application?.id, 240),
    title,
    subtitle: [propertyId ? `Property ${propertyId}` : null, unitId ? `Unit ${unitId}` : null]
      .filter(Boolean)
      .join(" • ") || null,
    status:
      asOptionalString(application?.screeningStatus, 120) ||
      asOptionalString(application?.status, 120),
  };
}

function resourceSummaryFromMaintenance(maintenance: any) {
  const title =
    asOptionalString(maintenance?.title, 200) ||
    asOptionalString(maintenance?.issueTitle, 200) ||
    asOptionalString(maintenance?.category, 200) ||
    `Maintenance ${asString(maintenance?.id, 120)}`;
  const propertyId = asOptionalString(maintenance?.propertyId, 120);
  const unitId = asOptionalString(maintenance?.unitId, 120);
  return {
    type: "maintenance",
    id: asString(maintenance?.id, 240),
    title,
    subtitle: [propertyId ? `Property ${propertyId}` : null, unitId ? `Unit ${unitId}` : null]
      .filter(Boolean)
      .join(" • ") || null,
    status: asOptionalString(maintenance?.status, 120),
  };
}

function resourceSummaryFromLease(lease: any) {
  const title =
    asOptionalString(lease?.tenantName, 200) ||
    asOptionalString(lease?.primaryTenantName, 200) ||
    (asOptionalString(lease?.unitId, 120) ? `Lease for unit ${asString(lease?.unitId, 120)}` : `Lease ${asString(lease?.id, 120)}`);
  const propertyId = asOptionalString(lease?.propertyId, 120);
  const unitId = asOptionalString(lease?.unitId, 120);
  return {
    type: "lease",
    id: asString(lease?.id, 240),
    title,
    subtitle: [propertyId ? `Property ${propertyId}` : null, unitId ? `Unit ${unitId}` : null]
      .filter(Boolean)
      .join(" • ") || null,
    status: asOptionalString(lease?.status, 120),
  };
}

function supportConsolePath(
  resourceType: string,
  resourceId: string,
  triageCategory?: string | null,
  triageSeverity?: string | null,
  reasonCode?: string | null
) {
  const search = new URLSearchParams();
  search.set("resourceType", resourceType);
  search.set("resourceId", resourceId);
  if (triageCategory) search.set("triageCategory", triageCategory);
  if (triageSeverity) search.set("triageSeverity", triageSeverity);
  if (reasonCode) search.set("reasonCode", reasonCode);
  return `/admin/support-console?${search.toString()}`;
}

function isVisibleToAdmin(event: CanonicalEventV1) {
  return event.visibility !== "tenant";
}

function latestOrderByApplication(orders: ScreeningOrderLike[]) {
  const grouped = new Map<string, ScreeningOrderLike[]>();
  for (const order of orders || []) {
    const applicationId = asString(order?.applicationId, 240);
    if (!applicationId) continue;
    if (!grouped.has(applicationId)) grouped.set(applicationId, []);
    grouped.get(applicationId)!.push(order);
  }
  const latest = new Map<string, ScreeningOrderLike>();
  for (const [applicationId, items] of grouped.entries()) {
    const ordered = [...items].sort(
      (a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)
    );
    latest.set(applicationId, ordered[0]);
  }
  return latest;
}

function isRelatedApplicationEvent(resourceId: string, event: CanonicalEventV1) {
  const resourceType = asString(event.resource?.type, 120);
  const exactId = asString(event.resource?.id, 240);
  const parentId = asString(event.resource?.parentId, 240);
  const metadataApplicationId = asString(event.metadata?.applicationId, 240);
  return (
    (resourceType === "rental_application" && exactId === resourceId) ||
    parentId === resourceId ||
    metadataApplicationId === resourceId
  );
}

function isRelatedMaintenanceEvent(resourceId: string, event: CanonicalEventV1) {
  const resourceType = asString(event.resource?.type, 120);
  const exactId = asString(event.resource?.id, 240);
  const parentId = asString(event.resource?.parentId, 240);
  const metadataMaintenanceRequestId = asString(event.metadata?.maintenanceRequestId, 240);
  return (
    (resourceType === "maintenance_request" && exactId === resourceId) ||
    parentId === resourceId ||
    metadataMaintenanceRequestId === resourceId
  );
}

function isRelatedLeaseEvent(resourceId: string, event: CanonicalEventV1) {
  return (
    (asString(event.resource?.type, 120) === "lease" && asString(event.resource?.id, 240) === resourceId) ||
    asString(event.resource?.parentId, 240) === resourceId
  );
}

function latestEvent(events: CanonicalEventV1[]) {
  return [...events].sort(compareEventsAscending).pop() || null;
}

function itemId(category: TriageCategory, resourceType: string, resourceId: string, reasonCode: string) {
  return `${category}:${resourceType}:${resourceId}:${reasonCode}`;
}

function buildItem(input: {
  category: TriageCategory;
  severity: TriageSeverity;
  resource: AdminTriageItemV1["resource"];
  reasonCode: string;
  reasonSummary: string;
  reasonDetails?: string | null;
  signals?: AdminTriageItemV1["signals"];
  surfacedAt: string;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  tags?: string[];
}): AdminTriageItemV1 {
  return {
    id: itemId(input.category, input.resource.type, input.resource.id, input.reasonCode),
    version: "v1",
    category: input.category,
    severity: input.severity,
    resource: input.resource,
    reason: {
      code: input.reasonCode,
      summary: input.reasonSummary,
      details: input.reasonDetails || null,
    },
    signals: input.signals || {},
    timestamps: {
      surfacedAt: input.surfacedAt,
      firstSeenAt: input.firstSeenAt || null,
      lastSeenAt: input.lastSeenAt || null,
    },
    navigation: {
      supportConsolePath: supportConsolePath(
        input.resource.type,
        input.resource.id,
        input.category,
        input.severity,
        input.reasonCode
      ),
    },
    tags: input.tags || [],
  };
}

function severityForReconciliation(status: string): TriageSeverity | null {
  if (status === "paid_not_fulfilled" || status === "mismatch") return "critical";
  if (status === "duplicate_risk") return "high";
  if (status === "abandoned") return "medium";
  if (status === "blocked" || status === "needs_review") return "medium";
  return null;
}

function reconciliationReason(status: string) {
  if (status === "paid_not_fulfilled") {
    return {
      code: "TRIAGE_PAID_NOT_FULFILLED",
      summary: "Payment was recorded but screening completion is missing.",
      details: "Review fulfillment and provider completion path.",
      tags: ["screening", "revenue"],
    };
  }
  if (status === "mismatch") {
    return {
      code: "TRIAGE_SCREENING_MISMATCH",
      summary: "Screening monetization signals are contradictory.",
      details: "Inspect payment, monetization state, and canonical screening history.",
      tags: ["screening", "integrity"],
    };
  }
  if (status === "duplicate_risk") {
    return {
      code: "TRIAGE_DUPLICATE_RISK",
      summary: "Multiple screening checkout signals indicate duplicate monetization risk.",
      details: "Inspect repeated checkout creation and linked identifiers.",
      tags: ["screening", "revenue"],
    };
  }
  if (status === "abandoned") {
    return {
      code: "TRIAGE_ABANDONED_CHECKOUT",
      summary: "Screening checkout appears abandoned without payment completion.",
      details: "Inspect inactivity and whether follow-up or cleanup is needed.",
      tags: ["screening"],
    };
  }
  if (status === "blocked") {
    return {
      code: "TRIAGE_BLOCKED_WORKFLOW",
      summary: "Screening monetization is blocked and may need operator review.",
      details: "Inspect provider availability, eligibility, or explicit blocked signals.",
      tags: ["screening", "blocked"],
    };
  }
  return {
    code: "TRIAGE_NEEDS_REVIEW",
    summary: "Screening monetization needs review.",
    details: "Inspect the reconciliation summary for incomplete or suspicious signals.",
    tags: ["screening"],
  };
}

function policySeverity(outcome: string, action: string, repeatCount: number): TriageSeverity | null {
  if (outcome === "review") return "medium";
  if (outcome === "block" && IMPORTANT_POLICY_ACTIONS.has(action) && repeatCount > 1) return "high";
  if (outcome === "block" && IMPORTANT_POLICY_ACTIONS.has(action)) return "high";
  if (outcome === "block") return "medium";
  return null;
}

function automationSeverity(reason: string, repeatCount: number): TriageSeverity | null {
  const normalizedReason = asString(reason, 200).toUpperCase();
  if (!normalizedReason) return "medium";
  if (
    repeatCount > 1 &&
    (normalizedReason.includes("POLICY_BLOCKED") ||
      normalizedReason.includes("FAILED") ||
      normalizedReason.includes("DUPLICATE"))
  ) {
    return "high";
  }
  return "medium";
}

function deriveApplicationReconciliationItems(input: {
  applications: any[];
  canonicalEvents: CanonicalEventV1[];
  screeningOrders: ScreeningOrderLike[];
  financialTransactions: FinancialTransactionLike[];
  now: number;
}) {
  const latestOrders = latestOrderByApplication(input.screeningOrders || []);
  const items: AdminTriageItemV1[] = [];

  for (const application of input.applications || []) {
    const applicationId = asString(application?.id, 240);
    if (!applicationId) continue;
    const reconciliation = deriveScreeningReconciliation({
      applicationId,
      application,
      latestOrder: latestOrders.get(applicationId) || null,
      canonicalEvents: input.canonicalEvents,
      financialTransactions: input.financialTransactions,
      now: input.now,
    });
    const severity = severityForReconciliation(reconciliation.status);
    if (!severity) continue;
    const reason = reconciliationReason(reconciliation.status);
    const resource = {
      ...resourceSummaryFromApplication(application),
      status: reconciliation.status,
    };
    items.push(
      buildItem({
        category: "screening_reconciliation",
        severity,
        resource,
        reasonCode: reason.code,
        reasonSummary: reason.summary,
        reasonDetails: reason.details,
        signals: {
          reconciliationStatus: reconciliation.status,
          inactivityMs: reconciliation.metrics?.inactivityMs ?? null,
          blockedCount: reconciliation.metrics?.blockedCount ?? null,
        },
        surfacedAt: reconciliation.summary.lastMeaningfulEventAt || reconciliation.generatedAt,
        firstSeenAt: reconciliation.metrics?.quoteCount ? reconciliation.generatedAt : reconciliation.generatedAt,
        lastSeenAt: reconciliation.summary.lastMeaningfulEventAt || reconciliation.generatedAt,
        tags: reason.tags,
      })
    );
  }

  return items;
}

function derivePolicyItemsForResource(params: {
  resourceType: "application" | "maintenance" | "lease";
  resource: any;
  events: CanonicalEventV1[];
}) {
  const policyEvents = params.events
    .filter((event) => event.type === "policy.evaluated")
    .sort(compareEventsAscending);
  if (!policyEvents.length) return [] as AdminTriageItemV1[];
  const latest = policyEvents[policyEvents.length - 1];
  const outcome = asString(latest.metadata?.outcome || latest.status, 80).toLowerCase();
  const action = asString(latest.metadata?.action, 120).toLowerCase();
  const repeatedBlocks = policyEvents.filter(
    (event) =>
      asString(event.metadata?.outcome || event.status, 80).toLowerCase() === "block" &&
      asString(event.metadata?.action, 120).toLowerCase() === action
  ).length;
  const severity = policySeverity(outcome, action, repeatedBlocks);
  if (!severity) return [];

  const resourceSummary =
    params.resourceType === "application"
      ? resourceSummaryFromApplication(params.resource)
      : params.resourceType === "maintenance"
      ? resourceSummaryFromMaintenance(params.resource)
      : resourceSummaryFromLease(params.resource);

  const firstSeenAt = policyEvents[0]?.occurredAt || policyEvents[0]?.recordedAt || null;
  const lastSeenAt = latest.occurredAt || latest.recordedAt || null;
  const topReasonCode = asOptionalString(latest.metadata?.topReasonCode, 120) || "POLICY_REVIEW_REQUIRED";
  const reasonCode =
    outcome === "review" ? "TRIAGE_POLICY_REVIEW_REQUIRED" : "TRIAGE_POLICY_BLOCKED";
  const reasonSummary =
    outcome === "review"
      ? "Policy review is required before this workflow can proceed."
      : "Policy blocked an important workflow action.";
  return [
    buildItem({
      category: "policy_review",
      severity,
      resource: resourceSummary,
      reasonCode,
      reasonSummary,
      reasonDetails: topReasonCode,
      signals: {
        policyOutcome: outcome || null,
      },
      surfacedAt: lastSeenAt || new Date().toISOString(),
      firstSeenAt,
      lastSeenAt,
      tags: ["policy", action || "decision"],
    }),
  ];
}

function deriveAutomationItemsForResource(params: {
  resourceType: "application" | "maintenance" | "lease";
  resource: any;
  events: CanonicalEventV1[];
}) {
  const automationEvents = params.events
    .filter((event) => event.type === "automation.skipped")
    .sort(compareEventsAscending);
  if (!automationEvents.length) return [] as AdminTriageItemV1[];
  const latest = automationEvents[automationEvents.length - 1];
  const action = asOptionalString(latest.metadata?.action, 160);
  const reason = asOptionalString(latest.metadata?.reason, 240) || "AUTOMATION_SKIPPED";
  const repeatCount = automationEvents.filter(
    (event) => asOptionalString(event.metadata?.action, 160) === action
  ).length;
  const severity = automationSeverity(reason, repeatCount);
  if (!severity) return [];

  const resourceSummary =
    params.resourceType === "application"
      ? resourceSummaryFromApplication(params.resource)
      : params.resourceType === "maintenance"
      ? resourceSummaryFromMaintenance(params.resource)
      : resourceSummaryFromLease(params.resource);

  const firstSeenAt = automationEvents[0]?.occurredAt || automationEvents[0]?.recordedAt || null;
  const lastSeenAt = latest.occurredAt || latest.recordedAt || null;

  return [
    buildItem({
      category: "automation_exception",
      severity,
      resource: resourceSummary,
      reasonCode: "TRIAGE_AUTOMATION_SKIPPED",
      reasonSummary: "Automation was skipped and may need operator follow-up.",
      reasonDetails: reason,
      signals: {
        automationAction: action,
        automationExecuted: false,
      },
      surfacedAt: lastSeenAt || new Date().toISOString(),
      firstSeenAt,
      lastSeenAt,
      tags: ["automation", action || "skipped"],
    }),
  ];
}

function deriveMaintenanceInsightItems(params: {
  maintenanceRequests: any[];
  canonicalEvents: CanonicalEventV1[];
  now: number;
}) {
  const items: AdminTriageItemV1[] = [];

  for (const maintenance of params.maintenanceRequests || []) {
    const resourceId = asString(maintenance?.id, 240);
    if (!resourceId) continue;
    const events = params.canonicalEvents.filter((event) => isRelatedMaintenanceEvent(resourceId, event));
    const insight = deriveInsightForResource(events, {
      domain: "maintenance",
      resourceType: "maintenance_request",
      resourceId,
    });
    if (!insight) continue;
    const resource = resourceSummaryFromMaintenance(maintenance);
    const lastSeenAt = insight.summary.lastEventAt || insight.generatedAt;
    const inactivityMs =
      lastSeenAt && parseTimestamp(lastSeenAt) != null
        ? Math.max(0, params.now - Number(parseTimestamp(lastSeenAt)))
        : null;

    if ((insight.summary.reopenCount || 0) > 0) {
      items.push(
        buildItem({
          category: "maintenance_friction",
          severity: "medium",
          resource,
          reasonCode: "TRIAGE_MAINTENANCE_REOPENED",
          reasonSummary: "Maintenance flow reopened after completion and may need operator review.",
          reasonDetails: "Inspect follow-up work and completion confidence.",
          signals: {
            lifecycleState: asOptionalString(insight.summary.lifecycleState, 80),
            reopenCount: insight.summary.reopenCount || 0,
            blockedCount: insight.summary.blockedCount || 0,
            inactivityMs,
          },
          surfacedAt: lastSeenAt,
          firstSeenAt: insight.summary.firstEventAt,
          lastSeenAt,
          tags: ["maintenance", "reopened"],
        })
      );
    }

    if ((insight.summary.blockedCount || 0) > 0) {
      items.push(
        buildItem({
          category: "workflow_stall",
          severity: "high",
          resource,
          reasonCode: "TRIAGE_BLOCKED_WORKFLOW",
          reasonSummary: "Maintenance workflow has explicit blocked signals.",
          reasonDetails: "Inspect the blocked event sequence and related policy/automation decisions.",
          signals: {
            lifecycleState: asOptionalString(insight.summary.lifecycleState, 80),
            blockedCount: insight.summary.blockedCount || 0,
            reopenCount: insight.summary.reopenCount || 0,
            inactivityMs,
          },
          surfacedAt: lastSeenAt,
          firstSeenAt: insight.summary.firstEventAt,
          lastSeenAt,
          tags: ["maintenance", "blocked"],
        })
      );
    } else if (
      inactivityMs != null &&
      inactivityMs > MAINTENANCE_STALL_THRESHOLD_MS &&
      !["completed"].includes(asString(insight.summary.lifecycleState, 80).toLowerCase())
    ) {
      items.push(
        buildItem({
          category: "workflow_stall",
          severity: "medium",
          resource,
          reasonCode: "TRIAGE_WORKFLOW_STALLED",
          reasonSummary: "Maintenance workflow appears stalled without recent follow-through.",
          reasonDetails: "Inspect assignment, completion, and any blocked or skipped automation signals.",
          signals: {
            lifecycleState: asOptionalString(insight.summary.lifecycleState, 80),
            blockedCount: insight.summary.blockedCount || 0,
            reopenCount: insight.summary.reopenCount || 0,
            inactivityMs,
          },
          surfacedAt: lastSeenAt,
          firstSeenAt: insight.summary.firstEventAt,
          lastSeenAt,
          tags: ["maintenance", "stalled"],
        })
      );
    }
  }

  return items;
}

export function deriveAdminTriageQueue(input: DeriveAdminTriageQueueInput): AdminTriageItemV1[] {
  const now = typeof input.now === "number" ? input.now : Date.now();
  const canonicalEvents = (input.canonicalEvents || []).filter(isVisibleToAdmin);
  const items: AdminTriageItemV1[] = [];

  items.push(
    ...deriveApplicationReconciliationItems({
      applications: input.applications || [],
      canonicalEvents,
      screeningOrders: input.screeningOrders || [],
      financialTransactions: input.financialTransactions || [],
      now,
    })
  );

  for (const application of input.applications || []) {
    const resourceId = asString(application?.id, 240);
    if (!resourceId) continue;
    const events = canonicalEvents.filter((event) => isRelatedApplicationEvent(resourceId, event));
    items.push(...derivePolicyItemsForResource({ resourceType: "application", resource: application, events }));
    items.push(...deriveAutomationItemsForResource({ resourceType: "application", resource: application, events }));
  }

  for (const maintenance of input.maintenanceRequests || []) {
    const resourceId = asString(maintenance?.id, 240);
    if (!resourceId) continue;
    const events = canonicalEvents.filter((event) => isRelatedMaintenanceEvent(resourceId, event));
    items.push(...derivePolicyItemsForResource({ resourceType: "maintenance", resource: maintenance, events }));
    items.push(...deriveAutomationItemsForResource({ resourceType: "maintenance", resource: maintenance, events }));
  }

  for (const lease of input.leases || []) {
    const resourceId = asString(lease?.id, 240);
    if (!resourceId) continue;
    const events = canonicalEvents.filter((event) => isRelatedLeaseEvent(resourceId, event));
    items.push(...derivePolicyItemsForResource({ resourceType: "lease", resource: lease, events }));
    items.push(...deriveAutomationItemsForResource({ resourceType: "lease", resource: lease, events }));
  }

  items.push(
    ...deriveMaintenanceInsightItems({
      maintenanceRequests: input.maintenanceRequests || [],
      canonicalEvents,
      now,
    })
  );

  const resolutions = input.resolutions || [];
  const enriched = items.map((item) => {
    const match = resolutions
      .filter(
        (record) =>
          asString(record.resource?.type, 120) === item.resource.type &&
          asString(record.resource?.id, 240) === item.resource.id &&
          asString(record.triage?.reasonCode, 160) === item.reason.code
      )
      .sort((a, b) => (parseTimestamp(b.updatedAt) ?? 0) - (parseTimestamp(a.updatedAt) ?? 0))[0];
    return {
      ...item,
      resolution: match
        ? {
            status: match.status,
            updatedAt: match.updatedAt,
          }
        : null,
    };
  });

  return enriched.sort(compareTriageItems);
}
