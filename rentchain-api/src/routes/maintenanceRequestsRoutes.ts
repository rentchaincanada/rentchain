import { Router } from "express";
import multer from "multer";
import { db, FieldValue } from "../config/firebase";
import { authenticateJwt } from "../middleware/authMiddleware";
import { verifyAuthToken } from "../auth/jwt";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";
import { uploadBufferToGcs } from "../lib/gcs";
import {
  buildEvidenceStoragePath,
  makeEvidenceId,
  normalizeEvidenceType,
  serializeEvidenceForAudience,
  type WorkOrderEvidenceItem,
} from "../lib/workOrderEvidence";

const router = Router();

const ALLOWED_STATUS = [
  "NEW",
  "IN_PROGRESS",
  "WAITING_ON_TENANT",
  "SCHEDULED",
  "RESOLVED",
  "CLOSED",
];

const NOTIFY_STATUS = [
  "IN_PROGRESS",
  "WAITING_ON_TENANT",
  "SCHEDULED",
  "RESOLVED",
  "CLOSED",
];

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WORKFLOW_STATUSES = [
  "submitted",
  "reviewed",
  "assigned",
  "scheduled",
  "blocked",
  "in_progress",
  "completed",
  "cancelled",
] as const;
const SCREENING_REQUEST_STATUSES = [
  "requested",
  "consent_pending",
  "consented",
  "in_progress",
  "completed",
  "inconclusive",
  "failed",
  "manual_review_required",
] as const;
const SCREENING_AUDIT_EVENTS = [
  "screening_requested",
  "consent_viewed",
  "consent_accepted",
  "screening_started",
  "provider_session_created",
  "retry_requested",
  "manual_review_selected",
  "screening_completed",
  "result_viewed",
] as const;
const WORKFLOW_TRANSITIONS: Record<(typeof WORKFLOW_STATUSES)[number], Array<(typeof WORKFLOW_STATUSES)[number]>> = {
  submitted: ["reviewed", "assigned", "cancelled"],
  reviewed: ["assigned", "completed", "cancelled"],
  assigned: ["scheduled", "completed", "cancelled"],
  scheduled: ["in_progress", "blocked", "completed", "cancelled"],
  blocked: ["scheduled", "in_progress", "completed", "cancelled"],
  in_progress: ["blocked", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const LEGACY_TO_WORKFLOW_STATUS: Record<string, (typeof WORKFLOW_STATUSES)[number]> = {
  NEW: "submitted",
  IN_PROGRESS: "in_progress",
  WAITING_ON_TENANT: "reviewed",
  SCHEDULED: "scheduled",
  RESOLVED: "completed",
  CLOSED: "completed",
};
const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EVIDENCE_BYTES },
});
const ALLOWED_EVIDENCE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

router.use(authenticateJwt);

function roleOf(req: any): string {
  return String(req.user?.actorRole || req.user?.role || "").trim().toLowerCase();
}

function landlordIdOf(req: any): string | null {
  return String(req.user?.landlordId || req.user?.id || "").trim() || null;
}

function contractorIdOf(req: any): string | null {
  return String(req.user?.contractorId || req.user?.id || "").trim() || null;
}

function getBearerToken(req: any): string | null {
  const raw = req?.headers?.authorization || req?.headers?.Authorization;
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

function fingerprint(value: string | null | undefined): string {
  const token = String(value || "").trim();
  if (!token) return "none";
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

async function resolveContractorAccess(req: any): Promise<{
  role: string;
  contractorId: string | null;
  directRole: string;
  directContractorId: string | null;
  jwtSub: string | null;
  jwtRole: string | null;
  jwtEmail: string | null;
  persistedUserRole: string | null;
  persistedAccountRole: string | null;
  source: string;
}> {
  const directRole = roleOf(req);
  const directContractorId = contractorIdOf(req);
  const rawToken = getBearerToken(req);
  let jwtSub: string | null = null;
  let jwtRole: string | null = null;
  let jwtEmail: string | null = null;

  try {
    if (rawToken) {
      const claims = verifyAuthToken(rawToken) as any;
      jwtSub = String(claims?.sub || "").trim() || null;
      jwtRole = String(claims?.role || "").trim().toLowerCase() || null;
      jwtEmail = String(claims?.email || "").trim().toLowerCase() || null;
    }
  } catch {
    // auth middleware already handles invalid bearer tokens
  }

  if (directRole === "contractor" || directRole === "admin") {
    return {
      role: directRole,
      contractorId: directContractorId,
      directRole,
      directContractorId,
      jwtSub,
      jwtRole,
      jwtEmail,
      persistedUserRole: null,
      persistedAccountRole: null,
      source: "direct_request_user",
    };
  }

  const userId = String(req.user?.id || jwtSub || "").trim();
  let userData: any = null;
  let accountData: any = null;

  if (userId) {
    const [userSnap, accountSnap] = await Promise.all([
      db.collection("users").doc(userId).get(),
      db.collection("accounts").doc(userId).get(),
    ]);
    userData = userSnap.exists ? (userSnap.data() as any) : null;
    accountData = accountSnap.exists ? (accountSnap.data() as any) : null;
  }

  let persistedUserRole = String(userData?.actorRole || userData?.role || "").trim().toLowerCase() || null;
  let persistedAccountRole = String(accountData?.actorRole || accountData?.role || "").trim().toLowerCase() || null;
  let resolvedRole = persistedUserRole || persistedAccountRole || directRole || jwtRole || "";
  let resolvedContractorId =
    String(userData?.contractorId || accountData?.contractorId || directContractorId || userId || "").trim() || null;
  let source = userId ? "persisted_by_user_id" : "no_identity";

  if (resolvedRole !== "contractor" && resolvedRole !== "admin") {
    const lookupEmail = String(req.user?.email || jwtEmail || "").trim().toLowerCase();
    if (lookupEmail) {
      const [userByEmailSnap, accountByEmailSnap, contractorProfileSnap] = await Promise.all([
        db.collection("users").where("email", "==", lookupEmail).limit(1).get(),
        db.collection("accounts").where("email", "==", lookupEmail).limit(1).get(),
        db.collection("contractorProfiles").where("email", "==", lookupEmail).limit(1).get(),
      ]);
      const userByEmail = !userByEmailSnap.empty ? (userByEmailSnap.docs[0].data() as any) : null;
      const accountByEmail = !accountByEmailSnap.empty ? (accountByEmailSnap.docs[0].data() as any) : null;
      const contractorProfile = !contractorProfileSnap.empty ? (contractorProfileSnap.docs[0].data() as any) : null;
      const emailUserRole = String(userByEmail?.actorRole || userByEmail?.role || "").trim().toLowerCase();
      const emailAccountRole = String(accountByEmail?.actorRole || accountByEmail?.role || "").trim().toLowerCase();
      const emailResolvedRole = emailUserRole || emailAccountRole || (contractorProfile ? "contractor" : "");
      const emailResolvedContractorId =
        String(
          userByEmail?.contractorId ||
            accountByEmail?.contractorId ||
            contractorProfile?.userId ||
            contractorProfileSnap.docs[0]?.id ||
            ""
        ).trim() || null;
      if (emailResolvedRole === "contractor" || emailResolvedRole === "admin") {
        resolvedRole = emailResolvedRole;
        resolvedContractorId = emailResolvedContractorId || resolvedContractorId;
        persistedUserRole = persistedUserRole || emailUserRole || null;
        persistedAccountRole = persistedAccountRole || emailAccountRole || null;
        source = "persisted_by_email";
      }
    }
  }

  return {
    role: resolvedRole,
    contractorId: resolvedContractorId,
    directRole,
    directContractorId,
    jwtSub,
    jwtRole,
    jwtEmail,
    persistedUserRole,
    persistedAccountRole,
    source,
  };
}

function logContractorAccess(event: string, access: Awaited<ReturnType<typeof resolveContractorAccess>>, extra?: Record<string, unknown>) {
  console.info(`[maintenance-v2] contractor-access:${event}`, {
    directRole: access.directRole || null,
    directContractorId: access.directContractorId || null,
    jwtSub: access.jwtSub || null,
    jwtRole: access.jwtRole || null,
    jwtEmail: access.jwtEmail || null,
    persistedUserRole: access.persistedUserRole || null,
    persistedAccountRole: access.persistedAccountRole || null,
    resolvedRole: access.role || null,
    resolvedContractorId: access.contractorId || null,
    source: access.source,
    ...extra,
  });
}

function normalizeWorkflowStatus(raw: any): (typeof WORKFLOW_STATUSES)[number] | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  const lower = value.toLowerCase();
  if ((WORKFLOW_STATUSES as readonly string[]).includes(lower)) {
    return lower as (typeof WORKFLOW_STATUSES)[number];
  }
  const upper = value.toUpperCase();
  return LEGACY_TO_WORKFLOW_STATUS[upper] ?? null;
}

function normalizeScreeningRequestStatus(raw: any): (typeof SCREENING_REQUEST_STATUSES)[number] {
  const value = String(raw || "").trim().toLowerCase();
  if ((SCREENING_REQUEST_STATUSES as readonly string[]).includes(value)) {
    return value as (typeof SCREENING_REQUEST_STATUSES)[number];
  }
  return "requested";
}

function makeScreeningId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function cleanString(value: any, max = 200): string | null {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, max);
}

function isAllowedEvidenceFile(file: Express.Multer.File | undefined) {
  if (!file?.buffer || !file.originalname) return false;
  return ALLOWED_EVIDENCE_MIME_TYPES.has(String(file.mimetype || "").toLowerCase());
}

function normalizeOptionalBoolean(value: any): boolean | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function toMillis(value: any): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function normalizeScreeningList(value: any, maxItems = 8, maxLength = 80): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function makeDeterministicDocId(parts: Array<string | null | undefined>): string {
  const normalized = parts
    .map((part) => String(part || "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_"))
    .filter(Boolean)
    .join("_")
    .slice(0, 220);
  return normalized || makeScreeningId("screening_audit");
}

