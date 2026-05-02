import { Router } from "express";
import crypto from "crypto";
import multer from "multer";
import { db, FieldValue } from "../config/firebase";
import { requireAuth } from "../middleware/requireAuth";
import { sendEmail } from "../services/emailService";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { uploadBufferToGcs } from "../lib/gcs";
import {
  buildEvidenceStoragePath,
  makeEvidenceId,
  normalizeEvidenceType,
  normalizeEvidenceVisibility,
  serializeEvidenceForAudience,
  type WorkOrderEvidenceItem,
} from "../lib/workOrderEvidence";
import {
  buildCostAttachmentStoragePath,
  filterCostAttachmentsForAudience,
  normalizeCostCurrency,
  normalizeCostReviewHistory,
  normalizeExpenseLink,
  normalizeCostLineItems,
  normalizeWorkOrderCost,
  serializeCostAttachmentsForAudience,
} from "../lib/maintenanceCost";
import {
  applyNotificationUpdate,
  buildTenantSafeWorkOrderNotifications,
} from "../lib/maintenanceNotifications";
import { createTransaction } from "../services/financialTransactionService";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { buildDatedExportFilename, setAttachmentExportHeaders } from "../lib/exports/exportResponse";
import { executeMaintenanceApprovalAutomation } from "../services/maintenanceApprovalExecutionService";
import { buildMaintenancePolicyRequest } from "../lib/policy/policyAdapters";
import { evaluatePolicy, toAutopilotPolicySummary, writePolicyEvaluatedEvent } from "../lib/policy/policyEvaluator";

const router = Router();

const WORK_ORDER_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const WORK_ORDER_STATUSES = new Set([
  "open",
  "invited",
  "assigned",
  "accepted",
  "scheduled",
  "blocked",
  "in_progress",
  "completed",
  "cancelled",
]);

const CONTRACTOR_VISIBLE_STATUSES = new Set(["accepted", "scheduled", "blocked", "in_progress", "completed"]);
const ACTIVE_INCIDENT_WORK_ORDER_STATUSES = new Set([
  "open",
  "invited",
  "assigned",
  "accepted",
  "scheduled",
  "blocked",
  "in_progress",
]);
const CONTRACTOR_INVITE_TTL_MS = Math.max(
  60_000,
  Number(process.env.CONTRACTOR_INVITE_TTL_MS || 7 * 24 * 60 * 60 * 1000)
);
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EVIDENCE_BYTES },
});
const ALLOWED_EVIDENCE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_COST_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const costAttachmentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_COST_ATTACHMENT_BYTES },
});
const ALLOWED_COST_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function nowMs() {
  return Date.now();
}

function asString(value: unknown, max = 2000): string {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 2000): string | null {
  const v = asString(value, max);
  return v || null;
}

function resolvePropertyLabel(raw: any): string {
  return (
    asString(raw?.name || raw?.addressLine1 || raw?.address || raw?.displayName || raw?.propertyName, 200) || "Property"
  );
}

function resolveUnitLabel(raw: any): string {
  return asString(raw?.unitNumber || raw?.name || raw?.label || raw?.displayLabel || raw?.unitLabel, 120) || "Unit";
}

function isAutomationRequested(body: any) {
  return Boolean(body?.automationEnabled || body?.automation?.enabled);
}

function uniqueStrings(input: unknown, max = 100): string[] {
  if (!Array.isArray(input)) return [];
  const set = new Set<string>();
  for (const raw of input) {
    const v = asString(raw, 120);
    if (v) set.add(v);
    if (set.size >= max) break;
  }
  return Array.from(set);
}

function parseMoneyToCents(value: unknown): number | null {
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return Math.round(numeric);
}

function toMillis(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof (value as any)?.toMillis === "function") return (value as any).toMillis();
  if (typeof (value as any)?.seconds === "number") return (value as any).seconds * 1000;
  return null;
}

function normalizeCompletionOutcome(value: unknown): "completed" | "partially_completed" | "follow_up_required" | null {
  const next = asString(value, 60).toLowerCase();
  if (next === "completed" || next === "partially_completed" || next === "follow_up_required") {
    return next;
  }
  return null;
}

function normalizeResolutionStatus(
  value: unknown
):
  | "completed_pending_review"
  | "landlord_approved"
  | "tenant_pending_signoff"
  | "resolved"
  | "follow_up_required"
  | null {
  const next = asString(value, 80).toLowerCase();
  if (
    next === "completed_pending_review" ||
    next === "landlord_approved" ||
    next === "tenant_pending_signoff" ||
    next === "resolved" ||
    next === "follow_up_required"
  ) {
    return next;
  }
  return null;
}

function normalizeTenantSignoffStatus(value: unknown): "pending" | "accepted" | "declined" | null {
  const next = asString(value, 40).toLowerCase();
  if (next === "pending" || next === "accepted" || next === "declined") return next;
  return null;
}

function normalizeReworkCycleStatus(
  value: unknown
): "not_started" | "assigned" | "in_progress" | "completed" | "cancelled" | null {
  const next = asString(value, 40).toLowerCase();
  if (
    next === "not_started" ||
    next === "assigned" ||
    next === "in_progress" ||
    next === "completed" ||
    next === "cancelled"
  ) {
    return next;
  }
  return null;
}

function normalizeReworkHistoryOutcome(value: unknown): "resolved" | "failed" | "partial" | null {
  const next = asString(value, 40).toLowerCase();
  if (next === "resolved" || next === "failed" || next === "partial") return next;
  return null;
}

function normalizeReworkScheduleStatus(
  value: unknown
): "not_scheduled" | "scheduled" | "contractor_confirmed" | "tenant_pending" | "confirmed" | "reschedule_requested" | "cancelled" | null {
  const next = asString(value, 40).toLowerCase();
  if (
    next === "not_scheduled" ||
    next === "scheduled" ||
    next === "contractor_confirmed" ||
    next === "tenant_pending" ||
    next === "confirmed" ||
    next === "reschedule_requested" ||
    next === "cancelled"
  ) {
    return next;
  }
  return null;
}

function normalizeReworkTenantAccessStatus(value: unknown): "pending" | "confirmed" | "denied" | "not_required" | null {
  const next = asString(value, 40).toLowerCase();
  if (next === "pending" || next === "confirmed" || next === "denied" || next === "not_required") return next;
  return null;
}

function normalizeReworkContractorScheduleStatus(value: unknown): "pending" | "confirmed" | "unavailable" | null {
  const next = asString(value, 40).toLowerCase();
  if (next === "pending" || next === "confirmed" || next === "unavailable") return next;
  return null;
}

function normalizeReworkReviewStatus(
  value: unknown
): "pending_review" | "landlord_approved" | "tenant_pending_signoff" | "closed" | "follow_up_required" | null {
  const next = asString(value, 60).toLowerCase();
  if (
    next === "pending_review" ||
    next === "landlord_approved" ||
    next === "tenant_pending_signoff" ||
    next === "closed" ||
    next === "follow_up_required"
  ) {
    return next;
  }
  return null;
}

function normalizeReworkReviewClosureOutcome(value: unknown): "resolved" | "partial" | "needs_more_followup" | null {
  const next = asString(value, 60).toLowerCase();
  if (next === "resolved" || next === "partial" || next === "needs_more_followup") return next;
  return null;
}

function upsertReworkHistoryEntry(history: any, entry: {
  cycleNumber: number;
  startedAt: number | null;
  completedAt: number | null;
  outcome: "resolved" | "failed" | "partial";
  notes: string | null;
}) {
  const current = Array.isArray(history) ? history.filter((item) => item && typeof item === "object") : [];
  const next = current.filter((item) => Number(item?.cycleNumber || 0) !== entry.cycleNumber);
  next.push(entry);
  next.sort((a, b) => Number(a?.cycleNumber || 0) - Number(b?.cycleNumber || 0));
  return next;
}

function tenantSignoffRequiredForWorkOrder(data: any) {
  return Boolean(asOptionalString(data?.tenantId, 120));
}

function buildPendingReworkReview(now: number) {
  return {
    status: "pending_review" as const,
    reviewedAt: null,
    reviewedBy: null,
    landlordReviewNote: null,
    tenantSignoffStatus: null,
    tenantSignedOffAt: null,
    tenantDeclinedAt: null,
    tenantDeclineReason: null,
    closureOutcome: null,
    closedAt: null,
  };
}

function normalizeRole(req: any): string {
  const actorRole = asString(req.user?.actorRole, 40).toLowerCase();
  const role = asString(req.user?.role, 40).toLowerCase();
  return actorRole || role;
}

function getLandlordId(req: any): string {
  return asString(req.user?.actorLandlordId || req.user?.landlordId || req.user?.id, 120);
}

function getUserId(req: any): string {
  return asString(req.user?.id, 120);
}

function getUserEmail(req: any): string {
  return asString(req.user?.email, 320).toLowerCase();
}

