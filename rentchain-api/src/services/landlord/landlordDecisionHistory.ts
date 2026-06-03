import { db } from "../../firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../../lib/events/buildEvent";
import type { CanonicalEventV1 } from "../../lib/events/eventTypes";
import { canonicalEventToTimelineItem, type TimelineItem } from "../../lib/timeline/timelineAdapter";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function compareEventsAscending(a: CanonicalEventV1, b: CanonicalEventV1) {
  const aTs = Date.parse(a.occurredAt || a.recordedAt || "");
  const bTs = Date.parse(b.occurredAt || b.recordedAt || "");
  if (aTs !== bTs) return aTs - bTs;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

function isDecisionHistoryEvent(event: CanonicalEventV1, landlordId: string, decisionId: string) {
  if (asString(event.resource?.type, 120) !== "analytics_decision") return false;
  if (asString(event.resource?.id, 240) !== decisionId) return false;
  if (asString(event.visibility, 80) !== "landlord") return false;
  if (asString(event.metadata?.landlordId, 240) !== landlordId) return false;
  return asString(event.metadata?.decisionId, 240) === decisionId;
}

export async function loadLandlordDecisionTimeline(params: {
  landlordId: string;
  decisionId: string;
}): Promise<TimelineItem[]> {
  const landlordId = asString(params.landlordId, 240);
  const decisionId = asString(params.decisionId, 240);
  if (!landlordId || !decisionId) return [];

  const snap = await db.collection(CANONICAL_EVENTS_COLLECTION).get().catch(() => ({ docs: [] } as any));
  const events = (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as CanonicalEventV1)
    .filter((event: CanonicalEventV1) => isDecisionHistoryEvent(event, landlordId, decisionId))
    .sort(compareEventsAscending);

  return events.map(canonicalEventToTimelineItem);
}
