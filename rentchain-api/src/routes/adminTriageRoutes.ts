import { Router } from "express";
import { db } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import type { CanonicalEventV1 } from "../lib/events/eventTypes";
import { ADMIN_RESOLUTIONS_COLLECTION } from "../lib/resolution/loadResolutionRecord";
import { deriveAdminTriageQueue } from "../lib/triage/deriveAdminTriageQueue";
import type { AdminTriageItemV1, TriageCategory, TriageSeverity } from "../lib/triage/triageTypes";

const router = Router();

const ALLOWED_CATEGORIES = new Set<TriageCategory>([
  "screening_reconciliation",
  "policy_review",
  "automation_exception",
  "maintenance_friction",
  "workflow_stall",
  "system_attention",
]);

const ALLOWED_SEVERITIES = new Set<TriageSeverity>(["low", "medium", "high", "critical"]);

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

function parseCursor(value: unknown): { surfacedAt: string; itemId: string } | null {
  const raw = asString(value, 4000);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const surfacedAt = asString(parsed?.surfacedAt);
    const itemId = asString(parsed?.itemId);
    if (!surfacedAt || !itemId) return null;
    return { surfacedAt, itemId };
  } catch {
    return null;
  }
}

function encodeCursor(item: AdminTriageItemV1) {
  return Buffer.from(
    JSON.stringify({
      surfacedAt: item.timestamps.surfacedAt,
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
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }) as CanonicalEventV1);
}

router.get("/triage", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const category = asString(req.query?.category, 80).toLowerCase();
    if (category && !ALLOWED_CATEGORIES.has(category as TriageCategory)) {
      return res.status(400).json({ ok: false, error: "CATEGORY_INVALID" });
    }

    const severity = asString(req.query?.severity, 40).toLowerCase();
    if (severity && !ALLOWED_SEVERITIES.has(severity as TriageSeverity)) {
      return res.status(400).json({ ok: false, error: "SEVERITY_INVALID" });
    }

    const resourceType = asString(req.query?.resourceType, 80).toLowerCase();
    if (resourceType && !["application", "maintenance", "lease"].includes(resourceType)) {
      return res.status(400).json({ ok: false, error: "RESOURCE_TYPE_INVALID" });
    }

    const includeLow = String(req.query?.includeLow || "false").toLowerCase() === "true";
    const limit = parseLimit(req.query?.limit);
    const cursor = parseCursor(req.query?.cursor);

    const [applications, maintenanceRequests, leases, canonicalEvents, screeningOrders, financialTransactions, resolutions] =
      await Promise.all([
        loadCollection("rentalApplications"),
        loadCollection("maintenanceRequests"),
        loadCollection("leases"),
        loadCanonicalEvents(),
        loadCollection("screeningOrders"),
        loadCollection("financialTransactions"),
        loadCollection(ADMIN_RESOLUTIONS_COLLECTION),
      ]);

    const allItems = deriveAdminTriageQueue({
      applications,
      maintenanceRequests,
      leases,
      canonicalEvents,
      screeningOrders,
      financialTransactions,
      resolutions,
    })
      .filter((item) => (includeLow ? true : item.severity !== "low"))
      .filter((item) => (category ? item.category === category : true))
      .filter((item) => (severity ? item.severity === severity : true))
      .filter((item) => (resourceType ? item.resource.type === resourceType : true));

    const cursorFiltered = cursor
      ? allItems.filter((item) => {
          const itemKey = `${item.timestamps.surfacedAt}::${item.id}`;
          const cursorKey = `${cursor.surfacedAt}::${cursor.itemId}`;
          return itemKey < cursorKey;
        })
      : allItems;

    const page = cursorFiltered.slice(0, limit);
    const hasMore = cursorFiltered.length > limit;

    return res.json({
      items: page,
      nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : undefined,
    });
  } catch (err: any) {
    console.error("[admin-triage] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_TRIAGE_FETCH_FAILED" });
  }
});

export default router;
