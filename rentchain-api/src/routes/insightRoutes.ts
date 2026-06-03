import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import type { CanonicalEventV1 } from "../lib/events/eventTypes";
import { deriveInsightForResource, groupCanonicalEventsByResource } from "../lib/insights/deriveInsights";
import type { DerivedInsightV1, InsightDomain } from "../lib/insights/insightTypes";

const router = Router();

const ALLOWED_DOMAINS = new Set<InsightDomain>([
  "screening",
  "maintenance",
  "lease",
  "expense",
  "application",
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
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function parseCursor(value: unknown): { timestamp: string; resourceKey: string } | null {
  const raw = asString(value, 4000);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const timestamp = asString(parsed?.timestamp);
    const resourceKey = asString(parsed?.resourceKey);
    if (!timestamp || !resourceKey) return null;
    return { timestamp, resourceKey };
  } catch {
    return null;
  }
}

function encodeCursor(insight: DerivedInsightV1) {
  return Buffer.from(
    JSON.stringify({
      timestamp: insight.summary.lastEventAt || insight.generatedAt,
      resourceKey: `${insight.resourceType}::${insight.resourceId}`,
    }),
    "utf8"
  ).toString("base64url");
}

function compareInsightsDescending(a: DerivedInsightV1, b: DerivedInsightV1) {
  const aTs = Date.parse(a.summary.lastEventAt || a.generatedAt || "");
  const bTs = Date.parse(b.summary.lastEventAt || b.generatedAt || "");
  if (bTs !== aTs) return bTs - aTs;
  const aKey = `${a.resourceType}::${a.resourceId}`;
  const bKey = `${b.resourceType}::${b.resourceId}`;
  return bKey.localeCompare(aKey);
}

function isVisibleToAdmin(event: CanonicalEventV1) {
  return event.visibility !== "tenant";
}

async function loadCanonicalEvents() {
  const snap = await db.collection(CANONICAL_EVENTS_COLLECTION).get();
  return (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as CanonicalEventV1)
    .filter(isVisibleToAdmin);
}

router.get("/insights/resource", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const resourceType = asString(req.query?.resourceType, 120);
    const resourceId = asString(req.query?.resourceId, 240);
    if (!resourceType || !resourceId) {
      return res.status(400).json({ ok: false, error: "RESOURCE_QUERY_INVALID" });
    }

    const events = (await loadCanonicalEvents()).filter(
      (event) => event.resource?.type === resourceType && event.resource?.id === resourceId
    );
    const insight = deriveInsightForResource(events, { resourceType, resourceId });

    return res.json({ insight });
  } catch (err: any) {
    console.error("[insights] resource fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "INSIGHT_RESOURCE_FETCH_FAILED" });
  }
});

router.get("/insights/summary", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const domain = asString(req.query?.domain, 40).toLowerCase();
    if (!ALLOWED_DOMAINS.has(domain as InsightDomain)) {
      return res.status(400).json({ ok: false, error: "DOMAIN_INVALID" });
    }

    const limit = parseLimit(req.query?.limit);
    const cursor = parseCursor(req.query?.cursor);
    const grouped = groupCanonicalEventsByResource(await loadCanonicalEvents(), domain as InsightDomain);
    const insights = Array.from(grouped.entries())
      .map(([resourceKey, resourceEvents]) => {
        const [resourceType, resourceId] = resourceKey.split("::");
        return deriveInsightForResource(resourceEvents, {
          domain: domain as InsightDomain,
          resourceType,
          resourceId,
        });
      })
      .filter(Boolean) as DerivedInsightV1[];

    const ordered = insights.sort(compareInsightsDescending);
    const cursorFiltered = cursor
      ? ordered.filter((insight) => {
          const insightKey = `${insight.summary.lastEventAt || insight.generatedAt}::${insight.resourceType}::${insight.resourceId}`;
          const cursorKey = `${cursor.timestamp}::${cursor.resourceKey}`;
          return insightKey < cursorKey;
        })
      : ordered;

    const page = cursorFiltered.slice(0, limit);
    const hasMore = cursorFiltered.length > limit;

    return res.json({
      insights: page,
      nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : undefined,
    });
  } catch (err: any) {
    console.error("[insights] summary fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "INSIGHT_SUMMARY_FETCH_FAILED" });
  }
});

export default router;
