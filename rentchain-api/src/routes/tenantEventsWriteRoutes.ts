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
type RiskTier = "low" | "medium" | "high" | "neutral";
type TierV1 = "excellent" | "good" | "watch" | "risk";

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

function computeSignalsFromEvents(items: any[]) {
  const now = Date.now();
  const days = (n: number) => n * 24 * 60 * 60 * 1000;
  const isWithin = (ms: number | null, windowMs: number) =>
    typeof ms === "number" && ms >= now - windowMs;

  const lastEventAt = items.length ? toMillis(items[0]?.createdAt) : null;

  const lateCount90d = items.filter((e) => {
    const ms = toMillis(e.createdAt);
    return e.type === "RENT_LATE" && isWithin(ms, days(90));
  }).length;

  const rentPaid90d = items.filter((e) => {
    const ms = toMillis(e.createdAt);
    return e.type === "RENT_PAID" && isWithin(ms, days(90));
  }).length;

  const notices12m = items.filter((e) => {
    const ms = toMillis(e.createdAt);
    return e.type === "NOTICE_SERVED" && isWithin(ms, days(365));
  }).length;

  let onTimeStreak = 0;
  for (const e of items) {
    if (e.type === "RENT_PAID") onTimeStreak += 1;
    else if (e.type === "RENT_LATE" || e.type === "NOTICE_SERVED") break;
  }

  const riskTier: RiskTier =
    notices12m >= 2
      ? "high"
      : lateCount90d >= 2
      ? "high"
      : lateCount90d === 1
      ? "medium"
      : rentPaid90d >= 2
      ? "low"
      : "neutral";

  return {
    lastEventAt,
    signals: { lateCount90d, rentPaid90d, notices12m, onTimeStreak, riskTier },
  };
}

function computeScoreV1(input: {
  lastEventAt: number | null;
  signals: { lateCount90d: number; rentPaid90d: number; notices12m: number; onTimeStreak: number; riskTier: RiskTier };
  hasHistory: boolean;
}) {
  const { lastEventAt, signals, hasHistory } = input;
  const now = Date.now();
  const days = (n: number) => n * 24 * 60 * 60 * 1000;

  if (!hasHistory) {
    const scoreV1 = 70;
    const tierV1: TierV1 = scoreV1 >= 90 ? "excellent" : scoreV1 >= 80 ? "good" : scoreV1 >= 65 ? "watch" : "risk";
    return {
      scoreV1,
      tierV1,
      reasons: ["No history yet � defaulted to baseline score"],
    };
  }

  let score = 100;
  const reasons: string[] = [];

  const latePenalty = signals.lateCount90d * 15;
  if (latePenalty) reasons.push(`-${latePenalty} late payments in last 90 days (${signals.lateCount90d}�15)`);
  score -= latePenalty;

  const noticePenalty = signals.notices12m * 20;
  if (noticePenalty) reasons.push(`-${noticePenalty} notices in last 12 months (${signals.notices12m}�20)`);
  score -= noticePenalty;

  let bonus = 0;
  if (signals.onTimeStreak >= 6) bonus = 5;
  else if (signals.onTimeStreak >= 3) bonus = 2;
  if (bonus) reasons.push(`+${bonus} on-time streak bonus (streak=${signals.onTimeStreak})`);
  score += bonus;

  if (lastEventAt && lastEventAt < now - days(180)) {
    score -= 8;
    reasons.push("-8 stale activity (last event >180 days ago)");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  const tierV1: TierV1 = score >= 90 ? "excellent" : score >= 80 ? "good" : score >= 65 ? "watch" : "risk";

  return { scoreV1: score, tierV1, reasons };
}

async function recomputeTenantSnapshot(params: { landlordId: string; tenantId: string }) {
  const { landlordId, tenantId } = params;

  const snap = await db
    .collection("tenantEvents")
    .where("landlordId", "==", landlordId)
    .where("tenantId", "==", tenantId)
    .orderBy("createdAt", "desc")
    .limit(300)
    .get();

  const items = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) }));

  const { lastEventAt, signals } = computeSignalsFromEvents(items);
  const { scoreV1, tierV1, reasons } = computeScoreV1({
    lastEventAt,
    signals,
    hasHistory: items.length > 0,
  });

  const docId = `${landlordId}__${tenantId}`;
  const payload = {
    landlordId,
    tenantId,
    lastEventAt: lastEventAt || null,
    signals,
    scoreV1,
    tierV1,
    reasons,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection("tenantSummaries").doc(docId).set(payload, { merge: true });

  return payload;
}

