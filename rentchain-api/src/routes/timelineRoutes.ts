import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import type { CanonicalEventDomain, CanonicalEventV1 } from "../lib/events/eventTypes";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import { canonicalEventToTimelineItem } from "../lib/timeline/timelineAdapter";

const router = Router();

const ALLOWED_DOMAINS = new Set<CanonicalEventDomain>([
  "application",
  "screening",
  "lease",
  "maintenance",
  "expense",
  "tenant",
  "billing",
  "policy",
  "system",
]);

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function normalizeRole(req: any): "admin" | "landlord" | "other" {
  const role = asString(req.user?.actorRole || req.user?.role, 40).toLowerCase();
  if (role === "admin") return "admin";
  if (role === "landlord") return "landlord";
  return "other";
}

function parseLimit(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 25;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function parseCursor(value: unknown): { timestamp: string; id: string } | null {
  const raw = asString(value, 4000);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const timestamp = asString(parsed?.timestamp);
    const id = asString(parsed?.id);
    if (!timestamp || !id) return null;
    return { timestamp, id };
  } catch {
    return null;
  }
}

function encodeCursor(event: CanonicalEventV1) {
  return Buffer.from(JSON.stringify({ timestamp: event.occurredAt || event.recordedAt, id: event.id }), "utf8").toString(
    "base64url"
  );
}

function compareEventsDescending(a: CanonicalEventV1, b: CanonicalEventV1) {
  const aTs = Date.parse(a.occurredAt || a.recordedAt || "");
  const bTs = Date.parse(b.occurredAt || b.recordedAt || "");
  if (bTs !== aTs) return bTs - aTs;
  return String(b.id || "").localeCompare(String(a.id || ""));
}

function matchesResource(event: CanonicalEventV1, resourceId: string) {
  if (!resourceId) return true;
  return event.resource?.id === resourceId || event.resource?.parentId === resourceId;
}

function isVisibleToAdmin(event: CanonicalEventV1) {
  return event.visibility !== "tenant";
}

router.get("/timeline", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    if (role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const domain = asString(req.query?.domain, 40).toLowerCase();
    if (domain && !ALLOWED_DOMAINS.has(domain as CanonicalEventDomain)) {
      return res.status(400).json({ ok: false, error: "DOMAIN_INVALID" });
    }

    const resourceId = asString(req.query?.resourceId, 240);
    const cursor = parseCursor(req.query?.cursor);
    const limit = parseLimit(req.query?.limit);

    const snap = await db.collection(CANONICAL_EVENTS_COLLECTION).get();
    const events = (snap.docs || [])
      .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as CanonicalEventV1)
      .filter((event) => isVisibleToAdmin(event))
      .filter((event) => (!domain ? true : event.domain === domain))
      .filter((event) => matchesResource(event, resourceId))
      .sort(compareEventsDescending);

    const cursorFiltered = cursor
      ? events.filter((event) => {
          const eventKey = `${event.occurredAt || event.recordedAt}::${event.id}`;
          const cursorKey = `${cursor.timestamp}::${cursor.id}`;
          return eventKey < cursorKey;
        })
      : events;

    const page = cursorFiltered.slice(0, limit);
    const hasMore = cursorFiltered.length > limit;

    return res.json({
      events: page.map(canonicalEventToTimelineItem),
      nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : undefined,
    });
  } catch (err: any) {
    console.error("[timeline] list failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "TIMELINE_LIST_FAILED" });
  }
});

export default router;
