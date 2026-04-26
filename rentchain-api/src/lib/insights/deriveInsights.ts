import type { CanonicalEventV1 } from "../events/eventTypes";
import type { DerivedInsightV1, InsightDomain } from "./insightTypes";

const SUPPORTED_DOMAINS = new Set<InsightDomain>([
  "screening",
  "maintenance",
  "lease",
  "expense",
  "application",
  "system",
]);

type NormalizedCanonicalEvent = CanonicalEventV1 & {
  __timestampIso: string;
  __timestampMs: number;
};

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function toTimestamp(value: unknown) {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return {
    iso: new Date(parsed).toISOString(),
    ms: parsed,
  };
}

function normalizeCanonicalEvent(event: CanonicalEventV1 | null | undefined): NormalizedCanonicalEvent | null {
  if (!event) return null;
  const resourceType = asString(event.resource?.type, 120);
  const resourceId = asString(event.resource?.id, 240);
  if (!resourceType || !resourceId) return null;
  const timestamp = toTimestamp(event.occurredAt) || toTimestamp(event.recordedAt);
  if (!timestamp) return null;
  return {
    ...event,
    __timestampIso: timestamp.iso,
    __timestampMs: timestamp.ms,
  };
}

function sortChronologically(events: NormalizedCanonicalEvent[]) {
  return [...events].sort((a, b) => {
    if (a.__timestampMs !== b.__timestampMs) return a.__timestampMs - b.__timestampMs;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

function isSupportedInsightDomain(value: unknown): value is InsightDomain {
  return typeof value === "string" && SUPPORTED_DOMAINS.has(value as InsightDomain);
}

function pickInsightDomain(events: NormalizedCanonicalEvent[]): InsightDomain | null {
  const latestSupported = [...events]
    .reverse()
    .find((event) => isSupportedInsightDomain(event.domain));
  return latestSupported && isSupportedInsightDomain(latestSupported.domain) ? latestSupported.domain : null;
}

function firstEventAt(events: NormalizedCanonicalEvent[]) {
  return events[0]?.__timestampIso || null;
}

function lastEventAt(events: NormalizedCanonicalEvent[]) {
  return events[events.length - 1]?.__timestampIso || null;
}

function firstTimestampForAction(events: NormalizedCanonicalEvent[], action: string) {
  return events.find((event) => event.action === action)?.__timestampMs ?? null;
}

function durationBetween(start: number | null, end: number | null) {
  if (start == null || end == null || end < start) return null;
  return end - start;
}

function countByAction(events: NormalizedCanonicalEvent[]) {
  return events.reduce<Record<string, number>>((acc, event) => {
    const action = asString(event.action, 80).toLowerCase();
    if (!action) return acc;
    acc[action] = (acc[action] || 0) + 1;
    return acc;
  }, {});
}

function hasBlockedMarker(event: NormalizedCanonicalEvent) {
  if (event.action === "blocked") return true;
  if (asString(event.status, 80).toLowerCase() === "blocked") return true;
  if (asString((event.metadata || {})["status"], 80).toLowerCase() === "blocked") return true;
  if (Array.isArray(event.tags) && event.tags.some((tag) => asString(tag, 80).toLowerCase() === "blocked")) return true;
  return false;
}

function baseInsight(events: NormalizedCanonicalEvent[], domain: InsightDomain): DerivedInsightV1 {
  const firstAt = firstEventAt(events);
  const lastAt = lastEventAt(events);
  return {
    version: "v1",
    resourceType: events[0]?.resource?.type || "unknown",
    resourceId: events[0]?.resource?.id || "unknown",
    domain,
    generatedAt: new Date().toISOString(),
    summary: {
      lifecycleState: null,
      blockedCount: events.filter(hasBlockedMarker).length,
      reopenCount: 0,
      eventCount: events.length,
      firstEventAt: firstAt,
      lastEventAt: lastAt,
      durationMs:
        firstAt && lastAt ? Math.max(0, Date.parse(lastAt) - Date.parse(firstAt)) : null,
    },
    metrics: {},
    tags: [],
    notes: [],
  };
}

function deriveScreeningInsight(events: NormalizedCanonicalEvent[]) {
  const insight = baseInsight(events, "screening");
  const counts = countByAction(events);
  const quoteAt = firstTimestampForAction(events, "quote_generated");
  const checkoutAt = firstTimestampForAction(events, "checkout_created");
  const paidAt = firstTimestampForAction(events, "paid");
  const completedAt = firstTimestampForAction(events, "completed");
  const latestAction = events[events.length - 1]?.action || "";

  insight.summary.lifecycleState =
    latestAction === "blocked"
      ? "blocked"
      : latestAction === "completed"
      ? "completed"
      : latestAction === "paid"
      ? "paid"
      : latestAction === "checkout_created"
      ? "checkout_started"
      : latestAction === "quote_generated"
      ? "quoted"
      : "not_started";

  insight.summary.blockedCount = counts.blocked || 0;
  insight.metrics = {
    quoteGeneratedCount: counts.quote_generated || 0,
    checkoutStartedCount: counts.checkout_created || 0,
    paidCount: counts.paid || 0,
    completedCount: counts.completed || 0,
    blockedCount: counts.blocked || 0,
    timeQuoteToCheckoutMs: durationBetween(quoteAt, checkoutAt),
    timeCheckoutToPaidMs: durationBetween(checkoutAt, paidAt),
    timePaidToCompletedMs: durationBetween(paidAt, completedAt),
  };

  if ((counts.blocked || 0) > 0) insight.tags?.push("blocked");
  if ((counts.completed || 0) > 0) insight.tags?.push("completed");
  return insight;
}

function deriveMaintenanceInsight(events: NormalizedCanonicalEvent[]) {
  const insight = baseInsight(events, "maintenance");
  const counts = countByAction(events);
  const requestAt = firstTimestampForAction(events, "request_created");
  const assignedAt = firstTimestampForAction(events, "assigned");
  const completedAt = firstTimestampForAction(events, "completed");
  const blockedCount = events.filter(hasBlockedMarker).length;
  const latest = events[events.length - 1];
  let completedSeen = false;
  let reopenSequenceActive = false;
  let reopenCount = 0;

  for (const event of events) {
    if (event.action === "completed") {
      completedSeen = true;
      reopenSequenceActive = false;
      continue;
    }
    if (!completedSeen || reopenSequenceActive) continue;
    if (event.action === "request_created" || event.action === "assigned" || event.action === "approval_requested" || hasBlockedMarker(event)) {
      reopenCount += 1;
      reopenSequenceActive = true;
    }
  }

  insight.summary.reopenCount = reopenCount;
  insight.summary.blockedCount = blockedCount;
  insight.summary.lifecycleState = hasBlockedMarker(latest)
    ? "escalated"
    : latest?.action === "completed"
    ? "completed"
    : reopenCount > 0 && completedSeen
    ? "reopened"
    : asString(latest?.status, 80).toLowerCase() === "in_progress"
    ? "in_progress"
    : latest?.action === "approval_requested"
    ? "in_progress"
    : latest?.action === "assigned"
    ? "assigned"
    : "requested";

  insight.metrics = {
    requestCreatedCount: counts.request_created || 0,
    assignedCount: counts.assigned || 0,
    completedCount: counts.completed || 0,
    approvalRequestedCount: counts.approval_requested || 0,
    reopenCount,
    blockedCount,
    timeRequestToAssignedMs: durationBetween(requestAt, assignedAt),
    timeRequestToCompletedMs: durationBetween(requestAt, completedAt),
  };

  if (reopenCount > 0) insight.tags?.push("reopened");
  if (blockedCount > 0) insight.tags?.push("blocked");
  if ((counts.completed || 0) > 0) insight.tags?.push("completed");
  return insight;
}

function deriveLeaseInsight(events: NormalizedCanonicalEvent[]) {
  const insight = baseInsight(events, "lease");
  const counts = countByAction(events);
  const createdAt = firstTimestampForAction(events, "created");
  const activatedAt = firstTimestampForAction(events, "activated");
  const latestAction = events[events.length - 1]?.action || "";

  insight.summary.lifecycleState =
    latestAction === "notice_generated"
      ? "notice_generated"
      : latestAction === "activated"
      ? "activated"
      : "created";

  insight.metrics = {
    createdCount: counts.created || 0,
    activatedCount: counts.activated || 0,
    noticeGeneratedCount: counts.notice_generated || 0,
    timeCreatedToActivatedMs: durationBetween(createdAt, activatedAt),
  };

  if ((counts.activated || 0) > 0) insight.tags?.push("activated");
  return insight;
}

function deriveApplicationInsight(events: NormalizedCanonicalEvent[]) {
  const insight = baseInsight(events, "application");
  const counts = countByAction(events);
  const createdAt = firstTimestampForAction(events, "created");
  const submittedAt = firstTimestampForAction(events, "submitted");

  insight.summary.lifecycleState = (counts.submitted || 0) > 0 ? "submitted" : "created";
  insight.metrics = {
    createdCount: counts.created || 0,
    submittedCount: counts.submitted || 0,
    timeCreatedToSubmittedMs: durationBetween(createdAt, submittedAt),
  };

  if ((counts.submitted || 0) > 0) insight.tags?.push("submitted");
  return insight;
}

function deriveExpenseInsight(events: NormalizedCanonicalEvent[]) {
  const insight = baseInsight(events, "expense");
  const counts = countByAction(events);
  const latestAction = events[events.length - 1]?.action || "";

  insight.summary.lifecycleState =
    latestAction === "approved" ? "approved" : latestAction === "linked" ? "linked" : "created";
  insight.metrics = {
    createdCount: counts.created || 0,
    linkedCount: counts.linked || 0,
    approvedCount: counts.approved || 0,
  };

  return insight;
}

function deriveSystemInsight(events: NormalizedCanonicalEvent[]) {
  const insight = baseInsight(events, "system");
  const counts = countByAction(events);
  const latestAction = events[events.length - 1]?.action || "";
  insight.summary.lifecycleState = latestAction || "observed";
  insight.metrics = {
    eventCount: events.length,
    blockedCount: counts.blocked || 0,
  };
  return insight;
}

export function deriveInsightForResource(
  events: CanonicalEventV1[],
  options?: {
    resourceType?: string | null;
    resourceId?: string | null;
    domain?: InsightDomain | null;
  }
): DerivedInsightV1 | null {
  const normalized = sortChronologically(events.map(normalizeCanonicalEvent).filter(Boolean) as NormalizedCanonicalEvent[]);
  if (!normalized.length) return null;

  const domain = options?.domain || pickInsightDomain(normalized);
  if (!domain) return null;

  const domainEvents = normalized.filter((event) => event.domain === domain);
  if (!domainEvents.length) return null;

  const exactResourceType = asString(options?.resourceType || domainEvents[0]?.resource?.type, 120);
  const exactResourceId = asString(options?.resourceId || domainEvents[0]?.resource?.id, 240);
  const resourceEvents = domainEvents.filter(
    (event) => event.resource?.type === exactResourceType && event.resource?.id === exactResourceId
  );
  const relevantEvents = resourceEvents.length ? resourceEvents : domainEvents;
  if (!relevantEvents.length) return null;

  if (domain === "screening") return deriveScreeningInsight(relevantEvents);
  if (domain === "maintenance") return deriveMaintenanceInsight(relevantEvents);
  if (domain === "lease") return deriveLeaseInsight(relevantEvents);
  if (domain === "application") return deriveApplicationInsight(relevantEvents);
  if (domain === "expense") return deriveExpenseInsight(relevantEvents);
  return deriveSystemInsight(relevantEvents);
}

export function groupCanonicalEventsByResource(
  events: CanonicalEventV1[],
  domain: InsightDomain
) {
  const groups = new Map<string, CanonicalEventV1[]>();
  for (const event of events) {
    const normalized = normalizeCanonicalEvent(event);
    if (!normalized || normalized.domain !== domain) continue;
    const key = `${normalized.resource.type}::${normalized.resource.id}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }
  return groups;
}
