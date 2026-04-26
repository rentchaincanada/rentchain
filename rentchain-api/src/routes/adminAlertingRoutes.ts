import crypto from "crypto";
import { Router } from "express";
import { db } from "../config/firebase";
import { ADMIN_ASSIGNMENTS_COLLECTION } from "../lib/assignment/loadAssignmentRecord";
import { requireAuth } from "../middleware/requireAuth";
import { deriveAdminAlerts } from "../lib/alerting/deriveAdminAlerts";
import type { AdminAlertV1, AlertCategory, AlertSeverity } from "../lib/alerting/alertingTypes";
import { loadAlertStates } from "../lib/alerting/loadAlertStates";
import { saveAlertAcknowledgement } from "../lib/alerting/saveAlertAcknowledgement";
import { loadPortfolioScoreHistory } from "../lib/portfolioScoreHistory/loadPortfolioScoreHistory";
import { derivePortfolioScoreTrend } from "../lib/portfolioScoreHistory/derivePortfolioScoreTrend";
import { CANONICAL_EVENTS_COLLECTION, writeCanonicalEvent } from "../lib/events/buildEvent";
import { ADMIN_RESOLUTIONS_COLLECTION } from "../lib/resolution/loadResolutionRecord";
import { deriveAdminTriageQueue } from "../lib/triage/deriveAdminTriageQueue";
import { ADMIN_WATCHLISTS_COLLECTION, loadWatchlistEntries } from "../lib/watchlist/loadWatchlistEntries";
import { saveWatchlistEntry } from "../lib/watchlist/saveWatchlistEntry";
import { updateWatchlistEntry } from "../lib/watchlist/updateWatchlistEntry";
import type { WatchTargetType, WatchlistEntryV1 } from "../lib/watchlist/watchlistTypes";

const router = Router();

const ALLOWED_ALERT_CATEGORIES = new Set<AlertCategory>([
  "screening_reconciliation",
  "portfolio_score_change",
  "policy_exception",
  "automation_exception",
  "maintenance_friction",
  "resolution_attention",
  "system_attention",
]);
const ALLOWED_ALERT_SEVERITIES = new Set<AlertSeverity>(["low", "medium", "high", "critical"]);
const ALLOWED_WATCH_TARGETS = new Set<WatchTargetType>(["portfolio", "application", "maintenance", "lease"]);

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function normalizeRole(req: any): "admin" | "landlord" | "other" {
  const role = asString(req.user?.actorRole || req.user?.role, 40).toLowerCase();
  if (role === "admin") return "admin";
  if (role === "landlord") return "landlord";
  return "other";
}

function parseLimit(value: unknown, fallback = 20) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(parsed)));
}

function parseCursor(value: unknown): { createdAt: string; itemId: string } | null {
  const raw = asString(value, 4000);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const createdAt = asString(parsed?.createdAt);
    const itemId = asString(parsed?.itemId);
    if (!createdAt || !itemId) return null;
    return { createdAt, itemId };
  } catch {
    return null;
  }
}

function encodeCursor(item: { id: string; timestamps?: { createdAt?: string } | null; createdAt?: string }) {
  return Buffer.from(
    JSON.stringify({
      createdAt: item.timestamps?.createdAt || item.createdAt || "",
      itemId: item.id,
    }),
    "utf8"
  ).toString("base64url");
}

