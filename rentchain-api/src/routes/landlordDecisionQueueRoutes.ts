import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { requireLandlord } from "../middleware/requireLandlord";
import { loadLandlordAnalyticsSnapshot } from "../services/landlord/landlordAnalyticsSnapshot";
import { deriveLeaseDecisionsForInbox, derivePaymentConsistentDecisionInbox } from "./landlordDecisionInboxRoutes";
import { getUnifiedInbox } from "../services/unifiedInbox";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import {
  appendLandlordDecisionQueueAuditEventId,
  applyLandlordDecisionQueueLifecycleOverlay,
  createLandlordDecisionQueueItem,
  deriveLandlordDecisionQueue,
  findPersistedLandlordDecisionQueueItemBySource,
  LandlordDecisionQueueLifecycleError,
  loadPersistedLandlordDecisionQueueItems,
  summarizeLandlordDecisionQueueItems,
  updateLandlordDecisionQueueItem,
  type LandlordDecisionQueueAssignment,
  type LandlordDecisionQueueItem,
  type LandlordDecisionQueueSeverity,
  type LandlordDecisionQueueSourceType,
  type LandlordDecisionQueueStatus,
  type LandlordDecisionQueueWorkspace,
} from "../services/landlordDecisionQueue";

const router = Router();

const ROUTE_VERSION = "landlord-decision-queue-api-v1";
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

const SEVERITIES = new Set<LandlordDecisionQueueSeverity>([
  "critical",
  "warning",
  "needs_review",
  "upcoming",
  "informational",
]);
const WORKSPACES = new Set<LandlordDecisionQueueWorkspace>([
  "dashboard",
  "operations",
  "tenant",
  "lease",
  "property",
  "maintenance",
  "payments",
  "notices",
  "evidence_compliance",
]);
const SOURCE_TYPES = new Set<LandlordDecisionQueueSourceType>([
  "renewal_notice_send_review",
  "application_review",
  "evidence_review",
  "decision_inbox",
  "lease_state_coherence",
  "payment_obligation",
  "payment_readiness",
  "lease_lifecycle",
  "maintenance_readiness",
  "property_action_request",
  "message_thread",
  "message_unread_priority",
  "message_notice_relevance",
  "message_maintenance_follow_up",
  "message_support_escalation",
  "unified_inbox_event",
]);
const STATUSES = new Set<LandlordDecisionQueueStatus>([
  "open",
  "acknowledged",
  "in_review",
  "pending",
  "blocked",
  "approved",
  "returned",
  "deferred",
  "resolved",
  "dismissed",
]);

router.use((_req, res, next) => {
  res.setHeader("x-landlord-decision-queue-route-version", ROUTE_VERSION);
  next();
});

function asString(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

function normalizeFilter<T extends string>(value: unknown, known: Set<T>): T | null {
  const raw = asString(value, 80).toLowerCase().replace(/-/g, "_");
  if (!raw || raw === "all") return null;
  return known.has(raw as T) ? (raw as T) : null;
}

function parseLimit(value: unknown): number {
  if (value == null || value === "") return DEFAULT_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function bodyObject(req: any): Record<string, unknown> {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
}

function cleanRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
    const safeKey = asString(key, 80);
    if (!safeKey) continue;
    if (raw == null || typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      output[safeKey] = raw;
    }
  }
  return Object.keys(output).length ? output : null;
}

function assignmentFromBody(body: Record<string, unknown>): LandlordDecisionQueueAssignment | null | undefined {
  if (body.assignment !== undefined) {
    if (!body.assignment || typeof body.assignment !== "object" || Array.isArray(body.assignment)) return null;
    const assignment = body.assignment as Record<string, unknown>;
    return {
      assignedToUserId: asString(assignment.assignedToUserId, 240) || null,
      assignedToEmail: asString(assignment.assignedToEmail, 240) || null,
      assignmentLabel: asString(assignment.assignmentLabel, 180) || null,
    };
  }
  if (body.assignedToUserId !== undefined || body.assignedToEmail !== undefined || body.assignmentLabel !== undefined) {
    return {
      assignedToUserId: asString(body.assignedToUserId, 240) || null,
      assignedToEmail: asString(body.assignedToEmail, 240) || null,
      assignmentLabel: asString(body.assignmentLabel, 180) || null,
    };
  }
  return undefined;
}

function actorId(req: any): string | null {
  return asString(req.user?.id || req.user?.uid || req.user?.email, 240) || null;
}

function actorEmail(req: any): string | null {
  return asString(req.user?.email, 240) || null;
}

function actionLabelForAudit(action: unknown, status: unknown, fallback: string): string {
  const actionValue = asString(action, 80).toLowerCase().replace(/-/g, "_");
  if (actionValue) return actionValue;
  const statusValue = asString(status, 80).toLowerCase().replace(/-/g, "_");
  return statusValue ? `set_${statusValue}` : fallback;
}

