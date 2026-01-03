import { Router } from "express";
import { Timestamp } from "firebase-admin/firestore";
import { db, FieldValue } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";

const router = Router();

type EventType =
  | "LEASE_STARTED"
  | "RENT_PAID"
  | "RENT_LATE"
  | "NOTICE_SERVED"
  | "LEASE_ENDED";

type Severity = "positive" | "neutral" | "negative";

const ALLOWED_TYPES: EventType[] = [
  "LEASE_STARTED",
  "RENT_PAID",
  "RENT_LATE",
  "NOTICE_SERVED",
  "LEASE_ENDED",
];

function inferSeverity(type: EventType): Severity {
  switch (type) {
    case "RENT_PAID":
    case "LEASE_STARTED":
      return "positive";
    case "RENT_LATE":
    case "NOTICE_SERVED":
      return "negative";
    case "LEASE_ENDED":
      return "neutral";
    default:
      return "neutral";
  }
}

function defaultTitle(type: EventType): string {
  switch (type) {
    case "LEASE_STARTED":
      return "Lease started";
    case "RENT_PAID":
      return "Rent paid";
    case "RENT_LATE":
      return "Rent paid late";
    case "NOTICE_SERVED":
      return "Notice served";
    case "LEASE_ENDED":
      return "Lease ended";
    default:
      return "Tenant event";
  }
}

function clampInt(n: any, min: number, max: number): number | undefined {
  const v = Number(n);
  if (!Number.isFinite(v)) return undefined;
  const i = Math.trunc(v);
  return Math.min(Math.max(i, min), max);
}

function clampMoneyCents(n: any): number | undefined {
  const v = Number(n);
  if (!Number.isFinite(v)) return undefined;
  const i = Math.trunc(v);
  if (i < 0) return undefined;
  return Math.min(i, 50_000_000);
}

function parseLimit(raw: any, fallback = 50) {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.max(n, 1), 200);
}

function parseCursor(raw: any): Timestamp | null {
  if (!raw) return null;
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum > 0) return Timestamp.fromMillis(asNum);
  const asDate = new Date(String(raw));
  if (!isNaN(asDate.getTime())) return Timestamp.fromDate(asDate);
  return null;
}

function getLandlordId(req: any) {
  return req.user?.landlordId || req.user?.id || null;
}

function toMillis(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts === "number") return ts;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (typeof ts?.seconds === "number") return ts.seconds * 1000;
  return null;
}

/**
 * POST /api/tenant-events
 * Body:
 * {
 *   tenantId: string,
 *   type: EventType,
 *   occurredAt?: string|number (optional; defaults to now),
 *   title?: string,
 *   description?: string,
 *   propertyId?: string,
 *   unitId?: string,
 *   amountCents?: number,
 *   currency?: string,
 *   daysLate?: number,
 *   noticeType?: string
 * }
 */
router.post("/tenant-events", requireAuth, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "tenantEventsWriteRoutes");

  const landlordId = req.user?.landlordId || req.user?.id;
  const createdByUserId = req.user?.id || req.user?.sub || undefined;

  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const tenantId = String(req.body?.tenantId || "");
  const type = String(req.body?.type || "") as EventType;

  if (!tenantId) return res.status(400).json({ ok: false, error: "Missing tenantId" });
  if (!ALLOWED_TYPES.includes(type)) {
    return res.status(400).json({
      ok: false,
      error: "BAD_TYPE",
      message: `type must be one of: ${ALLOWED_TYPES.join(", ")}`,
    });
  }

  // Ensure tenant belongs to landlord
  const tSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tSnap.exists) return res.status(404).json({ ok: false, error: "Tenant not found" });
  const tenant = tSnap.data() as any;
  if (tenant?.landlordId !== landlordId) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

  // occurredAt default now
  let occurredAtDate = new Date();
  const rawOccurredAt = req.body?.occurredAt;
  if (rawOccurredAt != null && rawOccurredAt !== "") {
    const d =
      typeof rawOccurredAt === "number"
        ? new Date(rawOccurredAt)
        : new Date(String(rawOccurredAt));
    if (!isNaN(d.getTime())) occurredAtDate = d;
  }

  const title = String(req.body?.title || defaultTitle(type)).slice(0, 120);
  const description =
    req.body?.description != null && String(req.body.description).trim()
      ? String(req.body.description).slice(0, 2000)
      : undefined;

  const propertyId =
    req.body?.propertyId != null && String(req.body.propertyId).trim()
      ? String(req.body.propertyId)
      : undefined;

  const unitId =
    req.body?.unitId != null && String(req.body.unitId).trim()
      ? String(req.body.unitId)
      : undefined;

  const currency =
    req.body?.currency != null && String(req.body.currency).trim()
      ? String(req.body.currency).toUpperCase().slice(0, 8)
      : undefined;

  const amountCents = clampMoneyCents(req.body?.amountCents);
  const daysLate = clampInt(req.body?.daysLate, 0, 365);
  const noticeType =
    req.body?.noticeType != null && String(req.body.noticeType).trim()
      ? String(req.body.noticeType).slice(0, 64)
      : undefined;

  const severity: Severity = inferSeverity(type);

  const doc = {
    tenantId,
    landlordId,
    propertyId,
    unitId,

    type,
    severity,
    title,
    description,

    occurredAt: occurredAtDate,
    createdAt: FieldValue.serverTimestamp(),

    source: "landlord",
    createdByUserId,

    amountCents,
    currency,
    daysLate,
    noticeType,

    // anchoring placeholders
    anchorStatus: "none",
  };

  const ref = await db.collection("tenantEvents").add(doc);

  return res.json({
    ok: true,
    id: ref.id,
    item: { id: ref.id, ...doc, createdAt: undefined },
  });
});