async function loadCollection(name: string) {
  const snap = await db.collection(name).get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

async function loadCanonicalEvents() {
  const snap = await db.collection(CANONICAL_EVENTS_COLLECTION).get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

function latestUniquePortfolioIds(records: any[]) {
  return Array.from(
    new Set(
      (records || [])
        .map((record) => asString(record?.landlordId || record?.portfolioId, 240))
        .filter(Boolean)
    )
  );
}

async function loadPortfolioTrends(portfolioIds: string[]) {
  const trends = await Promise.all(
    portfolioIds.map(async (portfolioId) => {
      const history = await loadPortfolioScoreHistory(portfolioId, 12);
      return derivePortfolioScoreTrend(history, portfolioId);
    })
  );
  return trends;
}

function actorId(req: any) {
  return asString(req.user?.uid || req.user?.id, 240) || null;
}

router.get("/alerts", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const category = asString(req.query?.category, 80).toLowerCase();
    if (category && !ALLOWED_ALERT_CATEGORIES.has(category as AlertCategory)) {
      return res.status(400).json({ ok: false, error: "CATEGORY_INVALID" });
    }
    const severity = asString(req.query?.severity, 40).toLowerCase();
    if (severity && !ALLOWED_ALERT_SEVERITIES.has(severity as AlertSeverity)) {
      return res.status(400).json({ ok: false, error: "SEVERITY_INVALID" });
    }
    const resourceType = asString(req.query?.resourceType, 80).toLowerCase();
    const activeOnly = String(req.query?.activeOnly || "true").toLowerCase() !== "false";
    const acknowledged = asString(req.query?.acknowledged, 20).toLowerCase();
    const watchedOnly = String(req.query?.watchedOnly || "false").toLowerCase() === "true";
    const limit = parseLimit(req.query?.limit, 20);
    const cursor = parseCursor(req.query?.cursor);

    const [applications, maintenanceRequests, leases, canonicalEvents, screeningOrders, financialTransactions, resolutions, assignments, alertStates, watchlist] =
      await Promise.all([
        loadCollection("rentalApplications"),
        loadCollection("maintenanceRequests"),
        loadCollection("leases"),
        loadCanonicalEvents(),
        loadCollection("screeningOrders"),
        loadCollection("financialTransactions"),
        loadCollection(ADMIN_RESOLUTIONS_COLLECTION),
        loadCollection(ADMIN_ASSIGNMENTS_COLLECTION),
        loadAlertStates(),
        loadWatchlistEntries(),
      ]);

    const triageItems = deriveAdminTriageQueue({
      applications,
      maintenanceRequests,
      leases,
      canonicalEvents,
      screeningOrders,
      financialTransactions,
      resolutions,
      assignments,
    });
    const portfolioTrends = await loadPortfolioTrends(
      latestUniquePortfolioIds([...applications, ...maintenanceRequests, ...leases])
    );

    const alerts = deriveAdminAlerts({
      triageItems,
      portfolioTrends,
      resolutions,
      assignments,
      alertStates,
      watchlist,
    })
      .filter((item) => (category ? item.category === category : true))
      .filter((item) => (severity ? item.severity === severity : true))
      .filter((item) => (resourceType ? item.resource.type === resourceType : true))
      .filter((item) => (activeOnly ? item.state.isActive : true))
      .filter((item) =>
        acknowledged === "true" ? item.state.isAcknowledged : acknowledged === "false" ? !item.state.isAcknowledged : true
      )
      .filter((item) => (watchedOnly ? (item.tags || []).includes("watched") : true));

    const cursorFiltered = cursor
      ? alerts.filter((item) => {
          const itemKey = `${item.timestamps.createdAt}::${item.id}`;
          const cursorKey = `${cursor.createdAt}::${cursor.itemId}`;
          return itemKey < cursorKey;
        })
      : alerts;

    const page = cursorFiltered.slice(0, limit);
    const hasMore = cursorFiltered.length > limit;
    return res.json({
      alerts: page,
      nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : undefined,
    });
  } catch (err: any) {
    console.error("[admin-alerting] alerts fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_ALERTS_FETCH_FAILED" });
  }
});

router.patch("/alerts/:alertId/acknowledge", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const alertId = asString(req.params?.alertId, 240);
    const acknowledged = req.body?.acknowledged === true;
    if (!alertId) {
      return res.status(400).json({ ok: false, error: "ALERT_ID_REQUIRED" });
    }
    const state = await saveAlertAcknowledgement({
      alertId,
      acknowledged,
      acknowledgedBy: actorId(req),
    });
    await writeCanonicalEvent({
      type: "alert.acknowledged",
      domain: "system",
      action: "acknowledged",
      actor: { type: "admin", id: actorId(req), role: "admin" },
      resource: { type: "alert", id: alertId },
      occurredAt: state.updatedAt,
      visibility: "internal",
      summary: acknowledged ? `Alert ${alertId} acknowledged.` : `Alert ${alertId} unacknowledged.`,
      metadata: { acknowledged },
    });
    return res.json({ state });
  } catch (err: any) {
    console.error("[admin-alerting] alert acknowledge failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_ALERT_ACKNOWLEDGE_FAILED" });
  }
});