function maskEmail(email: string): string | null {
  const value = asString(email, 320).toLowerCase();
  if (!value.includes("@")) return null;
  const [local, domain] = value.split("@");
  if (!local || !domain) return null;
  if (local.length <= 2) return `${local[0] || "*"}***@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function isAdmin(req: any): boolean {
  return normalizeRole(req) === "admin";
}

function isLandlord(req: any): boolean {
  const role = normalizeRole(req);
  return role === "landlord" || role === "admin";
}

function isContractor(req: any): boolean {
  const role = normalizeRole(req);
  return role === "contractor" || role === "admin";
}

function toWorkOrderResponse(id: string, data: any) {
  return { id, ...(data || {}) };
}

async function toWorkOrderResponseForAudience(id: string, data: any, audience: "landlord" | "contractor") {
  const item = toWorkOrderResponse(id, data);
  return {
    ...item,
    evidence: await serializeEvidenceForAudience(item.evidence, audience),
    cost: normalizeWorkOrderCost(item.cost),
    costLineItems: normalizeCostLineItems(item.costLineItems),
    costAttachments: await serializeCostAttachmentsForAudience(item.costAttachments, audience),
    costReviewHistory: normalizeCostReviewHistory(item.costReviewHistory),
    expenseLink: normalizeExpenseLink(item.expenseLink),
  };
}

function getNextReworkCycleNumber(data: any): number {
  const currentCycle = Number(data?.reworkCycle?.cycleNumber || 0);
  const historyMax = Array.isArray(data?.reworkHistory)
    ? data.reworkHistory.reduce((max: number, entry: any) => Math.max(max, Number(entry?.cycleNumber || 0)), 0)
    : 0;
  return Math.max(currentCycle, historyMax) + 1;
}

function isAllowedEvidenceFile(file: Express.Multer.File | undefined) {
  if (!file?.buffer || !file.originalname) return false;
  return ALLOWED_EVIDENCE_MIME_TYPES.has(String(file.mimetype || "").toLowerCase());
}

function isAllowedCostAttachmentFile(file: Express.Multer.File | undefined) {
  if (!file?.buffer || !file.originalname) return false;
  return ALLOWED_COST_ATTACHMENT_MIME_TYPES.has(String(file.mimetype || "").toLowerCase());
}

function makeCostHistoryEntryId() {
  return `cost_${crypto.randomBytes(8).toString("hex")}`;
}

function buildCostHistoryEntry(input: {
  revisionNumber: number;
  submittedAt: number;
  submittedByRole: "contractor" | "landlord" | "admin";
  submittedById: string;
  actualCostCents: number;
  currency?: string | null;
  reviewStatus: "pending_review" | "approved" | "rejected" | "revision_requested";
  reviewedAt?: number | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  linkedExpenseId?: string | null;
}) {
  return {
    id: makeCostHistoryEntryId(),
    revisionNumber: Math.max(1, Math.round(input.revisionNumber || 1)),
    submittedAt: Math.round(input.submittedAt),
    submittedByRole: input.submittedByRole,
    submittedById: input.submittedById,
    actualCostCents: Math.round(input.actualCostCents),
    currency: normalizeCostCurrency(input.currency) || "CAD",
    reviewStatus: input.reviewStatus,
    reviewedAt: typeof input.reviewedAt === "number" ? Math.round(input.reviewedAt) : null,
    reviewedBy: asOptionalString(input.reviewedBy, 120),
    reviewNote: asOptionalString(input.reviewNote, 1000),
    linkedExpenseId: asOptionalString(input.linkedExpenseId, 120),
  };
}

function getCurrentCostRevisionNumber(data: any) {
  const current = Number(data?.cost?.latestRevisionNumber || 0);
  const historyMax = normalizeCostReviewHistory(data?.costReviewHistory).reduce(
    (max, entry) => Math.max(max, Number(entry.revisionNumber || 0)),
    0
  );
  return Math.max(current, historyMax, 0);
}

function inviteIsExpired(invite: any, atMs = nowMs()) {
  const expiresAtMs = Number(invite?.expiresAtMs || 0);
  return expiresAtMs > 0 && atMs >= expiresAtMs;
}

function canTransitionWorkOrder(params: {
  fromStatus: string;
  toStatus: string;
  actorRole: string;
}) {
  const from = String(params.fromStatus || "").toLowerCase();
  const to = String(params.toStatus || "").toLowerCase();
  const actor = String(params.actorRole || "").toLowerCase();
  if (!WORK_ORDER_STATUSES.has(from) || !WORK_ORDER_STATUSES.has(to)) return false;
  if (from === to) return true;

  if (actor === "contractor") {
    if ((from === "open" || from === "invited" || from === "assigned") && to === "accepted") return true;
    if ((from === "accepted" || from === "assigned" || from === "scheduled" || from === "blocked") && to === "in_progress") {
      return true;
    }
    if ((from === "accepted" || from === "assigned") && to === "scheduled") return true;
    if ((from === "scheduled" || from === "in_progress") && to === "blocked") return true;
    if ((from === "scheduled" || from === "blocked" || from === "in_progress") && to === "completed") return true;
    if (from === "in_progress" && to === "completed") return true;
    return false;
  }

  if (actor === "landlord" || actor === "admin") {
    if (to === "cancelled" && ACTIVE_INCIDENT_WORK_ORDER_STATUSES.has(from)) return true;
    if ((from === "completed" || from === "blocked") && to === "in_progress") return true;
    if (from === "completed" && to === "blocked") return true;
    if (
      to === "completed" &&
      (from === "open" ||
        from === "invited" ||
        from === "assigned" ||
        from === "accepted" ||
        from === "scheduled" ||
        from === "blocked" ||
        from === "in_progress")
    ) {
      return true;
    }
    return false;
  }

  return false;
}

async function trySendContractorEmail(params: {
  to: string;
  subject: string;
  intro: string;
  ctaText?: string;
  ctaUrl?: string;
  bullets?: string[];
}) {
  const to = asString(params.to, 320).toLowerCase();
  const from = asString(process.env.EMAIL_FROM || process.env.FROM_EMAIL || "", 320);
  if (!to || !from) return;

  const ctaUrl = asString(
    params.ctaUrl ||
      String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai"),
    2000
  );
  const ctaText = asString(params.ctaText || "Open RentChain", 100);
  const intro = asString(params.intro, 1000);
  const subject = asString(params.subject, 180);

  if (!subject || !intro) return;

  try {
    await sendEmail({
      to,
      from,
      subject,
      text: buildEmailText({
        intro,
        bullets: params.bullets || [],
        ctaText,
        ctaUrl,
      }),
      html: buildEmailHtml({
        title: subject,
        intro,
        bullets: params.bullets || [],
        ctaText,
        ctaUrl,
      }),
    });
  } catch (err: any) {
    console.warn("[work-orders] email send failed (non-blocking)", {
      to,
      subject,
      message: String(err?.message || err),
    });
  }
}

async function findUserEmailById(userId: string): Promise<string | null> {
  const id = asString(userId, 120);
  if (!id) return null;
  const [userSnap, accountSnap] = await Promise.all([
    db.collection("users").doc(id).get(),
    db.collection("accounts").doc(id).get(),
  ]);
  const candidate =
    asString((userSnap.data() as any)?.email, 320).toLowerCase() ||
    asString((accountSnap.data() as any)?.email, 320).toLowerCase();
  return candidate || null;
}

async function getLandlordDisplayName(landlordId: string): Promise<string | null> {
  const id = asString(landlordId, 120);
  if (!id) return null;
  try {
    const [userSnap, accountSnap] = await Promise.all([
      db.collection("users").doc(id).get(),
      db.collection("accounts").doc(id).get(),
    ]);
    const user = (userSnap.data() as any) || {};
    const account = (accountSnap.data() as any) || {};
    const value =
      asString(user?.fullName, 180) ||
      asString(user?.name, 180) ||
      asString(account?.fullName, 180) ||
      asString(account?.name, 180) ||
      asString(account?.businessName, 180);
    return value || null;
  } catch {
    return null;
  }
}

async function ensureLandlordOwnsProperty(propertyId: string, landlordId: string, adminAccess: boolean) {
  const snap = await db.collection("properties").doc(propertyId).get();
  if (!snap.exists) {
    return { ok: false as const, code: "PROPERTY_NOT_FOUND" as const };
  }
  const data = snap.data() as any;
  const ownerLandlordId = asString(data?.landlordId || data?.ownerId || data?.owner, 120);
  if (!adminAccess && ownerLandlordId && ownerLandlordId !== landlordId) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }
  return { ok: true as const, data };
}

async function ensureLandlordOwnsUnit(unitId: string, propertyId: string, landlordId: string, adminAccess: boolean) {
  const snap = await db.collection("units").doc(unitId).get();
  if (!snap.exists) {
    return { ok: false as const, code: "UNIT_NOT_FOUND" as const };
  }
  const data = snap.data() as any;
  const unitPropertyId = asString(data?.propertyId, 120);
  const unitLandlordId = asString(data?.landlordId, 120);
  if (unitPropertyId && unitPropertyId !== propertyId) {
    return { ok: false as const, code: "UNIT_PROPERTY_MISMATCH" as const };
  }
  if (!adminAccess && unitLandlordId && unitLandlordId !== landlordId) {
    return { ok: false as const, code: "FORBIDDEN" as const };
  }
  return { ok: true as const, data };
}

async function writeWorkOrderUpdate(input: {
  workOrderId: string;
  actorRole: "landlord" | "contractor" | "admin";
  actorId: string;
  updateType:
    | "created"
    | "invited"
    | "accepted"
    | "declined"
    | "status_changed"
    | "scheduled"
    | "started"
    | "blocked"
    | "note"
    | "photo"
    | "invoice"
    | "completed"
    | "confirmed"
    | "reopened";
  message?: string;
  attachmentUrl?: string | null;
}) {
  const createdAtMs = nowMs();
  const ref = db.collection("workOrderUpdates").doc();
  await ref.set({
    id: ref.id,
    workOrderId: input.workOrderId,
    actorRole: input.actorRole,
    actorId: input.actorId,
    updateType: input.updateType,
    message: asString(input.message || "", 5000),
    attachmentUrl: asOptionalString(input.attachmentUrl, 2000),
    createdAtMs,
  });
}

async function appendMaintenanceStatusHistory(input: {
  maintenanceRequestId: string | null;
  status: string;
  actorRole: "landlord" | "contractor" | "admin";
  actorId: string;
  message: string;
}) {
  const maintenanceRequestId = asString(input.maintenanceRequestId, 120);
  if (!maintenanceRequestId) return;
  await db.collection("maintenanceRequests").doc(maintenanceRequestId).set(
    {
      statusHistory: FieldValue.arrayUnion({
        status: input.status,
        actorRole: input.actorRole,
        actorId: input.actorId,
        message: input.message,
        createdAt: nowMs(),
      }),
    },
    { merge: true }
  );
}

async function syncMaintenanceFromWorkOrder(workOrderId: string, patch: Record<string, unknown>) {
  const snap = await db.collection("workOrders").doc(workOrderId).get();
  if (!snap.exists) return;
  let workOrder = (snap.data() as any) || {};
  const notifications = await applyNotificationUpdate(db.collection("workOrders").doc(workOrderId), workOrder);
  workOrder = { ...workOrder, notifications };
  const maintenanceRequestId = asString(workOrder.maintenanceRequestId, 120);
  if (!maintenanceRequestId) return;
  await db.collection("maintenanceRequests").doc(maintenanceRequestId).set(
    {
      status: asString(workOrder.status, 40).toLowerCase() || null,
      contractorStatus: asString(workOrder.status, 40).toLowerCase() || null,
      scheduledFor: toMillis(workOrder.scheduledFor),
      serviceCompletedAt: toMillis(workOrder.serviceCompletedAt),
      completionSummary: asOptionalString(workOrder.completionSummary, 2000),
      resolutionStatus: normalizeResolutionStatus(workOrder.resolutionStatus),
      landlordApprovedAt: toMillis(workOrder.landlordApprovedAt),
      landlordApprovedBy: asOptionalString(workOrder.landlordApprovedBy, 120),
      tenantSignoffStatus: normalizeTenantSignoffStatus(workOrder.tenantSignoffStatus),
      tenantSignedOffAt: toMillis(workOrder.tenantSignedOffAt),
      tenantDeclinedAt: toMillis(workOrder.tenantDeclinedAt),
      tenantDeclineReason: asOptionalString(workOrder.tenantDeclineReason, 2000),
      followUpRequired: typeof workOrder.followUpRequired === "boolean" ? workOrder.followUpRequired : null,
      followUpReason: asOptionalString(workOrder.followUpReason, 2000),
      finalResolvedAt: toMillis(workOrder.finalResolvedAt),
      notifications: buildTenantSafeWorkOrderNotifications(workOrder),
      contractorLastUpdate: asOptionalString(patch.contractorLastUpdate, 500) || asOptionalString(workOrder.completionSummary, 500),
      updatedAt: nowMs(),
      ...patch,
    },
    { merge: true }
  );
}

async function getWorkOrderAuthorized(req: any, workOrderId: string) {
  const snap = await db.collection("workOrders").doc(workOrderId).get();
  if (!snap.exists) return { ok: false as const, code: "NOT_FOUND" as const };

  const item = toWorkOrderResponse(snap.id, snap.data());
  const role = normalizeRole(req);
  const userId = getUserId(req);
  const landlordId = getLandlordId(req);

  if (role === "admin") {
    return { ok: true as const, item, role, userId, landlordId };
  }

  if (role === "landlord") {
    if (asString(item.landlordId) !== landlordId) {
      return { ok: false as const, code: "FORBIDDEN" as const };
    }
    return { ok: true as const, item, role, userId, landlordId };
  }

  if (role === "contractor") {
    const assigned = asString(item.assignedContractorId);
    const invited = Array.isArray(item.invitedContractorIds)
      ? item.invitedContractorIds.map((v: any) => asString(v))
      : [];
    if (assigned !== userId && !invited.includes(userId)) {
      return { ok: false as const, code: "FORBIDDEN" as const };
    }
    return { ok: true as const, item, role, userId, landlordId };
  }

  return { ok: false as const, code: "FORBIDDEN" as const };
}

function buildEvidenceUploadMessage(item: WorkOrderEvidenceItem) {
  const label = item.evidenceType.replace(/_/g, " ");
  const caption = asString(item.caption, 180);
  return caption ? `Uploaded ${label} evidence photo: ${caption}` : `Uploaded ${label} evidence photo`;
}

function formatCostForMessage(costCents: number | null, currency: string | null) {
  if (!costCents) return "cost recorded";
  const amount = (costCents / 100).toFixed(2);
  return `${currency || "CAD"} ${amount}`;
}

function replaceEvidenceItem(
  current: unknown,
  evidenceId: string,
  updater: (item: WorkOrderEvidenceItem) => WorkOrderEvidenceItem
) {
  const list = Array.isArray(current) ? current : [];
  return list.map((entry) => {
    const normalized = {
      ...(entry as any),
      id: asString((entry as any)?.id, 120),
    } as WorkOrderEvidenceItem;
    if (normalized.id !== evidenceId) return entry;
    return updater(normalized);
  });
}

function exportCsvEscape(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function exportHtmlEscape(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function exportDateTime(value: unknown) {
  const ms = toMillis(value);
  if (!ms) return "";
  return new Date(ms).toISOString();
}

async function listLandlordWorkOrdersForExport(req: any) {
  const landlordId = getLandlordId(req);
  if (!landlordId) return [];
  const snap = await db.collection("workOrders").where("landlordId", "==", landlordId).limit(500).get();
  return Promise.all(snap.docs.map((doc) => toWorkOrderResponseForAudience(doc.id, doc.data(), "landlord")));
}

async function buildWorkOrderExportRows(items: any[]) {
  const propertyIds = Array.from(new Set(items.map((item) => asString(item.propertyId, 120)).filter(Boolean)));
  const unitIds = Array.from(new Set(items.map((item) => asString(item.unitId, 120)).filter(Boolean)));
  const propertySnaps = await Promise.all(propertyIds.map((id) => db.collection("properties").doc(id).get()));
  const unitSnaps = await Promise.all(unitIds.map((id) => db.collection("units").doc(id).get()));
  const propertyLabels = new Map<string, string>();
  propertySnaps.forEach((snap) => {
    if (!snap.exists) return;
    const data = snap.data() as any;
    propertyLabels.set(snap.id, resolvePropertyLabel(data));
  });
  const unitLabels = new Map<string, string>();
  unitSnaps.forEach((snap) => {
    if (!snap.exists) return;
    unitLabels.set(snap.id, resolveUnitLabel(snap.data() as any));
  });

  const latestComments = new Map<string, string>();
  await Promise.all(
    items.map(async (item) => {
      const snap = await db.collection("workOrderUpdates").where("workOrderId", "==", asString(item.id, 120)).limit(50).get();
      const messages = snap.docs
        .map((doc) => doc.data() as any)
        .sort((a, b) => Number(b?.createdAtMs || 0) - Number(a?.createdAtMs || 0))
        .map((entry) => asString(entry?.message, 500))
        .filter(Boolean);
      latestComments.set(asString(item.id, 120), messages[0] || "");
    })
  );

  return items.map((item) => ({
    title: asString(item.title, 200),
    property:
      (asString(item.propertyLabel, 200) && asString(item.propertyLabel, 200) !== asString(item.propertyId, 120)
        ? asString(item.propertyLabel, 200)
        : "") || propertyLabels.get(asString(item.propertyId, 120)) || "Property",
    unit:
      (asString(item.unitLabel, 120) && asString(item.unitLabel, 120) !== asString(item.unitId, 120)
        ? asString(item.unitLabel, 120)
        : "") || unitLabels.get(asString(item.unitId, 120)) || (asString(item.unitId, 120) ? "Unit" : ""),
    category: asString(item.category, 120),
    priority: asString(item.priority, 40),
    status: asString(item.status, 40),
    visibility: asString(item.visibility, 40),
    assignedContractor:
      asString(item.contractorAssignment?.displayName || item.contractorAssignment?.businessName, 180) ||
      (asString(item.assignedContractorId, 120) ? "Assigned" : ""),
    scheduledFor: exportDateTime(item.scheduledFor),
    serviceStartedAt: exportDateTime(item.serviceStartedAt),
    serviceCompletedAt: exportDateTime(item.serviceCompletedAt),
    updatedAt: exportDateTime(item.updatedAtMs),
    completionSummary: asString(item.completionSummary, 500),
    completionOutcome: asString(item.completionOutcome, 60),
    resolutionStatus: asString(item.resolutionStatus, 80),
    followUpRequired: item.followUpRequired ? "yes" : "no",
    linkedExpenseStatus: asString(item.expenseLink?.status || item.cost?.linkedExpenseStatus, 40),
    latestComment: latestComments.get(asString(item.id, 120)) || "",
  }));
}

function renderWorkOrdersSpreadsheetTable(rows: Array<Record<string, string>>) {
  const headers = [
    "Title",
    "Property",
    "Unit",
    "Category",
    "Priority",
    "Status",
    "Visibility",
    "Assigned Contractor",
    "Scheduled For",
    "Service Started At",
    "Service Completed At",
    "Updated At",
    "Completion Summary",
    "Completion Outcome",
    "Resolution Status",
    "Follow Up Required",
    "Linked Expense Status",
    "Latest Comment",
  ];
  const rowHtml = rows
    .map((row) => {
      const values = [
        row.title,
        row.property,
        row.unit,
        row.category,
        row.priority,
        row.status,
        row.visibility,
        row.assignedContractor,
        row.scheduledFor,
        row.serviceStartedAt,
        row.serviceCompletedAt,
        row.updatedAt,
        row.completionSummary,
        row.completionOutcome,
        row.resolutionStatus,
        row.followUpRequired,
        row.linkedExpenseStatus,
        row.latestComment,
      ];
      return `<tr>${values.map((value) => `<td>${exportHtmlEscape(value)}</td>`).join("")}</tr>`;
    })
    .join("");

  return `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>RentChain Work Orders Export</title></head>
  <body>
    <table>
      <thead><tr>${headers.map((header) => `<th>${exportHtmlEscape(header)}</th>`).join("")}</tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
  </body>
</html>`;
}
router.post("/contractor/profile", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const now = nowMs();
    const profileRef = db.collection("contractorProfiles").doc(userId);
    const existing = await profileRef.get();
    const base = (existing.data() as any) || {};

    const next = {
      id: userId,
      userId,
      businessName: asString(req.body?.businessName || base.businessName, 180),
      contactName: asString(req.body?.contactName || base.contactName, 180),
      email: asString(req.body?.email || getUserEmail(req) || base.email, 320).toLowerCase(),
      phone: asString(req.body?.phone || base.phone, 80),
      serviceCategories: uniqueStrings(req.body?.serviceCategories ?? base.serviceCategories, 30),
      serviceAreas: uniqueStrings(req.body?.serviceAreas ?? base.serviceAreas, 30),
      bio: asString(req.body?.bio ?? base.bio, 2000),
      isActive: req.body?.isActive === undefined ? Boolean(base.isActive ?? true) : Boolean(req.body?.isActive),
      invitedByLandlordIds: uniqueStrings(
        req.body?.invitedByLandlordIds ?? base.invitedByLandlordIds,
        100
      ),
      createdAtMs: Number(base.createdAtMs || now),
      updatedAtMs: now,
    };

    await profileRef.set(next, { merge: true });
    return res.json({ ok: true, profile: next });
  } catch (err) {
    console.error("[contractor/profile] create failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_PROFILE_CREATE_FAILED" });
  }
});

router.get("/contractor/profile", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const snap = await db.collection("contractorProfiles").doc(userId).get();
    const data = snap.exists ? snap.data() : null;
    return res.json({ ok: true, profile: data ? { id: snap.id, ...(data as any) } : null });
  } catch (err) {
    console.error("[contractor/profile] get failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_PROFILE_GET_FAILED" });
  }
});

router.get("/contractor/:contractorId/profile", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const contractorId = asString(req.params?.contractorId, 120);
    if (!contractorId) return res.status(400).json({ ok: false, error: "CONTRACTOR_ID_REQUIRED" });

    const landlordId = getLandlordId(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const snap = await db.collection("contractorProfiles").doc(contractorId).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "CONTRACTOR_PROFILE_NOT_FOUND" });
    const profile = { id: snap.id, ...(snap.data() as any) };

    if (!isAdmin(req)) {
      const invitedBy = uniqueStrings(profile.invitedByLandlordIds, 200);
      if (!invitedBy.includes(landlordId)) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
    }

    return res.json({ ok: true, profile });
  } catch (err) {
    console.error("[contractor/profile] get by id failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_PROFILE_GET_FAILED" });
  }
});

router.patch("/contractor/profile", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const profileRef = db.collection("contractorProfiles").doc(userId);
    const snap = await profileRef.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "CONTRACTOR_PROFILE_NOT_FOUND" });
    }

    const prev = snap.data() as any;
    const patch: Record<string, any> = { updatedAtMs: nowMs() };

    if (req.body?.businessName !== undefined) patch.businessName = asString(req.body.businessName, 180);
    if (req.body?.contactName !== undefined) patch.contactName = asString(req.body.contactName, 180);
    if (req.body?.email !== undefined) patch.email = asString(req.body.email, 320).toLowerCase();
    if (req.body?.phone !== undefined) patch.phone = asString(req.body.phone, 80);
    if (req.body?.serviceCategories !== undefined) patch.serviceCategories = uniqueStrings(req.body.serviceCategories, 30);
    if (req.body?.serviceAreas !== undefined) patch.serviceAreas = uniqueStrings(req.body.serviceAreas, 30);
    if (req.body?.bio !== undefined) patch.bio = asString(req.body.bio, 2000);
    if (req.body?.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);
    if (req.body?.invitedByLandlordIds !== undefined) {
      patch.invitedByLandlordIds = uniqueStrings(req.body.invitedByLandlordIds, 100);
    }

    await profileRef.set(patch, { merge: true });
    const merged = { ...prev, ...patch, id: userId };
    return res.json({ ok: true, profile: merged });
  } catch (err) {
    console.error("[contractor/profile] patch failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_PROFILE_PATCH_FAILED" });
  }
});

router.get("/public/contractor-invites/:token", async (req: any, res) => {
  try {
    const token = asString(req.params?.token, 120);
    if (!token) {
      return res.status(400).json({
        ok: false,
        error: "TOKEN_REQUIRED",
      });
    }

    const snap = await db.collection("contractorInvites").where("token", "==", token).limit(1).get();
    if (snap.empty) {
      return res.json({
        ok: true,
        status: "not_found",
      });
    }

    const inviteDoc = snap.docs[0];
    const invite = inviteDoc.data() as any;
    const now = nowMs();
    let status = asString(invite?.status, 40).toLowerCase() || "pending";

    if (status === "pending" && inviteIsExpired(invite, now)) {
      status = "expired";
      await inviteDoc.ref.set({ status: "expired", updatedAtMs: now }, { merge: true });
    }

    const landlordName = await getLandlordDisplayName(asString(invite?.landlordId, 120));
    return res.json({
      ok: true,
      status: status === "pending" ? "valid" : status,
      invite: {
        id: inviteDoc.id,
        landlordId: asString(invite?.landlordId, 120) || null,
        landlordName,
        emailMasked: maskEmail(asString(invite?.email, 320)),
        expiresAtMs: Number(invite?.expiresAtMs || 0) || null,
        createdAtMs: Number(invite?.createdAtMs || 0) || null,
      },
    });
  } catch (err) {
    console.error("[public/contractor-invites] verify failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_INVITE_VERIFY_FAILED" });
  }
});

router.post("/contractor/invites", requireAuth, async (req: any, res) => {
  try {
    console.log("[route-hit] contractorInvites", {
      method: req.method,
      path: req.path,
      userId: String(req.user?.id || ""),
    });
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const landlordId = getLandlordId(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const email = asString(req.body?.email, 320).toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "INVALID_EMAIL" });
    }

    const now = nowMs();
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAtMs = now + CONTRACTOR_INVITE_TTL_MS;
    const ref = db.collection("contractorInvites").doc();
    const invite = {
      id: ref.id,
      landlordId,
      email,
      token,
      status: "pending",
      createdAtMs: now,
      expiresAtMs,
      acceptedAtMs: null,
      createdByUserId: getUserId(req),
      message: asString(req.body?.message, 1000),
    };

    await ref.set(invite);

    const appBaseUrl = String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
    const inviteLink = `${appBaseUrl}/contractor/invite/${encodeURIComponent(token)}`;

    console.log("[contractor-invite] created", {
      inviteId: ref.id,
      landlordId,
      email,
      expiresAtMs,
      inviteLink,
    });

    await trySendContractorEmail({
      to: email,
      subject: "You’ve been invited to RentChain Contractor",
      intro: "A landlord has invited you to join their private contractor network on RentChain.",
      bullets: [`Invite expires: ${new Date(expiresAtMs).toLocaleString()}`],
      ctaText: "Accept Invite",
      ctaUrl: inviteLink,
    });

    return res.status(201).json({ ok: true, invite: { ...invite, inviteLink } });
  } catch (err) {
    console.error("[contractor/invites] create failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_INVITE_CREATE_FAILED" });
  }
});

router.get("/contractor/invites", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    const userEmail = getUserEmail(req);
    const landlordId = getLandlordId(req);

    if (role === "landlord" || role === "admin") {
      if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      const snap = await db
        .collection("contractorInvites")
        .where("landlordId", "==", landlordId)
        .limit(300)
        .get();
      const now = nowMs();
      const invites = await Promise.all(
        snap.docs.map(async (d) => {
          const item = { id: d.id, ...(d.data() as any) };
          if (String(item.status || "") === "pending" && inviteIsExpired(item, now)) {
            await d.ref.set({ status: "expired", updatedAtMs: now }, { merge: true });
            return { ...item, status: "expired", updatedAtMs: now };
          }
          return item;
        })
      );
      invites.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
      return res.json({ ok: true, invites });
    }

    if (role === "contractor") {
      if (!userEmail) return res.json({ ok: true, invites: [] });
      const snap = await db
        .collection("contractorInvites")
        .where("email", "==", userEmail)
        .limit(100)
        .get();
      const now = nowMs();
      const invites = await Promise.all(
        snap.docs.map(async (d) => {
          const item = { id: d.id, ...(d.data() as any) };
          if (String(item.status || "") === "pending" && inviteIsExpired(item, now)) {
            await d.ref.set({ status: "expired", updatedAtMs: now }, { merge: true });
            return { ...item, status: "expired", updatedAtMs: now };
          }
          return item;
        })
      );
      invites.sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
      return res.json({ ok: true, invites });
    }

    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  } catch (err) {
    console.error("[contractor/invites] list failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_INVITE_LIST_FAILED" });
  }
});

async function redeemContractorInvite(req: any, res: any) {
  try {
    const token = asString(req.params?.token, 120);
    if (!token) return res.status(400).json({ ok: false, error: "TOKEN_REQUIRED" });

    const snap = await db
      .collection("contractorInvites")
      .where("token", "==", token)
      .limit(1)
      .get();

    if (snap.empty) return res.status(404).json({ ok: false, error: "INVITE_NOT_FOUND" });

    const inviteDoc = snap.docs[0];
    const invite = inviteDoc.data() as any;
    const now = nowMs();
    if (inviteIsExpired(invite, now)) {
      await inviteDoc.ref.set({ status: "expired", updatedAtMs: now }, { merge: true });
      return res.status(410).json({
        ok: false,
        error: "INVITE_EXPIRED",
        message: "This contractor invite has expired.",
      });
    }
    if (String(invite?.status || "").toLowerCase() === "accepted") {
      return res.status(409).json({
        ok: false,
        error: "INVITE_ALREADY_ACCEPTED",
        message: "This invite has already been accepted.",
      });
    }
    if (String(invite?.status || "").toLowerCase() !== "pending") {
      return res.status(409).json({ ok: false, error: "INVITE_NOT_PENDING" });
    }
    const userId = getUserId(req);
    const userEmail = getUserEmail(req);
    const role = normalizeRole(req);
    if (!userId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (role === "admin" || role === "landlord") {
      return res.status(403).json({
        ok: false,
        error: "CONTRACTOR_ACCOUNT_REQUIRED",
        message: "Use a separate contractor account to accept this invite.",
      });
    }

    const inviteEmail = asString(invite?.email, 320).toLowerCase();
    if (inviteEmail && inviteEmail !== userEmail) {
      return res.status(403).json({ ok: false, error: "INVITE_EMAIL_MISMATCH" });
    }

    await inviteDoc.ref.set(
      {
        status: "accepted",
        acceptedAtMs: now,
        acceptedByUserId: userId,
      },
      { merge: true }
    );

    const contractorProfileRef = db.collection("contractorProfiles").doc(userId);
    const profileSnap = await contractorProfileRef.get();
    const prevProfile = (profileSnap.data() as any) || {};
    const invitedBy = uniqueStrings([...(Array.isArray(prevProfile.invitedByLandlordIds) ? prevProfile.invitedByLandlordIds : []), invite.landlordId], 100);

    const nextProfile = {
      id: userId,
      userId,
      businessName: asString(req.body?.businessName || prevProfile.businessName, 180),
      contactName: asString(req.body?.contactName || prevProfile.contactName, 180),
      email: asString(userEmail || inviteEmail || prevProfile.email, 320).toLowerCase(),
      phone: asString(req.body?.phone || prevProfile.phone, 80),
      serviceCategories: uniqueStrings(req.body?.serviceCategories ?? prevProfile.serviceCategories, 30),
      serviceAreas: uniqueStrings(req.body?.serviceAreas ?? prevProfile.serviceAreas, 30),
      bio: asString(req.body?.bio ?? prevProfile.bio, 2000),
      isActive: true,
      invitedByLandlordIds: invitedBy,
      createdAtMs: Number(prevProfile.createdAtMs || now),
      updatedAtMs: now,
    };
    await contractorProfileRef.set(nextProfile, { merge: true });

    await Promise.all([
      db.collection("users").doc(userId).set(
        {
          role: "contractor",
          contractorId: userId,
          contractorLandlordIds: invitedBy,
          landlordId: null,
          updatedAt: now,
        },
        { merge: true }
      ),
      db.collection("accounts").doc(userId).set(
        {
          role: "contractor",
          contractorId: userId,
          contractorLandlordIds: invitedBy,
          landlordId: null,
          updatedAt: now,
        },
        { merge: true }
      ),
    ]);

    await trySendContractorEmail({
      to: inviteEmail,
      subject: "RentChain contractor invite accepted",
      intro: "Your contractor invite has been accepted and your profile is now linked.",
      ctaText: "Open Contractor Portal",
      ctaUrl: `${String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "")}/contractor`,
    });

    return res.json({
      ok: true,
      invite: { id: inviteDoc.id, ...invite, status: "accepted", acceptedAtMs: now },
    });
  } catch (err) {
    console.error("[contractor/invites] redeem failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_INVITE_REDEEM_FAILED" });
  }
}

router.post("/contractor/invites/:token/accept", requireAuth, async (req: any, res) => {
  return redeemContractorInvite(req, res);
});

router.post("/contractor/invites/:token/redeem", requireAuth, async (req: any, res) => {
  return redeemContractorInvite(req, res);
});

router.post("/contractor/invites/:inviteId/resend", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const landlordId = getLandlordId(req);
    const inviteId = asString(req.params?.inviteId, 120);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!inviteId) return res.status(400).json({ ok: false, error: "INVITE_ID_REQUIRED" });

    const ref = db.collection("contractorInvites").doc(inviteId);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "INVITE_NOT_FOUND" });
    const invite = snap.data() as any;
    if (asString(invite?.landlordId, 120) !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    if (String(invite?.status || "") === "accepted") {
      return res.status(409).json({ ok: false, error: "INVITE_ALREADY_ACCEPTED" });
    }

    const now = nowMs();
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAtMs = now + CONTRACTOR_INVITE_TTL_MS;
    const email = asString(invite?.email, 320).toLowerCase();
    const appBaseUrl = String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
    const inviteLink = `${appBaseUrl}/contractor/invite/${encodeURIComponent(token)}`;

    await ref.set(
      {
        token,
        status: "pending",
        expiresAtMs,
        resentAtMs: now,
        resentByUserId: getUserId(req),
        acceptedAtMs: null,
        acceptedByUserId: null,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await trySendContractorEmail({
      to: email,
      subject: "RentChain contractor invite resent",
      intro: "A new invite link was issued to join RentChain as a contractor.",
      bullets: [`Invite expires: ${new Date(expiresAtMs).toLocaleString()}`],
      ctaText: "Accept Invite",
      ctaUrl: inviteLink,
    });

    return res.json({
      ok: true,
      invite: { id: inviteId, ...invite, token, status: "pending", expiresAtMs, resentAtMs: now, inviteLink },
    });
  } catch (err) {
    console.error("[contractor/invites] resend failed", err);
    return res.status(500).json({ ok: false, error: "CONTRACTOR_INVITE_RESEND_FAILED" });
  }
});

router.post("/work-orders", requireAuth, async (req: any, res) => {
  try {
    console.log("[route-hit] workOrders", {
      method: req.method,
      path: req.path,
      userId: String(req.user?.id || ""),
    });
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const landlordId = getLandlordId(req);
    const actorId = getUserId(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const propertyId = asString(req.body?.propertyId, 120);
    if (!propertyId) return res.status(400).json({ ok: false, error: "PROPERTY_REQUIRED" });

    const propertyCheck = await ensureLandlordOwnsProperty(propertyId, landlordId, isAdmin(req));
    if (!propertyCheck.ok) {
      if (propertyCheck.code === "PROPERTY_NOT_FOUND") {
        return res.status(404).json({ ok: false, error: "PROPERTY_NOT_FOUND" });
      }
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const unitId = asOptionalString(req.body?.unitId, 120);
    if (unitId) {
      const unitCheck = await ensureLandlordOwnsUnit(unitId, propertyId, landlordId, isAdmin(req));
      if (!unitCheck.ok) {
        return res.status(400).json({ ok: false, error: unitCheck.code });
      }
    }

    const title = asString(req.body?.title, 180);
    const description = asString(req.body?.description, 5000);
    const category = asString(req.body?.category, 120);
    const priorityRaw = asString(req.body?.priority, 30).toLowerCase();
    const priority = WORK_ORDER_PRIORITIES.has(priorityRaw) ? priorityRaw : "medium";

    if (!title) return res.status(400).json({ ok: false, error: "TITLE_REQUIRED" });

    const invitedContractorIds = uniqueStrings(req.body?.invitedContractorIds, 100);
    const assignedContractorId = asOptionalString(req.body?.assignedContractorId, 120);

    const now = nowMs();
    const initialStatus = assignedContractorId
      ? "assigned"
      : invitedContractorIds.length
      ? "invited"
      : "open";

    const ref = db.collection("workOrders").doc();
    const item = {
      id: ref.id,
      landlordId,
      propertyId,
      unitId: unitId || null,
      title,
      description,
      category,
      priority,
      status: initialStatus,
      visibility: "private",
      budgetMinCents: parseMoneyToCents(req.body?.budgetMinCents),
      budgetMaxCents: parseMoneyToCents(req.body?.budgetMaxCents),
      assignedContractorId: assignedContractorId || null,
      invitedContractorIds,
      acceptedAtMs: null,
      startedAtMs: null,
      completedAtMs: null,
      notesInternal: asString(req.body?.notesInternal, 5000),
      linkedExpenseId: asOptionalString(req.body?.linkedExpenseId, 120),
      estimatedCostCents: parseMoneyToCents(req.body?.estimatedCostCents),
      finalCostCents: parseMoneyToCents(req.body?.finalCostCents),
      createdAtMs: now,
      updatedAtMs: now,
    };

    await ref.set(item);

    await writeWorkOrderUpdate({
      workOrderId: ref.id,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId,
      updateType: "created",
      message: "Work order created",
    });

    if (invitedContractorIds.length > 0) {
      await writeWorkOrderUpdate({
        workOrderId: ref.id,
        actorRole: isAdmin(req) ? "admin" : "landlord",
        actorId,
        updateType: "invited",
        message: `Invited ${invitedContractorIds.length} contractor(s).`,
      });
    }

    return res.status(201).json({ ok: true, item });
  } catch (err) {
    console.error("[work-orders] create failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_CREATE_FAILED" });
  }
});

router.get("/work-orders", requireAuth, async (req: any, res) => {
  try {
    const role = normalizeRole(req);
    const userId = getUserId(req);
    const landlordId = getLandlordId(req);
    const statusFilter = asString(req.query?.status, 40).toLowerCase();

    if (role === "landlord" || role === "admin") {
      if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      const snap = await db
        .collection("workOrders")
        .where("landlordId", "==", landlordId)
        .limit(500)
        .get();
      let items = await Promise.all(snap.docs.map((d) => toWorkOrderResponseForAudience(d.id, d.data(), "landlord")));
      if (statusFilter) items = items.filter((item) => String(item.status || "").toLowerCase() === statusFilter);
      items.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
      return res.json({ ok: true, items });
    }

    if (role === "contractor") {
      const [assignedSnap, invitedSnap] = await Promise.all([
        db.collection("workOrders").where("assignedContractorId", "==", userId).limit(400).get(),
        db.collection("workOrders").where("invitedContractorIds", "array-contains", userId).limit(400).get(),
      ]);

      const map = new Map<string, any>();
      for (const doc of [...assignedSnap.docs, ...invitedSnap.docs]) {
        const item = await toWorkOrderResponseForAudience(doc.id, doc.data(), "contractor");
        const assigned = asString(item.assignedContractorId, 120);
        const invited = uniqueStrings(item.invitedContractorIds, 200);
        if (assigned === userId || invited.includes(userId)) {
          map.set(doc.id, item);
        }
      }

      let items = Array.from(map.values());
      if (statusFilter) items = items.filter((item) => String(item.status || "").toLowerCase() === statusFilter);
      items.sort((a, b) => Number(b.updatedAtMs || 0) - Number(a.updatedAtMs || 0));
      return res.json({ ok: true, items });
    }

    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  } catch (err) {
    console.error("[work-orders] list failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_LIST_FAILED" });
  }
});

router.get("/work-orders/export.csv", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const rows = await buildWorkOrderExportRows(await listLandlordWorkOrdersForExport(req));
    const csv = [
      [
        "title",
        "property",
        "unit",
        "category",
        "priority",
        "status",
        "visibility",
        "assigned_contractor",
        "scheduled_for",
        "service_started_at",
        "service_completed_at",
        "updated_at",
        "completion_summary",
        "completion_outcome",
        "resolution_status",
        "follow_up_required",
        "linked_expense_status",
        "latest_comment",
      ].join(","),
      ...rows.map((row) =>
        [
          row.title,
          row.property,
          row.unit,
          row.category,
          row.priority,
          row.status,
          row.visibility,
          row.assignedContractor,
          row.scheduledFor,
          row.serviceStartedAt,
          row.serviceCompletedAt,
          row.updatedAt,
          row.completionSummary,
          row.completionOutcome,
          row.resolutionStatus,
          row.followUpRequired,
          row.linkedExpenseStatus,
          row.latestComment,
        ]
          .map(exportCsvEscape)
          .join(",")
      ),
    ].join("\n");

    setAttachmentExportHeaders(res, {
      filename: buildDatedExportFilename({ prefix: "rentchain-work-orders", format: "csv" }),
      format: "csv",
    });
    return res.status(200).send(csv);
  } catch (err) {
    console.error("[work-orders] csv export failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_EXPORT_FAILED" });
  }
});

async function handleWorkOrderSpreadsheetExport(req: any, res: any) {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const rows = await buildWorkOrderExportRows(await listLandlordWorkOrdersForExport(req));
    const table = renderWorkOrdersSpreadsheetTable(rows);

    setAttachmentExportHeaders(res, {
      filename: buildDatedExportFilename({ prefix: "rentchain-work-orders", format: "xls" }),
      format: "xls",
    });
    return res.status(200).send(table);
  } catch (err) {
    console.error("[work-orders] xls export failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_EXPORT_FAILED" });
  }
}

router.get("/work-orders/export.xls", requireAuth, handleWorkOrderSpreadsheetExport);
router.get("/work-orders/export.xlsx", requireAuth, handleWorkOrderSpreadsheetExport);

router.get("/work-orders/:id", requireAuth, async (req: any, res) => {
  try {
    const id = asString(req.params?.id, 120);
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const access = await getWorkOrderAuthorized(req, id);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(access.item.id, access.item, access.role === "contractor" ? "contractor" : "landlord") });
  } catch (err) {
    console.error("[work-orders] get failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_GET_FAILED" });
  }
});
router.patch("/work-orders/:id", requireAuth, async (req: any, res) => {
  try {
    const id = asString(req.params?.id, 120);
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const access = await getWorkOrderAuthorized(req, id);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const patch: Record<string, any> = { updatedAtMs: nowMs() };
    let updateMessage = "Work order updated";
    let maintenanceHistoryMessage: string | null = null;

    if (access.role === "landlord" || access.role === "admin") {
      if (req.body?.title !== undefined) patch.title = asString(req.body.title, 180);
      if (req.body?.description !== undefined) patch.description = asString(req.body.description, 5000);
      if (req.body?.category !== undefined) patch.category = asString(req.body.category, 120);
      if (req.body?.priority !== undefined) {
        const nextPriority = asString(req.body.priority, 30).toLowerCase();
        if (WORK_ORDER_PRIORITIES.has(nextPriority)) patch.priority = nextPriority;
      }
      if (req.body?.budgetMinCents !== undefined) patch.budgetMinCents = parseMoneyToCents(req.body.budgetMinCents);
      if (req.body?.budgetMaxCents !== undefined) patch.budgetMaxCents = parseMoneyToCents(req.body.budgetMaxCents);
      if (req.body?.assignedContractorId !== undefined) {
        patch.assignedContractorId = asOptionalString(req.body.assignedContractorId, 120);
      }
      if (req.body?.invitedContractorIds !== undefined) {
        patch.invitedContractorIds = uniqueStrings(req.body.invitedContractorIds, 100);
      }
      if (req.body?.notesInternal !== undefined) patch.notesInternal = asString(req.body.notesInternal, 5000);
      if (req.body?.linkedExpenseId !== undefined) patch.linkedExpenseId = asOptionalString(req.body.linkedExpenseId, 120);
      if (req.body?.estimatedCostCents !== undefined) {
        patch.estimatedCostCents = parseMoneyToCents(req.body.estimatedCostCents);
      }
      if (req.body?.finalCostCents !== undefined) {
        patch.finalCostCents = parseMoneyToCents(req.body.finalCostCents);
      }
      if (req.body?.scheduledFor !== undefined) {
        const scheduledFor = toMillis(req.body.scheduledFor);
        if (scheduledFor === null && req.body.scheduledFor !== null) {
          return res.status(400).json({ ok: false, error: "INVALID_SCHEDULED_FOR" });
        }
        patch.scheduledFor = scheduledFor;
      }
      if (req.body?.status !== undefined) {
        const nextStatus = asString(req.body.status, 40).toLowerCase();
        const currentStatus = asString((access.item as any)?.status, 40).toLowerCase();
        if (!canTransitionWorkOrder({ fromStatus: currentStatus, toStatus: nextStatus, actorRole: access.role })) {
          return res.status(400).json({ ok: false, error: "INVALID_STATUS_TRANSITION" });
        }
        patch.status = nextStatus;
        if (nextStatus === "completed") {
          const completionSummary = asString(req.body?.completionSummary, 2000);
          const completionOutcome = normalizeCompletionOutcome(req.body?.completionOutcome) || "completed";
          const completedAt = nowMs();
          if (!completionSummary) {
            return res.status(400).json({ ok: false, error: "COMPLETION_SUMMARY_REQUIRED" });
          }
          patch.completedAtMs = completedAt;
          patch.serviceCompletedAt = completedAt;
          patch.lastExecutionUpdateAt = completedAt;
          patch.completionSummary = completionSummary;
          patch.completionOutcome = completionOutcome;
          patch.completedByActorRole = access.role === "admin" ? "admin" : "landlord";
          patch.completedByActorId = access.userId;
          patch.completionConfirmedByLandlordAt = null;
          patch.completionConfirmedByLandlordBy = null;
          patch.resolutionStatus = "completed_pending_review";
          patch.landlordApprovedAt = null;
          patch.landlordApprovedBy = null;
          patch.tenantSignoffStatus = null;
          patch.tenantSignedOffAt = null;
          patch.tenantDeclinedAt = null;
          patch.tenantDeclineReason = null;
          patch.followUpRequired = false;
          patch.followUpReason = null;
          patch.finalResolvedAt = null;
          updateMessage = "Work order marked completed in-house";
          maintenanceHistoryMessage = `Service completed in-house: ${completionSummary}`;
        }
        if (nextStatus === "in_progress") {
          patch.startedAtMs = Number((access.item as any)?.startedAtMs || 0) || nowMs();
          patch.serviceStartedAt = Number((access.item as any)?.serviceStartedAt || 0) || nowMs();
          patch.lastExecutionUpdateAt = nowMs();
          updateMessage = "Work order moved back into service";
          maintenanceHistoryMessage = "Service is in progress.";
        }
        if (nextStatus === "blocked") {
          const blockedReason = asString(req.body?.blockedReason || req.body?.reopenReason, 500);
          if (!blockedReason) {
            return res.status(400).json({ ok: false, error: "BLOCKED_REASON_REQUIRED" });
          }
          patch.executionBlockedReason = blockedReason;
          patch.lastExecutionUpdateAt = nowMs();
          updateMessage = "Work order marked blocked";
          maintenanceHistoryMessage = `Service is blocked: ${blockedReason}`;
        }
        const hasAssignedContractor = Boolean(asString((access.item as any)?.assignedContractorId, 120));
        if (!(nextStatus === "completed" || nextStatus === "in_progress" || nextStatus === "blocked")) {
          updateMessage =
            nextStatus === "completed" && !hasAssignedContractor
              ? "Work order marked completed in-house"
              : `Status changed to ${nextStatus}`;
        }
      }
    } else if (access.role === "contractor") {
      if (req.body?.status !== undefined) {
        const nextStatus = asString(req.body.status, 40).toLowerCase();
        const currentStatus = asString((access.item as any)?.status, 40).toLowerCase();
        if (!canTransitionWorkOrder({ fromStatus: currentStatus, toStatus: nextStatus, actorRole: access.role })) {
          return res.status(400).json({ ok: false, error: "INVALID_STATUS_TRANSITION" });
        }
        patch.status = nextStatus;
        if (nextStatus === "in_progress") patch.startedAtMs = nowMs();
        if (nextStatus === "completed") patch.completedAtMs = nowMs();
        updateMessage = `Contractor status updated to ${nextStatus}`;
      }
    }

    await db.collection("workOrders").doc(id).set(patch, { merge: true });

    await writeWorkOrderUpdate({
      workOrderId: id,
      actorRole: access.role === "admin" ? "admin" : access.role === "contractor" ? "contractor" : "landlord",
      actorId: access.userId,
      updateType: patch.status === "completed" ? "completed" : "status_changed",
      message: updateMessage,
    });

    const refreshed = await db.collection("workOrders").doc(id).get();
    await syncMaintenanceFromWorkOrder(id, {
      contractorLastUpdate:
        patch.completionSummary ||
        patch.executionBlockedReason ||
        (typeof req.body?.message === "string" ? req.body.message : null),
    });
    if (maintenanceHistoryMessage) {
      await appendMaintenanceStatusHistory({
        maintenanceRequestId: asOptionalString((refreshed.data() as any)?.maintenanceRequestId, 120),
        status: asString((refreshed.data() as any)?.status, 40).toLowerCase(),
        actorRole: access.role === "admin" ? "admin" : "landlord",
        actorId: access.userId,
        message: maintenanceHistoryMessage,
      });
    }
    if (patch.status === "completed" && asOptionalString((refreshed.data() as any)?.maintenanceRequestId, 120)) {
      await writeCanonicalEvent({
        domain: "maintenance",
        action: "completed",
        status: "completed",
        actor: {
          type: access.role === "admin" ? "admin" : "landlord",
          role: access.role,
          id: access.userId,
        },
        resource: {
          type: "maintenance_request",
          id: asOptionalString((refreshed.data() as any)?.maintenanceRequestId, 120) || id,
        },
        occurredAt: patch.completedAtMs || nowMs(),
        visibility: "landlord",
        summary: "Maintenance request marked completed",
        metadata: {
          workOrderId: id,
          landlordId: asOptionalString((refreshed.data() as any)?.landlordId, 120),
          propertyId: asOptionalString((refreshed.data() as any)?.propertyId, 120),
          unitId: asOptionalString((refreshed.data() as any)?.unitId, 120),
          completionOutcome: patch.completionOutcome || null,
        },
      });
    }
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] patch failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_PATCH_FAILED" });
  }
});

router.post("/work-orders/:id/accept", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const userId = getUserId(req);
    const currentStatus = asString((access.item as any)?.status, 40).toLowerCase();
    if (!canTransitionWorkOrder({ fromStatus: currentStatus, toStatus: "accepted", actorRole: "contractor" })) {
      return res.status(400).json({ ok: false, error: "INVALID_STATUS_TRANSITION" });
    }
    const now = nowMs();
    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: "accepted",
        assignedContractorId: userId,
        acceptedAtMs: now,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "contractor",
      actorId: userId,
      updateType: "accepted",
      message: "Work order accepted",
    });

    const landlordEmail = await findUserEmailById(asString((access.item as any)?.landlordId, 120));
    if (landlordEmail) {
      await trySendContractorEmail({
        to: landlordEmail,
        subject: "Work order accepted",
        intro: `A contractor accepted work order: ${asString((access.item as any)?.title, 180) || workOrderId}.`,
        ctaText: "Open Work Orders",
        ctaUrl: `${String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "")}/work-orders`,
      });
    }

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), access.role === "contractor" ? "contractor" : "landlord") });
  } catch (err) {
    console.error("[work-orders] accept failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_ACCEPT_FAILED" });
  }
});

router.post("/work-orders/:id/decline", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const userId = getUserId(req);
    const currentStatus = asString((access.item as any)?.status, 40).toLowerCase();
    if (!(currentStatus === "open" || currentStatus === "invited" || currentStatus === "assigned")) {
      return res.status(400).json({ ok: false, error: "INVALID_STATUS_TRANSITION" });
    }
    const invited = uniqueStrings((access.item as any)?.invitedContractorIds, 100).filter((id) => id !== userId);
    const nextStatus = invited.length ? "invited" : "open";

    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: nextStatus,
        invitedContractorIds: invited,
        assignedContractorId:
          asString((access.item as any)?.assignedContractorId) === userId
            ? null
            : asOptionalString((access.item as any)?.assignedContractorId),
        updatedAtMs: nowMs(),
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "contractor",
      actorId: userId,
      updateType: "declined",
      message: "Work order declined",
    });

    const landlordEmail = await findUserEmailById(asString((access.item as any)?.landlordId, 120));
    if (landlordEmail) {
      await trySendContractorEmail({
        to: landlordEmail,
        subject: "Work order declined",
        intro: `A contractor declined work order: ${asString((access.item as any)?.title, 180) || workOrderId}.`,
        ctaText: "Open Work Orders",
        ctaUrl: `${String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "")}/work-orders`,
      });
    }

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), access.role === "contractor" ? "contractor" : "landlord") });
  } catch (err) {
    console.error("[work-orders] decline failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_DECLINE_FAILED" });
  }
});

router.post("/work-orders/:id/start", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const userId = getUserId(req);
    const currentStatus = asString((access.item as any)?.status, 40).toLowerCase();
    if (!canTransitionWorkOrder({ fromStatus: currentStatus, toStatus: "in_progress", actorRole: "contractor" })) {
      return res.status(400).json({ ok: false, error: "INVALID_STATUS_TRANSITION" });
    }
    const now = nowMs();
    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: "in_progress",
        assignedContractorId: userId,
        startedAtMs: now,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "contractor",
      actorId: userId,
      updateType: "status_changed",
      message: "Work order marked in progress",
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), access.role === "contractor" ? "contractor" : "landlord") });
  } catch (err) {
    console.error("[work-orders] start failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_START_FAILED" });
  }
});

router.post("/work-orders/:id/complete", requireAuth, async (req: any, res) => {
  try {
    if (!isContractor(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const userId = getUserId(req);
    const currentStatus = asString((access.item as any)?.status, 40).toLowerCase();
    if (!canTransitionWorkOrder({ fromStatus: currentStatus, toStatus: "completed", actorRole: "contractor" })) {
      return res.status(400).json({ ok: false, error: "INVALID_STATUS_TRANSITION" });
    }
    const now = nowMs();
    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: "completed",
        assignedContractorId: userId,
        completedAtMs: now,
        serviceCompletedAt: now,
        lastExecutionUpdateAt: now,
        resolutionStatus: "completed_pending_review",
        landlordApprovedAt: null,
        landlordApprovedBy: null,
        tenantSignoffStatus: null,
        tenantSignedOffAt: null,
        tenantDeclinedAt: null,
        tenantDeclineReason: null,
        followUpRequired: false,
        followUpReason: null,
        finalResolvedAt: null,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "contractor",
      actorId: userId,
      updateType: "completed",
      message: "Work order marked completed",
    });

    const landlordEmail = await findUserEmailById(asString((access.item as any)?.landlordId, 120));
    if (landlordEmail) {
      await trySendContractorEmail({
        to: landlordEmail,
        subject: "Work order completed",
        intro: `A contractor marked work order as completed: ${asString((access.item as any)?.title, 180) || workOrderId}.`,
        ctaText: "Review Work Order",
        ctaUrl: `${String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "")}/work-orders`,
      });
    }

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), access.role === "contractor" ? "contractor" : "landlord") });
  } catch (err) {
    console.error("[work-orders] complete failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_COMPLETE_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/confirm-completion", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const currentStatus = asString((access.item as any)?.status, 40).toLowerCase();
    if (currentStatus !== "completed") {
      return res.status(400).json({ ok: false, error: "WORK_ORDER_NOT_COMPLETED" });
    }

    const now = nowMs();
    const tenantId = asOptionalString((access.item as any)?.tenantId, 120);
    await db.collection("workOrders").doc(workOrderId).set(
      {
        completionConfirmedByLandlordAt: now,
        completionConfirmedByLandlordBy: access.userId,
        resolutionStatus: tenantId ? "tenant_pending_signoff" : "landlord_approved",
        landlordApprovedAt: now,
        landlordApprovedBy: access.userId,
        tenantSignoffStatus: tenantId ? "pending" : null,
        tenantSignedOffAt: null,
        tenantDeclinedAt: null,
        tenantDeclineReason: null,
        followUpRequired: false,
        followUpReason: null,
        finalResolvedAt: null,
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "confirmed",
      message: tenantId
        ? "Landlord approved the completed work and is waiting for tenant signoff"
        : "Landlord approved the completed work",
    });

    await syncMaintenanceFromWorkOrder(workOrderId, {
      contractorLastUpdate: tenantId
        ? "Landlord approved the completed work and is waiting for tenant signoff."
        : "Landlord approved the completed work.",
    });
    await appendMaintenanceStatusHistory({
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
      status: "completed",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      message: tenantId
        ? "Landlord approved the completed work and is waiting for tenant signoff."
        : "Landlord approved the completed work.",
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] confirm completion failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_CONFIRM_COMPLETION_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/approve-resolution", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const currentStatus = asString((access.item as any)?.status, 40).toLowerCase();
    if (currentStatus !== "completed") {
      return res.status(400).json({ ok: false, error: "WORK_ORDER_NOT_COMPLETED" });
    }

    const now = nowMs();
    const tenantId = asOptionalString((access.item as any)?.tenantId, 120);
    await db.collection("workOrders").doc(workOrderId).set(
      {
        resolutionStatus: tenantId ? "tenant_pending_signoff" : "landlord_approved",
        landlordApprovedAt: now,
        landlordApprovedBy: access.userId,
        completionConfirmedByLandlordAt: now,
        completionConfirmedByLandlordBy: access.userId,
        tenantSignoffStatus: tenantId ? "pending" : null,
        tenantSignedOffAt: null,
        tenantDeclinedAt: null,
        tenantDeclineReason: null,
        followUpRequired: false,
        followUpReason: null,
        finalResolvedAt: null,
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "confirmed",
      message: tenantId
        ? "Landlord approved the completed work and is waiting for tenant signoff"
        : "Landlord approved the completed work",
    });

    await syncMaintenanceFromWorkOrder(workOrderId, {
      contractorLastUpdate: tenantId
        ? "Landlord approved the completed work and is waiting for tenant signoff."
        : "Landlord approved the completed work.",
    });
    await appendMaintenanceStatusHistory({
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
      status: "completed",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      message: tenantId
        ? "Landlord approved the completed work and is waiting for tenant signoff."
        : "Landlord approved the completed work.",
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] approve resolution failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_APPROVE_RESOLUTION_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/mark-follow-up-required", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const currentStatus = asString((access.item as any)?.status, 40).toLowerCase();
    if (currentStatus !== "completed") {
      return res.status(400).json({ ok: false, error: "WORK_ORDER_NOT_COMPLETED" });
    }

    const reason = asString(req.body?.reason, 2000);
    if (!reason) {
      return res.status(400).json({ ok: false, error: "FOLLOW_UP_REASON_REQUIRED" });
    }

    const now = nowMs();
    await db.collection("workOrders").doc(workOrderId).set(
      {
        resolutionStatus: "follow_up_required",
        landlordApprovedAt: null,
        landlordApprovedBy: null,
        completionConfirmedByLandlordAt: null,
        completionConfirmedByLandlordBy: null,
        followUpRequired: true,
        followUpReason: reason,
        tenantSignoffStatus: null,
        tenantSignedOffAt: null,
        tenantDeclinedAt: null,
        tenantDeclineReason: null,
        finalResolvedAt: null,
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "status_changed",
      message: `Follow-up required: ${reason}`,
    });

    await syncMaintenanceFromWorkOrder(workOrderId, {
      contractorLastUpdate: `Follow-up required: ${reason}`,
    });
    await appendMaintenanceStatusHistory({
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
      status: "completed",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      message: `Follow-up required: ${reason}`,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] mark follow-up required failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_MARK_FOLLOW_UP_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/start-rework", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const currentResolutionStatus = normalizeResolutionStatus((access.item as any)?.resolutionStatus);
    if (currentResolutionStatus !== "follow_up_required") {
      return res.status(400).json({ ok: false, error: "REWORK_REQUIRES_FOLLOW_UP_STATUS" });
    }

    const currentReworkStatus = normalizeReworkCycleStatus((access.item as any)?.reworkCycle?.status);
    if (currentReworkStatus && currentReworkStatus !== "completed" && currentReworkStatus !== "cancelled") {
      return res.status(409).json({ ok: false, error: "REWORK_ALREADY_ACTIVE" });
    }

    const now = nowMs();
    const existingAssignedContractorId = asOptionalString((access.item as any)?.assignedContractorId, 120);
    const cycleNumber = getNextReworkCycleNumber(access.item);
    const cycleStatus = existingAssignedContractorId ? "assigned" : "not_started";

    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: "assigned",
        resolutionStatus: "completed_pending_review",
        followUpRequired: false,
        followUpReason: null,
        reworkReview: null,
        reworkCycle: {
          cycleNumber,
          status: cycleStatus,
          createdAt: now,
          createdBy: access.userId,
          assignedContractorId: existingAssignedContractorId,
          assignedAt: existingAssignedContractorId ? now : null,
          startedAt: null,
          completedAt: null,
          completionSummary: null,
          evidenceSnapshot: null,
          schedule: null,
        },
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "reopened",
      message: `Rework cycle #${cycleNumber} started`,
    });

    await syncMaintenanceFromWorkOrder(workOrderId, {
      contractorLastUpdate: `Rework cycle #${cycleNumber} started.`,
    });
    await appendMaintenanceStatusHistory({
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
      status: "assigned",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      message: `Rework cycle #${cycleNumber} started.`,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] start rework failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_START_REWORK_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/assign-rework", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const reworkCycle = (access.item as any)?.reworkCycle || null;
    const cycleStatus = normalizeReworkCycleStatus(reworkCycle?.status);
    if (!reworkCycle || !cycleStatus || cycleStatus === "completed" || cycleStatus === "cancelled") {
      return res.status(400).json({ ok: false, error: "REWORK_CYCLE_NOT_ACTIVE" });
    }

    const contractorId = asOptionalString(req.body?.contractorId, 120);
    if (!contractorId) {
      return res.status(400).json({ ok: false, error: "CONTRACTOR_ID_REQUIRED" });
    }

    const now = nowMs();
    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: "assigned",
        assignedContractorId: contractorId,
        reworkCycle: {
          ...reworkCycle,
          status: "assigned",
          assignedContractorId: contractorId,
          assignedAt: now,
        },
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "status_changed",
      message: `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} assigned to contractor ${contractorId}`,
    });

    await syncMaintenanceFromWorkOrder(workOrderId, {
      contractorLastUpdate: `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} assigned.`,
    });
    await appendMaintenanceStatusHistory({
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
      status: "assigned",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      message: `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} assigned to contractor.`,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] assign rework failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_ASSIGN_REWORK_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/rework-schedule", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const reworkCycle = (access.item as any)?.reworkCycle || null;
    const cycleStatus = normalizeReworkCycleStatus(reworkCycle?.status);
    if (!reworkCycle || !cycleStatus || cycleStatus === "completed" || cycleStatus === "cancelled") {
      return res.status(400).json({ ok: false, error: "REWORK_CYCLE_NOT_ACTIVE" });
    }

    const scheduledFor = req.body?.scheduledFor === undefined ? undefined : toMillis(req.body?.scheduledFor);
    const timeWindowStart = req.body?.timeWindowStart === undefined ? undefined : toMillis(req.body?.timeWindowStart);
    const timeWindowEnd = req.body?.timeWindowEnd === undefined ? undefined : toMillis(req.body?.timeWindowEnd);
    if (req.body?.scheduledFor !== undefined && scheduledFor === null && req.body?.scheduledFor !== null) {
      return res.status(400).json({ ok: false, error: "INVALID_SCHEDULED_FOR" });
    }
    if (req.body?.timeWindowStart !== undefined && timeWindowStart === null && req.body?.timeWindowStart !== null) {
      return res.status(400).json({ ok: false, error: "INVALID_TIME_WINDOW_START" });
    }
    if (req.body?.timeWindowEnd !== undefined && timeWindowEnd === null && req.body?.timeWindowEnd !== null) {
      return res.status(400).json({ ok: false, error: "INVALID_TIME_WINDOW_END" });
    }
    if (!scheduledFor && !(timeWindowStart && timeWindowEnd)) {
      return res.status(400).json({ ok: false, error: "REWORK_SCHEDULE_TIME_REQUIRED" });
    }
    if (timeWindowStart && timeWindowEnd && timeWindowEnd < timeWindowStart) {
      return res.status(400).json({ ok: false, error: "INVALID_TIME_WINDOW_RANGE" });
    }

    const requiresTenantAccess = Boolean(req.body?.requiresTenantAccess);
    const now = nowMs();
    const nextSchedule = {
      scheduledFor: scheduledFor ?? null,
      timeWindowStart: timeWindowStart ?? null,
      timeWindowEnd: timeWindowEnd ?? null,
      status: requiresTenantAccess ? "tenant_pending" : "scheduled",
      requiresTenantAccess,
      tenantAccessStatus: requiresTenantAccess ? "pending" : "not_required",
      contractorScheduleStatus: "pending",
      scheduledBy: access.userId,
      scheduledAt: now,
      rescheduleReason: null,
      tenantAccessNote: null,
      contractorAvailabilityNote: null,
      lastUpdatedAt: now,
    };

    await db.collection("workOrders").doc(workOrderId).set(
      {
        reworkCycle: {
          ...reworkCycle,
          schedule: nextSchedule,
        },
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "scheduled",
      message: `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} scheduled for return visit`,
    });
    await syncMaintenanceFromWorkOrder(workOrderId, {
      contractorLastUpdate: requiresTenantAccess
        ? `Rework return visit scheduled and waiting on access confirmation.`
        : `Rework return visit scheduled.`,
    });
    await appendMaintenanceStatusHistory({
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
      status: "assigned",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      message: requiresTenantAccess
        ? `Rework return visit scheduled and awaiting tenant access confirmation.`
        : `Rework return visit scheduled.`,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] schedule rework failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_SCHEDULE_REWORK_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/reschedule-rework", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const reworkCycle = (access.item as any)?.reworkCycle || null;
    const cycleStatus = normalizeReworkCycleStatus(reworkCycle?.status);
    if (!reworkCycle || !cycleStatus || cycleStatus === "completed" || cycleStatus === "cancelled") {
      return res.status(400).json({ ok: false, error: "REWORK_CYCLE_NOT_ACTIVE" });
    }

    const reason = asOptionalString(req.body?.reason, 2000);
    if (!reason) return res.status(400).json({ ok: false, error: "RESCHEDULE_REASON_REQUIRED" });

    const scheduledFor = req.body?.scheduledFor === undefined ? undefined : toMillis(req.body?.scheduledFor);
    const timeWindowStart = req.body?.timeWindowStart === undefined ? undefined : toMillis(req.body?.timeWindowStart);
    const timeWindowEnd = req.body?.timeWindowEnd === undefined ? undefined : toMillis(req.body?.timeWindowEnd);
    if (req.body?.scheduledFor !== undefined && scheduledFor === null && req.body?.scheduledFor !== null) {
      return res.status(400).json({ ok: false, error: "INVALID_SCHEDULED_FOR" });
    }
    if (req.body?.timeWindowStart !== undefined && timeWindowStart === null && req.body?.timeWindowStart !== null) {
      return res.status(400).json({ ok: false, error: "INVALID_TIME_WINDOW_START" });
    }
    if (req.body?.timeWindowEnd !== undefined && timeWindowEnd === null && req.body?.timeWindowEnd !== null) {
      return res.status(400).json({ ok: false, error: "INVALID_TIME_WINDOW_END" });
    }
    if (!scheduledFor && !(timeWindowStart && timeWindowEnd)) {
      return res.status(400).json({ ok: false, error: "REWORK_SCHEDULE_TIME_REQUIRED" });
    }
    if (timeWindowStart && timeWindowEnd && timeWindowEnd < timeWindowStart) {
      return res.status(400).json({ ok: false, error: "INVALID_TIME_WINDOW_RANGE" });
    }

    const requiresTenantAccess = Boolean(req.body?.requiresTenantAccess);
    const now = nowMs();
    const nextSchedule = {
      scheduledFor: scheduledFor ?? null,
      timeWindowStart: timeWindowStart ?? null,
      timeWindowEnd: timeWindowEnd ?? null,
      status: requiresTenantAccess ? "tenant_pending" : "scheduled",
      requiresTenantAccess,
      tenantAccessStatus: requiresTenantAccess ? "pending" : "not_required",
      contractorScheduleStatus: "pending",
      scheduledBy: access.userId,
      scheduledAt: now,
      rescheduleReason: reason,
      tenantAccessNote: null,
      contractorAvailabilityNote: null,
      lastUpdatedAt: now,
    };

    await db.collection("workOrders").doc(workOrderId).set(
      {
        reworkCycle: {
          ...reworkCycle,
          schedule: nextSchedule,
        },
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "scheduled",
      message: `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} rescheduled: ${reason}`,
    });
    await syncMaintenanceFromWorkOrder(workOrderId, {
      contractorLastUpdate: `Rework return visit rescheduled: ${reason}`,
    });
    await appendMaintenanceStatusHistory({
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
      status: "assigned",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      message: `Rework return visit rescheduled: ${reason}`,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] reschedule rework failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_RESCHEDULE_REWORK_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/complete-rework", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const reworkCycle = (access.item as any)?.reworkCycle || null;
    if (!reworkCycle || normalizeReworkCycleStatus(reworkCycle?.status) !== "completed") {
      return res.status(400).json({ ok: false, error: "REWORK_NOT_READY_FOR_COMPLETION" });
    }

    const outcome = normalizeReworkHistoryOutcome(req.body?.outcome) || "resolved";
    const notes = asOptionalString(req.body?.notes || reworkCycle?.completionSummary, 2000);
    const now = nowMs();
    const historyEntry = {
      cycleNumber: Number(reworkCycle?.cycleNumber || 1),
      startedAt: typeof reworkCycle?.startedAt === "number" ? reworkCycle.startedAt : null,
      completedAt: typeof reworkCycle?.completedAt === "number" ? reworkCycle.completedAt : now,
      outcome,
      notes,
    };

    const nextReworkHistory = upsertReworkHistoryEntry((access.item as any)?.reworkHistory, historyEntry);

    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: "completed",
        resolutionStatus: "completed_pending_review",
        followUpRequired: false,
        followUpReason: null,
        reworkCycle: {
          ...reworkCycle,
          status: "completed",
        },
        reworkHistory: nextReworkHistory,
        reworkReview: buildPendingReworkReview(now),
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "confirmed",
      message: `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} completed and returned for review`,
    });

    await syncMaintenanceFromWorkOrder(workOrderId, {
      contractorLastUpdate: `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} completed and is ready for review.`,
    });
    await appendMaintenanceStatusHistory({
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
      status: "completed",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      message: `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} completed and is ready for review.`,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] complete rework failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_COMPLETE_REWORK_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/review-rework-resolution", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const reworkCycle = (access.item as any)?.reworkCycle || null;
    if (!reworkCycle || normalizeReworkCycleStatus(reworkCycle?.status) !== "completed") {
      return res.status(400).json({ ok: false, error: "REWORK_NOT_READY_FOR_REVIEW" });
    }

    const currentReviewStatus = normalizeReworkReviewStatus((access.item as any)?.reworkReview?.status);
    if (currentReviewStatus === "closed") {
      return res.status(409).json({ ok: false, error: "REWORK_ALREADY_CLOSED" });
    }

    const decision = req.body?.decision === "approve" || req.body?.decision === "follow_up_required" ? req.body.decision : null;
    if (!decision) return res.status(400).json({ ok: false, error: "INVALID_REWORK_REVIEW_DECISION" });

    const note = asOptionalString(req.body?.note, 2000);
    const now = nowMs();
    const requiresTenantSignoff = tenantSignoffRequiredForWorkOrder(access.item);
    const nextReview =
      decision === "approve"
        ? {
            status: requiresTenantSignoff ? "tenant_pending_signoff" : "closed",
            reviewedAt: now,
            reviewedBy: access.userId,
            landlordReviewNote: note,
            tenantSignoffStatus: requiresTenantSignoff ? "pending" : null,
            tenantSignedOffAt: null,
            tenantDeclinedAt: null,
            tenantDeclineReason: null,
            closureOutcome: requiresTenantSignoff ? null : ("resolved" as const),
            closedAt: requiresTenantSignoff ? null : now,
          }
        : {
            status: "follow_up_required",
            reviewedAt: now,
            reviewedBy: access.userId,
            landlordReviewNote: note,
            tenantSignoffStatus: null,
            tenantSignedOffAt: null,
            tenantDeclinedAt: null,
            tenantDeclineReason: null,
            closureOutcome: "needs_more_followup" as const,
            closedAt: null,
          };

    await db.collection("workOrders").doc(workOrderId).set(
      {
        reworkReview: nextReview,
        resolutionStatus: decision === "approve" ? (requiresTenantSignoff ? "tenant_pending_signoff" : "resolved") : "follow_up_required",
        followUpRequired: decision === "follow_up_required",
        followUpReason: decision === "follow_up_required" ? note : null,
        finalResolvedAt: decision === "approve" && !requiresTenantSignoff ? now : null,
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
      },
      { merge: true }
    );

    const message =
      decision === "approve"
        ? requiresTenantSignoff
          ? `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} approved and sent for tenant signoff.`
          : `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} approved and closed.`
        : `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} needs more follow-up.${note ? ` ${note}` : ""}`;

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "confirmed",
      message,
    });

    await syncMaintenanceFromWorkOrder(workOrderId, {
      contractorLastUpdate: message,
    });
    await appendMaintenanceStatusHistory({
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
      status: decision === "follow_up_required" ? "completed" : "completed",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      message,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] review rework resolution failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_REWORK_REVIEW_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/close-rework-directly", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const reworkCycle = (access.item as any)?.reworkCycle || null;
    if (!reworkCycle || normalizeReworkCycleStatus(reworkCycle?.status) !== "completed") {
      return res.status(400).json({ ok: false, error: "REWORK_NOT_READY_FOR_REVIEW" });
    }
    if (tenantSignoffRequiredForWorkOrder(access.item)) {
      return res.status(400).json({ ok: false, error: "TENANT_SIGNOFF_REQUIRED" });
    }
    if (normalizeReworkReviewStatus((access.item as any)?.reworkReview?.status) === "closed") {
      return res.status(409).json({ ok: false, error: "REWORK_ALREADY_CLOSED" });
    }

    const note = asOptionalString(req.body?.note, 2000);
    const now = nowMs();
    await db.collection("workOrders").doc(workOrderId).set(
      {
        reworkReview: {
          status: "closed",
          reviewedAt: now,
          reviewedBy: access.userId,
          landlordReviewNote: note,
          tenantSignoffStatus: null,
          tenantSignedOffAt: null,
          tenantDeclinedAt: null,
          tenantDeclineReason: null,
          closureOutcome: "resolved",
          closedAt: now,
        },
        resolutionStatus: "resolved",
        followUpRequired: false,
        followUpReason: null,
        finalResolvedAt: now,
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
      },
      { merge: true }
    );

    const message = `Rework cycle #${Number(reworkCycle?.cycleNumber || 1)} closed.${note ? ` ${note}` : ""}`;
    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "confirmed",
      message,
    });
    await syncMaintenanceFromWorkOrder(workOrderId, { contractorLastUpdate: message });
    await appendMaintenanceStatusHistory({
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
      status: "completed",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      message,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] close rework directly failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_REWORK_CLOSE_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/reopen", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const reason = asString(req.body?.reason, 500);
    if (!reason) return res.status(400).json({ ok: false, error: "REOPEN_REASON_REQUIRED" });

    const currentStatus = asString((access.item as any)?.status, 40).toLowerCase();
    if (currentStatus !== "completed") {
      return res.status(400).json({ ok: false, error: "WORK_ORDER_NOT_COMPLETED" });
    }

    const requestedStatus = asString(req.body?.status, 40).toLowerCase();
    const nextStatus = requestedStatus === "blocked" ? "blocked" : "in_progress";
    const now = nowMs();
    await db.collection("workOrders").doc(workOrderId).set(
      {
        status: nextStatus,
        reopenedAt: now,
        reopenedByActorId: access.userId,
        reopenedByActorRole: isAdmin(req) ? "admin" : "landlord",
        reopenReason: reason,
        resolutionStatus: "follow_up_required",
        landlordApprovedAt: null,
        landlordApprovedBy: null,
        tenantSignoffStatus: null,
        tenantSignedOffAt: null,
        tenantDeclinedAt: null,
        tenantDeclineReason: null,
        followUpRequired: true,
        followUpReason: reason,
        finalResolvedAt: null,
        completionConfirmedByLandlordAt: null,
        completionConfirmedByLandlordBy: null,
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
        executionBlockedReason: nextStatus === "blocked" ? reason : null,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "reopened",
      message: `Work order reopened: ${reason}`,
    });

    await syncMaintenanceFromWorkOrder(workOrderId, {
      contractorLastUpdate: reason,
    });
    await appendMaintenanceStatusHistory({
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
      status: nextStatus,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      message: `Work order reopened: ${reason}`,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] reopen failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_REOPEN_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/submit-cost", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    if (asString((access.item as any)?.status, 40).toLowerCase() !== "completed") {
      return res.status(400).json({ ok: false, error: "WORK_ORDER_NOT_COMPLETED" });
    }

    const actualCostCents = parseMoneyToCents(req.body?.actualCostCents);
    if (!actualCostCents) return res.status(400).json({ ok: false, error: "INVALID_COST_AMOUNT" });
    const currency = normalizeCostCurrency(req.body?.currency) || "CAD";
    const lineItems = normalizeCostLineItems(req.body?.lineItems);
    const now = nowMs();
    const revisionNumber = getCurrentCostRevisionNumber(access.item) + 1;
    const actorRole = isAdmin(req) ? "admin" : "landlord";
    const history = normalizeCostReviewHistory((access.item as any)?.costReviewHistory);

    await db.collection("workOrders").doc(workOrderId).set(
      {
        cost: {
          ...(normalizeWorkOrderCost((access.item as any)?.cost) || {}),
          actualCostCents,
          currency,
          submittedByRole: actorRole,
          submittedById: access.userId,
          submittedAt: now,
          reviewedBy: access.userId,
          reviewedAt: now,
          reviewStatus: "approved",
          reviewNote: asOptionalString(req.body?.reviewNote, 1000),
          revisionRequestedAt: null,
          revisionRequestedBy: null,
          latestRevisionNumber: revisionNumber,
          linkedExpenseId: null,
          linkedExpenseStatus: "not_linked",
        },
        costLineItems: lineItems,
        costReviewHistory: [
          buildCostHistoryEntry({
            revisionNumber,
            submittedAt: now,
            submittedByRole: actorRole,
            submittedById: access.userId,
            actualCostCents,
            currency,
            reviewStatus: "approved",
            reviewedAt: now,
            reviewedBy: access.userId,
            reviewNote: asOptionalString(req.body?.reviewNote, 1000),
          }),
          ...history,
        ],
        expenseLink: {
          expenseId: null,
          linkedAt: null,
          linkedBy: null,
          status: "not_linked",
        },
        linkedExpenseId: null,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "invoice",
      message: `Landlord recorded ${formatCostForMessage(actualCostCents, currency)} for this work order.`,
    });

    await createTransaction({
      landlordId: asString((access.item as any)?.landlordId, 120) || access.landlordId,
      propertyId: asOptionalString((access.item as any)?.propertyId, 120) || undefined,
      unitId: asOptionalString((access.item as any)?.unitId, 120) || undefined,
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120) || undefined,
      workOrderId,
      type: "maintenance_cost_recorded",
      amountCents: actualCostCents,
      currency,
      status: "recorded",
      metadata: {
        source: "work_order_submit_cost",
        revisionNumber,
      },
      createdAt: now,
      updatedAt: now,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({
      ok: true,
      item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord"),
    });
  } catch (err) {
    console.error("[work-orders] landlord submit cost failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_SUBMIT_COST_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/review-cost", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const currentCost = normalizeWorkOrderCost((access.item as any)?.cost);
    if (!currentCost?.actualCostCents) {
      return res.status(400).json({ ok: false, error: "COST_NOT_SUBMITTED" });
    }

    const requestedDecision =
      req.body?.decision === "approve" || req.body?.decision === "reject" || req.body?.decision === "revision_requested"
        ? req.body.decision
        : null;
    const automationRequested = isAutomationRequested(req.body) && !requestedDecision;
    const decision = requestedDecision || (automationRequested ? "approve" : null);
    if (!decision) return res.status(400).json({ ok: false, error: "INVALID_COST_REVIEW_DECISION" });
    const note = asOptionalString(req.body?.note, 1000);
    if (decision === "revision_requested" && !note) {
      return res.status(400).json({ ok: false, error: "COST_REVISION_NOTE_REQUIRED" });
    }
    if (automationRequested) {
      const automation = await executeMaintenanceApprovalAutomation({
        workOrderId,
        workOrder: access.item,
        actorId: access.userId,
        actorRole: isAdmin(req) ? "admin" : "landlord",
        landlordId: asOptionalString((access.item as any)?.landlordId, 120) || access.landlordId || null,
        initiatedFrom: "work_order_review_cost",
      });
      const fallbackItem = await toWorkOrderResponseForAudience(workOrderId, access.item, "landlord");
      return res.json({
        ok: true,
        item: automation.workOrder
          ? await toWorkOrderResponseForAudience(automation.workOrderId, automation.workOrder, "landlord")
          : fallbackItem,
        autopilotPolicy: automation.autopilotPolicy,
        automationResult: automation.automationResult,
      });
    }
    const policyRequest = buildMaintenancePolicyRequest({
      action: decision === "approve" ? "approve_cost" : "review_cost",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorUserId: access.userId,
      workOrderId,
      workOrder: access.item,
      actualCostCents: currentCost.actualCostCents,
    });
    const policyResult = evaluatePolicy(policyRequest);
    const autopilotPolicy = toAutopilotPolicySummary(policyResult);
    await writePolicyEvaluatedEvent({
      request: policyRequest,
      result: policyResult,
      actorType: isAdmin(req) ? "admin" : "landlord",
      metadata: {
        landlordId: asOptionalString((access.item as any)?.landlordId, 120),
        maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
        propertyId: asOptionalString((access.item as any)?.propertyId, 120),
        unitId: asOptionalString((access.item as any)?.unitId, 120),
      },
    });
    if (!automationRequested && decision === "approve" && policyResult.outcome === "block") {
      return res.status(409).json({
        ok: false,
        error: "MAINTENANCE_POLICY_BLOCKED",
        autopilotPolicy,
      });
    }
    const executeDecision = async () => {
      const now = nowMs();
      const currentRevisionNumber = getCurrentCostRevisionNumber(access.item);
      const history = normalizeCostReviewHistory((access.item as any)?.costReviewHistory);
      const reviewStatus = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "revision_requested";
      const updatedHistory = history.map((entry) =>
        entry.revisionNumber === currentRevisionNumber
          ? {
              ...entry,
              reviewStatus,
              reviewedAt: now,
              reviewedBy: access.userId,
              reviewNote: note,
            }
          : entry
      );

      await db.collection("workOrders").doc(workOrderId).set(
        {
          cost: {
            ...currentCost,
            reviewStatus,
            reviewedBy: access.userId,
            reviewedAt: now,
            reviewNote: note,
            revisionRequestedAt: decision === "revision_requested" ? now : null,
            revisionRequestedBy: decision === "revision_requested" ? access.userId : null,
          },
          costReviewHistory: updatedHistory,
          updatedAtMs: now,
        },
        { merge: true }
      );

      await writeWorkOrderUpdate({
        workOrderId,
        actorRole: isAdmin(req) ? "admin" : "landlord",
        actorId: access.userId,
        updateType: "invoice",
        message:
          decision === "approve"
            ? "Cost submission approved."
            : decision === "reject"
            ? `Cost submission rejected.${note ? ` ${note}` : ""}`
            : `Cost revision requested.${note ? ` ${note}` : ""}`,
      });
      if (decision === "approve") {
        await writeCanonicalEvent({
          domain: "expense",
          action: "approved",
          status: "approved",
          actor: {
            type: isAdmin(req) ? "admin" : "landlord",
            role: isAdmin(req) ? "admin" : "landlord",
            id: access.userId,
          },
          resource: {
            type: "work_order_cost",
            id: workOrderId,
            parentType: "work_order",
            parentId: workOrderId,
          },
          occurredAt: now,
          visibility: "internal",
          summary: "Maintenance cost approved for expense reconciliation",
          metadata: {
            maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
            propertyId: asOptionalString((access.item as any)?.propertyId, 120),
            unitId: asOptionalString((access.item as any)?.unitId, 120),
            actualCostCents: currentCost.actualCostCents,
            currency: currentCost.currency || "CAD",
          },
        });
      }

      const refreshed = await db.collection("workOrders").doc(workOrderId).get();
      return await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord");
    };

    const item = await executeDecision();
    return res.json({
      ok: true,
      item,
      autopilotPolicy,
    });
  } catch (err) {
    console.error("[work-orders] review cost failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_REVIEW_COST_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/request-cost-revision", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const currentCost = normalizeWorkOrderCost((access.item as any)?.cost);
    if (!currentCost?.actualCostCents) {
      return res.status(400).json({ ok: false, error: "COST_NOT_SUBMITTED" });
    }
    if (currentCost.reviewStatus !== "pending_review" && currentCost.reviewStatus !== "rejected") {
      return res.status(400).json({ ok: false, error: "COST_REVISION_NOT_ALLOWED" });
    }
    const note = asOptionalString(req.body?.note, 1000);
    if (!note) return res.status(400).json({ ok: false, error: "COST_REVISION_NOTE_REQUIRED" });
    const now = nowMs();
    const currentRevisionNumber = getCurrentCostRevisionNumber(access.item);
    const history = normalizeCostReviewHistory((access.item as any)?.costReviewHistory).map((entry) =>
      entry.revisionNumber === currentRevisionNumber
        ? {
            ...entry,
            reviewStatus: "revision_requested" as const,
            reviewedAt: now,
            reviewedBy: access.userId,
            reviewNote: note,
          }
        : entry
    );

    await db.collection("workOrders").doc(workOrderId).set(
      {
        cost: {
          ...currentCost,
          reviewStatus: "revision_requested",
          reviewNote: note,
          reviewedBy: access.userId,
          reviewedAt: now,
          revisionRequestedAt: now,
          revisionRequestedBy: access.userId,
        },
        costReviewHistory: history,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "invoice",
      message: `Cost revision requested. ${note}`,
    });
    await writeCanonicalEvent({
      domain: "maintenance",
      action: "approval_requested",
      status: "revision_requested",
      actor: {
        type: isAdmin(req) ? "admin" : "landlord",
        role: isAdmin(req) ? "admin" : "landlord",
        id: access.userId,
      },
      resource: {
        type: "maintenance_request",
        id: asOptionalString((access.item as any)?.maintenanceRequestId, 120) || workOrderId,
      },
      occurredAt: now,
      visibility: "landlord",
      summary: "Maintenance cost revision requested",
      metadata: {
        workOrderId,
        propertyId: asOptionalString((access.item as any)?.propertyId, 120),
        unitId: asOptionalString((access.item as any)?.unitId, 120),
        note,
      },
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] request cost revision failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_REQUEST_COST_REVISION_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/link-expense", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const currentCost = normalizeWorkOrderCost((access.item as any)?.cost);
    if (!currentCost?.actualCostCents || currentCost.reviewStatus !== "approved") {
      return res.status(400).json({ ok: false, error: "COST_NOT_APPROVED" });
    }
    if (asOptionalString(currentCost.linkedExpenseId, 120) || asOptionalString((access.item as any)?.linkedExpenseId, 120)) {
      return res.status(400).json({ ok: false, error: "EXPENSE_ALREADY_LINKED" });
    }

    const propertyId = asString((access.item as any)?.propertyId, 120);
    if (!propertyId) return res.status(400).json({ ok: false, error: "PROPERTY_REQUIRED" });
    const now = nowMs();
    const expenseRef = db.collection("expenses").doc();
    const landlordId = asString((access.item as any)?.landlordId, 120) || access.landlordId;
    const unitId = asOptionalString((access.item as any)?.unitId, 120);
    const completionSummary = asOptionalString((access.item as any)?.completionSummary, 5000);
    const category = "Maintenance";

    await expenseRef.set({
      landlordId,
      propertyId,
      unitId,
      category,
      vendorName:
        asOptionalString((access.item as any)?.assignedContractorName, 180) ||
        asOptionalString((access.item as any)?.title, 180) ||
        "Maintenance work order",
      amountCents: currentCost.actualCostCents,
      incurredAtMs: typeof (access.item as any)?.serviceCompletedAt === "number" ? (access.item as any).serviceCompletedAt : now,
      notes: completionSummary || asOptionalString(currentCost.reviewNote, 5000) || "",
      status: "recorded",
      source: "work_order",
      linkedWorkOrderId: workOrderId,
      createdAtMs: now,
      updatedAtMs: now,
    });

    const history = normalizeCostReviewHistory((access.item as any)?.costReviewHistory).map((entry) =>
      entry.revisionNumber === getCurrentCostRevisionNumber(access.item)
        ? { ...entry, linkedExpenseId: expenseRef.id }
        : entry
    );

    await db.collection("workOrders").doc(workOrderId).set(
      {
        cost: {
          ...currentCost,
          linkedExpenseId: expenseRef.id,
          linkedExpenseStatus: "linked",
        },
        costReviewHistory: history,
        expenseLink: {
          expenseId: expenseRef.id,
          linkedAt: now,
          linkedBy: access.userId,
          status: "linked",
        },
        linkedExpenseId: expenseRef.id,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "invoice",
      message: "Approved maintenance cost linked to an expense record.",
    });

    await createTransaction({
      landlordId,
      propertyId,
      unitId: unitId || undefined,
      maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120) || undefined,
      workOrderId,
      type: "maintenance_cost_linked_to_expense",
      amountCents: currentCost.actualCostCents,
      currency: currentCost.currency || "CAD",
      status: "linked",
      metadata: {
        expenseId: expenseRef.id,
        source: "work_order_link_expense",
      },
      createdAt: now,
      updatedAt: now,
    });
    await writeCanonicalEvent({
      domain: "expense",
      action: "linked",
      status: "linked",
      actor: {
        type: isAdmin(req) ? "admin" : "landlord",
        role: isAdmin(req) ? "admin" : "landlord",
        id: access.userId,
      },
      resource: {
        type: "expense",
        id: expenseRef.id,
        parentType: "work_order",
        parentId: workOrderId,
      },
      occurredAt: now,
      visibility: "internal",
      summary: "Expense linked to maintenance work order",
      metadata: {
        landlordId,
        propertyId,
        unitId,
        maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
        amountCents: currentCost.actualCostCents,
        currency: currentCost.currency || "CAD",
      },
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] link expense failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_LINK_EXPENSE_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/cost-attachment", requireAuth, async (req: any, res) => {
  costAttachmentUpload.single("file")(req, res, async (uploadErr: any) => {
    try {
      if (uploadErr) {
        const message = String(uploadErr?.message || "");
        if (String(uploadErr?.code || "") === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ ok: false, error: "FILE_TOO_LARGE", maxBytes: MAX_COST_ATTACHMENT_BYTES });
        }
        return res.status(400).json({ ok: false, error: "UPLOAD_FAILED", detail: message || "upload_failed" });
      }
      if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

      const workOrderId = asString(req.params?.id, 120);
      const access = await getWorkOrderAuthorized(req, workOrderId);
      if (!access.ok) {
        if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file?.buffer || !file.originalname) return res.status(400).json({ ok: false, error: "FILE_REQUIRED" });
      if (!isAllowedCostAttachmentFile(file)) {
        return res.status(400).json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" });
      }

      const now = nowMs();
      const attachmentId = makeEvidenceId();
      const storagePath = buildCostAttachmentStoragePath({
        workOrderId,
        attachmentId,
        filename: file.originalname,
      });
      await uploadBufferToGcs({
        path: storagePath,
        contentType: String(file.mimetype || "application/octet-stream"),
        buffer: file.buffer,
        metadata: {
          workOrderId,
          uploadedAtMs: String(now),
          actorRole: isAdmin(req) ? "admin" : "landlord",
          actorId: access.userId,
          visibility: "internal",
        },
      });

      const nextAttachments = [
        ...filterCostAttachmentsForAudience((access.item as any)?.costAttachments, "landlord"),
        {
          id: attachmentId,
          storagePath,
          fileName: asString(file.originalname, 180),
          contentType: asString(file.mimetype, 120),
          uploadedAt: now,
          uploadedByRole: isAdmin(req) ? "admin" : "landlord",
          uploadedById: access.userId,
          visibility: "internal",
        },
      ];

      await db.collection("workOrders").doc(workOrderId).set(
        {
          costAttachments: nextAttachments,
          updatedAtMs: now,
        },
        { merge: true }
      );

      await writeWorkOrderUpdate({
        workOrderId,
        actorRole: isAdmin(req) ? "admin" : "landlord",
        actorId: access.userId,
        updateType: "invoice",
        message: "Uploaded a cost attachment.",
      });

      const refreshed = await db.collection("workOrders").doc(workOrderId).get();
      return res.status(201).json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
    } catch (err) {
      console.error("[work-orders] landlord cost attachment upload failed", err);
      return res.status(500).json({ ok: false, error: "WORK_ORDER_COST_ATTACHMENT_UPLOAD_FAILED" });
    }
  });
});

router.post("/landlord/work-orders/:id/submit-cost", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    if (asString((access.item as any)?.status, 40).toLowerCase() !== "completed") {
      return res.status(400).json({ ok: false, error: "WORK_ORDER_NOT_COMPLETED" });
    }

    const actualCostCents = parseMoneyToCents(req.body?.actualCostCents);
    if (!actualCostCents) return res.status(400).json({ ok: false, error: "INVALID_COST_AMOUNT" });
    const currency = normalizeCostCurrency(req.body?.currency) || "CAD";
    const lineItems = normalizeCostLineItems(req.body?.lineItems);
    const now = nowMs();

    await db.collection("workOrders").doc(workOrderId).set(
      {
        cost: {
          ...(normalizeWorkOrderCost((access.item as any)?.cost) || {}),
          actualCostCents,
          currency,
          submittedByRole: isAdmin(req) ? "admin" : "landlord",
          submittedById: access.userId,
          submittedAt: now,
          reviewedBy: null,
          reviewedAt: null,
          reviewStatus: "approved",
          reviewNote: asOptionalString(req.body?.reviewNote, 1000),
        },
        costLineItems: lineItems,
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "invoice",
      message: `Landlord recorded ${formatCostForMessage(actualCostCents, currency)} for this work order.`,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] landlord submit cost failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_SUBMIT_COST_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/review-cost", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const currentCost = normalizeWorkOrderCost((access.item as any)?.cost);
    if (!currentCost?.actualCostCents) {
      return res.status(400).json({ ok: false, error: "COST_NOT_SUBMITTED" });
    }

    const decision = req.body?.decision === "approve" || req.body?.decision === "reject" ? req.body.decision : null;
    if (!decision) return res.status(400).json({ ok: false, error: "INVALID_COST_REVIEW_DECISION" });
    const note = asOptionalString(req.body?.note, 1000);
    const policyRequest = buildMaintenancePolicyRequest({
      action: decision === "approve" ? "approve_cost" : "review_cost",
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorUserId: access.userId,
      workOrderId,
      workOrder: access.item,
      actualCostCents: currentCost.actualCostCents,
    });
    const policyResult = evaluatePolicy(policyRequest);
    const autopilotPolicy = toAutopilotPolicySummary(policyResult);
    await writePolicyEvaluatedEvent({
      request: policyRequest,
      result: policyResult,
      actorType: isAdmin(req) ? "admin" : "landlord",
      metadata: {
        landlordId: asOptionalString((access.item as any)?.landlordId, 120),
        maintenanceRequestId: asOptionalString((access.item as any)?.maintenanceRequestId, 120),
        propertyId: asOptionalString((access.item as any)?.propertyId, 120),
        unitId: asOptionalString((access.item as any)?.unitId, 120),
      },
    });
    if (decision === "approve" && policyResult.outcome === "block") {
      return res.status(409).json({
        ok: false,
        error: "MAINTENANCE_POLICY_BLOCKED",
        autopilotPolicy,
      });
    }
    const now = nowMs();

    await db.collection("workOrders").doc(workOrderId).set(
      {
        cost: {
          ...currentCost,
          reviewStatus: decision === "approve" ? "approved" : "rejected",
          reviewedBy: access.userId,
          reviewedAt: now,
          reviewNote: note,
        },
        updatedAtMs: now,
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "invoice",
      message: decision === "approve" ? "Cost submission approved." : `Cost submission rejected.${note ? ` ${note}` : ""}`,
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({
      ok: true,
      item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord"),
      autopilotPolicy,
    });
  } catch (err) {
    console.error("[work-orders] review cost failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_REVIEW_COST_FAILED" });
  }
});

router.post("/landlord/work-orders/:id/cost-attachment", requireAuth, async (req: any, res) => {
  costAttachmentUpload.single("file")(req, res, async (uploadErr: any) => {
    try {
      if (uploadErr) {
        const message = String(uploadErr?.message || "");
        if (String(uploadErr?.code || "") === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ ok: false, error: "FILE_TOO_LARGE", maxBytes: MAX_COST_ATTACHMENT_BYTES });
        }
        return res.status(400).json({ ok: false, error: "UPLOAD_FAILED", detail: message || "upload_failed" });
      }
      if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

      const workOrderId = asString(req.params?.id, 120);
      const access = await getWorkOrderAuthorized(req, workOrderId);
      if (!access.ok) {
        if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file?.buffer || !file.originalname) return res.status(400).json({ ok: false, error: "FILE_REQUIRED" });
      if (!isAllowedCostAttachmentFile(file)) {
        return res.status(400).json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" });
      }

      const now = nowMs();
      const attachmentId = makeEvidenceId();
      const storagePath = buildCostAttachmentStoragePath({
        workOrderId,
        attachmentId,
        filename: file.originalname,
      });
      await uploadBufferToGcs({
        path: storagePath,
        contentType: String(file.mimetype || "application/octet-stream"),
        buffer: file.buffer,
        metadata: {
          workOrderId,
          uploadedAtMs: String(now),
          actorRole: isAdmin(req) ? "admin" : "landlord",
          actorId: access.userId,
          visibility: "internal",
        },
      });

      const nextAttachments = [
        ...filterCostAttachmentsForAudience((access.item as any)?.costAttachments, "landlord"),
        {
          id: attachmentId,
          storagePath,
          fileName: asString(file.originalname, 180),
          contentType: asString(file.mimetype, 120),
          uploadedAt: now,
          uploadedByRole: isAdmin(req) ? "admin" : "landlord",
          uploadedById: access.userId,
          visibility: "internal",
        },
      ];

      await db.collection("workOrders").doc(workOrderId).set(
        {
          costAttachments: nextAttachments,
          updatedAtMs: now,
        },
        { merge: true }
      );

      await writeWorkOrderUpdate({
        workOrderId,
        actorRole: isAdmin(req) ? "admin" : "landlord",
        actorId: access.userId,
        updateType: "invoice",
        message: "Uploaded a cost attachment.",
      });

      const refreshed = await db.collection("workOrders").doc(workOrderId).get();
      return res.status(201).json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
    } catch (err) {
      console.error("[work-orders] landlord cost attachment upload failed", err);
      return res.status(500).json({ ok: false, error: "WORK_ORDER_COST_ATTACHMENT_UPLOAD_FAILED" });
    }
  });
});