function screeningConfigSnapshot() {
  const defaultProvider = cleanString(process.env.SCREENING_DEFAULT_PROVIDER, 80) || "manual";
  const providerPriority = String(process.env.SCREENING_PROVIDER_PRIORITY || "transunion_redirect,equifax,manual")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    enabled: String(process.env.SCREENING_ENABLED || "true").toLowerCase() !== "false",
    defaultProvider,
    providerPriority,
    providers: {
      transunion_redirect: String(process.env.SCREENING_TRANSUNION_ENABLED || "false").toLowerCase() === "true",
      equifax: String(process.env.SCREENING_EQUIFAX_ENABLED || "false").toLowerCase() === "true",
      manual: String(process.env.SCREENING_MANUAL_ENABLED || "true").toLowerCase() !== "false",
    },
  };
}

async function writeScreeningAuditEvent(input: {
  requestId: string;
  eventType: (typeof SCREENING_AUDIT_EVENTS)[number];
  actorRole: string;
  actorId: string | null;
  landlordId?: string | null;
  tenantId?: string | null;
  sessionId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const auditId = input.idempotencyKey
    ? makeDeterministicDocId([input.requestId, input.eventType, input.idempotencyKey])
    : makeScreeningId("screening_audit");
  const ref = db.collection("screening_audit_log").doc(auditId);
  const now = Date.now();
  await ref.set({
    id: auditId,
    requestId: input.requestId,
    eventType: input.eventType,
    actorRole: cleanString(input.actorRole, 80) || "system",
    actorId: input.actorId || null,
    landlordId: input.landlordId || null,
    tenantId: input.tenantId || null,
    sessionId: input.sessionId || null,
    idempotencyKey: input.idempotencyKey || null,
    metadata: {
      requestId: input.requestId,
      eventType: input.eventType,
      actorRole: cleanString(input.actorRole, 80) || "system",
      actorId: input.actorId || null,
      landlordId: input.landlordId || null,
      tenantId: input.tenantId || null,
      sessionId: input.sessionId || null,
      ...(input.metadata || {}),
    },
    createdAt: now,
    updatedAt: now,
    createdAtServer: FieldValue.serverTimestamp(),
  });
}

async function resolveTenantIdByEmail(email: string | null): Promise<string | null> {
  const safeEmail = String(email || "").trim().toLowerCase();
  if (!safeEmail) return null;
  const snap = await db.collection("tenants").where("email", "==", safeEmail).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

function ensureStatusHistory(item: any) {
  const history = Array.isArray(item?.statusHistory) ? item.statusHistory : [];
  return history;
}

function canTransitionWorkflowStatus(
  currentStatus: (typeof WORKFLOW_STATUSES)[number],
  nextStatus: (typeof WORKFLOW_STATUSES)[number]
) {
  if (currentStatus === nextStatus) return true;
  return WORKFLOW_TRANSITIONS[currentStatus]?.includes(nextStatus) || false;
}

function formatTenantName(tenant: any, fallback?: string | null) {
  const direct = String(tenant?.name || "").trim();
  if (direct) return direct;
  const combined = [tenant?.firstName, tenant?.lastName]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");
  if (combined) return combined;
  return String(fallback || "").trim() || null;
}

async function appendStatusHistory(
  requestId: string,
  payload: {
    status: string;
    actorRole: "tenant" | "landlord" | "contractor" | "admin";
    actorId: string | null;
    message?: string;
  }
) {
  await db
    .collection("maintenanceRequests")
    .doc(requestId)
    .set(
      {
        statusHistory: FieldValue.arrayUnion({
          status: payload.status,
          actorRole: payload.actorRole,
          actorId: payload.actorId || null,
          message: String(payload.message || "").trim().slice(0, 500),
          createdAt: Date.now(),
        }),
      },
      { merge: true }
    );
}

type WorkOrderExecutionUpdateType =
  | "status_changed"
  | "scheduled"
  | "started"
  | "blocked"
  | "photo"
  | "completed"
  | "confirmed"
  | "reopened";

type WorkOrderCompletionOutcome = "completed" | "partially_completed" | "follow_up_required";

function normalizeCompletionOutcome(value: any): WorkOrderCompletionOutcome | null {
  const next = String(value || "").trim().toLowerCase();
  if (next === "completed" || next === "partially_completed" || next === "follow_up_required") {
    return next;
  }
  return null;
}

async function appendWorkOrderUpdate(
  workOrderId: string,
  payload: {
    actorRole: "tenant" | "landlord" | "contractor" | "admin";
    actorId: string | null;
    updateType: WorkOrderExecutionUpdateType;
    message?: string | null;
  }
) {
  if (!workOrderId) return;
  const ref = db.collection("workOrderUpdates").doc();
  const createdAtMs = Date.now();
  await ref.set({
    id: ref.id,
    workOrderId,
    actorRole: payload.actorRole,
    actorId: payload.actorId || null,
    updateType: payload.updateType,
    message: String(payload.message || "").trim().slice(0, 5000),
    attachmentUrl: null,
    createdAtMs,
  });
}

async function lookupEmailFromDoc(docPath: [string, string][]): Promise<string | null> {
  for (const [collection, id] of docPath) {
    if (!id) continue;
    try {
      const snap = await db.collection(collection).doc(id).get();
      if (!snap.exists) continue;
      const email = String((snap.data() as any)?.email || "").trim();
      if (email && emailRegex.test(email)) return email;
    } catch {
      // ignore lookup failures
    }
  }
  return null;
}

async function sendMaintenanceStatusEmail(params: {
  to: string | null;
  subject: string;
  intro: string;
  requestId: string;
  workOrderId?: string | null;
  event: string;
}) {
  const to = String(params.to || "").trim();
  const provider = String(process.env.EMAIL_PROVIDER || "mailgun").trim().toLowerCase() || "mailgun";
  const from =
    process.env.EMAIL_FROM ||
    process.env.FROM_EMAIL ||
    process.env.SENDGRID_FROM_EMAIL ||
    process.env.SENDGRID_FROM;
  const replyTo = process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_REPLYTO_EMAIL;
  if (!to || !emailRegex.test(to)) {
    console.warn("[maintenance-v2] notification skipped", {
      event: params.event,
      maintenanceRequestId: params.requestId,
      workOrderId: params.workOrderId || null,
      to: to || null,
      provider,
      reason: "INVALID_RECIPIENT",
    });
    return { ok: false, attempted: false, provider, to, reason: "INVALID_RECIPIENT" } as const;
  }
  if (!from) {
    console.error("[maintenance-v2] notification failed", {
      event: params.event,
      maintenanceRequestId: params.requestId,
      workOrderId: params.workOrderId || null,
      to,
      provider,
      reason: "EMAIL_FROM_MISSING",
    });
    return { ok: false, attempted: false, provider, to, reason: "EMAIL_FROM_MISSING" } as const;
  }
  const baseUrl =
    (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
  const requestLink = `${baseUrl}/tenant/maintenance/${params.requestId}`;
  console.info("[maintenance-v2] notification attempt", {
    event: params.event,
    maintenanceRequestId: params.requestId,
    workOrderId: params.workOrderId || null,
    to,
    provider,
  });
  try {
    await sendEmail({
      to,
      from,
      replyTo: replyTo || from,
      subject: params.subject,
      text: buildEmailText({
        intro: params.intro,
        ctaText: "View request",
        ctaUrl: requestLink,
      }),
      html: buildEmailHtml({
        title: "Maintenance request update",
        intro: params.intro,
        ctaText: "View request",
        ctaUrl: requestLink,
      }),
    });
    console.info("[maintenance-v2] notification sent", {
      event: params.event,
      maintenanceRequestId: params.requestId,
      workOrderId: params.workOrderId || null,
      to,
      provider,
      ok: true,
    });
    return { ok: true, attempted: true, provider, to } as const;
  } catch (err: any) {
    console.error("[maintenance-v2] notification failed", {
      event: params.event,
      to,
      maintenanceRequestId: params.requestId,
      workOrderId: params.workOrderId || null,
      provider,
      message: err?.message || "send_failed",
    });
    return { ok: false, attempted: true, provider, to, reason: err?.message || "send_failed" } as const;
  }
}

async function upsertMaintenanceWorkOrder(input: {
  maintenanceRequestId: string;
  landlordId: string | null;
  propertyId: string | null;
  unitId: string | null;
  tenantId: string | null;
  assignedContractorId: string | null;
  assignedContractorName: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  priority: string | null;
  status: string | null;
  serviceWindowStartAt?: number | null;
  serviceWindowEndAt?: number | null;
  accessRequired?: boolean | null;
  scheduledFor?: number | null;
  serviceStartedAt?: number | null;
  serviceCompletedAt?: number | null;
  lastExecutionUpdateAt?: number | null;
  executionBlockedReason?: string | null;
  completionSummary?: string | null;
  completionOutcome?: WorkOrderCompletionOutcome | null;
  completedByActorRole?: "contractor" | "landlord" | "admin" | null;
  completedByActorId?: string | null;
  completionConfirmedByLandlordAt?: number | null;
  completionConfirmedByLandlordBy?: string | null;
  reopenedAt?: number | null;
  reopenedByActorId?: string | null;
  reopenedByActorRole?: "landlord" | "admin" | null;
  reopenReason?: string | null;
}) {
  const workOrderId = `maintenance_${input.maintenanceRequestId}`;
  const ref = db.collection("workOrders").doc(workOrderId);
  const existing = await ref.get();
  const existingData = existing.exists ? ((existing.data() as any) || {}) : {};
  const createdAtMs = Number(existingData.createdAtMs || existingData.createdAt || Date.now()) || Date.now();
  const now = Date.now();
  const payload = {
    id: workOrderId,
    maintenanceRequestId: input.maintenanceRequestId,
    landlordId: input.landlordId || null,
    propertyId: input.propertyId || null,
    unitId: input.unitId || null,
    tenantId: input.tenantId || null,
    assignedContractorId: input.assignedContractorId || null,
    assignedContractorName: input.assignedContractorName || null,
    title: String(input.title || "").trim() || "Maintenance request",
    description: String(input.description || "").trim() || "",
    category: String(input.category || "").trim() || "GENERAL",
    priority: String(input.priority || "").trim() || "normal",
    status: String(input.status || "assigned").trim() || "assigned",
    serviceWindowStartAt:
      input.serviceWindowStartAt !== undefined
        ? typeof input.serviceWindowStartAt === "number"
          ? input.serviceWindowStartAt
          : null
        : toMillis(existingData.serviceWindowStartAt),
    serviceWindowEndAt:
      input.serviceWindowEndAt !== undefined
        ? typeof input.serviceWindowEndAt === "number"
          ? input.serviceWindowEndAt
          : null
        : toMillis(existingData.serviceWindowEndAt),
    accessRequired:
      input.accessRequired !== undefined
        ? typeof input.accessRequired === "boolean"
          ? input.accessRequired
          : null
        : typeof existingData.accessRequired === "boolean"
        ? existingData.accessRequired
        : null,
    scheduledFor:
      input.scheduledFor !== undefined
        ? typeof input.scheduledFor === "number"
          ? input.scheduledFor
          : null
        : toMillis(existingData.scheduledFor),
    serviceStartedAt:
      input.serviceStartedAt !== undefined
        ? typeof input.serviceStartedAt === "number"
          ? input.serviceStartedAt
          : null
        : toMillis(existingData.serviceStartedAt),
    serviceCompletedAt:
      input.serviceCompletedAt !== undefined
        ? typeof input.serviceCompletedAt === "number"
          ? input.serviceCompletedAt
          : null
        : toMillis(existingData.serviceCompletedAt),
    lastExecutionUpdateAt:
      input.lastExecutionUpdateAt !== undefined
        ? typeof input.lastExecutionUpdateAt === "number"
          ? input.lastExecutionUpdateAt
          : null
        : toMillis(existingData.lastExecutionUpdateAt),
    executionBlockedReason:
      input.executionBlockedReason !== undefined
        ? String(input.executionBlockedReason || "").trim() || null
        : String(existingData.executionBlockedReason || "").trim() || null,
    completionSummary:
      input.completionSummary !== undefined
        ? String(input.completionSummary || "").trim() || null
        : String(existingData.completionSummary || "").trim() || null,
    completionOutcome:
      input.completionOutcome !== undefined
        ? input.completionOutcome || null
        : normalizeCompletionOutcome(existingData.completionOutcome),
    completedByActorRole:
      input.completedByActorRole !== undefined
        ? input.completedByActorRole || null
        : String(existingData.completedByActorRole || "").trim() || null,
    completedByActorId:
      input.completedByActorId !== undefined
        ? String(input.completedByActorId || "").trim() || null
        : String(existingData.completedByActorId || "").trim() || null,
    completionConfirmedByLandlordAt:
      input.completionConfirmedByLandlordAt !== undefined
        ? typeof input.completionConfirmedByLandlordAt === "number"
          ? input.completionConfirmedByLandlordAt
          : null
        : toMillis(existingData.completionConfirmedByLandlordAt),
    completionConfirmedByLandlordBy:
      input.completionConfirmedByLandlordBy !== undefined
        ? String(input.completionConfirmedByLandlordBy || "").trim() || null
        : String(existingData.completionConfirmedByLandlordBy || "").trim() || null,
    reopenedAt:
      input.reopenedAt !== undefined
        ? typeof input.reopenedAt === "number"
          ? input.reopenedAt
          : null
        : toMillis(existingData.reopenedAt),
    reopenedByActorId:
      input.reopenedByActorId !== undefined
        ? String(input.reopenedByActorId || "").trim() || null
        : String(existingData.reopenedByActorId || "").trim() || null,
    reopenedByActorRole:
      input.reopenedByActorRole !== undefined
        ? input.reopenedByActorRole || null
        : String(existingData.reopenedByActorRole || "").trim() || null,
    reopenReason:
      input.reopenReason !== undefined
        ? String(input.reopenReason || "").trim() || null
        : String(existingData.reopenReason || "").trim() || null,
    visibility: "private",
    createdAt: createdAtMs,
    updatedAt: now,
    createdAtMs,
    updatedAtMs: now,
  };
  await ref.set(payload, { merge: true });
  console.info("[maintenance-v2] work-order upserted", {
    maintenanceRequestId: input.maintenanceRequestId,
    workOrderId,
    assignedContractorId: input.assignedContractorId || null,
    status: payload.status,
    created: !existing.exists,
  });
  return { workOrderId, payload };
}

async function shapeContractorJobFromSources(workOrder: any, maintenance: any) {
  const maintenanceId =
    String(workOrder?.maintenanceRequestId || maintenance?.id || "").trim() || String(workOrder?.id || "").trim();
  const status = normalizeWorkflowStatus(workOrder?.status || maintenance?.status) || "assigned";
  return {
    ...(maintenance || {}),
    ...(workOrder || {}),
    id: maintenanceId,
    workOrderId: String(workOrder?.id || "").trim() || null,
    maintenanceRequestId: maintenanceId,
    landlordId: String(workOrder?.landlordId || maintenance?.landlordId || "").trim() || null,
    tenantId: String(workOrder?.tenantId || maintenance?.tenantId || "").trim() || null,
    propertyId: String(workOrder?.propertyId || maintenance?.propertyId || "").trim() || null,
    unitId: String(workOrder?.unitId || maintenance?.unitId || "").trim() || null,
    assignedContractorId:
      String(workOrder?.assignedContractorId || maintenance?.assignedContractorId || "").trim() || null,
    assignedContractorName:
      String(workOrder?.assignedContractorName || maintenance?.assignedContractorName || "").trim() || null,
    title: String(workOrder?.title || maintenance?.title || "").trim() || "Maintenance request",
    description: String(workOrder?.description || maintenance?.description || "").trim() || "",
    category: String(workOrder?.category || maintenance?.category || "").trim() || "GENERAL",
    priority: String(workOrder?.priority || maintenance?.priority || "").trim() || "normal",
    status,
    contractorStatus:
      String(maintenance?.contractorStatus || workOrder?.contractorStatus || status).trim() || status,
    contractorLastUpdate:
      String(maintenance?.contractorLastUpdate || workOrder?.contractorLastUpdate || "").trim() || null,
    scheduledFor: toMillis(workOrder?.scheduledFor) ?? null,
    serviceStartedAt: toMillis(workOrder?.serviceStartedAt) ?? null,
    serviceCompletedAt: toMillis(workOrder?.serviceCompletedAt) ?? null,
    lastExecutionUpdateAt: toMillis(workOrder?.lastExecutionUpdateAt) ?? null,
    executionBlockedReason: String(workOrder?.executionBlockedReason || "").trim() || null,
    completionSummary: String(workOrder?.completionSummary || "").trim() || null,
    completionOutcome: normalizeCompletionOutcome(workOrder?.completionOutcome),
    completionConfirmedByLandlordAt: toMillis(workOrder?.completionConfirmedByLandlordAt) ?? null,
    completionConfirmedByLandlordBy: String(workOrder?.completionConfirmedByLandlordBy || "").trim() || null,
    completedByActorRole: String(workOrder?.completedByActorRole || "").trim() || null,
    completedByActorId: String(workOrder?.completedByActorId || "").trim() || null,
    reopenedAt: toMillis(workOrder?.reopenedAt) ?? null,
    reopenedByActorId: String(workOrder?.reopenedByActorId || "").trim() || null,
    reopenedByActorRole: String(workOrder?.reopenedByActorRole || "").trim() || null,
    reopenReason: String(workOrder?.reopenReason || "").trim() || null,
    serviceWindowStartAt:
      toMillis(maintenance?.serviceWindowStartAt) ?? toMillis(workOrder?.serviceWindowStartAt) ?? null,
    serviceWindowEndAt:
      toMillis(maintenance?.serviceWindowEndAt) ?? toMillis(workOrder?.serviceWindowEndAt) ?? null,
    accessRequired:
      typeof maintenance?.accessRequired === "boolean"
        ? maintenance.accessRequired
        : typeof workOrder?.accessRequired === "boolean"
        ? workOrder.accessRequired
        : null,
    tenantName: String(maintenance?.tenantName || "").trim() || null,
    propertyLabel: String(maintenance?.propertyLabel || "").trim() || null,
    unitLabel: String(maintenance?.unitLabel || "").trim() || null,
    notes: String(maintenance?.notes || "").trim() || null,
    landlordNote: String(maintenance?.landlordNote || "").trim() || null,
    createdAt:
      Number(maintenance?.createdAt || workOrder?.createdAt || workOrder?.createdAtMs || Date.now()) || Date.now(),
    updatedAt:
      Number(maintenance?.updatedAt || workOrder?.updatedAt || workOrder?.updatedAtMs || Date.now()) || Date.now(),
    statusHistory: Array.isArray(maintenance?.statusHistory) ? maintenance.statusHistory : [],
    evidence: await serializeEvidenceForAudience(workOrder?.evidence, "contractor"),
  };
}

router.get("/maintenance-requests", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const { tenantId, status } = req.query || {};
    let query: FirebaseFirestore.Query = db
      .collection("maintenanceRequests")
      .where("landlordId", "==", landlordId)
      .limit(100);

    if (tenantId) {
      query = query.where("tenantId", "==", String(tenantId));
    }
    if (status && typeof status === "string") {
      query = query.where("status", "==", status.toUpperCase());
    }

    const snap = await query.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    items.sort((a, b) => (Number(b.updatedAt || 0) || 0) - (Number(a.updatedAt || 0) || 0));
    return res.json({ ok: true, data: items });
  } catch (err) {
    console.error("[maintenance-requests] list failed", { err });
    return res.status(500).json({ ok: false, error: "MAINT_REQUEST_LIST_FAILED" });
  }
});

router.patch("/maintenance-requests/:id", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = req.user?.landlordId || req.user?.id || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const id = String(req.params?.id || "").trim();
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const docRef = db.collection("maintenanceRequests").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const data = snap.data() as any;
    if (data?.landlordId && data.landlordId !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const updates: any = {};
    if (req.body?.status) {
      const st = String(req.body.status || "").toUpperCase();
      if (ALLOWED_STATUS.includes(st)) {
        updates.status = st;
      }
    }
    if (req.body?.landlordNote !== undefined) {
      const note = req.body.landlordNote;
      updates.landlordNote = note === null ? null : String(note || "").trim().slice(0, 5000);
    }
    updates.updatedAt = Date.now();
    updates.lastUpdatedBy = "LANDLORD";

    const previousStatus = String(data?.status || "NEW").toUpperCase();

    await docRef.update(updates);
    const refreshed = await docRef.get();
    const refreshedData = refreshed.data() as any;

    let emailed = false;
    let emailError: string | undefined;
    const nextStatus = String(refreshedData?.status || previousStatus).toUpperCase();
    const statusChanged = Boolean(updates.status) && nextStatus !== previousStatus;
    const shouldNotify = statusChanged && NOTIFY_STATUS.includes(nextStatus);

    if (shouldNotify) {
      const tenantId = refreshedData?.tenantId || data?.tenantId || null;
      if (!tenantId) {
        emailError = "MISSING_TENANT_ID";
      } else {
        let tenantEmail: string | null = null;
        try {
          const tenantSnap = await db.collection("tenants").doc(String(tenantId)).get();
          if (tenantSnap.exists) {
            const tenant = tenantSnap.data() as any;
            tenantEmail = typeof tenant?.email === "string" ? tenant.email.trim() : null;
          }
        } catch {
          // ignore lookup errors
        }

        if (!tenantEmail || !emailRegex.test(tenantEmail)) {
          emailError = "INVALID_TENANT_EMAIL";
        } else {
          const apiKey = process.env.SENDGRID_API_KEY;
          const from =
            process.env.SENDGRID_FROM_EMAIL || process.env.SENDGRID_FROM || process.env.FROM_EMAIL;
          const replyTo = process.env.SENDGRID_REPLY_TO || process.env.SENDGRID_REPLYTO_EMAIL;
          const baseUrl =
            (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(
              /\/$/,
              ""
            );
          const requestLink = `${baseUrl}/tenant/maintenance/${refreshed.id}`;
          const title = String(refreshedData?.title || "Maintenance request");
          const category = String(refreshedData?.category || "GENERAL");
          const priority = String(refreshedData?.priority || "NORMAL");
          const descriptionRaw = String(refreshedData?.description || "");
          const excerpt =
            descriptionRaw.length > 400 ? `${descriptionRaw.slice(0, 400)}...` : descriptionRaw;
          const timestamp = new Date().toISOString();

          if (!apiKey || !from) {
            emailError = "EMAIL_NOT_CONFIGURED";
          } else {
            try {
              await sendEmail({
                to: tenantEmail,
                from,
                replyTo: replyTo || from,
                subject: `Maintenance update: ${title} (${nextStatus})`,
                text: buildEmailText({
                  intro: `Your maintenance request was updated to ${nextStatus}.\nUpdated at: ${timestamp}\nCategory: ${category}\nPriority: ${priority}\n\n${excerpt}`,
                  ctaText: "View request",
                  ctaUrl: requestLink,
                }),
                html: buildEmailHtml({
                  title: "Maintenance request updated",
                  intro: `Status: ${nextStatus}. Updated at: ${timestamp}. Category: ${category}. Priority: ${priority}.`,
                  ctaText: "View request",
                  ctaUrl: requestLink,
                }),
              });
              emailed = true;
            } catch (err: any) {
              emailed = false;
              emailError = err?.message || "SEND_FAILED";
              console.error("[maintenance-requests] tenant email send failed", {
                requestId: refreshed.id,
                tenantId,
                tenantEmail,
                errMessage: err?.message,
                errStatus: err?.response?.statusCode || err?.code || null,
              });
            }
          }
        }
      }
    }

    return res.json({
      ok: true,
      data: { id: refreshed.id, ...(refreshedData as any) },
      emailed,
      emailError,
    });
  } catch (err) {
    console.error("[maintenance-requests] update failed", { id: req.params?.id, err });
    return res.status(500).json({ ok: false, error: "MAINT_REQUEST_UPDATE_FAILED" });
  }
});

// ---------------------------
// Maintenance Workflow V2 APIs
// ---------------------------

router.post("/tenant/maintenance", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "tenant") return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
    const tenantId = String(req.user?.tenantId || req.user?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const title = String(req.body?.title || "").trim().slice(0, 180);
    const description = String(req.body?.description || "").trim().slice(0, 5000);
    const category = String(req.body?.category || "GENERAL").trim().toUpperCase().slice(0, 80);
    const priorityRaw = String(req.body?.priority || "normal").trim().toLowerCase();
    const priority = ["low", "normal", "urgent"].includes(priorityRaw) ? priorityRaw : "normal";
    const notes = String(req.body?.notes || req.body?.optionalNotes || "").trim().slice(0, 2000) || null;

    if (!title || !description) {
      return res.status(400).json({ ok: false, error: "TITLE_AND_DESCRIPTION_REQUIRED" });
    }

    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const tenant = (tenantSnap.exists ? (tenantSnap.data() as any) : {}) || {};
    const landlordId = String(tenant?.landlordId || req.user?.landlordId || "").trim() || null;
    const propertyId = String(tenant?.propertyId || tenant?.property || "").trim() || null;
    const unitId = String(tenant?.unitId || tenant?.unit || "").trim() || null;
    const tenantName = formatTenantName(tenant, req.user?.name || req.user?.email || null);
    const propertyLabel = String(tenant?.propertyName || tenant?.propertyLabel || propertyId || "").trim() || null;
    const unitLabel = String(tenant?.unitLabel || unitId || "").trim() || null;
    const now = Date.now();
    const ref = db.collection("maintenanceRequests").doc();
    const data = {
      id: ref.id,
      tenantId,
      landlordId,
      propertyId,
      unitId,
      tenantName,
      propertyLabel,
      unitLabel,
      title,
      description,
      notes,
      category,
      priority,
      status: "submitted",
      assignedContractorId: null,
      contractorStatus: null,
      createdAt: now,
      updatedAt: now,
      lastUpdatedBy: "TENANT",
      photoUploadPending: Boolean(req.body?.photoUploadPending || false),
      statusHistory: [
        {
          status: "submitted",
          actorRole: "tenant",
          actorId: tenantId,
          message: "Maintenance request submitted",
          createdAt: now,
        },
      ],
      messages: [],
    };
    await ref.set(data);

    if (landlordId) {
      const landlordEmail = await lookupEmailFromDoc([
        ["users", landlordId],
        ["landlords", landlordId],
      ]);
      await sendMaintenanceStatusEmail({
        to: landlordEmail,
        subject: `New maintenance request: ${title}`,
        intro: `A tenant submitted a new maintenance request.\nCategory: ${category}\nPriority: ${priority}\nStatus: submitted`,
        requestId: ref.id,
        event: "tenant_maintenance_created_notify_landlord",
      });
    }

    return res.status(201).json({ ok: true, requestId: ref.id, status: "submitted", data });
  } catch (err: any) {
    console.error("[maintenance-v2] tenant create failed", {
      tenantId: req.user?.tenantId || null,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINTENANCE_CREATE_FAILED" });
  }
});

router.get("/tenant/maintenance", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "tenant") return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
    const tenantId = String(req.user?.tenantId || req.user?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const snap = await db
      .collection("maintenanceRequests")
      .where("tenantId", "==", tenantId)
      .limit(200)
      .get();
    const items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    items.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    return res.json({ ok: true, items, data: items });
  } catch (err: any) {
    console.error("[maintenance-v2] tenant list failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "TENANT_MAINTENANCE_LIST_FAILED" });
  }
});