router.get("/watchlist", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const targetType = asString(req.query?.targetType, 80).toLowerCase();
    if (targetType && !ALLOWED_WATCH_TARGETS.has(targetType as WatchTargetType)) {
      return res.status(400).json({ ok: false, error: "TARGET_TYPE_INVALID" });
    }
    const portfolioId = asString(req.query?.portfolioId, 240);
    const activeOnly = String(req.query?.activeOnly || "true").toLowerCase() !== "false";
    const limit = parseLimit(req.query?.limit, 20);
    const cursor = parseCursor(req.query?.cursor);

    const allEntries = (await loadWatchlistEntries())
      .filter((entry) => (targetType ? entry.target.type === targetType : true))
      .filter((entry) => (portfolioId ? asString(entry.target.portfolioId, 240) === portfolioId : true))
      .filter((entry) => (activeOnly ? entry.isActive : true))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));

    const cursorFiltered = cursor
      ? allEntries.filter((entry) => `${entry.updatedAt}::${entry.id}` < `${cursor.createdAt}::${cursor.itemId}`)
      : allEntries;
    const page = cursorFiltered.slice(0, limit);
    const hasMore = cursorFiltered.length > limit;
    return res.json({
      watchlist: page,
      nextCursor: hasMore && page.length ? encodeCursor({ id: page[page.length - 1].id, createdAt: page[page.length - 1].updatedAt }) : undefined,
    });
  } catch (err: any) {
    console.error("[admin-alerting] watchlist fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_WATCHLIST_FETCH_FAILED" });
  }
});

router.post("/watchlist", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const targetType = asString(req.body?.targetType, 80).toLowerCase() as WatchTargetType;
    const targetId = asString(req.body?.targetId, 240);
    const portfolioId = asString(req.body?.portfolioId, 240) || null;
    if (!ALLOWED_WATCH_TARGETS.has(targetType) || !targetId) {
      return res.status(400).json({ ok: false, error: "WATCH_TARGET_INVALID" });
    }
    const existing = (await loadWatchlistEntries()).find(
      (entry) => entry.target.type === targetType && entry.target.id === targetId
    );
    if (existing) {
      const updated = await updateWatchlistEntry(existing, {
        isActive: true,
        notes: req.body?.notes ?? existing.notes ?? null,
        tags: Array.isArray(req.body?.tags) ? req.body.tags : existing.tags || [],
      });
      return res.json({ watch: updated });
    }
    const now = new Date().toISOString();
    const watch: WatchlistEntryV1 = {
      version: "v1",
      id: crypto.randomUUID(),
      target: {
        type: targetType,
        id: targetId,
        portfolioId,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: actorId(req),
      notes: asString(req.body?.notes, 2000) || null,
      tags: Array.isArray(req.body?.tags) ? req.body.tags.filter(Boolean) : [],
      isActive: true,
    };
    await saveWatchlistEntry(watch);
    await writeCanonicalEvent({
      type: "watchlist.created",
      domain: "system",
      action: "created",
      actor: { type: "admin", id: actorId(req), role: "admin" },
      resource: { type: "watchlist", id: watch.id, parentType: targetType, parentId: targetId },
      occurredAt: now,
      visibility: "internal",
      summary: `Watchlist entry created for ${targetType} ${targetId}.`,
    });
    return res.status(201).json({ watch });
  } catch (err: any) {
    console.error("[admin-alerting] watchlist create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_WATCHLIST_CREATE_FAILED" });
  }
});

router.patch("/watchlist/:watchId", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const watchId = asString(req.params?.watchId, 240);
    if (!watchId) {
      return res.status(400).json({ ok: false, error: "WATCH_ID_REQUIRED" });
    }
    const snap = await db.collection(ADMIN_WATCHLISTS_COLLECTION).doc(watchId).get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "WATCH_NOT_FOUND" });
    }
    const existing = { id: snap.id, ...(snap.data() || {}) } as WatchlistEntryV1;
    const watch = await updateWatchlistEntry(existing, {
      isActive: typeof req.body?.isActive === "boolean" ? req.body.isActive : undefined,
      notes: req.body?.notes ?? undefined,
      tags: Array.isArray(req.body?.tags) ? req.body.tags : undefined,
    });
    await writeCanonicalEvent({
      type: "watchlist.updated",
      domain: "system",
      action: "updated",
      actor: { type: "admin", id: actorId(req), role: "admin" },
      resource: { type: "watchlist", id: watch.id, parentType: watch.target.type, parentId: watch.target.id },
      occurredAt: watch.updatedAt,
      visibility: "internal",
      summary: `Watchlist entry updated for ${watch.target.type} ${watch.target.id}.`,
      metadata: { isActive: watch.isActive },
    });
    return res.json({ watch });
  } catch (err: any) {
    console.error("[admin-alerting] watchlist update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_WATCHLIST_UPDATE_FAILED" });
  }
});

export default router;