router.post("/landlord/work-orders/:id/evidence", requireAuth, async (req: any, res) => {
  evidenceUpload.single("file")(req, res, async (uploadErr: any) => {
    try {
      if (uploadErr) {
        const message = String(uploadErr?.message || "");
        if (String(uploadErr?.code || "") === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ ok: false, error: "FILE_TOO_LARGE", maxBytes: MAX_EVIDENCE_BYTES });
        }
        return res.status(400).json({ ok: false, error: "UPLOAD_FAILED", detail: message || "upload_failed" });
      }

      if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

      const workOrderId = asString(req.params?.id, 120);
      const access = await getWorkOrderAuthorized(req, workOrderId);
      if (!access.ok) {
        if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }

      const file = req.file as Express.Multer.File | undefined;
      if (!file?.buffer || !file.originalname) {
        return res.status(400).json({ ok: false, error: "FILE_REQUIRED" });
      }
      if (!isAllowedEvidenceFile(file)) {
        return res.status(400).json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" });
      }

      const evidenceType = normalizeEvidenceType(req.body?.evidenceType);
      const visibility = normalizeEvidenceVisibility(req.body?.visibility);
      if (!evidenceType) return res.status(400).json({ ok: false, error: "INVALID_EVIDENCE_TYPE" });
      if (!visibility) return res.status(400).json({ ok: false, error: "INVALID_VISIBILITY" });

      const now = nowMs();
      const evidenceId = makeEvidenceId();
      const storagePath = buildEvidenceStoragePath({
        workOrderId,
        evidenceId,
        filename: file.originalname,
      });
      await uploadBufferToGcs({
        path: storagePath,
        contentType: String(file.mimetype || "application/octet-stream"),
        buffer: file.buffer,
        metadata: {
          workOrderId,
          evidenceType,
          visibility,
          uploadedAtMs: String(now),
          actorRole: isAdmin(req) ? "admin" : "landlord",
          actorId: access.userId,
        },
      });

      const evidenceItem: WorkOrderEvidenceItem = {
        id: evidenceId,
        storagePath,
        filename: asString(file.originalname, 180),
        contentType: asString(file.mimetype, 120),
        uploadedAt: now,
        uploadedByActorRole: isAdmin(req) ? "admin" : "landlord",
        uploadedByActorId: access.userId,
        evidenceType,
        caption: asOptionalString(req.body?.caption, 500),
        visibility,
      };

      const nextEvidence = [...(Array.isArray((access.item as any)?.evidence) ? (access.item as any).evidence : []), evidenceItem];
      await db.collection("workOrders").doc(workOrderId).set(
        {
          evidence: nextEvidence,
          updatedAtMs: now,
          lastExecutionUpdateAt: now,
        },
        { merge: true }
      );

      await writeWorkOrderUpdate({
        workOrderId,
        actorRole: isAdmin(req) ? "admin" : "landlord",
        actorId: access.userId,
        updateType: "photo",
        message: buildEvidenceUploadMessage(evidenceItem),
      });

      const refreshed = await db.collection("workOrders").doc(workOrderId).get();
      return res.status(201).json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
    } catch (err) {
      console.error("[work-orders] landlord evidence upload failed", err);
      return res.status(500).json({ ok: false, error: "WORK_ORDER_EVIDENCE_UPLOAD_FAILED" });
    }
  });
});