router.get("/tenant/maintenance/:id", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "tenant") return res.status(403).json({ ok: false, error: "TENANT_ONLY" });
    const tenantId = String(req.user?.tenantId || req.user?.id || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const snap = await db.collection("maintenanceRequests").doc(id).get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const item = { id: snap.id, ...(snap.data() as any) };
    if (String(item.tenantId || "") !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    return res.json({ ok: true, item, data: item });
  } catch (err: any) {
    console.error("[maintenance-v2] tenant get failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "TENANT_MAINTENANCE_GET_FAILED" });
  }
});

router.get("/landlord/maintenance", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = landlordIdOf(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const statusFilter = normalizeWorkflowStatus(req.query?.status);
    const snap = await db
      .collection("maintenanceRequests")
      .where("landlordId", "==", landlordId)
      .limit(400)
      .get();
    let items = snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    if (statusFilter) {
      items = items.filter((item) => normalizeWorkflowStatus(item.status) === statusFilter);
    }
    items.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    return res.json({ ok: true, items, data: items });
  } catch (err: any) {
    console.error("[maintenance-v2] landlord list failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LANDLORD_MAINTENANCE_LIST_FAILED" });
  }
});

router.patch("/landlord/maintenance/:id", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = landlordIdOf(req);
    const actorId = String(req.user?.id || "").trim() || landlordId;
    const id = String(req.params?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const ref = db.collection("maintenanceRequests").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const current = { id: snap.id, ...(snap.data() as any) };
    if (String(current.landlordId || "") !== landlordId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const currentStatus = normalizeWorkflowStatus(current.status) || "submitted";
    const nextStatus = req.body?.status === undefined ? null : normalizeWorkflowStatus(req.body?.status);
    if (req.body?.status !== undefined && !nextStatus) {
      return res.status(400).json({ ok: false, error: "INVALID_STATUS" });
    }
    const requestedWindowStartAt = req.body?.serviceWindowStartAt === undefined ? undefined : toMillis(req.body?.serviceWindowStartAt);
    const requestedWindowEndAt = req.body?.serviceWindowEndAt === undefined ? undefined : toMillis(req.body?.serviceWindowEndAt);
    const requestedAccessRequired = normalizeOptionalBoolean(req.body?.accessRequired);
    if (req.body?.serviceWindowStartAt !== undefined && requestedWindowStartAt === null && req.body?.serviceWindowStartAt !== null) {
      return res.status(400).json({ ok: false, error: "INVALID_SERVICE_WINDOW_START" });
    }
    if (req.body?.serviceWindowEndAt !== undefined && requestedWindowEndAt === null && req.body?.serviceWindowEndAt !== null) {
      return res.status(400).json({ ok: false, error: "INVALID_SERVICE_WINDOW_END" });
    }
    if (
      typeof requestedWindowStartAt === "number" &&
      typeof requestedWindowEndAt === "number" &&
      requestedWindowEndAt < requestedWindowStartAt
    ) {
      return res.status(400).json({ ok: false, error: "INVALID_SERVICE_WINDOW_RANGE" });
    }

    let effectiveNextStatus = nextStatus;
    if (!effectiveNextStatus && typeof requestedWindowStartAt === "number" && currentStatus === "assigned") {
      effectiveNextStatus = "scheduled";
    }

    if (effectiveNextStatus && !canTransitionWorkflowStatus(currentStatus, effectiveNextStatus)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_STATUS_TRANSITION",
        currentStatus,
        nextStatus: effectiveNextStatus,
      });
    }

    const update: any = {
      updatedAt: Date.now(),
      lastUpdatedBy: "LANDLORD",
    };
    if (effectiveNextStatus) update.status = effectiveNextStatus;
    if (req.body?.priority !== undefined) {
      const rawPriority = String(req.body.priority || "").trim().toLowerCase();
      update.priority = ["low", "normal", "urgent"].includes(rawPriority) ? rawPriority : current.priority || "normal";
    }
    if (req.body?.landlordNote !== undefined) {
      update.landlordNote = req.body.landlordNote === null ? null : String(req.body.landlordNote || "").trim().slice(0, 5000);
    }
    if (req.body?.serviceWindowStartAt !== undefined) {
      update.serviceWindowStartAt = requestedWindowStartAt;
    }
    if (req.body?.serviceWindowEndAt !== undefined) {
      update.serviceWindowEndAt = requestedWindowEndAt;
    }
    if (requestedAccessRequired !== undefined) {
      update.accessRequired = requestedAccessRequired;
    }
    if (req.body?.serviceWindowStartAt !== undefined || req.body?.serviceWindowEndAt !== undefined) {
      update.tenantConfirmationStatus = null;
      update.tenantConfirmationUpdatedAt = null;
      update.accessAcknowledgedAt = null;
    } else if (requestedAccessRequired !== undefined) {
      update.accessAcknowledgedAt = null;
    }
    await ref.set(update, { merge: true });
    if (effectiveNextStatus && effectiveNextStatus !== currentStatus) {
      await appendStatusHistory(id, {
        status: effectiveNextStatus,
        actorRole: role === "admin" ? "admin" : "landlord",
        actorId,
        message: String(req.body?.message || `Status changed to ${effectiveNextStatus}`).slice(0, 500),
      });
    }

    if (req.body?.serviceWindowStartAt !== undefined || req.body?.serviceWindowEndAt !== undefined) {
      const windowMessage =
        typeof requestedWindowStartAt === "number"
          ? "Service window updated."
          : "Scheduled service window cleared.";
      await appendStatusHistory(id, {
        status: effectiveNextStatus || currentStatus,
        actorRole: role === "admin" ? "admin" : "landlord",
        actorId,
        message: windowMessage,
      });
    }
    if (requestedAccessRequired !== undefined) {
      await appendStatusHistory(id, {
        status: effectiveNextStatus || currentStatus,
        actorRole: role === "admin" ? "admin" : "landlord",
        actorId,
        message:
          requestedAccessRequired === true
            ? "Access coordination marked as required."
            : requestedAccessRequired === false
            ? "Access coordination marked as not required."
            : "Access coordination requirement cleared.",
      });
    }
    if (req.body?.serviceWindowStartAt !== undefined || req.body?.serviceWindowEndAt !== undefined) {
      await appendStatusHistory(id, {
        status: effectiveNextStatus || currentStatus,
        actorRole: role === "admin" ? "admin" : "landlord",
        actorId,
        message: "Tenant confirmation was reset because the service window changed.",
      });
    } else if (requestedAccessRequired !== undefined) {
      await appendStatusHistory(id, {
        status: effectiveNextStatus || currentStatus,
        actorRole: role === "admin" ? "admin" : "landlord",
        actorId,
        message: "Tenant access acknowledgement was reset because the access requirement changed.",
      });
    }

    const refreshedSnap = await ref.get();
    const refreshed = { id: refreshedSnap.id, ...(refreshedSnap.data() as any) };
    let workOrderId: string | null = null;
    if (String(refreshed.assignedContractorId || "").trim()) {
      const workOrder = await upsertMaintenanceWorkOrder({
        maintenanceRequestId: id,
        landlordId: String(refreshed.landlordId || landlordId || "").trim() || null,
        propertyId: String(refreshed.propertyId || "").trim() || null,
        unitId: String(refreshed.unitId || "").trim() || null,
        tenantId: String(refreshed.tenantId || "").trim() || null,
        assignedContractorId: String(refreshed.assignedContractorId || "").trim() || null,
        assignedContractorName: String(refreshed.assignedContractorName || "").trim() || null,
        title: String(refreshed.title || "").trim() || null,
        description: String(refreshed.description || "").trim() || null,
        category: String(refreshed.category || "").trim() || null,
        priority: String(refreshed.priority || "").trim() || null,
        status: String(refreshed.status || effectiveNextStatus || currentStatus).trim() || currentStatus,
        serviceWindowStartAt: toMillis(refreshed.serviceWindowStartAt),
        serviceWindowEndAt: toMillis(refreshed.serviceWindowEndAt),
        accessRequired: typeof refreshed.accessRequired === "boolean" ? refreshed.accessRequired : null,
        scheduledFor: toMillis(refreshed.serviceWindowStartAt) ?? toMillis(refreshed.scheduledFor),
        serviceCompletedAt: toMillis(refreshed.serviceCompletedAt),
        completionSummary: String(refreshed.completionSummary || "").trim() || null,
        completionOutcome: normalizeCompletionOutcome(refreshed.completionOutcome),
        completionConfirmedByLandlordAt: toMillis(refreshed.completionConfirmedByLandlordAt),
        completionConfirmedByLandlordBy: String(refreshed.completionConfirmedByLandlordBy || "").trim() || null,
      });
      workOrderId = workOrder.workOrderId;
    }
    const tenantEmail = await lookupEmailFromDoc([
      ["tenants", String(refreshed.tenantId || "")],
      ["users", String(refreshed.tenantId || "")],
    ]);
    let tenantNotification = null;
    if (effectiveNextStatus && effectiveNextStatus !== currentStatus) {
      tenantNotification = await sendMaintenanceStatusEmail({
        to: tenantEmail,
        subject: `Maintenance request updated: ${String(refreshed.title || "Request")}`,
        intro: `Your maintenance request status changed to ${effectiveNextStatus}.`,
        requestId: id,
        workOrderId,
        event: "landlord_maintenance_status_notify_tenant",
      });
    }

    return res.json({ ok: true, item: refreshed, data: refreshed, workOrderId, notifications: { tenant: tenantNotification } });
  } catch (err: any) {
    console.error("[maintenance-v2] landlord patch failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LANDLORD_MAINTENANCE_PATCH_FAILED" });
  }
});

