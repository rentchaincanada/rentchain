import { Router } from "express";
import { db } from "../firebase";
import { ADMIN_ASSIGNMENTS_COLLECTION } from "../lib/assignment/loadAssignmentRecord";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import type { CanonicalEventV1 } from "../lib/events/eventTypes";
import { ADMIN_RESOLUTIONS_COLLECTION } from "../lib/resolution/loadResolutionRecord";
import { deriveSlaState } from "../lib/sla/deriveSlaState";
import { loadSlaContext } from "../lib/sla/loadSlaContext";
import type { EscalationLevel, SlaEvaluationV1, SlaStage } from "../lib/sla/slaTypes";
import { deriveAdminTriageQueue } from "../lib/triage/deriveAdminTriageQueue";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

const ALLOWED_STAGES = new Set<SlaStage>(["fresh", "aging", "due_soon", "overdue", "escalated"]);
const ALLOWED_ESCALATION_LEVELS = new Set<EscalationLevel>(["none", "low", "medium", "high", "critical"]);

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

function parseCursor(value: unknown): { evaluatedAt: string; itemId: string } | null {
  const raw = asString(value, 4000);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    const evaluatedAt = asString(parsed?.evaluatedAt);
    const itemId = asString(parsed?.itemId);
    if (!evaluatedAt || !itemId) return null;
    return { evaluatedAt, itemId };
  } catch {
    return null;
  }
}

function encodeCursor(item: SlaEvaluationV1) {
  return Buffer.from(
    JSON.stringify({
      evaluatedAt: item.evaluatedAt,
      itemId: `${item.resource.type}:${item.resource.id}`,
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

router.get("/sla", requireAuth, async (req: any, res) => {
  try {
    if (normalizeRole(req) !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const resourceType = asString(req.query?.resourceType, 80).toLowerCase();
    const resourceId = asString(req.query?.resourceId, 240);
    if (resourceType && !["application", "maintenance", "lease"].includes(resourceType)) {
      return res.status(400).json({ ok: false, error: "RESOURCE_TYPE_INVALID" });
    }

    const stage = asString(req.query?.stage, 80).toLowerCase();
    if (stage && !ALLOWED_STAGES.has(stage as SlaStage)) {
      return res.status(400).json({ ok: false, error: "STAGE_INVALID" });
    }

    const escalationLevel = asString(req.query?.escalationLevel, 80).toLowerCase();
    if (escalationLevel && !ALLOWED_ESCALATION_LEVELS.has(escalationLevel as EscalationLevel)) {
      return res.status(400).json({ ok: false, error: "ESCALATION_LEVEL_INVALID" });
    }

    const limit = parseLimit(req.query?.limit, 20);
    const cursor = parseCursor(req.query?.cursor);

    const [applications, maintenanceRequests, leases, canonicalEvents, screeningOrders, financialTransactions, resolutions, assignments] =
      await Promise.all([
        loadCollection("rentalApplications"),
        loadCollection("maintenanceRequests"),
        loadCollection("leases"),
        loadCanonicalEvents(),
        loadCollection("screeningOrders"),
        loadCollection("financialTransactions"),
        loadCollection(ADMIN_RESOLUTIONS_COLLECTION),
        loadCollection(ADMIN_ASSIGNMENTS_COLLECTION),
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

    const items = loadSlaContext({
      triageItems,
      resolutions,
      assignments,
      resourceType: resourceType || null,
      resourceId: resourceId || null,
    })
      .map(({ triageItem, resolution, assignment }) =>
        deriveSlaState({
          resourceType: triageItem.resource.type,
          resourceId: triageItem.resource.id,
          triageCategory: triageItem.category,
          triageSeverity: triageItem.severity,
          resolutionStatus: resolution?.status || null,
          assignmentOwnerId: assignment?.currentOwner?.ownerId || null,
          assignmentOwnerLabel: assignment?.currentOwner?.ownerLabel || null,
          firstSeenAt: triageItem.timestamps.firstSeenAt || triageItem.timestamps.surfacedAt,
          lastSeenAt: triageItem.timestamps.lastSeenAt || triageItem.timestamps.surfacedAt,
        })
      )
      .filter((item) => (stage ? item.sla.stage === stage : true))
      .filter((item) => (escalationLevel ? item.sla.escalationLevel === escalationLevel : true))
      .sort((a, b) => Date.parse(b.evaluatedAt) - Date.parse(a.evaluatedAt));

    const cursorFiltered = cursor
      ? items.filter(
          (item) =>
            `${item.evaluatedAt}::${item.resource.type}:${item.resource.id}` <
            `${cursor.evaluatedAt}::${cursor.itemId}`
        )
      : items;
    const page = cursorFiltered.slice(0, limit);
    const hasMore = cursorFiltered.length > limit;

    return res.json({
      items: page,
      nextCursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : undefined,
    });
  } catch (err: any) {
    console.error("[admin-sla] fetch failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "ADMIN_SLA_FETCH_FAILED" });
  }
});

export default router;