router.patch("/landlord/work-orders/:id/evidence/:evidenceId", requireAuth, async (req: any, res) => {
  try {
    if (!isLandlord(req)) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const workOrderId = asString(req.params?.id, 120);
    const evidenceId = asString(req.params?.evidenceId, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    if (!evidenceId) return res.status(404).json({ ok: false, error: "EVIDENCE_NOT_FOUND" });

    const nextVisibility =
      req.body?.visibility === undefined ? undefined : normalizeEvidenceVisibility(req.body?.visibility);
    const nextEvidenceType =
      req.body?.evidenceType === undefined ? undefined : normalizeEvidenceType(req.body?.evidenceType);
    if (req.body?.visibility !== undefined && !nextVisibility) {
      return res.status(400).json({ ok: false, error: "INVALID_VISIBILITY" });
    }
    if (req.body?.evidenceType !== undefined && !nextEvidenceType) {
      return res.status(400).json({ ok: false, error: "INVALID_EVIDENCE_TYPE" });
    }

    const currentEvidence = Array.isArray((access.item as any)?.evidence) ? ((access.item as any).evidence as any[]) : [];
    if (!currentEvidence.some((entry) => asString(entry?.id, 120) === evidenceId)) {
      return res.status(404).json({ ok: false, error: "EVIDENCE_NOT_FOUND" });
    }

    const nextEvidence = replaceEvidenceItem(currentEvidence, evidenceId, (entry) => ({
      ...entry,
      caption: req.body?.caption !== undefined ? asOptionalString(req.body?.caption, 500) : entry.caption || null,
      visibility: nextVisibility || entry.visibility,
      evidenceType: nextEvidenceType || entry.evidenceType,
    }));

    await db.collection("workOrders").doc(workOrderId).set(
      {
        evidence: nextEvidence,
        updatedAtMs: nowMs(),
      },
      { merge: true }
    );

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: isAdmin(req) ? "admin" : "landlord",
      actorId: access.userId,
      updateType: "photo",
      message: "Evidence metadata updated",
    });

    const refreshed = await db.collection("workOrders").doc(workOrderId).get();
    return res.json({ ok: true, item: await toWorkOrderResponseForAudience(refreshed.id, refreshed.data(), "landlord") });
  } catch (err) {
    console.error("[work-orders] evidence update failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_EVIDENCE_UPDATE_FAILED" });
  }
});