router.get("/landlord/maintenance/contractors", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = landlordIdOf(req);
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const snap = await db
      .collection("contractorProfiles")
      .where("invitedByLandlordIds", "array-contains", landlordId)
      .limit(200)
      .get();
    const items = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
      .filter((item) => item.isActive !== false)
      .sort((a, b) =>
        String(a.businessName || a.contactName || a.email || "").localeCompare(
          String(b.businessName || b.contactName || b.email || "")
        )
      )
      .map((item) => ({
        id: item.id,
        businessName: String(item.businessName || "").trim() || null,
        contactName: String(item.contactName || "").trim() || null,
        email: String(item.email || "").trim() || null,
      }));

    return res.json({ ok: true, items, data: items });
  } catch (err: any) {
    console.error("[maintenance-v2] landlord contractor list failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LANDLORD_MAINTENANCE_CONTRACTOR_LIST_FAILED" });
  }
});

router.post("/landlord/maintenance/:id/assign", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "landlord" && role !== "admin") return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    const landlordId = landlordIdOf(req);
    const actorId = String(req.user?.id || "").trim() || landlordId;
    const id = String(req.params?.id || "").trim();
    const rawContractorId =
      String(req.body?.contractorId || req.body?.contractorUserId || req.body?.acceptedByUserId || "").trim();
    const inviteId = String(req.body?.inviteId || "").trim() || null;
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    console.info("[maintenance-v2] assignment request", {
      maintenanceRequestId: id,
      landlordId,
      payload: {
        contractorId: req.body?.contractorId ?? null,
        contractorUserId: req.body?.contractorUserId ?? null,
        acceptedByUserId: req.body?.acceptedByUserId ?? null,
        inviteId,
      },
    });

    let resolvedContractorId = rawContractorId;
    let inviteData: any = null;
    if (!resolvedContractorId && inviteId) {
      let inviteSnap = await db.collection("contractorInvites").doc(inviteId).get();
      if (inviteSnap.exists) {
        inviteData = inviteSnap.data() as any;
      } else {
        const inviteByTokenSnap = await db
          .collection("contractorInvites")
          .where("token", "==", inviteId)
          .limit(1)
          .get();
        if (!inviteByTokenSnap.empty) {
          inviteData = inviteByTokenSnap.docs[0].data() as any;
        }
      }
      if (!inviteData) {
        return res.status(404).json({ ok: false, error: "CONTRACTOR_INVITE_NOT_FOUND" });
      }
      if (String(inviteData?.landlordId || "").trim() !== landlordId) {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      resolvedContractorId = String(inviteData?.acceptedByUserId || "").trim();
      if (!resolvedContractorId) {
        const inviteEmail = String(inviteData?.email || "").trim().toLowerCase();
        if (inviteEmail) {
          const [userByEmailSnap, accountByEmailSnap, contractorProfileByEmailSnap] = await Promise.all([
            db.collection("users").where("email", "==", inviteEmail).limit(1).get(),
            db.collection("accounts").where("email", "==", inviteEmail).limit(1).get(),
            db.collection("contractorProfiles").where("email", "==", inviteEmail).limit(1).get(),
          ]);
          const userDoc = !userByEmailSnap.empty ? userByEmailSnap.docs[0] : null;
          const accountDoc = !accountByEmailSnap.empty ? accountByEmailSnap.docs[0] : null;
          const profileDoc = !contractorProfileByEmailSnap.empty ? contractorProfileByEmailSnap.docs[0] : null;
          resolvedContractorId = String(
            userDoc?.id ||
              accountDoc?.id ||
              (profileDoc?.data() as any)?.userId ||
              profileDoc?.id ||
              ""
          ).trim();
        }
      }
      if (!resolvedContractorId) {
        return res.status(400).json({ ok: false, error: "CONTRACTOR_ID_REQUIRED" });
      }
    }
    if (!resolvedContractorId) {
      return res.status(400).json({ ok: false, error: "CONTRACTOR_ID_REQUIRED" });
    }

    const ref = db.collection("maintenanceRequests").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const current = { id: snap.id, ...(snap.data() as any) };
    if (String(current.landlordId || "") !== landlordId) return res.status(403).json({ ok: false, error: "FORBIDDEN" });

    const currentStatus = normalizeWorkflowStatus(current.status) || "submitted";
    if (!["submitted", "reviewed", "assigned"].includes(currentStatus)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_STATUS_TRANSITION",
        currentStatus,
        nextStatus: "assigned",
      });
    }

    let profileSnap = await db.collection("contractorProfiles").doc(resolvedContractorId).get();
    let userSnap = await db.collection("users").doc(resolvedContractorId).get();
    let accountSnap = await db.collection("accounts").doc(resolvedContractorId).get();
    let contractorProfile = profileSnap.exists ? (profileSnap.data() as any) : null;
    let userData = userSnap.exists ? (userSnap.data() as any) : null;
    let accountData = accountSnap.exists ? (accountSnap.data() as any) : null;

    const profileUserId = String(contractorProfile?.userId || "").trim() || null;
    if ((!userData && !accountData) && profileUserId) {
      resolvedContractorId = profileUserId;
      userSnap = await db.collection("users").doc(resolvedContractorId).get();
      accountSnap = await db.collection("accounts").doc(resolvedContractorId).get();
      profileSnap = await db.collection("contractorProfiles").doc(resolvedContractorId).get();
      contractorProfile = profileSnap.exists ? (profileSnap.data() as any) : contractorProfile;
      userData = userSnap.exists ? (userSnap.data() as any) : null;
      accountData = accountSnap.exists ? (accountSnap.data() as any) : null;
    }

    const persistedRole = String(
      userData?.actorRole || userData?.role || accountData?.actorRole || accountData?.role || ""
    ).trim().toLowerCase();
    if (!profileSnap.exists && persistedRole !== "contractor" && role !== "admin") {
      console.error("[maintenance-v2] assignment resolution failed", {
        maintenanceRequestId: id,
        landlordId,
        rawContractorId,
        resolvedContractorId,
        inviteId,
        persistedRole: persistedRole || null,
        hasProfile: profileSnap.exists,
      });
      return res.status(400).json({ ok: false, error: "INVALID_CONTRACTOR_ID" });
    }

    const contractorName =
      String(
        contractorProfile?.businessName ||
          contractorProfile?.contactName ||
          userData?.fullName ||
          userData?.name ||
          accountData?.fullName ||
          accountData?.name ||
          accountData?.businessName ||
          ""
      ).trim() || null;
    const contractorEmail =
      String(contractorProfile?.email || userData?.email || accountData?.email || inviteData?.email || "").trim() || null;

    console.info("[maintenance-v2] assignment resolved", {
      maintenanceRequestId: id,
      landlordId,
      rawContractorId: rawContractorId || null,
      resolvedContractorId,
      inviteId,
      contractorName,
      contractorEmail,
      persistedRole: persistedRole || null,
      hasProfile: profileSnap.exists,
    });

    const now = Date.now();
    const workOrderId = `maintenance_${id}`;
    const batch = db.batch();
    batch.set(
      ref,
      {
        assignedContractorId: resolvedContractorId,
        assignedContractorName: contractorName,
        status: "assigned",
        updatedAt: now,
        lastUpdatedBy: "LANDLORD",
        statusHistory: FieldValue.arrayUnion({
          status: "assigned",
          actorRole: role === "admin" ? "admin" : "landlord",
          actorId,
          message: contractorName ? `Assigned contractor: ${contractorName}` : `Assigned contractor: ${resolvedContractorId}`,
          createdAt: now,
        }),
      },
      { merge: true }
    );
    batch.set(
      db.collection("workOrders").doc(workOrderId),
      {
        id: workOrderId,
        maintenanceRequestId: id,
        landlordId: String(current.landlordId || landlordId || "").trim() || null,
        propertyId: String(current.propertyId || "").trim() || null,
        unitId: String(current.unitId || "").trim() || null,
        tenantId: String(current.tenantId || "").trim() || null,
        assignedContractorId: resolvedContractorId,
        assignedContractorName: contractorName,
        title: String(current.title || "").trim() || "Maintenance request",
        description: String(current.description || "").trim() || "",
        category: String(current.category || "").trim() || "GENERAL",
        priority: String(current.priority || "").trim() || "normal",
        status: "assigned",
        serviceWindowStartAt: toMillis(current.serviceWindowStartAt),
        serviceWindowEndAt: toMillis(current.serviceWindowEndAt),
        accessRequired: typeof current.accessRequired === "boolean" ? current.accessRequired : null,
        scheduledFor: toMillis(current.serviceWindowStartAt),
        serviceStartedAt: null,
        serviceCompletedAt: null,
        lastExecutionUpdateAt: null,
        executionBlockedReason: null,
        completionSummary: null,
        completionOutcome: null,
        completedByActorRole: null,
        completedByActorId: null,
        completionConfirmedByLandlordAt: null,
        completionConfirmedByLandlordBy: null,
        reopenedAt: null,
        reopenedByActorId: null,
        reopenedByActorRole: null,
        reopenReason: null,
        visibility: "private",
        createdAt: Number(current.createdAt || now) || now,
        updatedAt: now,
        createdAtMs: Number(current.createdAt || now) || now,
        updatedAtMs: now,
      },
      { merge: true }
    );
    await batch.commit();

    const [refreshedSnap, workOrderSnap] = await Promise.all([
      ref.get(),
      db.collection("workOrders").doc(workOrderId).get(),
    ]);
    const refreshed = { id: refreshedSnap.id, ...(refreshedSnap.data() as any) };
    const workOrder = workOrderSnap.exists ? { id: workOrderSnap.id, ...(workOrderSnap.data() as any) } : null;
    const maintenanceAssignedContractorId = String(refreshed.assignedContractorId || "").trim() || null;
    const workOrderAssignedContractorId = String(workOrder?.assignedContractorId || "").trim() || null;

    console.info("[maintenance-v2] assignment persisted", {
      maintenanceRequestId: id,
      workOrderId,
      resolvedContractorId,
      maintenanceAssignedContractorId,
      workOrderAssignedContractorId,
      assignedContractorName: String(refreshed.assignedContractorName || workOrder?.assignedContractorName || "").trim() || null,
    });

    if (maintenanceAssignedContractorId !== resolvedContractorId || workOrderAssignedContractorId !== resolvedContractorId) {
      console.error("[maintenance-v2] assignment persistence mismatch", {
        maintenanceRequestId: id,
        workOrderId,
        resolvedContractorId,
        maintenanceAssignedContractorId,
        workOrderAssignedContractorId,
      });
      return res.status(500).json({
        ok: false,
        error: "ASSIGNMENT_PERSIST_FAILED",
        maintenanceAssignedContractorId,
        workOrderAssignedContractorId,
      });
    }

    const tenantEmail = await lookupEmailFromDoc([
      ["tenants", String(refreshed.tenantId || "")],
      ["users", String(refreshed.tenantId || "")],
    ]);
    const [tenantNotification, contractorNotification] = await Promise.all([
      sendMaintenanceStatusEmail({
        to: tenantEmail,
        subject: `Contractor assigned: ${String(refreshed.title || "Maintenance request")}`,
        intro: "A contractor has been assigned to your maintenance request.",
        requestId: id,
        workOrderId,
        event: "landlord_assignment_notify_tenant",
      }),
      sendMaintenanceStatusEmail({
        to: contractorEmail,
        subject: `New maintenance job assigned: ${String(refreshed.title || "Maintenance request")}`,
        intro: "You have been assigned a maintenance job in RentChain.",
        requestId: id,
        workOrderId,
        event: "landlord_assignment_notify_contractor",
      }),
    ]);

    return res.json({
      ok: true,
      item: refreshed,
      data: refreshed,
      workOrderId,
      resolvedContractorId,
      notifications: {
        tenant: tenantNotification,
        contractor: contractorNotification,
      },
    });
  } catch (err: any) {
    console.error("[maintenance-v2] landlord assign failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "LANDLORD_MAINTENANCE_ASSIGN_FAILED" });
  }
});