/**
 * POST /api/tenant-events
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

  const tSnap = await db.collection("tenants").doc(tenantId).get();
  if (!tSnap.exists) return res.status(404).json({ ok: false, error: "Tenant not found" });
  const tenant = tSnap.data() as any;
  if (tenant?.landlordId !== landlordId) {
    return res.status(403).json({ ok: false, error: "Forbidden" });
  }

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

    anchorStatus: "none",
  };

  const ref = await db.collection("tenantEvents").add(doc);

  try {
    await recomputeTenantSnapshot({ landlordId, tenantId });
  } catch (err) {
    console.warn("[tenant-events] failed to recompute tenant summary", err);
  }

  return res.json({
    ok: true,
    id: ref.id,
    item: { id: ref.id, ...doc, createdAt: undefined },
  });
});

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

    const { lastEventAt, signals } = computeSignalsFromEvents(items);
    const { scoreV1, tierV1, reasons } = computeScoreV1({
      lastEventAt,
      signals,
      hasHistory: items.length > 0,
    });

    return res.json({
      ok: true,
      tenantId,
      lastEventAt,
      scoreV1,
      tierV1,
      reasons,
      signals,
    });
  } catch (err: any) {
    console.error("[tenant-events GET /tenant-events/score] error", err);
    return res.status(500).json({ ok: false, error: "Failed to compute score" });
  }
});

/**
 * MISSION 7.1 — Monthly Ops Snapshot (landlord-scoped)
 *
 * GET /api/ops/monthly-snapshot?windowDays=30&topN=5
 *
 * Reads from tenantSummaries for speed.
 */
router.get("/ops/monthly-snapshot", requireAuth, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "tenantEventsWriteRoutes");

  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const clampInt = (n: any, min: number, max: number, fallback: number) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(v)));
  };

  const windowDays = clampInt(req.query?.windowDays, 7, 365, 30);
  const topN = clampInt(req.query?.topN, 3, 25, 5);
  const now = Date.now();
  const cutoffMs = now - windowDays * 24 * 60 * 60 * 1000;

  const toMillisLocal = (ts: any): number | null => {
    if (!ts) return null;
    if (typeof ts === "number") return ts;
    if (typeof ts?.toMillis === "function") return ts.toMillis();
    if (typeof ts?.seconds === "number") return ts.seconds * 1000;
    return null;
  };

  try {
    const snap = await db
      .collection("tenantSummaries")
      .where("landlordId", "==", landlordId)
      .limit(2000)
      .get();

    const items = snap.docs.map((d: any) => ({ id: d.id, ...(d.data() as any) })) as any[];

    const active = items.filter((s) => {
      const last = toMillisLocal(s.lastEventAt);
      return typeof last === "number" && last >= cutoffMs;
    });

    const population = active.length ? active : items;

    let sumScore = 0;
    let withScore = 0;

    const tierCounts: any = { excellent: 0, good: 0, watch: 0, risk: 0 };

    let totalLate90d = 0;
    let totalNotices12m = 0;
    let totalPaid90d = 0;

    for (const s of population) {
      const score = typeof s.scoreV1 === "number" ? s.scoreV1 : null;
      if (score !== null) {
        sumScore += score;
        withScore += 1;
      }
      const tier = s.tierV1;
      if (tier && tierCounts[tier] !== undefined) tierCounts[tier] += 1;

      const sig = s.signals || {};
      if (typeof sig.lateCount90d === "number") totalLate90d += sig.lateCount90d;
      if (typeof sig.notices12m === "number") totalNotices12m += sig.notices12m;
      if (typeof sig.rentPaid90d === "number") totalPaid90d += sig.rentPaid90d;
    }

    const avgScore = withScore ? Math.round((sumScore / withScore) * 10) / 10 : null;

    const topRisk = population
      .filter((s) => typeof s.scoreV1 === "number")
      .sort((a, b) => (a.scoreV1 as number) - (b.scoreV1 as number))
      .slice(0, topN)
      .map((s) => ({
        tenantId: s.tenantId,
        scoreV1: s.scoreV1,
        tierV1: s.tierV1,
        lastEventAt: s.lastEventAt || null,
        signals: s.signals || null,
      }));

    const totalTenants = population.length;
    const atRiskCount = (tierCounts.watch || 0) + (tierCounts.risk || 0);

    return res.json({
      ok: true,
      windowDays,
      usingActiveWindow: active.length > 0,
      totals: {
        totalTenants,
        avgScore,
        atRiskCount,
        tierCounts,
        totalLate90d,
        totalPaid90d,
        totalNotices12m,
      },
      topRisk,
      generatedAt: now,
    });
  } catch (err: any) {
    console.error("[ops monthly snapshot] error:", err);
    return res.status(500).json({ ok: false, error: "Failed to build monthly snapshot" });
  }
});
/**
 * GET /api/tenant-summaries?tenantId=...
 * Landlord-scoped snapshot fetch
 */
