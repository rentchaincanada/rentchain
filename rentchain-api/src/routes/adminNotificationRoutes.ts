import { Router } from "express";
import { db } from "../config/firebase";
import { ADMIN_ASSIGNMENTS_COLLECTION } from "../lib/assignment/loadAssignmentRecord";
import { deriveAdminAlerts } from "../lib/alerting/deriveAdminAlerts";
import { loadAlertStates } from "../lib/alerting/loadAlertStates";
import { ADMIN_RESOLUTIONS_COLLECTION } from "../lib/resolution/loadResolutionRecord";
import { deriveAdminTriageQueue } from "../lib/triage/deriveAdminTriageQueue";
import { ADMIN_WATCHLISTS_COLLECTION, loadWatchlistEntries } from "../lib/watchlist/loadWatchlistEntries";
import { loadPortfolioScoreHistory } from "../lib/portfolioScoreHistory/loadPortfolioScoreHistory";
import { derivePortfolioScoreTrend } from "../lib/portfolioScoreHistory/derivePortfolioScoreTrend";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import { requireAuth } from "../middleware/requireAuth";
import { deriveNotifications } from "../lib/notifications/deriveNotifications";
import { loadNotificationStates } from "../lib/notifications/loadNotifications";
import { saveNotificationState } from "../lib/notifications/saveNotificationState";

const router = Router();

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

function encodeCursor(item: { id: string; createdAt: string }) {
  return Buffer.from(
    JSON.stringify({
      createdAt: item.createdAt,
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

function buildPortfolioIndex(records: any[], resourceType: string) {
  return Object.fromEntries(
    (records || []).map((record) => [
      `${resourceType}:${asString(record.id, 240)}`,
      asString(record.landlordId || record.portfolioId, 240) || null,
    ])
  );
}

router.get("/notifications", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const unreadOnly = String(req.query?.unreadOnly || "false").toLowerCase() === "true";
    const watchedOnly = String(req.query?.watchedOnly || "false").toLowerCase() === "true";
    const limit = parseLimit(req.query?.limit, 20);
    const cursor = parseCursor(req.query?.cursor);

    const [
      applications,
      maintenanceRequests,
      leases,
      canonicalEvents,
      screeningOrders,
      financialTransactions,
      resolutions,
      assignments,
      alertStates,
      watchlist,
      notificationStates,
    ] = await Promise.all([
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
      loadNotificationStates(),
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
    });
    const resourcePortfolioIds = {
      ...buildPortfolioIndex(applications, "application"),
      ...buildPortfolioIndex(maintenanceRequests, "maintenance"),
      ...buildPortfolioIndex(leases, "lease"),
    };
    const notifications = deriveNotifications({
      alerts,
      watchlist,
      notificationStates,
      resourcePortfolioIds,
    })
      .filter((item) => (unreadOnly ? item.state.status === "unread" : true))
      .filter((item) => (watchedOnly ? item.watched === true : true));

    const cursorFiltered = cursor
      ? notifications.filter((item) => `${item.createdAt}::${item.id}` < `${cursor.createdAt}::${cursor.itemId}`)
      : notifications;
    const page = cursorFiltered.slice(0, limit);
    const hasMore = cursorFiltered.length > limit;

    return res.json({
      notifications: page,
      nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : undefined,
    });
  } catch (err: any) {
    console.error("[admin-notifications] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_NOTIFICATIONS_FETCH_FAILED" });
  }
});

router.patch("/notifications/:notificationId/read", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const notificationId = asString(req.params?.notificationId, 240);
    if (!notificationId) {
      return res.status(400).json({ ok: false, error: "NOTIFICATION_ID_REQUIRED" });
    }

    const read = req.body?.read === true;
    const state = await saveNotificationState({ notificationId, read });
    return res.json({ state });
  } catch (err: any) {
    console.error("[admin-notifications] read update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_NOTIFICATION_STATE_UPDATE_FAILED" });
  }
});

export default router;
