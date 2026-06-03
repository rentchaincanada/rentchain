import { Router } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import type { CanonicalEventV1 } from "../lib/events/eventTypes";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import { deriveScreeningReconciliation } from "../lib/reconciliation/deriveScreeningReconciliation";
import type { ScreeningReconciliationStatus, ScreeningReconciliationV1 } from "../lib/reconciliation/reconciliationTypes";

const router = Router();

const ALLOWED_STATUSES = new Set<ScreeningReconciliationStatus>([
  "not_started",
  "quoted",
  "checkout_created",
  "payment_pending",
  "paid_not_fulfilled",
  "fulfilled",
  "blocked",
  "expired",
  "abandoned",
  "mismatch",
  "duplicate_risk",
  "needs_review",
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

function parseCursor(value: unknown): { timestamp: string; applicationId: string } | null {
  const raw = asString(value, 4000);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const timestamp = asString(parsed?.timestamp);
    const applicationId = asString(parsed?.applicationId);
    if (!timestamp || !applicationId) return null;
    return { timestamp, applicationId };
  } catch {
    return null;
  }
}

function encodeCursor(reconciliation: ScreeningReconciliationV1) {
  return Buffer.from(
    JSON.stringify({
      timestamp: reconciliation.summary.lastMeaningfulEventAt || reconciliation.generatedAt,
      applicationId: reconciliation.applicationId,
    }),
    "utf8"
  ).toString("base64url");
}

function compareReconciliationsDescending(a: ScreeningReconciliationV1, b: ScreeningReconciliationV1) {
  const aTs = Date.parse(a.summary.lastMeaningfulEventAt || a.generatedAt || "");
  const bTs = Date.parse(b.summary.lastMeaningfulEventAt || b.generatedAt || "");
  if (bTs !== aTs) return bTs - aTs;
  return String(b.applicationId || "").localeCompare(String(a.applicationId || ""));
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

async function loadFinancialTransactions() {
  const snap = await db.collection("financialTransactions").get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

async function loadScreeningOrders() {
  const snap = await db.collection("screeningOrders").get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

async function loadApplications() {
  const snap = await db.collection("rentalApplications").get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

function latestOrderByApplication(orders: any[]) {
  const grouped = new Map<string, any[]>();
  for (const order of orders) {
    const applicationId = asString(order?.applicationId, 240);
    if (!applicationId) continue;
    if (!grouped.has(applicationId)) grouped.set(applicationId, []);
    grouped.get(applicationId)!.push(order);
  }
  const latest = new Map<string, any>();
  for (const [applicationId, items] of grouped.entries()) {
    const ordered = [...items].sort(
      (a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0)
    );
    latest.set(applicationId, ordered[0]);
  }
  return latest;
}

router.get("/screening-reconciliation/application/:applicationId", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const applicationId = asString(req.params?.applicationId, 240);
    if (!applicationId) {
      return res.status(400).json({ ok: false, error: "APPLICATION_ID_INVALID" });
    }
    const appSnap = await db.collection("rentalApplications").doc(applicationId).get();
    if (!appSnap.exists) {
      return res.json({ reconciliation: null });
    }

    const [canonicalEvents, financialTransactions, orders] = await Promise.all([
      loadCanonicalEvents(),
      loadFinancialTransactions(),
      loadScreeningOrders(),
    ]);
    const latestOrder = latestOrderByApplication(orders).get(applicationId) || null;
    const reconciliation = deriveScreeningReconciliation({
      applicationId,
      application: appSnap.data(),
      latestOrder,
      canonicalEvents,
      financialTransactions,
    });

    return res.json({ reconciliation });
  } catch (err: any) {
    console.error("[screening-reconciliation] application fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SCREENING_RECONCILIATION_FETCH_FAILED" });
  }
});

router.get("/screening-reconciliation/summary", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const status = asString(req.query?.status, 80).toLowerCase();
    if (status && !ALLOWED_STATUSES.has(status as ScreeningReconciliationStatus)) {
      return res.status(400).json({ ok: false, error: "STATUS_INVALID" });
    }
    const includeNeedsReview = String(req.query?.includeNeedsReview || "true").toLowerCase() !== "false";
    const limit = parseLimit(req.query?.limit);
    const cursor = parseCursor(req.query?.cursor);

    const [applications, canonicalEvents, financialTransactions, orders] = await Promise.all([
      loadApplications(),
      loadCanonicalEvents(),
      loadFinancialTransactions(),
      loadScreeningOrders(),
    ]);
    const latestOrders = latestOrderByApplication(orders);

    const reconciliations = applications
      .filter((application) => {
        return Boolean(
          application?.screeningMonetization ||
            application?.screeningStatus ||
            latestOrders.has(application.id)
        );
      })
      .map((application) =>
        deriveScreeningReconciliation({
          applicationId: application.id,
          application,
          latestOrder: latestOrders.get(application.id) || null,
          canonicalEvents,
          financialTransactions,
        })
      )
      .filter((reconciliation) => (status ? reconciliation.status === status : true))
      .filter((reconciliation) => (includeNeedsReview ? true : reconciliation.status !== "needs_review"))
      .sort(compareReconciliationsDescending);

    const cursorFiltered = cursor
      ? reconciliations.filter((reconciliation) => {
          const reconciliationKey = `${reconciliation.summary.lastMeaningfulEventAt || reconciliation.generatedAt}::${reconciliation.applicationId}`;
          const cursorKey = `${cursor.timestamp}::${cursor.applicationId}`;
          return reconciliationKey < cursorKey;
        })
      : reconciliations;

    const page = cursorFiltered.slice(0, limit);
    const hasMore = cursorFiltered.length > limit;
    return res.json({
      reconciliations: page,
      nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : undefined,
    });
  } catch (err: any) {
    console.error("[screening-reconciliation] summary fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "SCREENING_RECONCILIATION_SUMMARY_FAILED" });
  }
});

export default router;
