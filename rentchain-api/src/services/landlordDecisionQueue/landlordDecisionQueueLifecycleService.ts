import crypto from "crypto";
import { db } from "../../firebase";
import {
  buildLandlordDecisionQueueItem,
  sortLandlordDecisionQueueItems,
} from "./landlordDecisionQueueService";
import type {
  LandlordDecisionQueueAssignment,
  LandlordDecisionQueueItem,
  LandlordDecisionQueueRelatedRefs,
  LandlordDecisionQueueSeverity,
  LandlordDecisionQueueSourceType,
  LandlordDecisionQueueStatus,
  LandlordDecisionQueueWorkspace,
} from "./landlordDecisionQueueTypes";

export const LANDLORD_DECISION_QUEUE_ITEMS_COLLECTION = "landlordDecisionQueueItems";

const MAX_TEXT = 500;

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

export class LandlordDecisionQueueLifecycleError extends Error {
  statusCode: number;
  code: string;

  constructor(code: string, statusCode: number, message?: string) {
    super(message || code);
    this.name = "LandlordDecisionQueueLifecycleError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export type CreateLandlordDecisionQueueItemInput = LandlordDecisionQueueRelatedRefs & {
  landlordId: string;
  actorId: string | null;
  actorEmail?: string | null;
  sourceType: LandlordDecisionQueueSourceType;
  sourceId: string;
  sourceRoute?: string | null;
  workspace: LandlordDecisionQueueWorkspace;
  severity: LandlordDecisionQueueSeverity;
  title: string;
  description: string;
  recommendedActionLabel: string;
  recommendedActionHref: string;
  dueAt?: string | null;
  status?: LandlordDecisionQueueStatus | null;
  assignment?: LandlordDecisionQueueAssignment | null;
  sourceSnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  dedupeKey?: string | null;
};

export type UpdateLandlordDecisionQueueItemInput = {
  landlordId: string;
  actorId: string | null;
  actorEmail?: string | null;
  decisionItemId: string;
  action?: string | null;
  status?: LandlordDecisionQueueStatus | null;
  assignment?: LandlordDecisionQueueAssignment | null;
  clearAssignment?: boolean;
  dueAt?: string | null;
  clearDueAt?: boolean;
  metadata?: Record<string, unknown> | null;
};

function asString(value: unknown, max = MAX_TEXT): string {
  return String(value ?? "").trim().slice(0, max);
}

function cleanToken(value: unknown, fallback: string): string {
  const cleaned = asString(value, 300)
    .toLowerCase()
    .replace(/[\/\\#?&=]+/g, "_")
    .replace(/[^a-z0-9_.:-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function normalizeDate(value: unknown, fieldName: string): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) {
    throw new LandlordDecisionQueueLifecycleError(`${fieldName}_invalid`, 400);
  }
  return new Date(parsed).toISOString();
}

function safeHref(value: unknown, fallback = "/operations"): string {
  const href = asString(value, 700);
  if (!href) return fallback;
  if (href.startsWith("/")) return href;
  if (href.startsWith("https://")) return href;
  return fallback;
}

function cleanRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
    const safeKey = asString(key, 80);
    if (!safeKey) continue;
    if (raw == null || typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean") {
      output[safeKey] = raw;
    } else if (Array.isArray(raw)) {
      output[safeKey] = raw
        .filter((entry) => entry == null || typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean")
        .slice(0, 20);
    }
  }
  return Object.keys(output).length ? output : null;
}

function normalizeRelatedRefs(input: LandlordDecisionQueueRelatedRefs): LandlordDecisionQueueRelatedRefs {
  return {
    propertyId: asString(input.propertyId, 240) || null,
    unitId: asString(input.unitId, 240) || null,
    tenantId: asString(input.tenantId, 240) || null,
    leaseId: asString(input.leaseId, 240) || null,
    maintenanceRequestId: asString(input.maintenanceRequestId, 240) || null,
    noticeId: asString(input.noticeId, 240) || null,
  };
}

function normalizeAssignment(value: unknown): LandlordDecisionQueueAssignment | null {
  if (!value || typeof value !== "object") return null;
  const assignment = value as Partial<LandlordDecisionQueueAssignment>;
  const assignedToUserId = asString(assignment.assignedToUserId, 240) || null;
  const assignedToEmail = asString(assignment.assignedToEmail, 240) || null;
  const assignmentLabel = asString(assignment.assignmentLabel, 180) || assignedToEmail || assignedToUserId || null;
  if (!assignedToUserId && !assignedToEmail && !assignmentLabel) return null;
  return { assignedToUserId, assignedToEmail, assignmentLabel };
}

function requireKnown<T extends string>(value: unknown, known: Set<T>, fieldName: string): T {
  const cleaned = asString(value, 120).toLowerCase().replace(/-/g, "_") as T;
  if (!known.has(cleaned)) {
    throw new LandlordDecisionQueueLifecycleError(`${fieldName}_invalid`, 400);
  }
  return cleaned;
}

function normalizePersistedItem(id: string, raw: Record<string, unknown> | undefined | null): LandlordDecisionQueueItem | null {
  if (!raw) return null;
  try {
    const landlordId = asString(raw.landlordId, 240);
    const sourceType = requireKnown(raw.sourceType, SOURCE_TYPES, "source_type");
    const sourceId = asString(raw.sourceId, 300);
    const workspace = requireKnown(raw.workspace, WORKSPACES, "workspace");
    const severity = requireKnown(raw.severity, SEVERITIES, "severity");
    const status = requireKnown(raw.status || "open", STATUSES, "status");
    const title = asString(raw.title, 180);
    const description = asString(raw.description, 500);
    const recommendedActionLabel = asString(raw.recommendedActionLabel, 120) || "Review";
    const recommendedActionHref = safeHref(raw.recommendedActionHref, "/operations");
    if (!landlordId || !sourceId || !title || !description) return null;
    return buildLandlordDecisionQueueItem({
      id: asString(raw.id, 300) || id,
      landlordId,
      persistence: "persisted",
      sourceType,
      sourceId,
      sourceRoute: asString(raw.sourceRoute, 700) || null,
      workspace,
      severity,
      title,
      description,
      recommendedActionLabel,
      recommendedActionHref,
      dueAt: normalizeDate(raw.dueAt, "due_at"),
      createdAt: normalizeDate(raw.createdAt, "created_at"),
      updatedAt: normalizeDate(raw.updatedAt, "updated_at"),
      status,
      assignment: normalizeAssignment(raw.assignment),
      createdBy: asString(raw.createdBy, 240) || null,
      updatedBy: asString(raw.updatedBy, 240) || null,
      lastActionAt: normalizeDate(raw.lastActionAt, "last_action_at"),
      lastActionBy: asString(raw.lastActionBy, 240) || null,
      sourceSnapshot: cleanRecord(raw.sourceSnapshot),
      auditEventIds: Array.isArray(raw.auditEventIds)
        ? raw.auditEventIds.map((entry) => asString(entry, 240)).filter(Boolean).slice(0, 100)
        : [],
      metadata: cleanRecord(raw.metadata),
      dedupeKey: asString(raw.dedupeKey, 300) || cleanToken([sourceType, sourceId].join(":"), sourceId),
      ...normalizeRelatedRefs(raw),
    });
  } catch {
    return null;
  }
}

function itemToDocument(item: LandlordDecisionQueueItem): Record<string, unknown> {
  return {
    id: item.id,
    landlordId: item.landlordId,
    persistence: item.persistence || "persisted",
    sourceType: item.sourceType,
    sourceId: item.sourceId,
    sourceRoute: item.sourceRoute || null,
    workspace: item.workspace,
    severity: item.severity,
    title: item.title,
    description: item.description,
    recommendedActionLabel: item.recommendedActionLabel,
    recommendedActionHref: item.recommendedActionHref,
    dueAt: item.dueAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    status: item.status,
    assignment: item.assignment || null,
    createdBy: item.createdBy || null,
    updatedBy: item.updatedBy || null,
    lastActionAt: item.lastActionAt || null,
    lastActionBy: item.lastActionBy || null,
    sourceSnapshot: item.sourceSnapshot || null,
    auditEventIds: item.auditEventIds || [],
    metadata: item.metadata || null,
    dedupeKey: item.dedupeKey,
    propertyId: item.propertyId || null,
    unitId: item.unitId || null,
    tenantId: item.tenantId || null,
    leaseId: item.leaseId || null,
    maintenanceRequestId: item.maintenanceRequestId || null,
    noticeId: item.noticeId || null,
  };
}

export async function loadPersistedLandlordDecisionQueueItems(landlordId: string): Promise<LandlordDecisionQueueItem[]> {
  const normalizedLandlordId = asString(landlordId, 240);
  if (!normalizedLandlordId) return [];
  const snapshot = await db
    .collection(LANDLORD_DECISION_QUEUE_ITEMS_COLLECTION)
    .where("landlordId", "==", normalizedLandlordId)
    .get();
  return sortLandlordDecisionQueueItems(
    (snapshot.docs || [])
      .map((doc: any) => normalizePersistedItem(doc.id, doc.data?.()))
      .filter((item: LandlordDecisionQueueItem | null): item is LandlordDecisionQueueItem => Boolean(item))
  );
}

export async function findPersistedLandlordDecisionQueueItemBySource(params: {
  landlordId: string;
  sourceType: LandlordDecisionQueueSourceType;
  sourceId: string;
}): Promise<LandlordDecisionQueueItem | null> {
  const landlordId = asString(params.landlordId, 240);
  const sourceType = requireKnown(params.sourceType, SOURCE_TYPES, "source_type");
  const sourceId = asString(params.sourceId, 300);
  if (!landlordId || !sourceId) return null;
  const snapshot = await db
    .collection(LANDLORD_DECISION_QUEUE_ITEMS_COLLECTION)
    .where("landlordId", "==", landlordId)
    .where("sourceType", "==", sourceType)
    .where("sourceId", "==", sourceId)
    .get();
  const items = sortLandlordDecisionQueueItems(
    (snapshot.docs || [])
      .map((doc: any) => normalizePersistedItem(doc.id, doc.data?.()))
      .filter((item: LandlordDecisionQueueItem | null): item is LandlordDecisionQueueItem => Boolean(item))
  );
  return items[0] || null;
}

function overlayLifecycleFields(
  derived: LandlordDecisionQueueItem,
  persisted: LandlordDecisionQueueItem
): LandlordDecisionQueueItem {
  return buildLandlordDecisionQueueItem({
    ...derived,
    id: persisted.id,
    persistence: "persisted",
    status: persisted.status,
    dueAt: persisted.dueAt || derived.dueAt,
    updatedAt: persisted.updatedAt || derived.updatedAt,
    sourceRoute: persisted.sourceRoute || derived.sourceRoute || null,
    assignment: persisted.assignment || null,
    createdBy: persisted.createdBy || derived.createdBy || null,
    updatedBy: persisted.updatedBy || null,
    lastActionAt: persisted.lastActionAt || null,
    lastActionBy: persisted.lastActionBy || null,
    sourceSnapshot: persisted.sourceSnapshot || null,
    auditEventIds: persisted.auditEventIds || [],
    metadata: persisted.metadata || null,
  });
}

export function applyLandlordDecisionQueueLifecycleOverlay(
  derivedItems: LandlordDecisionQueueItem[],
  persistedItems: LandlordDecisionQueueItem[]
): LandlordDecisionQueueItem[] {
  const byItemId = new Map(derivedItems.map((item) => [item.id, item]));
  const bySource = new Map(derivedItems.map((item) => [[item.sourceType, item.sourceId].join(":"), item]));
  const byDedupe = new Map(derivedItems.map((item) => [item.dedupeKey, item]));
  const matchedDerivedIds = new Set<string>();
  const overlaidByDerivedId = new Map<string, LandlordDecisionQueueItem>();
  const standalone: LandlordDecisionQueueItem[] = [];

  for (const persisted of persistedItems) {
    const derived =
      byItemId.get(persisted.id) ||
      bySource.get([persisted.sourceType, persisted.sourceId].join(":")) ||
      byDedupe.get(persisted.dedupeKey);
    if (!derived) {
      standalone.push(persisted);
      continue;
    }
    matchedDerivedIds.add(derived.id);
    overlaidByDerivedId.set(derived.id, overlayLifecycleFields(derived, persisted));
  }

  return sortLandlordDecisionQueueItems([
    ...derivedItems.map((item) => overlaidByDerivedId.get(item.id) || item),
    ...standalone.filter((item) => !matchedDerivedIds.has(item.id)),
  ]);
}

export function summarizeLandlordDecisionQueueItems(items: LandlordDecisionQueueItem[]) {
  return {
    total: items.length,
    critical: items.filter((item) => item.severity === "critical").length,
    warning: items.filter((item) => item.severity === "warning").length,
    needsReview: items.filter((item) => item.severity === "needs_review").length,
    upcoming: items.filter((item) => item.severity === "upcoming").length,
    informational: items.filter((item) => item.severity === "informational").length,
    open: items.filter((item) => item.status === "open").length,
    blocked: items.filter((item) => item.status === "blocked").length,
  };
}

export async function createLandlordDecisionQueueItem(
  input: CreateLandlordDecisionQueueItemInput
): Promise<LandlordDecisionQueueItem> {
  const landlordId = asString(input.landlordId, 240);
  const sourceType = requireKnown(input.sourceType, SOURCE_TYPES, "source_type");
  const sourceId = asString(input.sourceId, 300);
  const workspace = requireKnown(input.workspace, WORKSPACES, "workspace");
  const severity = requireKnown(input.severity, SEVERITIES, "severity");
  const title = asString(input.title, 180);
  const description = asString(input.description, 500);
  if (!landlordId || !sourceId || !title || !description) {
    throw new LandlordDecisionQueueLifecycleError("decision_item_required_fields_missing", 400);
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const refs = normalizeRelatedRefs(input);
  const item = buildLandlordDecisionQueueItem({
    id,
    landlordId,
    persistence: "persisted",
    sourceType,
    sourceId,
    sourceRoute: asString(input.sourceRoute, 700) || null,
    workspace,
    severity,
    title,
    description,
    recommendedActionLabel: asString(input.recommendedActionLabel, 120) || "Review",
    recommendedActionHref: safeHref(input.recommendedActionHref, "/operations"),
    dueAt: normalizeDate(input.dueAt, "due_at"),
    createdAt: now,
    updatedAt: now,
    status: input.status ? requireKnown(input.status, STATUSES, "status") : "open",
    assignment: normalizeAssignment(input.assignment),
    createdBy: asString(input.actorId, 240) || null,
    updatedBy: asString(input.actorId, 240) || null,
    lastActionAt: now,
    lastActionBy: asString(input.actorId, 240) || null,
    sourceSnapshot: cleanRecord(input.sourceSnapshot),
    auditEventIds: [],
    metadata: cleanRecord(input.metadata),
    dedupeKey: asString(input.dedupeKey, 300) || cleanToken([sourceType, sourceId].join(":"), sourceId),
    ...refs,
  });

  await db.collection(LANDLORD_DECISION_QUEUE_ITEMS_COLLECTION).doc(item.id).set(itemToDocument(item), { merge: false });
  return item;
}

function statusForAction(action: string | null | undefined): LandlordDecisionQueueStatus | null {
  const normalized = asString(action, 80).toLowerCase().replace(/-/g, "_");
  if (!normalized) return null;
  if (normalized === "acknowledge" || normalized === "acknowledged") return "acknowledged";
  if (normalized === "start_review" || normalized === "in_review") return "in_review";
  if (normalized === "defer" || normalized === "deferred") return "deferred";
  if (normalized === "resolve" || normalized === "resolved") return "resolved";
  if (normalized === "dismiss" || normalized === "dismissed") return "dismissed";
  if (normalized === "approve" || normalized === "approved") return "approved";
  if (normalized === "return" || normalized === "return_to_draft" || normalized === "returned") return "returned";
  if (normalized === "mark_not_required") return "dismissed";
  if (normalized === "assign" || normalized === "clear_assignment") return null;
  throw new LandlordDecisionQueueLifecycleError("decision_item_action_invalid", 400);
}

export async function updateLandlordDecisionQueueItem(
  input: UpdateLandlordDecisionQueueItemInput
): Promise<LandlordDecisionQueueItem> {
  const landlordId = asString(input.landlordId, 240);
  const decisionItemId = asString(input.decisionItemId, 300);
  if (!landlordId || !decisionItemId) {
    throw new LandlordDecisionQueueLifecycleError("decision_item_required_fields_missing", 400);
  }
  const ref = db.collection(LANDLORD_DECISION_QUEUE_ITEMS_COLLECTION).doc(decisionItemId);
  const snap = await ref.get();
  const existing = normalizePersistedItem(decisionItemId, snap.exists ? snap.data?.() : null);
  if (!existing || existing.landlordId !== landlordId) {
    throw new LandlordDecisionQueueLifecycleError("decision_item_not_found", 404);
  }

  const now = new Date().toISOString();
  const actionStatus = statusForAction(input.action);
  const nextStatus = input.status ? requireKnown(input.status, STATUSES, "status") : actionStatus || existing.status;
  const normalizedAction = asString(input.action, 80).toLowerCase().replace(/-/g, "_");
  const nextAssignment =
    input.clearAssignment || normalizedAction === "clear_assignment"
      ? null
      : input.assignment !== undefined
        ? normalizeAssignment(input.assignment)
        : existing.assignment || null;
  const dueAt =
    input.clearDueAt
      ? null
      : input.dueAt !== undefined
        ? normalizeDate(input.dueAt, "due_at")
        : existing.dueAt;

  const item = buildLandlordDecisionQueueItem({
    ...existing,
    status: nextStatus,
    assignment: nextAssignment,
    dueAt,
    updatedAt: now,
    updatedBy: asString(input.actorId, 240) || null,
    lastActionAt: now,
    lastActionBy: asString(input.actorId, 240) || null,
    metadata: input.metadata === undefined ? existing.metadata || null : cleanRecord(input.metadata),
  });

  await ref.set(itemToDocument(item), { merge: false });
  return item;
}

export async function appendLandlordDecisionQueueAuditEventId(
  landlordId: string,
  decisionItemId: string,
  auditEventId: string
): Promise<LandlordDecisionQueueItem | null> {
  const ref = db.collection(LANDLORD_DECISION_QUEUE_ITEMS_COLLECTION).doc(decisionItemId);
  const snap = await ref.get();
  const existing = normalizePersistedItem(decisionItemId, snap.exists ? snap.data?.() : null);
  if (!existing || existing.landlordId !== asString(landlordId, 240)) return null;
  const auditEventIds = Array.from(new Set([...(existing.auditEventIds || []), asString(auditEventId, 240)].filter(Boolean)));
  const item = buildLandlordDecisionQueueItem({
    ...existing,
    auditEventIds,
  });
  await ref.set(itemToDocument(item), { merge: false });
  return item;
}
