import type { LandlordDecisionOutcomeAnalytics } from "../../lib/analytics/analyticsTypes";
import type { CanonicalEventV1 } from "../../lib/events/eventTypes";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function eventTimestamp(event: CanonicalEventV1) {
  const iso = asString(event.occurredAt || event.recordedAt, 80);
  if (!iso) return null;
  const millis = Date.parse(iso);
  return Number.isFinite(millis) ? millis : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isLandlordDecisionEvent(event: CanonicalEventV1, landlordId: string) {
  if (asString(event.visibility, 80) !== "landlord") return false;
  if (asString(event.resource?.type, 120) !== "analytics_decision") return false;
  if (asString(event.metadata?.landlordId, 240) !== landlordId) return false;
  return [
    "decision.appeared",
    "decision.reviewed",
    "decision.dismissed",
    "decision.executed",
    "decision.execution_failed",
  ].includes(asString(event.type, 120));
}

type DecisionOutcomeEventState = {
  appearedAt: number | null;
  reviewedAt: number | null;
  dismissedAt: number | null;
  executedAt: number | null;
  failedExecutionAt: number | null;
};

function nextEarliest(current: number | null, candidate: number | null) {
  if (candidate == null) return current;
  if (current == null) return candidate;
  return Math.min(current, candidate);
}

export function deriveLandlordDecisionOutcomeAnalytics(params: {
  landlordId: string;
  canonicalEvents: CanonicalEventV1[];
}): LandlordDecisionOutcomeAnalytics {
  const landlordId = asString(params.landlordId, 240);
  const events = (params.canonicalEvents || []).filter((event) => isLandlordDecisionEvent(event, landlordId));
  const eventsByDecisionId = new Map<string, DecisionOutcomeEventState>();

  for (const event of events) {
    const decisionId = asString(event.metadata?.decisionId || event.resource?.id, 240);
    if (!decisionId) continue;
    const timestamp = eventTimestamp(event);
    const current = eventsByDecisionId.get(decisionId) || {
      appearedAt: null,
      reviewedAt: null,
      dismissedAt: null,
      executedAt: null,
      failedExecutionAt: null,
    };

    const eventType = asString(event.type, 120);
    if (eventType === "decision.appeared") current.appearedAt = nextEarliest(current.appearedAt, timestamp);
    if (eventType === "decision.reviewed") current.reviewedAt = nextEarliest(current.reviewedAt, timestamp);
    if (eventType === "decision.dismissed") current.dismissedAt = nextEarliest(current.dismissedAt, timestamp);
    if (eventType === "decision.executed") current.executedAt = nextEarliest(current.executedAt, timestamp);
    if (eventType === "decision.execution_failed") {
      current.failedExecutionAt = nextEarliest(current.failedExecutionAt, timestamp);
    }
    eventsByDecisionId.set(decisionId, current);
  }

  const resolutionDurationsHours: number[] = [];
  const executionDurationsHours: number[] = [];
  let appearedCount = 0;
  let reviewedCount = 0;
  let dismissedCount = 0;
  let executedCount = 0;
  let failedExecutionCount = 0;
  let resolvedCount = 0;

  for (const eventState of eventsByDecisionId.values()) {
    if (eventState.appearedAt != null) appearedCount += 1;
    if (eventState.reviewedAt != null) reviewedCount += 1;
    if (eventState.dismissedAt != null) dismissedCount += 1;
    if (eventState.executedAt != null) executedCount += 1;
    if (eventState.failedExecutionAt != null) failedExecutionCount += 1;

    const resolvedAt = [eventState.reviewedAt, eventState.dismissedAt, eventState.executedAt]
      .filter((value): value is number => value != null)
      .sort((a, b) => a - b)[0] ?? null;

    if (resolvedAt != null) {
      resolvedCount += 1;
    }
    if (eventState.appearedAt != null && resolvedAt != null && resolvedAt >= eventState.appearedAt) {
      resolutionDurationsHours.push((resolvedAt - eventState.appearedAt) / (1000 * 60 * 60));
    }
    if (eventState.appearedAt != null && eventState.executedAt != null && eventState.executedAt >= eventState.appearedAt) {
      executionDurationsHours.push((eventState.executedAt - eventState.appearedAt) / (1000 * 60 * 60));
    }
  }

  return {
    scope: "landlord_all_time",
    appearedCount,
    reviewedCount,
    dismissedCount,
    executedCount,
    failedExecutionCount,
    resolvedCount,
    resolutionRate: appearedCount > 0 ? resolvedCount / appearedCount : null,
    medianTimeToResolutionHours: median(resolutionDurationsHours),
    averageTimeToExecutionHours: average(executionDurationsHours),
  };
}