router.get("/contractor/jobs", async (req: any, res) => {
  try {
    const access = await resolveContractorAccess(req);
    if (access.role !== "contractor" && access.role !== "admin") {
      logContractorAccess("forbidden_role", access, { authorization: fingerprint(getBearerToken(req)) });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const contractorId = access.contractorId;
    if (!contractorId) {
      logContractorAccess("missing_contractor_id", access, { authorization: fingerprint(getBearerToken(req)) });
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const statusFilter = normalizeWorkflowStatus(req.query?.status);
    const workOrderSnap = await db
      .collection("workOrders")
      .where("assignedContractorId", "==", contractorId)
      .limit(300)
      .get();
    const workOrders = workOrderSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
    const maintenanceIds = Array.from(
      new Set(
        workOrders
          .map((item) => String(item.maintenanceRequestId || "").trim())
          .filter(Boolean)
      )
    );
    const maintenanceDocs = await Promise.all(
      maintenanceIds.map(async (maintenanceId) => {
        const maintenanceSnap = await db.collection("maintenanceRequests").doc(maintenanceId).get();
        return maintenanceSnap.exists ? { id: maintenanceSnap.id, ...(maintenanceSnap.data() as any) } : null;
      })
    );
    const maintenanceMap = new Map(
      maintenanceDocs.filter((item): item is any => Boolean(item)).map((item) => [String(item.id), item])
    );

    let items = (
      await Promise.all(
        workOrders.map((workOrder) =>
          shapeContractorJobFromSources(workOrder, maintenanceMap.get(String(workOrder.maintenanceRequestId || "").trim()) || null)
        )
      )
    ).filter((item) => Boolean(item?.id) && Boolean(item?.title) && Boolean(item?.description));
    if (statusFilter) {
      items = items.filter((item) => normalizeWorkflowStatus(item.status) === statusFilter);
    }
    items.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
    console.info("[maintenance-v2] contractor-jobs result", {
      contractorId,
      workOrderCount: workOrders.length,
      jobCount: items.length,
      statusFilter: statusFilter || null,
      source: "workOrders",
    });
    logContractorAccess("allowed", access, { authorization: fingerprint(getBearerToken(req)), matchedJobs: items.length, source: "workOrders" });
    return res.json({ ok: true, items, data: items });
  } catch (err: any) {
    console.error("[maintenance-v2] contractor jobs failed", { message: err?.message || "failed" });
    return res.status(500).json({ ok: false, error: "CONTRACTOR_MAINTENANCE_LIST_FAILED" });
  }
});

router.patch("/contractor/jobs/:id/status", async (req: any, res) => {
  try {
    const access = await resolveContractorAccess(req);
    if (access.role !== "contractor" && access.role !== "admin") {
      logContractorAccess("status_forbidden_role", access, { authorization: fingerprint(getBearerToken(req)), requestId: String(req.params?.id || "").trim() || null });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const contractorId = access.contractorId;
    const actorId = String(req.user?.id || "").trim() || contractorId;
    const id = String(req.params?.id || "").trim();
    if (!contractorId) {
      logContractorAccess("status_missing_contractor_id", access, { authorization: fingerprint(getBearerToken(req)), requestId: id || null });
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const nextStatus = normalizeWorkflowStatus(req.body?.status);
    if (!nextStatus || !["assigned", "scheduled", "blocked", "in_progress", "completed"].includes(nextStatus)) {
      return res.status(400).json({ ok: false, error: "INVALID_STATUS" });
    }

    const ref = db.collection("maintenanceRequests").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const item = { id: snap.id, ...(snap.data() as any) };
    if (String(item.assignedContractorId || "") !== contractorId) {
      logContractorAccess("status_assignee_mismatch", access, { authorization: fingerprint(getBearerToken(req)), requestId: id, assignedContractorId: String(item.assignedContractorId || "") || null });
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const currentStatus = normalizeWorkflowStatus(item.status) || "assigned";
    const isAcknowledgement = nextStatus === "assigned" && currentStatus === "assigned";
    if (!isAcknowledgement && !canTransitionWorkflowStatus(currentStatus, nextStatus)) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_STATUS_TRANSITION",
        currentStatus,
        nextStatus,
      });
    }

    const now = Date.now();
    const note = String(req.body?.message || req.body?.note || "").trim().slice(0, 500);
    const blockedReason = String(req.body?.blockedReason || req.body?.executionBlockedReason || note || "")
      .trim()
      .slice(0, 500);
    const completionSummary = String(req.body?.completionSummary || "").trim().slice(0, 2000);
    const completionOutcome = normalizeCompletionOutcome(req.body?.completionOutcome) || "completed";
    const requestedScheduledFor =
      req.body?.scheduledFor === undefined ? undefined : toMillis(req.body?.scheduledFor);

    if (req.body?.scheduledFor !== undefined && requestedScheduledFor === null && req.body?.scheduledFor !== null) {
      return res.status(400).json({ ok: false, error: "INVALID_SCHEDULED_FOR" });
    }
    if (nextStatus === "blocked" && !blockedReason) {
      return res.status(400).json({ ok: false, error: "BLOCKED_REASON_REQUIRED" });
    }
    if (nextStatus === "completed" && !completionSummary) {
      return res.status(400).json({ ok: false, error: "COMPLETION_SUMMARY_REQUIRED" });
    }

    const existingWorkOrderRef = db.collection("workOrders").doc(`maintenance_${id}`);
    const existingWorkOrderSnap = await existingWorkOrderRef.get();
    const existingWorkOrder = existingWorkOrderSnap.exists ? ((existingWorkOrderSnap.data() as any) || {}) : {};

    const scheduledFor =
      nextStatus === "scheduled"
        ? requestedScheduledFor === undefined
          ? toMillis(existingWorkOrder.scheduledFor) ??
            toMillis(item.scheduledFor) ??
            toMillis(item.serviceWindowStartAt) ??
            now
          : requestedScheduledFor
        : undefined;
    const serviceStartedAt =
      nextStatus === "in_progress"
        ? toMillis(existingWorkOrder.serviceStartedAt) ?? toMillis(item.serviceStartedAt) ?? now
        : undefined;
    const serviceCompletedAt = nextStatus === "completed" ? now : undefined;
    const contractorMessage =
      nextStatus === "scheduled"
        ? note || "Contractor scheduled the service visit."
        : nextStatus === "in_progress"
        ? note || "Contractor started the work."
        : nextStatus === "blocked"
        ? blockedReason
        : nextStatus === "completed"
        ? completionSummary
        : note || (isAcknowledgement ? "Contractor accepted the assigned job." : `Contractor updated status to ${nextStatus}.`);
    const historyMessage =
      nextStatus === "scheduled"
        ? scheduledFor
          ? `Contractor scheduled service for ${new Date(scheduledFor).toLocaleString()}.`
          : contractorMessage
        : nextStatus === "in_progress"
        ? contractorMessage
        : nextStatus === "blocked"
        ? `Service is blocked: ${blockedReason}`
        : nextStatus === "completed"
        ? `Service completed: ${completionSummary}`
        : contractorMessage;

    const workOrder = await upsertMaintenanceWorkOrder({
      maintenanceRequestId: id,
      landlordId: String(item.landlordId || "").trim() || null,
      propertyId: String(item.propertyId || "").trim() || null,
      unitId: String(item.unitId || "").trim() || null,
      tenantId: String(item.tenantId || "").trim() || null,
      assignedContractorId: contractorId,
      assignedContractorName: String(item.assignedContractorName || "").trim() || null,
      title: String(item.title || "").trim() || null,
      description: String(item.description || "").trim() || null,
      category: String(item.category || "").trim() || null,
      priority: String(item.priority || "").trim() || null,
      status: nextStatus,
      serviceWindowStartAt: toMillis(item.serviceWindowStartAt),
      serviceWindowEndAt: toMillis(item.serviceWindowEndAt),
      accessRequired: typeof item.accessRequired === "boolean" ? item.accessRequired : null,
      scheduledFor,
      serviceStartedAt,
      serviceCompletedAt,
      lastExecutionUpdateAt: now,
      executionBlockedReason: nextStatus === "blocked" ? blockedReason : null,
      completionSummary: nextStatus === "completed" ? completionSummary : undefined,
      completionOutcome: nextStatus === "completed" ? completionOutcome : undefined,
      completedByActorRole: nextStatus === "completed" ? (access.role === "admin" ? "admin" : "contractor") : undefined,
      completedByActorId: nextStatus === "completed" ? actorId : undefined,
      completionConfirmedByLandlordAt: nextStatus === "completed" ? null : undefined,
      completionConfirmedByLandlordBy: nextStatus === "completed" ? null : undefined,
      reopenedAt: nextStatus === "completed" ? null : undefined,
      reopenedByActorId: nextStatus === "completed" ? null : undefined,
      reopenedByActorRole: nextStatus === "completed" ? null : undefined,
      reopenReason: nextStatus === "completed" ? null : undefined,
    });

    const maintenancePatch: Record<string, unknown> = {
      status: nextStatus,
      contractorStatus: nextStatus,
      contractorLastUpdate: contractorMessage || null,
      updatedAt: now,
      lastUpdatedBy: "CONTRACTOR",
      scheduledFor: workOrder.payload.scheduledFor ?? null,
      serviceCompletedAt: workOrder.payload.serviceCompletedAt ?? null,
    };
    if (nextStatus === "completed") {
      maintenancePatch.completionSummary = completionSummary;
      maintenancePatch.completionOutcome = completionOutcome;
    } else if (nextStatus === "blocked") {
      maintenancePatch.completionSummary = null;
      maintenancePatch.completionOutcome = null;
    }
    await ref.set(maintenancePatch, { merge: true });

    await appendStatusHistory(id, {
      status: nextStatus,
      actorRole: access.role === "admin" ? "admin" : "contractor",
      actorId,
      message: historyMessage,
    });
    await appendWorkOrderUpdate(workOrder.workOrderId, {
      actorRole: access.role === "admin" ? "admin" : "contractor",
      actorId,
      updateType:
        nextStatus === "scheduled"
          ? "scheduled"
          : nextStatus === "in_progress"
          ? "started"
          : nextStatus === "blocked"
          ? "blocked"
          : nextStatus === "completed"
          ? "completed"
          : "status_changed",
      message: historyMessage,
    });

    const refreshedSnap = await ref.get();
    const refreshed = { id: refreshedSnap.id, ...(refreshedSnap.data() as any) };

    let notifications = null;
    if (!isAcknowledgement) {
      const [tenantEmail, landlordEmail] = await Promise.all([
        lookupEmailFromDoc([
          ["tenants", String(refreshed.tenantId || "")],
          ["users", String(refreshed.tenantId || "")],
        ]),
        lookupEmailFromDoc([
          ["users", String(refreshed.landlordId || "")],
          ["landlords", String(refreshed.landlordId || "")],
        ]),
      ]);

      const [tenantNotification, landlordNotification] = await Promise.all([
        sendMaintenanceStatusEmail({
          to: tenantEmail,
          subject: `Maintenance update: ${String(refreshed.title || "Request")}`,
          intro: `Your maintenance request is now ${nextStatus}.`,
          requestId: id,
          workOrderId: workOrder.workOrderId,
          event: "contractor_status_notify_tenant",
        }),
        sendMaintenanceStatusEmail({
          to: landlordEmail,
          subject: `Contractor update: ${String(refreshed.title || "Request")}`,
          intro: `Contractor marked request as ${nextStatus}.`,
          requestId: id,
          workOrderId: workOrder.workOrderId,
          event: "contractor_status_notify_landlord",
        }),
      ]);
      notifications = {
        tenant: tenantNotification,
        landlord: landlordNotification,
      };
    }

    return res.json({ ok: true, item: refreshed, data: refreshed, workOrderId: workOrder.workOrderId, notifications });
  } catch (err: any) {
    console.error("[maintenance-v2] contractor status patch failed", {
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "CONTRACTOR_MAINTENANCE_PATCH_FAILED" });
  }
});

router.post("/contractor/jobs/:id/evidence", async (req: any, res) => {
  evidenceUpload.single("file")(req, res, async (uploadErr: any) => {
    try {
      if (uploadErr) {
        const message = String(uploadErr?.message || "");
        if (String(uploadErr?.code || "") === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ ok: false, error: "FILE_TOO_LARGE", maxBytes: MAX_EVIDENCE_BYTES });
        }
        return res.status(400).json({ ok: false, error: "UPLOAD_FAILED", detail: message || "upload_failed" });
      }

      const access = await resolveContractorAccess(req);
      if (access.role !== "contractor" && access.role !== "admin") {
        return res.status(403).json({ ok: false, error: "FORBIDDEN" });
      }
      const contractorId = access.contractorId;
      const id = String(req.params?.id || "").trim();
      if (!contractorId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
      const actorId = String(req.user?.id || "").trim() || contractorId;
      if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

      const maintenanceRef = db.collection("maintenanceRequests").doc(id);
      const maintenanceSnap = await maintenanceRef.get();
      if (!maintenanceSnap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      const maintenance = { id: maintenanceSnap.id, ...(maintenanceSnap.data() as any) };
      if (String(maintenance.assignedContractorId || "") !== contractorId) {
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
      if (!evidenceType || !["before", "during", "after", "completion", "other"].includes(evidenceType)) {
        return res.status(400).json({ ok: false, error: "INVALID_EVIDENCE_TYPE" });
      }

      const now = Date.now();
      const workOrder = await upsertMaintenanceWorkOrder({
        maintenanceRequestId: id,
        landlordId: String(maintenance.landlordId || "").trim() || null,
        propertyId: String(maintenance.propertyId || "").trim() || null,
        unitId: String(maintenance.unitId || "").trim() || null,
        tenantId: String(maintenance.tenantId || "").trim() || null,
        assignedContractorId: contractorId,
        assignedContractorName: String(maintenance.assignedContractorName || "").trim() || null,
        title: String(maintenance.title || "").trim() || null,
        description: String(maintenance.description || "").trim() || null,
        category: String(maintenance.category || "").trim() || null,
        priority: String(maintenance.priority || "").trim() || null,
        status: normalizeWorkflowStatus(maintenance.status) || "assigned",
        serviceWindowStartAt: toMillis(maintenance.serviceWindowStartAt),
        serviceWindowEndAt: toMillis(maintenance.serviceWindowEndAt),
        accessRequired: typeof maintenance.accessRequired === "boolean" ? maintenance.accessRequired : null,
      });

      const evidenceId = makeEvidenceId();
      const storagePath = buildEvidenceStoragePath({
        workOrderId: workOrder.workOrderId,
        evidenceId,
        filename: file.originalname,
      });
      await uploadBufferToGcs({
        path: storagePath,
        contentType: String(file.mimetype || "application/octet-stream"),
        buffer: file.buffer,
        metadata: {
          workOrderId: workOrder.workOrderId,
          maintenanceRequestId: id,
          evidenceType,
          visibility: "landlord_contractor",
          uploadedAtMs: String(now),
          actorRole: access.role === "admin" ? "admin" : "contractor",
          actorId,
        },
      });

      const workOrderRef = db.collection("workOrders").doc(workOrder.workOrderId);
      const currentWorkOrderSnap = await workOrderRef.get();
      const currentWorkOrder = currentWorkOrderSnap.exists ? ((currentWorkOrderSnap.data() as any) || {}) : {};
      const evidenceItem: WorkOrderEvidenceItem = {
        id: evidenceId,
        storagePath,
        filename: String(file.originalname || "").trim() || null,
        contentType: String(file.mimetype || "").trim() || null,
        uploadedAt: now,
        uploadedByActorRole: access.role === "admin" ? "admin" : "contractor",
        uploadedByActorId: actorId,
        evidenceType,
        caption: String(req.body?.caption || "").trim().slice(0, 500) || null,
        visibility: "landlord_contractor",
      };
      await workOrderRef.set(
        {
          evidence: [...(Array.isArray(currentWorkOrder.evidence) ? currentWorkOrder.evidence : []), evidenceItem],
          updatedAtMs: now,
          lastExecutionUpdateAt: now,
        },
        { merge: true }
      );

      await appendWorkOrderUpdate(workOrder.workOrderId, {
        actorRole: access.role === "admin" ? "admin" : "contractor",
        actorId,
        updateType: "photo",
        message: `Uploaded ${evidenceType} evidence photo${evidenceItem.caption ? `: ${evidenceItem.caption}` : ""}`,
      });

      const refreshedWorkOrderSnap = await workOrderRef.get();
      const refreshedJob = await shapeContractorJobFromSources(
        { id: refreshedWorkOrderSnap.id, ...(refreshedWorkOrderSnap.data() || {}) },
        maintenance
      );
      return res.status(201).json({ ok: true, item: refreshedJob, data: refreshedJob, workOrderId: workOrder.workOrderId });
    } catch (err: any) {
      console.error("[maintenance-v2] contractor evidence upload failed", {
        message: err?.message || "failed",
      });
      return res.status(500).json({ ok: false, error: "CONTRACTOR_EVIDENCE_UPLOAD_FAILED" });
    }
  });
});

router.post("/rental-applications/:id/screening/request", async (req: any, res) => {
  try {
    const role = roleOf(req);
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const landlordId = landlordIdOf(req);
    const actorId = String(req.user?.id || "").trim() || landlordId;
    const rentalApplicationId = String(req.params?.id || "").trim();
    if (!landlordId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!rentalApplicationId) return res.status(400).json({ ok: false, error: "RENTAL_APPLICATION_ID_REQUIRED" });

    const permissibleUseConfirmed = Boolean(req.body?.permissibleUseConfirmed);
    if (!permissibleUseConfirmed) {
      return res.status(400).json({ ok: false, error: "PERMISSIBLE_USE_CONFIRMATION_REQUIRED" });
    }

    const appRef = db.collection("rentalApplications").doc(rentalApplicationId);
    const appSnap = await appRef.get();
    const appData = (appSnap.exists ? (appSnap.data() as any) : {}) || {};
    const ownerLandlordId =
      cleanString(appData?.landlordId || appData?.ownerId || appData?.userId, 120) || landlordId;
    if (appSnap.exists && ownerLandlordId !== landlordId && role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const applicantEmail =
      cleanString(
        req.body?.applicantEmail ||
          appData?.applicantEmail ||
          appData?.email ||
          appData?.tenantEmail,
        200
      ) || null;
    const applicantName =
      cleanString(
        req.body?.applicantName ||
          appData?.applicantName ||
          [appData?.firstName, appData?.lastName].filter(Boolean).join(" "),
        200
      ) || "Applicant";
    const applicantTenantId =
      cleanString(req.body?.applicantTenantId || appData?.tenantId || appData?.applicantTenantId, 160) ||
      (await resolveTenantIdByEmail(applicantEmail));
    const propertyId = cleanString(req.body?.propertyId || appData?.propertyId, 160);
    const unitId = cleanString(req.body?.unitId || appData?.unitId || appData?.unit, 160);
    const propertyLabel =
      cleanString(req.body?.property || req.body?.propertyLabel || appData?.propertyName || appData?.property, 200) ||
      propertyId;
    const unitLabel =
      cleanString(req.body?.unit || req.body?.unitLabel || appData?.unitLabel || appData?.unit, 120) || unitId;
    const packageType = cleanString(req.body?.packageType, 80) || "standard";
    const payerType = cleanString(req.body?.payerType, 80) || "applicant";
    const addOns = normalizeScreeningList(req.body?.addOns);
    const now = Date.now();
    const requestRef = db.collection("screening_requests").doc();
    const screeningRequest = {
      id: requestRef.id,
      rentalApplicationId,
      landlordId,
      applicantTenantId: applicantTenantId || null,
      applicantUserId: cleanString(req.body?.applicantUserId || appData?.applicantUserId, 160),
      applicantEmail,
      applicantName,
      propertyId,
      unitId,
      propertyLabel,
      unitLabel,
      packageType,
      payerType,
      addOns,
      permissibleUseConfirmed: true,
      providerRoutingSnapshot: screeningConfigSnapshot(),
      providerSelection: null,
      status: normalizeScreeningRequestStatus("consent_pending"),
      normalizedResultStatus: "pending",
      latestConsentId: null,
      activeSessionId: null,
      latestResultId: null,
      latestAuditEventType: "screening_requested",
      nextAction: applicantTenantId ? "awaiting_applicant_consent" : "manual_applicant_link_required",
      requestSource: "landlord_application_detail",
      requestedAt: now,
      consentedAt: null,
      startedAt: null,
      completedAt: null,
      failedAt: null,
      lastViewedAt: null,
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
      createdByRole: role,
      createdById: actorId || null,
    };

    await requestRef.set(screeningRequest);
    await writeScreeningAuditEvent({
      requestId: requestRef.id,
      eventType: "screening_requested",
      actorRole: role,
      actorId: actorId || null,
      landlordId,
      tenantId: applicantTenantId || null,
      idempotencyKey: `screening_requested_${rentalApplicationId}_${requestRef.id}`,
      metadata: {
        rentalApplicationId,
        packageType,
        payerType,
        providerRoutingSnapshot: screeningRequest.providerRoutingSnapshot,
      },
    });

    if (appSnap.exists) {
      await appRef.set(
        {
          screeningRequestId: requestRef.id,
          screeningStatus: screeningRequest.status,
          screeningRequestedAt: now,
          screeningLastUpdatedAt: now,
          screeningProvider: null,
          screeningPackageType: packageType,
        },
        { merge: true }
      );
    }

    return res.status(201).json({ ok: true, screeningRequest });
  } catch (err: any) {
    console.error("[screening] request create failed", {
      rentalApplicationId: req.params?.id || null,
      landlordId: landlordIdOf(req),
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "SCREENING_REQUEST_CREATE_FAILED" });
  }
});

export default router;