export default router;

/**
 * GET /api/tenant-events?tenantId=...&limit=...&cursor=...
 * Landlord-scoped tenant timeline
 */
router.get("/tenant-events", requireAuth, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "tenantEventsWriteRoutes");
  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });

  const tenantId = String(req.query?.tenantId || "").trim();
  if (!tenantId) {
    return res.status(400).json({ error: "tenantId is required" });
  }

  const limit = parseLimit(req.query?.limit, 50);
  const cursorTs = parseCursor(req.query?.cursor);

  try {
    let q = db
      .collection("tenantEvents")
      .where("landlordId", "==", landlordId)
      .where("tenantId", "==", tenantId)
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (cursorTs) {
      q = q.startAfter(cursorTs) as any;
    }

    const snap = await q.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    const nextCursor =
      items.length > 0 && items[items.length - 1]?.createdAt?.toMillis
        ? items[items.length - 1].createdAt.toMillis()
        : null;

    return res.json({ ok: true, items, nextCursor });
  } catch (err: any) {
    console.error("[tenant-events GET /tenant-events] error", err);
    return res.status(500).json({ error: "Failed to load tenant events" });
  }
});

/**
 * GET /api/tenant-events/recent?limit=...
 * Landlord-wide feed (dashboard)
 */
router.get("/tenant-events/recent", requireAuth, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "tenantEventsWriteRoutes");
  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ error: "Unauthorized" });

  const limit = parseLimit(req.query?.limit, 25);

  try {
    const snap = await db
      .collection("tenantEvents")
      .where("landlordId", "==", landlordId)
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    return res.json({ ok: true, items });
  } catch (err: any) {
    console.error("[tenant-events GET /tenant-events/recent] error", err);
    return res.status(500).json({ error: "Failed to load recent tenant events" });
  }
});

/**
 * GET /api/tenant-events/score?tenantId=...
 * Computes transparent score v1 from tenantEvents.
 */
router.get("/tenant-events/score", requireAuth, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "tenantEventsWriteRoutes");

  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const tenantId = String(req.query?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "Missing tenantId" });

  try {
    const snap = await db
      .collection("tenantEvents")
      .where("landlordId", "==", landlordId)
      .where("tenantId", "==", tenantId)
      .orderBy("createdAt", "desc")
      .limit(300)
      .get();

    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const now = Date.now();
    const days = (n: number) => n * 24 * 60 * 60 * 1000;

    const lastEventAt = items.length ? toMillis(items[0]?.createdAt) : null;
    const within = (ms: number | null, windowMs: number) =>
      typeof ms === "number" && ms >= now - windowMs;

    const lateCount90d = items.filter((e) => within(toMillis(e.createdAt), days(90)) && e.type === "RENT_LATE").length;
    const rentPaid90d = items.filter((e) => within(toMillis(e.createdAt), days(90)) && e.type === "RENT_PAID").length;
    const notices12m = items.filter((e) => within(toMillis(e.createdAt), days(365)) && e.type === "NOTICE_SERVED").length;

    let onTimeStreak = 0;
    for (const e of items) {
      if (e.type === "RENT_PAID") onTimeStreak += 1;
      else if (e.type === "RENT_LATE" || e.type === "NOTICE_SERVED") break;
    }

    if (items.length === 0) {
      return res.json({
        ok: true,
        tenantId,
        lastEventAt: null,
        scoreV1: 70,
        tierV1: "watch",
        reasons: ["No history yet — defaulted to baseline score"],
        signals: { lateCount90d: 0, rentPaid90d: 0, notices12m: 0, onTimeStreak: 0 },
      });
    }

    let score = 100;
    const reasons: string[] = [];

    const latePenalty = lateCount90d * 15;
    if (latePenalty) reasons.push(`-${latePenalty} late payments in last 90 days (${lateCount90d}×15)`);
    score -= latePenalty;

    const noticePenalty = notices12m * 20;
    if (noticePenalty) reasons.push(`-${noticePenalty} notices in last 12 months (${notices12m}×20)`);
    score -= noticePenalty;

    let bonus = 0;
    if (onTimeStreak >= 6) bonus = 5;
    else if (onTimeStreak >= 3) bonus = 2;
    if (bonus) reasons.push(`+${bonus} on-time streak bonus (streak=${onTimeStreak})`);
    score += bonus;

    if (lastEventAt && lastEventAt < now - days(180)) {
      score -= 8;
      reasons.push("-8 stale activity (last event >180 days ago)");
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    const tierV1 =
      score >= 90 ? "excellent" : score >= 80 ? "good" : score >= 65 ? "watch" : "risk";

    return res.json({
      ok: true,
      tenantId,
      lastEventAt,
      scoreV1: score,
      tierV1,
      reasons,
      signals: { lateCount90d, rentPaid90d, notices12m, onTimeStreak },
    });
  } catch (err: any) {
    console.error("[tenant-events GET /tenant-events/score] error", err);
    return res.status(500).json({ ok: false, error: "Failed to compute score" });
  }
});