async function recordDecisionQueueAuditEvent(params: {
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  item: LandlordDecisionQueueItem;
}): Promise<string | null> {
  const event = await writeCanonicalEvent({
    domain: "system",
    action: `landlord_decision_queue_item_${params.action}`,
    status: params.item.status,
    actor: {
      type: "user",
      id: params.actorId,
      role: "landlord",
      displayName: params.actorEmail,
    },
    resource: {
      type: "landlord_decision_queue_item",
      id: params.item.id,
      parentType: "landlord",
      parentId: params.item.landlordId,
    },
    visibility: "landlord",
    summary: `Landlord decision queue item ${params.action.replace(/_/g, " ")}.`,
    metadata: {
      landlordId: params.item.landlordId,
      decisionItemId: params.item.id,
      sourceType: params.item.sourceType,
      sourceId: params.item.sourceId,
      workspace: params.item.workspace,
      severity: params.item.severity,
      status: params.item.status,
      dueAt: params.item.dueAt,
      assignedToUserId: params.item.assignment?.assignedToUserId || null,
      assignedToEmail: params.item.assignment?.assignedToEmail || null,
      leaseId: params.item.leaseId || null,
      propertyId: params.item.propertyId || null,
      tenantId: params.item.tenantId || null,
      noSendBehavior: true,
      noTenantNotification: true,
      noNoticeServed: true,
      noLeaseLifecycleMutation: true,
    },
    tags: ["landlord_decision_queue", params.item.workspace, params.item.sourceType],
  });
  return event?.id || null;
}

function applyFilters(
  items: LandlordDecisionQueueItem[],
  filters: {
    severity: LandlordDecisionQueueSeverity | null;
    workspace: LandlordDecisionQueueWorkspace | null;
    status: LandlordDecisionQueueStatus | "open_state" | null;
    sourceType: LandlordDecisionQueueSourceType | null;
    sourceId: string | null;
    sourceRoute: string | null;
  }
) {
  return items.filter((item) => {
    if (filters.severity && item.severity !== filters.severity) return false;
    if (filters.workspace && item.workspace !== filters.workspace) return false;
    if (filters.status === "open_state" && (item.status === "resolved" || item.status === "dismissed")) return false;
    if (filters.status && filters.status !== "open_state" && item.status !== filters.status) return false;
    if (filters.sourceType && item.sourceType !== filters.sourceType) return false;
    if (filters.sourceId && item.sourceId !== filters.sourceId) return false;
    if (filters.sourceRoute && item.sourceRoute !== filters.sourceRoute) return false;
    return true;
  });
}

router.get("/decision-queue", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const [snapshot, leaseDecisions, unifiedInbox] = await Promise.all([
      loadLandlordAnalyticsSnapshot({
        landlordId,
        period: req.query?.period,
        propertyId: req.query?.propertyId,
      }),
      deriveLeaseDecisionsForInbox(landlordId),
      getUnifiedInbox({ role: "landlord", landlordId }, { limit: MAX_LIMIT }),
    ]);

    const decisionInbox = await derivePaymentConsistentDecisionInbox({
      landlordId,
      analyticsDecisions: Array.isArray(snapshot?.decisions?.items) ? snapshot.decisions.items : [],
      leaseDecisions,
    });

    const derivedQueue = deriveLandlordDecisionQueue({
      landlordId,
      decisionInboxItems: decisionInbox.items,
      unifiedInboxRecords: unifiedInbox.items,
    });
    const persistedItems = await loadPersistedLandlordDecisionQueueItems(landlordId);
    const queueItems = applyLandlordDecisionQueueLifecycleOverlay(derivedQueue.items, persistedItems);
    const summary = summarizeLandlordDecisionQueueItems(queueItems);

    const statusRaw = asString(req.query?.status ?? req.query?.open, 80).toLowerCase();
    const status: LandlordDecisionQueueStatus | "open_state" | null =
      statusRaw === "true" || statusRaw === "open_state"
        ? "open_state"
        : normalizeFilter(req.query?.status, STATUSES);
    const filters = {
      severity: normalizeFilter(req.query?.severity, SEVERITIES),
      workspace: normalizeFilter(req.query?.workspace, WORKSPACES),
      status,
      sourceType: normalizeFilter(req.query?.sourceType, SOURCE_TYPES),
      sourceId: asString(req.query?.sourceId, 300) || null,
      sourceRoute: asString(req.query?.sourceRoute, 700) || null,
    };
    const filteredItems = applyFilters(queueItems, {
      ...filters,
    });
    const limit = parseLimit(req.query?.limit);
    const items = filteredItems.slice(0, limit);

    return res.json({
      ok: true,
      ...derivedQueue,
      summary,
      items,
      total: filteredItems.length,
      limit,
      filters: {
        ...filters,
      },
    });
  } catch (err: any) {
    console.error("[landlord-decision-queue] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_QUEUE_FAILED" });
  }
});