router.get("/work-orders/:id/updates", requireAuth, async (req: any, res) => {
  try {
    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const snap = await db
      .collection("workOrderUpdates")
      .where("workOrderId", "==", workOrderId)
      .limit(500)
      .get();

    const items = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0));

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[work-orders] updates list failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_UPDATES_LIST_FAILED" });
  }
});

router.post("/work-orders/:id/updates", requireAuth, async (req: any, res) => {
  try {
    const workOrderId = asString(req.params?.id, 120);
    const access = await getWorkOrderAuthorized(req, workOrderId);
    if (!access.ok) {
      if (access.code === "NOT_FOUND") return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const updateTypeRaw = asString(req.body?.updateType, 40).toLowerCase();
    const updateType = [
      "created",
      "invited",
      "accepted",
      "declined",
      "status_changed",
      "note",
      "photo",
      "invoice",
      "completed",
    ].includes(updateTypeRaw)
      ? (updateTypeRaw as
          | "created"
          | "invited"
          | "accepted"
          | "declined"
          | "status_changed"
          | "note"
          | "photo"
          | "invoice"
          | "completed")
      : "note";

    await writeWorkOrderUpdate({
      workOrderId,
      actorRole: access.role === "admin" ? "admin" : access.role === "contractor" ? "contractor" : "landlord",
      actorId: access.userId,
      updateType,
      message: asString(req.body?.message, 5000),
      attachmentUrl: asOptionalString(req.body?.attachmentUrl, 2000),
    });

    await db.collection("workOrders").doc(workOrderId).set({ updatedAtMs: nowMs() }, { merge: true });

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("[work-orders] updates create failed", err);
    return res.status(500).json({ ok: false, error: "WORK_ORDER_UPDATES_CREATE_FAILED" });
  }
});

export default router;