router.get("/tenant-summaries", requireAuth, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "tenantEventsWriteRoutes");

  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const tenantId = String(req.query?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "Missing tenantId" });

  try {
    const docId = `${landlordId}__${tenantId}`;
    const ref = db.collection("tenantSummaries").doc(docId);
    const snap = await ref.get();

    if (!snap.exists) {
      const computed = await recomputeTenantSnapshot({ landlordId, tenantId });
      return res.json({ ok: true, item: computed, computed: true });
    }

    return res.json({ ok: true, item: { id: snap.id, ...(snap.data() as any) } });
  } catch (err: any) {
    console.error("[tenant-summaries GET] error", err);
    return res.status(500).json({ ok: false, error: "Failed to load tenant summary" });
  }
});

export default router;





/**
 * POST /api/tenant-summaries/batch
 * Landlord-scoped batch fetch of tenant summaries (no compute-on-miss)
 */
router.post("/tenant-summaries/batch", requireAuth, requireLandlord, async (req: any, res) => {
  res.setHeader("x-route-source", "tenantEventsWriteRoutes");

  const landlordId = getLandlordId(req);
  if (!landlordId) return res.status(401).json({ ok: false, error: "Unauthorized" });

  const tenantIdsRaw = req.body?.tenantIds;
  const tenantIds: string[] = Array.isArray(tenantIdsRaw)
    ? tenantIdsRaw.map((x: any) => String(x || "").trim()).filter(Boolean)
    : [];

  if (tenantIds.length === 0) {
    return res.status(400).json({ ok: false, error: "tenantIds must be a non-empty array" });
  }
  if (tenantIds.length > 100) {
    return res.status(400).json({ ok: false, error: "tenantIds max 100" });
  }

  try {
    const refs = tenantIds.map((tid) => db.collection("tenantSummaries").doc(`${landlordId}__${tid}`));
    const snaps = await (db as any).getAll(...refs);

    const itemsByTenantId: Record<string, any> = {};
    for (let i = 0; i < tenantIds.length; i++) {
      const tid = tenantIds[i];
      const snap = snaps[i];
      itemsByTenantId[tid] = snap?.exists ? { id: snap.id, ...(snap.data() as any) } : null;
    }

    return res.json({ ok: true, itemsByTenantId });
  } catch (err: any) {
    console.error("[tenant-summaries batch] error", err);
    return res.status(500).json({ ok: false, error: "Failed to batch load tenant summaries" });
  }
});