router.post("/decision-queue/items", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    const body = bodyObject(req);
    const assignment = assignmentFromBody(body);
    const sourceType = normalizeFilter(body.sourceType, SOURCE_TYPES) as LandlordDecisionQueueSourceType | null;
    const sourceId = asString(body.sourceId, 300);
    if (sourceType && sourceId) {
      const existing = await findPersistedLandlordDecisionQueueItemBySource({
        landlordId,
        sourceType,
        sourceId,
      });
      if (existing) {
        return res.status(200).json({ ok: true, item: existing, auditEventId: null, created: false });
      }
    }
    const item = await createLandlordDecisionQueueItem({
      landlordId,
      actorId: actorId(req),
      actorEmail: actorEmail(req),
      sourceType: sourceType as any,
      sourceId,
      sourceRoute: asString(body.sourceRoute, 700) || null,
      workspace: normalizeFilter(body.workspace, WORKSPACES) as any,
      severity: normalizeFilter(body.severity, SEVERITIES) as any,
      title: asString(body.title, 180),
      description: asString(body.description, 500),
      recommendedActionLabel: asString(body.recommendedActionLabel, 120) || "Review",
      recommendedActionHref: asString(body.recommendedActionHref, 700) || "/operations",
      dueAt: body.dueAt == null ? null : asString(body.dueAt, 120),
      status: body.status ? (asString(body.status, 80) as LandlordDecisionQueueStatus) : null,
      assignment: assignment === undefined ? null : assignment,
      sourceSnapshot: cleanRecord(body.sourceSnapshot),
      metadata: cleanRecord(body.metadata),
      dedupeKey: asString(body.dedupeKey, 300) || null,
      propertyId: asString(body.propertyId, 240) || null,
      unitId: asString(body.unitId, 240) || null,
      tenantId: asString(body.tenantId, 240) || null,
      leaseId: asString(body.leaseId, 240) || null,
      maintenanceRequestId: asString(body.maintenanceRequestId, 240) || null,
      noticeId: asString(body.noticeId, 240) || null,
    });
    const auditEventId = await recordDecisionQueueAuditEvent({
      action: "created",
      actorId: actorId(req),
      actorEmail: actorEmail(req),
      item,
    });
    const auditedItem = auditEventId
      ? await appendLandlordDecisionQueueAuditEventId(landlordId, item.id, auditEventId)
      : item;
    return res.status(201).json({ ok: true, item: auditedItem || item, auditEventId, created: true });
  } catch (err: any) {
    if (err instanceof LandlordDecisionQueueLifecycleError) {
      return res.status(err.statusCode).json({ ok: false, error: err.code });
    }
    console.error("[landlord-decision-queue] create failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_QUEUE_ITEM_CREATE_FAILED" });
  }
});

router.patch("/decision-queue/items/:decisionItemId", requireAuth, requireLandlord, async (req: any, res) => {
  try {
    const landlordId = asString(req.user?.landlordId || req.user?.id, 240);
    const decisionItemId = asString(req.params?.decisionItemId, 300);
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    const body = bodyObject(req);
    const assignment = assignmentFromBody(body);
    const item = await updateLandlordDecisionQueueItem({
      landlordId,
      actorId: actorId(req),
      actorEmail: actorEmail(req),
      decisionItemId,
      action: asString(body.action, 80) || null,
      status: body.status ? (asString(body.status, 80) as LandlordDecisionQueueStatus) : null,
      assignment,
      clearAssignment: body.clearAssignment === true,
      dueAt: body.dueAt === undefined ? undefined : body.dueAt == null ? null : asString(body.dueAt, 120),
      clearDueAt: body.clearDueAt === true,
      metadata: body.metadata === undefined ? undefined : cleanRecord(body.metadata),
    });
    const auditEventId = await recordDecisionQueueAuditEvent({
      action: actionLabelForAudit(body.action, body.status, "updated"),
      actorId: actorId(req),
      actorEmail: actorEmail(req),
      item,
    });
    const auditedItem = auditEventId
      ? await appendLandlordDecisionQueueAuditEventId(landlordId, item.id, auditEventId)
      : item;
    return res.json({ ok: true, item: auditedItem || item, auditEventId });
  } catch (err: any) {
    if (err instanceof LandlordDecisionQueueLifecycleError) {
      return res.status(err.statusCode).json({ ok: false, error: err.code });
    }
    console.error("[landlord-decision-queue] update failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "LANDLORD_DECISION_QUEUE_ITEM_UPDATE_FAILED" });
  }
});

export default router;
