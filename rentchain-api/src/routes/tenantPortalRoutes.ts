import { createHash, randomBytes } from "crypto";
import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { db, FieldValue } from "../config/firebase";
import { buildEmailHtml, buildEmailText } from "../email/templates/baseEmailTemplate";
import { sendEmail } from "../services/emailService";
import { getEnvFlags } from "../config/requiredEnv";
import { getAdminEmails } from "../lib/adminEmails";
import { resolveTenancyContext } from "../services/tenantPortal/tenancyContextService";
import {
  projectTenantApplication,
  projectTenantLease,
  projectTenantMaintenance,
  projectTenantProperty,
} from "../services/tenantPortal/tenantProjectionService";
import { recordTenantEvent } from "../services/tenantPortal/tenantEventLogService";
import { redeemTenancyInvite } from "../services/tenantPortal/tenantInviteService";
import { loadTenantIdentityRecord, loadTenantProfileProjection } from "../services/tenantPortal/tenantProfileService";
import {
  loadTenantCommunicationsWorkspace,
  markTenantCommunicationsRead,
  sendTenantCommunicationMessage,
} from "../services/tenantPortal/tenantCommunicationsService";
import { listTenantNotificationFeed } from "../services/tenantPortal/tenantNotificationsService";
import { serializeEvidenceForAudience } from "../lib/workOrderEvidence";
import {
  applyNotificationUpdate,
  buildTenantSafeWorkOrderNotifications,
} from "../lib/maintenanceNotifications";
import { writeCanonicalEvent } from "../lib/events/buildEvent";
import { adaptTenantSafeScreeningState } from "../services/screening/tenantScreeningStatusAdapter";
import {
  createTenantSharePackage,
  listTenantSharePackages,
  revokeTenantSharePackage,
} from "../services/tenantPortal/tenantSharePackageService";

const router = Router();
router.use(authenticateJwt);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireTenant(req: any, res: any, next: any) {
  const user = req.user;
  const role = String(user?.role || "").trim().toLowerCase();
  const tenantId = String(user?.tenantId || "").trim();
  if (!user || role !== "tenant" || !tenantId) {
    console.warn("[tenant-auth] denied", {
      path: req.originalUrl || req.path || "",
      reason: !user ? "missing_user" : role !== "tenant" ? "role_not_tenant" : "missing_tenant_id",
      role: role || null,
      tenantId: tenantId || null,
      hasAuthHeader: Boolean(req.headers?.authorization),
    });
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  console.info("[tenant-auth] granted", {
    path: req.originalUrl || req.path || "",
    tenantId,
    role,
  });
  return next();
}

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? null : ts;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function makeCorrelationId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function timestampToSort(value: any): number {
  if (!value) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ts = Date.parse(value);
    return Number.isNaN(ts) ? 0 : ts;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return 0;
}

type TenantCommunicationType = "notice" | "message" | "maintenance_update" | "screening_update" | "system";

type TenantCommunicationItem = {
  id: string;
  type: TenantCommunicationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  priority: "low" | "normal" | "high";
  fromLabel: "Landlord" | "RentChain" | "Maintenance Team";
  relatedEntityType: "notice" | "maintenance" | "message" | "screening" | null;
  relatedEntityId: string | null;
};

type CompletionStatus =
  | "completed"
  | "verified"
  | "pending"
  | "missing"
  | "needs_review"
  | "not_started"
  | "in_progress";

type ReminderTiming =
  | "due_now"
  | "due_soon"
  | "scheduled_later"
  | "overdue"
  | "blocked"
  | "not_applicable";

type ReminderPriority = "low" | "medium" | "high";

type TenantCompletionItem = {
  key: string;
  label: string;
  status: CompletionStatus;
  nextAction: string | null;
  actionPath: string | null;
  actionLabel: string | null;
};

type TenantCompletionSection = {
  key: string;
  label: string;
  status: CompletionStatus;
  items: TenantCompletionItem[];
};

type ReminderMetadata = {
  reminderTiming: ReminderTiming;
  reminderTimingLabel: string;
  reminderTimingDescription: string;
  reminderPriority: ReminderPriority;
  reminderBlockedReason: string | null;
  reminderNextActionLabel: string | null;
};

type TenantDocumentStatus =
  | "missing"
  | "uploaded"
  | "pending_review"
  | "verified"
  | "needs_attention"
  | "reupload_requested";

type TenantDocumentItem = {
  id: string;
  label: string;
  category: string;
  status: TenantDocumentStatus;
  fileName: string | null;
  title: string | null;
  purpose: string | null;
  purposeLabel: string | null;
  url: string | null;
  uploadedAt: number | null;
  nextAction: string | null;
  actionAvailable: boolean;
  actionLabel: string | null;
  actionPath: string | null;
  helpLabel: string | null;
  helpPath: string | null;
};

type TenantAccessRequestStatus = "pending";
type TenantAccessGrantStatus = "active" | "expired" | "revoked";
type TenantAccessActivityType =
  | "request_submitted"
  | "access_granted"
  | "access_viewed"
  | "access_revoked"
  | "access_expired";

type TenantAccessRequestItem = {
  id: string;
  requestedByLabel: string;
  categories: string[];
  status: TenantAccessRequestStatus;
  requestedAt: number | null;
  reviewCtaLabel: string;
};

type TenantAccessGrantItem = {
  id: string;
  grantedToLabel: string;
  categories: string[];
  status: TenantAccessGrantStatus;
  grantedAt: number | null;
  expiresAt: number | null;
  lastActivityAt: number | null;
  canRevoke: boolean;
  accessLabel: string;
};

type TenantAccessActivityItem = {
  id: string;
  type: TenantAccessActivityType;
  title: string;
  occurredAt: number | null;
};

type TenantAccessWorkspace = {
  summary: {
    activeGrants: number;
    pendingRequests: number;
    latestActivityAt: number | null;
  };
  pendingRequests: TenantAccessRequestItem[];
  activeAccess: TenantAccessGrantItem[];
  recentActivity: TenantAccessActivityItem[];
  guidance: {
    headline: string;
    body: string;
  };
};

function buildTenantAccessWorkspace(input: {
  shareRecords: any[];
  propertyLabel: string | null;
}): TenantAccessWorkspace {
  const now = Date.now();
  const categories = ["Rental history"];
  const grantedToLabel = input.propertyLabel
    ? `Shared with your landlord for ${input.propertyLabel}`
    : "Shared with your landlord";

  const activeAccess = input.shareRecords
    .filter((record) => {
      const expiresAt = typeof record?.expiresAt === "number" ? record.expiresAt : null;
      return !record?.revoked && !(expiresAt && expiresAt <= now);
    })
    .map((record) => ({
      id: String(record?.id || ""),
      grantedToLabel,
      categories,
      status: "active" as const,
      grantedAt: typeof record?.createdAt === "number" ? record.createdAt : null,
      expiresAt: typeof record?.expiresAt === "number" ? record.expiresAt : null,
      lastActivityAt: typeof record?.lastAccessedAt === "number" ? record.lastAccessedAt : null,
      canRevoke: true,
      accessLabel: "View-only access",
    }))
    .filter((item) => item.id)
    .sort(
      (a, b) =>
        timestampToSort(b.lastActivityAt || b.grantedAt) - timestampToSort(a.lastActivityAt || a.grantedAt)
    );

  const recentActivity = input.shareRecords
    .flatMap((record) => {
      const id = String(record?.id || "");
      if (!id) return [];

      const items: TenantAccessActivityItem[] = [];
      const createdAt = typeof record?.createdAt === "number" ? record.createdAt : null;
      const revokedAt = typeof record?.revokedAt === "number" ? record.revokedAt : null;
      const lastAccessedAt = typeof record?.lastAccessedAt === "number" ? record.lastAccessedAt : null;
      const expiresAt = typeof record?.expiresAt === "number" ? record.expiresAt : null;

      if (createdAt) {
        items.push({
          id: `${id}:created`,
          type: "access_granted",
          title: "Access granted to your landlord",
          occurredAt: createdAt,
        });
      }
      if (lastAccessedAt) {
        items.push({
          id: `${id}:viewed`,
          type: "access_viewed",
          title: "Your shared access link was viewed",
          occurredAt: lastAccessedAt,
        });
      }
      if (revokedAt) {
        items.push({
          id: `${id}:revoked`,
          type: "access_revoked",
          title: "You revoked access",
          occurredAt: revokedAt,
        });
      } else if (expiresAt && expiresAt <= now) {
        items.push({
          id: `${id}:expired`,
          type: "access_expired",
          title: "A shared access link expired",
          occurredAt: expiresAt,
        });
      }

      return items;
    })
    .sort((a, b) => timestampToSort(b.occurredAt) - timestampToSort(a.occurredAt))
    .slice(0, 6);

  const latestActivityAt =
    recentActivity.reduce((max, item) => Math.max(max, timestampToSort(item.occurredAt)), 0) || null;

  return {
    summary: {
      activeGrants: activeAccess.length,
      pendingRequests: 0,
      latestActivityAt,
    },
    pendingRequests: [],
    activeAccess,
    recentActivity,
    guidance: {
      headline: activeAccess.length
        ? "You can review and manage the access you’ve already shared."
        : "Nothing is shared from your profile right now.",
      body:
        "This view shows tenant-safe sharing records only. V1 focuses on the access you’ve already granted, so request review stays read-first until broader permission flows are introduced.",
    },
  };
}

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
const SCREENING_RESULT_STATUSES = [
  "pending",
  "completed",
  "inconclusive",
  "failed",
  "manual_review_required",
] as const;
const SCREENING_SESSION_STATUSES = [
  "created",
  "ready_for_consent",
  "consent_received",
  "redirect_pending",
  "in_progress",
  "pending_review",
  "completed",
  "inconclusive",
  "failed",
  "expired",
] as const;
const SCREENING_AUDIT_EVENTS = [
  "screening_requested",
  "consent_viewed",
  "consent_accepted",
  "screening_started",
  "provider_session_created",
  "redirect_prepared",
  "retry_requested",
  "manual_review_selected",
  "callback_received",
  "callback_rejected",
  "callback_duplicate_ignored",
  "return_state_resolved",
  "screening_completed",
  "result_viewed",
] as const;
const SCREENING_RETURN_STATES = [
  "completed",
  "pending",
  "action_needed",
  "expired",
  "unable_to_complete",
  "callback_received_but_not_finalized",
] as const;
type ScreeningProviderKey = "manual" | "equifax" | "transunion_redirect";
type ScreeningRequestStatus = (typeof SCREENING_REQUEST_STATUSES)[number];
type ScreeningResultStatus = (typeof SCREENING_RESULT_STATUSES)[number];
type ScreeningSessionStatus = (typeof SCREENING_SESSION_STATUSES)[number];
type ScreeningReturnState = (typeof SCREENING_RETURN_STATES)[number];

type ScreeningRequestRecord = {
  id: string;
  rentalApplicationId: string | null;
  landlordId: string | null;
  applicantTenantId: string | null;
  applicantUserId: string | null;
  applicantEmail: string | null;
  applicantName: string | null;
  propertyId: string | null;
  unitId: string | null;
  propertyLabel: string | null;
  unitLabel: string | null;
  packageType: string | null;
  payerType: string | null;
  addOns: string[];
  status: ScreeningRequestStatus;
  normalizedResultStatus: ScreeningResultStatus;
  providerSelection: ScreeningProviderKey | null;
  providerRoutingSnapshot?: any;
  latestConsentId: string | null;
  activeSessionId: string | null;
  latestResultId: string | null;
  nextAction?: string | null;
  requestedAt?: number | null;
  consentedAt?: number | null;
  startedAt?: number | null;
  completedAt?: number | null;
  failedAt?: number | null;
  retryCount?: number | null;
  createdAt?: number | null;
  updatedAt?: number | null;
};

type ScreeningConsentRecord = {
  id: string;
  requestId: string;
  tenantId: string;
  applicantId?: string | null;
  rentalApplicationId?: string | null;
  landlordId?: string | null;
  propertyId?: string | null;
  providerKey?: ScreeningProviderKey | null;
  providerLabel?: string | null;
  consentVersion?: string | null;
  consentTextSummary?: string | null;
  viewedAt: number | null;
  acceptedAt: number | null;
  acceptedBy?: string | null;
  providerDisclosure: string | null;
  disclosureVersion: string | null;
};

type ScreeningSessionRecord = {
  id: string;
  requestId: string;
  providerKey: ScreeningProviderKey;
  status: ScreeningSessionStatus;
  providerSessionStatus?: string | null;
  providerSessionId?: string | null;
  handoffType: "manual" | "redirect";
  redirectUrl: string | null;
  returnUrl: string | null;
  expiresAt: number | null;
  correlationId: string | null;
  stateToken: string | null;
  stateTokenHash?: string | null;
  redirectStateId?: string | null;
  redirectPreparedAt?: number | null;
  redirectLastUpdatedAt?: number | null;
  redirectPreparationStatus?: "not_applicable" | "prepared" | "blocked" | "expired" | "consumed";
  returnState?: ScreeningReturnState | null;
  returnStateResolvedAt?: number | null;
  isActive?: boolean;
  duplicateOfSessionId?: string | null;
  callbackReceivedAt?: number | null;
  normalizedResultStatus: ScreeningResultStatus;
  createdAt: number;
  updatedAt: number;
};

type ScreeningResultRecord = {
  id: string;
  requestId: string;
  sessionId: string;
  providerKey: ScreeningProviderKey;
  status: ScreeningResultStatus;
  summary: string | null;
  normalizedDecision: string | null;
  identityVerified?: boolean | null;
  creditIncluded?: boolean | null;
  incomeIncluded?: boolean | null;
  fraudFlags?: string[];
  providerStatusMapped?: string | null;
  reportAvailability?: {
    summaryAvailable: boolean;
    fullReportAvailable: boolean;
  } | null;
  reportAvailable: boolean;
  rawPayloadRef: string | null;
  fullReportStorageRef: string | null;
  createdAt: number;
  updatedAt: number;
};

type ScreeningRedirectStateRecord = {
  id: string;
  requestId: string;
  sessionId: string;
  providerKey: ScreeningProviderKey;
  correlationId: string | null;
  providerSessionId: string | null;
  stateTokenHash: string;
  stateTokenPreview: string | null;
  returnUrl: string | null;
  expiresAt: number | null;
  preparedAt: number;
  updatedAt: number;
  callbackReceivedAt: number | null;
  consumedAt: number | null;
  callbackCount: number;
  status: "prepared" | "callback_received" | "completed" | "expired" | "rejected" | "duplicate";
  lastOutcome: string | null;
  lastRejectedReason: string | null;
};

function isoFromMs(ms: number | null | undefined): string {
  const safe = typeof ms === "number" && Number.isFinite(ms) ? ms : Date.now();
  return new Date(safe).toISOString();
}

function truncateText(value: any, max = 220): string {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function cleanString(value: any, max = 200): string | null {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, max);
}

function normalizeStringList(value: any, maxItems = 8, maxLength = 80): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanString(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
}

function normalizeScreeningRequestStatus(raw: any): ScreeningRequestStatus {
  const value = String(raw || "").trim().toLowerCase();
  if ((SCREENING_REQUEST_STATUSES as readonly string[]).includes(value)) {
    return value as ScreeningRequestStatus;
  }
  return "requested";
}

function normalizeScreeningResultStatus(raw: any): ScreeningResultStatus {
  const value = String(raw || "").trim().toLowerCase();
  if ((SCREENING_RESULT_STATUSES as readonly string[]).includes(value)) {
    return value as ScreeningResultStatus;
  }
  return "pending";
}

function normalizeScreeningSessionStatus(raw: any): ScreeningSessionStatus {
  const value = String(raw || "").trim().toLowerCase();
  if ((SCREENING_SESSION_STATUSES as readonly string[]).includes(value)) {
    return value as ScreeningSessionStatus;
  }
  return "created";
}

function makeScreeningCorrelationId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString("hex")}`;
}

function makeSecureOpaqueToken(size = 32): string {
  return randomBytes(size).toString("base64url");
}

function hashOpaqueToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function makeStateTokenPreview(value: string | null | undefined): string | null {
  const safe = String(value || "").trim();
  if (!safe) return null;
  if (safe.length <= 10) return safe;
  return `${safe.slice(0, 6)}...${safe.slice(-4)}`;
}

function buildTenantScreeningReturnUrl(requestId: string): string | null {
  const returnBase = String(process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (!returnBase) return null;
  return `${returnBase}/tenant/messages?screeningReturn=1&requestId=${encodeURIComponent(requestId)}`;
}

function mapSessionStatusToReturnState(status: ScreeningSessionStatus): ScreeningReturnState {
  if (status === "completed") return "completed";
  if (status === "expired") return "expired";
  if (status === "failed" || status === "inconclusive") return "unable_to_complete";
  if (status === "redirect_pending" || status === "created" || status === "consent_received" || status === "in_progress") {
    return "pending";
  }
  if (status === "pending_review") return "action_needed";
  return "pending";
}

function resolveReturnState(
  request: ScreeningRequestRecord,
  session: ScreeningSessionRecord | null,
  result: ScreeningResultRecord | null
): ScreeningReturnState {
  const now = Date.now();
  if (request.status === "completed" || result?.status === "completed" || session?.status === "completed") return "completed";
  if (session?.expiresAt && session.expiresAt <= now && !result) return "expired";
  if (session?.callbackReceivedAt && request.status === "in_progress" && result?.status === "pending") {
    return "callback_received_but_not_finalized";
  }
  if (request.status === "failed" || result?.status === "failed" || session?.status === "failed") return "unable_to_complete";
  if (request.status === "manual_review_required" || result?.status === "manual_review_required") return "action_needed";
  if (request.status === "consent_pending" || request.status === "consented") return "action_needed";
  return session ? mapSessionStatusToReturnState(session.status) : "pending";
}

function sanitizeAuditMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {};
  const sanitized: Record<string, unknown> = {};
  Object.entries(metadata).forEach(([key, value]) => {
    if (["stateToken", "state_token", "rawPayload", "payload", "providerPayload"].includes(key)) return;
    sanitized[key] = value;
  });
  return sanitized;
}

function summarizeCallbackPayload(payload: any) {
  const providerSessionId = cleanString(
    payload?.providerSessionId || payload?.provider_session_id || payload?.sessionId,
    160
  );
  const correlationId = cleanString(payload?.correlationId || payload?.correlation_id, 160);
  const providerStatus = cleanString(payload?.status || payload?.providerStatus || payload?.decision, 160);
  return {
    providerSessionId,
    correlationId,
    providerStatus,
    hasState: Boolean(cleanString(payload?.stateToken || payload?.state, 200)),
  };
}

function makeDeterministicDocId(parts: Array<string | null | undefined>): string {
  const normalized = parts
    .map((part) => String(part || "").trim().replace(/[^a-zA-Z0-9_-]+/g, "_"))
    .filter(Boolean)
    .join("_")
    .slice(0, 220);
  return normalized || makeScreeningCorrelationId("doc");
}

function isTerminalScreeningSessionStatus(status: ScreeningSessionStatus | null | undefined): boolean {
  return Boolean(status && ["completed", "inconclusive", "failed", "expired"].includes(status));
}

function isTerminalScreeningRequestStatus(status: ScreeningRequestStatus | null | undefined): boolean {
  return Boolean(status && ["completed", "inconclusive", "failed", "manual_review_required"].includes(status));
}

function getScreeningConfig() {
  const defaultProvider = (cleanString(process.env.SCREENING_DEFAULT_PROVIDER, 80) || "manual") as ScreeningProviderKey;
  const providerPriority = String(process.env.SCREENING_PROVIDER_PRIORITY || "transunion_redirect,equifax,manual")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean) as ScreeningProviderKey[];
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
  tenantId?: string | null;
  landlordId?: string | null;
  sessionId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const auditId = input.idempotencyKey
    ? makeDeterministicDocId([input.requestId, input.eventType, input.idempotencyKey])
    : makeScreeningCorrelationId("audit");
  const ref = db.collection("screening_audit_log").doc(auditId);
  const createdAt = Date.now();
  await ref.set({
    id: auditId,
    requestId: input.requestId,
    eventType: input.eventType,
    actorRole: cleanString(input.actorRole, 80) || "system",
    actorId: input.actorId || null,
    tenantId: input.tenantId || null,
    landlordId: input.landlordId || null,
    sessionId: input.sessionId || null,
    idempotencyKey: input.idempotencyKey || null,
    metadata: {
      requestId: input.requestId,
      eventType: input.eventType,
      actorRole: cleanString(input.actorRole, 80) || "system",
      actorId: input.actorId || null,
      tenantId: input.tenantId || null,
      landlordId: input.landlordId || null,
      sessionId: input.sessionId || null,
      ...sanitizeAuditMetadata(input.metadata),
    },
    createdAt,
    updatedAt: createdAt,
    createdAtServer: FieldValue.serverTimestamp(),
  });
}

async function getTenantScreeningReadMap(tenantId: string): Promise<Map<string, number>> {
  const snap = await db
    .collection("tenantScreeningReads")
    .where("tenantId", "==", tenantId)
    .limit(500)
    .get();
  const map = new Map<string, number>();
  snap.docs.forEach((doc) => {
    const data = (doc.data() as any) || {};
    const requestId = String(data.requestId || "").trim();
    const readAtMs = Number(data.readAtMs || 0);
    if (requestId) map.set(requestId, readAtMs || Date.now());
  });
  return map;
}

async function getScreeningRequestById(requestId: string): Promise<ScreeningRequestRecord | null> {
  const snap = await db.collection("screening_requests").doc(requestId).get();
  if (!snap.exists) return null;
  const data = (snap.data() as any) || {};
  return {
    id: snap.id,
    rentalApplicationId: cleanString(data.rentalApplicationId, 160),
    landlordId: cleanString(data.landlordId, 160),
    applicantTenantId: cleanString(data.applicantTenantId, 160),
    applicantUserId: cleanString(data.applicantUserId, 160),
    applicantEmail: cleanString(data.applicantEmail, 200),
    applicantName: cleanString(data.applicantName, 200),
    propertyId: cleanString(data.propertyId, 160),
    unitId: cleanString(data.unitId, 160),
    propertyLabel: cleanString(data.propertyLabel, 200),
    unitLabel: cleanString(data.unitLabel, 120),
    packageType: cleanString(data.packageType, 80),
    payerType: cleanString(data.payerType, 80),
    addOns: normalizeStringList(data.addOns),
    status: normalizeScreeningRequestStatus(data.status),
    normalizedResultStatus: normalizeScreeningResultStatus(data.normalizedResultStatus),
    providerSelection: (cleanString(data.providerSelection, 80) as ScreeningProviderKey | null) || null,
    providerRoutingSnapshot: data.providerRoutingSnapshot || null,
    latestConsentId: cleanString(data.latestConsentId, 160),
    activeSessionId: cleanString(data.activeSessionId, 160),
    latestResultId: cleanString(data.latestResultId, 160),
    nextAction: cleanString(data.nextAction, 120),
    requestedAt: Number(data.requestedAt || data.createdAt || 0) || null,
    consentedAt: Number(data.consentedAt || 0) || null,
    startedAt: Number(data.startedAt || 0) || null,
    completedAt: Number(data.completedAt || 0) || null,
    failedAt: Number(data.failedAt || 0) || null,
    retryCount: Number(data.retryCount || 0) || 0,
    createdAt: Number(data.createdAt || 0) || null,
    updatedAt: Number(data.updatedAt || 0) || null,
  };
}

async function getLatestConsent(requestId: string): Promise<ScreeningConsentRecord | null> {
  const snap = await db
    .collection("screening_consents")
    .where("requestId", "==", requestId)
    .limit(50)
    .get();
  const items = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a, b) => Number(b.acceptedAt || b.viewedAt || 0) - Number(a.acceptedAt || a.viewedAt || 0));
  const item = items[0];
  if (!item) return null;
  return {
    id: item.id,
    requestId,
    tenantId: cleanString(item.tenantId, 160) || "",
    applicantId: cleanString(item.applicantId, 160),
    rentalApplicationId: cleanString(item.rentalApplicationId, 160),
    landlordId: cleanString(item.landlordId, 160),
    propertyId: cleanString(item.propertyId, 160),
    providerKey: ((cleanString(item.providerKey, 80) || "") as ScreeningProviderKey | "") || null,
    providerLabel: cleanString(item.providerLabel, 120),
    consentVersion: cleanString(item.consentVersion, 80),
    consentTextSummary: cleanString(item.consentTextSummary, 600),
    viewedAt: Number(item.viewedAt || 0) || null,
    acceptedAt: Number(item.acceptedAt || 0) || null,
    acceptedBy: cleanString(item.acceptedBy, 160),
    providerDisclosure: cleanString(item.providerDisclosure, 200),
    disclosureVersion: cleanString(item.disclosureVersion, 80),
  };
}

async function getLatestSession(requestId: string): Promise<ScreeningSessionRecord | null> {
  const snap = await db
    .collection("screening_sessions")
    .where("requestId", "==", requestId)
    .limit(50)
    .get();
  const items = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  const item = items[0];
  if (!item) return null;
  return {
    id: item.id,
    requestId,
    providerKey: ((cleanString(item.providerKey, 80) || "manual") as ScreeningProviderKey),
    status: normalizeScreeningSessionStatus(item.status),
    providerSessionStatus: cleanString(item.providerSessionStatus, 120),
    providerSessionId: cleanString(item.providerSessionId, 160),
    handoffType: item.handoffType === "redirect" ? "redirect" : "manual",
    redirectUrl: cleanString(item.redirectUrl, 500),
    returnUrl: cleanString(item.returnUrl, 500),
    expiresAt: Number(item.expiresAt || 0) || null,
    correlationId: cleanString(item.correlationId, 120),
    stateToken: cleanString(item.stateToken, 120),
    stateTokenHash: cleanString(item.stateTokenHash, 120),
    redirectStateId: cleanString(item.redirectStateId, 160),
    redirectPreparedAt: Number(item.redirectPreparedAt || 0) || null,
    redirectLastUpdatedAt: Number(item.redirectLastUpdatedAt || 0) || null,
    redirectPreparationStatus:
      item.redirectPreparationStatus === "prepared" ||
      item.redirectPreparationStatus === "blocked" ||
      item.redirectPreparationStatus === "expired" ||
      item.redirectPreparationStatus === "consumed"
        ? item.redirectPreparationStatus
        : item.handoffType === "redirect"
        ? "prepared"
        : "not_applicable",
    returnState:
      (SCREENING_RETURN_STATES as readonly string[]).includes(String(item.returnState || ""))
        ? (item.returnState as ScreeningReturnState)
        : null,
    returnStateResolvedAt: Number(item.returnStateResolvedAt || 0) || null,
    isActive: item.isActive !== false,
    duplicateOfSessionId: cleanString(item.duplicateOfSessionId, 160),
    callbackReceivedAt: Number(item.callbackReceivedAt || 0) || null,
    normalizedResultStatus: normalizeScreeningResultStatus(item.normalizedResultStatus),
    createdAt: Number(item.createdAt || 0) || Date.now(),
    updatedAt: Number(item.updatedAt || 0) || Date.now(),
  };
}

async function getScreeningSessionById(sessionId: string): Promise<ScreeningSessionRecord | null> {
  const snap = await db.collection("screening_sessions").doc(sessionId).get();
  if (!snap.exists) return null;
  const item = (snap.data() as any) || {};
  return {
    id: snap.id,
    requestId: cleanString(item.requestId, 160) || "",
    providerKey: ((cleanString(item.providerKey, 80) || "manual") as ScreeningProviderKey),
    status: normalizeScreeningSessionStatus(item.status),
    providerSessionStatus: cleanString(item.providerSessionStatus, 120),
    providerSessionId: cleanString(item.providerSessionId, 160),
    handoffType: item.handoffType === "redirect" ? "redirect" : "manual",
    redirectUrl: cleanString(item.redirectUrl, 500),
    returnUrl: cleanString(item.returnUrl, 500),
    expiresAt: Number(item.expiresAt || 0) || null,
    correlationId: cleanString(item.correlationId, 120),
    stateToken: cleanString(item.stateToken, 120),
    stateTokenHash: cleanString(item.stateTokenHash, 120),
    redirectStateId: cleanString(item.redirectStateId, 160),
    redirectPreparedAt: Number(item.redirectPreparedAt || 0) || null,
    redirectLastUpdatedAt: Number(item.redirectLastUpdatedAt || 0) || null,
    redirectPreparationStatus:
      item.redirectPreparationStatus === "prepared" ||
      item.redirectPreparationStatus === "blocked" ||
      item.redirectPreparationStatus === "expired" ||
      item.redirectPreparationStatus === "consumed"
        ? item.redirectPreparationStatus
        : item.handoffType === "redirect"
        ? "prepared"
        : "not_applicable",
    returnState:
      (SCREENING_RETURN_STATES as readonly string[]).includes(String(item.returnState || ""))
        ? (item.returnState as ScreeningReturnState)
        : null,
    returnStateResolvedAt: Number(item.returnStateResolvedAt || 0) || null,
    isActive: item.isActive !== false,
    duplicateOfSessionId: cleanString(item.duplicateOfSessionId, 160),
    callbackReceivedAt: Number(item.callbackReceivedAt || 0) || null,
    normalizedResultStatus: normalizeScreeningResultStatus(item.normalizedResultStatus),
    createdAt: Number(item.createdAt || 0) || Date.now(),
    updatedAt: Number(item.updatedAt || 0) || Date.now(),
  };
}

async function findScreeningSessionByStateToken(stateToken: string): Promise<ScreeningSessionRecord | null> {
  const redirectState = await getRedirectStateByToken(stateToken);
  if (!redirectState?.sessionId) return null;
  return getScreeningSessionById(redirectState.sessionId);
}

async function getActiveScreeningSession(request: ScreeningRequestRecord): Promise<ScreeningSessionRecord | null> {
  if (request.activeSessionId) {
    const session = await getScreeningSessionById(request.activeSessionId);
    if (session && session.requestId === request.id && session.isActive !== false) return session;
  }
  const session = await getLatestSession(request.id);
  if (!session || session.isActive === false) return null;
  return session;
}

async function getLatestResult(requestId: string): Promise<ScreeningResultRecord | null> {
  const snap = await db
    .collection("screening_results")
    .where("requestId", "==", requestId)
    .limit(50)
    .get();
  const items = snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));
  const item = items[0];
  if (!item) return null;
  return {
    id: item.id,
    requestId,
    sessionId: cleanString(item.sessionId, 160) || "",
    providerKey: ((cleanString(item.providerKey, 80) || "manual") as ScreeningProviderKey),
    status: normalizeScreeningResultStatus(item.status),
    summary: cleanString(item.summary, 500),
    normalizedDecision: cleanString(item.normalizedDecision, 120),
    identityVerified: typeof item.identityVerified === "boolean" ? item.identityVerified : null,
    creditIncluded: typeof item.creditIncluded === "boolean" ? item.creditIncluded : null,
    incomeIncluded: typeof item.incomeIncluded === "boolean" ? item.incomeIncluded : null,
    fraudFlags: normalizeStringList(item.fraudFlags, 12, 80),
    providerStatusMapped: cleanString(item.providerStatusMapped, 160),
    reportAvailability: item.reportAvailability
      ? {
          summaryAvailable: Boolean(item.reportAvailability.summaryAvailable),
          fullReportAvailable: Boolean(item.reportAvailability.fullReportAvailable),
        }
      : null,
    reportAvailable: Boolean(item.reportAvailable),
    rawPayloadRef: cleanString(item.rawPayloadRef, 240),
    fullReportStorageRef: cleanString(item.fullReportStorageRef, 240),
    createdAt: Number(item.createdAt || 0) || Date.now(),
    updatedAt: Number(item.updatedAt || 0) || Date.now(),
  };
}

async function getRedirectStateById(redirectStateId: string): Promise<ScreeningRedirectStateRecord | null> {
  const snap = await db.collection("screening_redirect_states").doc(redirectStateId).get();
  if (!snap.exists) return null;
  const item = (snap.data() as any) || {};
  return {
    id: snap.id,
    requestId: cleanString(item.requestId, 160) || "",
    sessionId: cleanString(item.sessionId, 160) || "",
    providerKey: ((cleanString(item.providerKey, 80) || "manual") as ScreeningProviderKey),
    correlationId: cleanString(item.correlationId, 160),
    providerSessionId: cleanString(item.providerSessionId, 160),
    stateTokenHash: cleanString(item.stateTokenHash, 120) || "",
    stateTokenPreview: cleanString(item.stateTokenPreview, 32),
    returnUrl: cleanString(item.returnUrl, 500),
    expiresAt: Number(item.expiresAt || 0) || null,
    preparedAt: Number(item.preparedAt || 0) || 0,
    updatedAt: Number(item.updatedAt || 0) || 0,
    callbackReceivedAt: Number(item.callbackReceivedAt || 0) || null,
    consumedAt: Number(item.consumedAt || 0) || null,
    callbackCount: Number(item.callbackCount || 0) || 0,
    status:
      item.status === "callback_received" ||
      item.status === "completed" ||
      item.status === "expired" ||
      item.status === "rejected" ||
      item.status === "duplicate"
        ? item.status
        : "prepared",
    lastOutcome: cleanString(item.lastOutcome, 160),
    lastRejectedReason: cleanString(item.lastRejectedReason, 160),
  };
}

async function getRedirectStateByToken(stateToken: string): Promise<ScreeningRedirectStateRecord | null> {
  const safeStateToken = cleanString(stateToken, 200);
  if (!safeStateToken) return null;
  const redirectStateId = makeDeterministicDocId(["redirect_state", hashOpaqueToken(safeStateToken)]);
  return getRedirectStateById(redirectStateId);
}

async function getScreeningAuditTrail(requestId: string, limit = 25) {
  const snap = await db
    .collection("screening_audit_log")
    .where("requestId", "==", requestId)
    .limit(limit)
    .get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function screeningSummaryText(request: ScreeningRequestRecord, session: ScreeningSessionRecord | null, result: ScreeningResultRecord | null): string {
  if (result?.summary) return result.summary;
  if (request.status === "manual_review_required") return "A manual review path is active while provider routing remains unavailable.";
  if (request.status === "completed") return "Screening is complete. Your landlord can review the summary.";
  if (request.status === "failed") return "We could not complete the screening. You can retry when ready.";
  if (session?.handoffType === "redirect") return "Your screening partner handoff is ready. Continue when you are ready.";
  if (request.status === "consent_pending") return "Consent is required before screening can begin.";
  return "Screening is queued and ready for the next step.";
}

function getScreeningProviderLabel(providerKey: ScreeningProviderKey | null | undefined): string {
  if (providerKey === "transunion_redirect") return "TransUnion";
  if (providerKey === "equifax") return "Equifax";
  if (providerKey === "manual") return "Manual review";
  return "Selected screening provider";
}

function isSafeRequesterLabel(value: any): value is string {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.includes("@")) return false;
  return true;
}

function pickSafeRequesterLabel(source: any, candidates: string[]) {
  for (const key of candidates) {
    const value = source?.[key];
    if (isSafeRequesterLabel(value)) {
      return String(value).trim();
    }
  }
  return null;
}

async function resolveTenantSafeRequesterLabel(landlordId: string | null | undefined): Promise<string | null> {
  const normalizedLandlordId = cleanString(landlordId, 160);
  if (!normalizedLandlordId) return null;

  try {
    const landlordSnap = await db.collection("landlords").doc(normalizedLandlordId).get();
    if (landlordSnap.exists) {
      const landlord = (landlordSnap.data() as any) || {};
      const landlordLabel = pickSafeRequesterLabel(landlord, [
        "businessName",
        "displayName",
        "companyName",
        "company",
        "name",
        "fullName",
      ]);
      if (landlordLabel) return landlordLabel;
    }
  } catch {}

  try {
    const accountSnap = await db.collection("accounts").doc(normalizedLandlordId).get();
    if (accountSnap.exists) {
      const account = (accountSnap.data() as any) || {};
      const accountLabel = pickSafeRequesterLabel(account, [
        "displayName",
        "businessName",
        "companyName",
        "accountName",
        "organizationName",
        "company",
      ]);
      if (accountLabel) return accountLabel;
    }
  } catch {}

  try {
    const userSnap = await db.collection("users").doc(normalizedLandlordId).get();
    if (userSnap.exists) {
      const user = (userSnap.data() as any) || {};
      const userLabel = pickSafeRequesterLabel(user, [
        "displayName",
        "businessName",
        "companyName",
        "company",
        "name",
        "fullName",
      ]);
      if (userLabel) return userLabel;
    }
  } catch {}

  return null;
}

function buildScreeningConsentSummary(input: {
  providerKey: ScreeningProviderKey | null | undefined;
  propertyLabel?: string | null;
  unitLabel?: string | null;
}) {
  const providerLabel = getScreeningProviderLabel(input.providerKey);
  const locationLabel = [input.propertyLabel, input.unitLabel].filter(Boolean).join(" - ");
  const locationSegment = locationLabel ? ` for ${locationLabel}` : "";
  return `The landlord requested tenant screening${locationSegment}. A third-party screening provider may be used, including ${providerLabel} when applicable. RentChain records consent and workflow status for audit and application review purposes.`;
}

async function writeScreeningConsentCanonicalEvent(input: {
  request: ScreeningRequestRecord;
  consent: ScreeningConsentRecord;
  actorId: string;
}) {
  const providerKey = input.consent.providerKey || input.request.providerSelection || null;
  const providerLabel = input.consent.providerLabel || getScreeningProviderLabel(providerKey);
  await writeCanonicalEvent({
    type: "screening_consent_confirmed",
    domain: "screening",
    action: "screening_consent_confirmed",
    status: "confirmed",
    actor: {
      type: "tenant",
      id: input.actorId,
      role: "tenant",
    },
    resource: {
      type: "screening_request",
      id: input.request.id,
      parentType: input.request.rentalApplicationId
        ? "rental_application"
        : input.request.landlordId
        ? "landlord"
        : "tenant",
      parentId:
        input.request.rentalApplicationId ||
        input.request.landlordId ||
        input.request.applicantTenantId ||
        null,
    },
    visibility: "internal",
    occurredAt: input.consent.acceptedAt || Date.now(),
    summary: "Tenant screening consent confirmed",
    metadata: {
      requestId: input.request.id,
      consentId: input.consent.id,
      tenantId: input.request.applicantTenantId || input.consent.tenantId || null,
      applicantId: input.request.applicantUserId || input.consent.applicantId || null,
      applicationId:
        input.request.rentalApplicationId || input.consent.rentalApplicationId || null,
      landlordId: input.request.landlordId || input.consent.landlordId || null,
      propertyId: input.request.propertyId || input.consent.propertyId || null,
      providerKey,
      providerLabel,
      consentVersion:
        input.consent.consentVersion || input.consent.disclosureVersion || null,
      acceptedBy: input.consent.acceptedBy || input.actorId,
      consentTextSummary: input.consent.consentTextSummary || null,
    },
    tags: ["screening-consent", `provider:${providerKey || "pending"}`],
  });
}

async function getTenantConversationIds(tenantId: string): Promise<string[]> {
  const snap = await db
    .collection("conversations")
    .where("tenantId", "==", tenantId)
    .limit(20)
    .get();
  return snap.docs.map((doc) => doc.id);
}

async function getMessageReadMap(tenantId: string): Promise<Map<string, number>> {
  const snap = await db
    .collection("tenantMessageReads")
    .where("tenantId", "==", tenantId)
    .limit(500)
    .get();
  const map = new Map<string, number>();
  snap.docs.forEach((doc) => {
    const data = (doc.data() as any) || {};
    const messageId = String(data.messageId || "").trim();
    const readAtMs = Number(data.readAtMs || 0);
    if (messageId) map.set(messageId, readAtMs || Date.now());
  });
  return map;
}

async function getNoticeReadMap(tenantId: string): Promise<Map<string, number>> {
  const snap = await db
    .collection("tenantNoticeReads")
    .where("tenantId", "==", tenantId)
    .limit(500)
    .get();
  const map = new Map<string, number>();
  snap.docs.forEach((doc) => {
    const data = (doc.data() as any) || {};
    const noticeId = String(data.noticeId || "").trim();
    const readAtMs = Number(data.readAtMs || 0);
    if (noticeId) map.set(noticeId, readAtMs || Date.now());
  });
  return map;
}

async function getMaintenanceReadMap(tenantId: string): Promise<Map<string, number>> {
  const snap = await db
    .collection("tenantMaintenanceReads")
    .where("tenantId", "==", tenantId)
    .limit(500)
    .get();
  const map = new Map<string, number>();
  snap.docs.forEach((doc) => {
    const data = (doc.data() as any) || {};
    const requestId = String(data.requestId || "").trim();
    const readAtMs = Number(data.readAtMs || 0);
    if (requestId) map.set(requestId, readAtMs || Date.now());
  });
  return map;
}

function getProviderPriority(config: ReturnType<typeof getScreeningConfig>): ScreeningProviderKey[] {
  const allowed: ScreeningProviderKey[] = ["transunion_redirect", "equifax", "manual"];
  const ranked = config.providerPriority.filter((item): item is ScreeningProviderKey => allowed.includes(item));
  if (!ranked.includes(config.defaultProvider)) ranked.push(config.defaultProvider);
  if (!ranked.includes("manual")) ranked.push("manual");
  return ranked;
}

function selectScreeningProvider(config: ReturnType<typeof getScreeningConfig>): ScreeningProviderKey | null {
  if (!config.enabled) return null;
  const ranked = getProviderPriority(config);
  for (const provider of ranked) {
    if (provider === "manual" && config.providers.manual) return provider;
    if (provider === "equifax" && config.providers.equifax) return provider;
    if (provider === "transunion_redirect" && config.providers.transunion_redirect) return provider;
  }
  return null;
}

type ScreeningAdapterContext = {
  request: ScreeningRequestRecord;
  consent: ScreeningConsentRecord;
  providerKey: ScreeningProviderKey;
  config: ReturnType<typeof getScreeningConfig>;
};

type ScreeningAdapterResult = {
  session: Omit<ScreeningSessionRecord, "id">;
  result: Omit<ScreeningResultRecord, "id"> | null;
  requestStatus: ScreeningRequestStatus;
  nextAction: string;
};

type ScreeningCallbackContext = {
  session: ScreeningSessionRecord;
  request: ScreeningRequestRecord;
  payload: any;
};

type NormalizedScreeningResultContract = {
  status: ScreeningResultStatus;
  summary: string;
  normalizedDecision: string | null;
  identityVerified: boolean | null;
  creditIncluded: boolean | null;
  incomeIncluded: boolean | null;
  fraudFlags: string[];
  providerStatusMapped: string | null;
  reportAvailability: {
    summaryAvailable: boolean;
    fullReportAvailable: boolean;
  };
  reportAvailable: boolean;
};

type RedirectPreparationResult = {
  redirectUrl: string | null;
  returnUrl: string | null;
  expiresAt: number | null;
  providerSessionId: string | null;
  correlationId: string;
  stateToken: string;
  stateTokenHash: string;
  redirectStateId: string;
  redirectPreparedAt: number;
  redirectPreparationStatus: "prepared";
  returnState: ScreeningReturnState;
};

type ScreeningProviderAdapter = {
  createSession: (ctx: ScreeningAdapterContext) => Promise<ScreeningAdapterResult>;
  handleCallback: (ctx: ScreeningCallbackContext) => Promise<{
    requestStatus: ScreeningRequestStatus;
    sessionStatus: ScreeningSessionStatus;
    resultStatus: ScreeningResultStatus;
    summary: string;
  }>;
  normalizeResult: (payload: any) => NormalizedScreeningResultContract;
};

async function prepareRedirectSession(input: {
  request: ScreeningRequestRecord;
  providerKey: ScreeningProviderKey;
  requestedSessionId: string;
  existingCorrelationId?: string | null;
  existingProviderSessionId?: string | null;
}): Promise<RedirectPreparationResult> {
  const now = Date.now();
  const stateToken = makeSecureOpaqueToken();
  const stateTokenHash = hashOpaqueToken(stateToken);
  const redirectStateId = makeDeterministicDocId(["redirect_state", stateTokenHash]);
  return {
    redirectUrl: null,
    returnUrl: buildTenantScreeningReturnUrl(input.request.id),
    expiresAt: now + 1000 * 60 * 30,
    providerSessionId: input.existingProviderSessionId || null,
    correlationId: input.existingCorrelationId || makeScreeningCorrelationId(`${input.providerKey}_corr`),
    stateToken,
    stateTokenHash,
    redirectStateId,
    redirectPreparedAt: now,
    redirectPreparationStatus: "prepared",
    returnState: "pending",
  };
}

const screeningAdapters: Record<ScreeningProviderKey, ScreeningProviderAdapter> = {
  manual: {
    async createSession(ctx) {
      const now = Date.now();
      return {
        session: {
          requestId: ctx.request.id,
          providerKey: "manual",
          status: "pending_review",
          providerSessionStatus: "manual_review_pending",
          handoffType: "manual",
          redirectUrl: null,
          returnUrl: null,
          expiresAt: null,
          correlationId: makeScreeningCorrelationId("manual"),
          stateToken: null,
          isActive: true,
          duplicateOfSessionId: null,
          callbackReceivedAt: null,
          normalizedResultStatus: "manual_review_required",
          createdAt: now,
          updatedAt: now,
        },
        result: {
          requestId: ctx.request.id,
          sessionId: "",
          providerKey: "manual",
          status: "manual_review_required",
          summary: "Manual review required while external screening providers are unavailable.",
          normalizedDecision: "manual_review_required",
          reportAvailable: false,
          rawPayloadRef: "manual://screening/manual-review",
          fullReportStorageRef: null,
          createdAt: now,
          updatedAt: now,
        },
        requestStatus: "manual_review_required",
        nextAction: "await_manual_review",
      };
    },
    async handleCallback() {
      return {
        requestStatus: "manual_review_required",
        sessionStatus: "pending_review",
        resultStatus: "manual_review_required",
        summary: "Manual review remains active.",
      };
    },
    normalizeResult() {
      return {
        status: "manual_review_required",
        summary: "Manual review required while external screening providers are unavailable.",
        normalizedDecision: "manual_review_required",
        identityVerified: null,
        creditIncluded: false,
        incomeIncluded: false,
        fraudFlags: [],
        providerStatusMapped: "manual_review_required",
        reportAvailability: {
          summaryAvailable: true,
          fullReportAvailable: false,
        },
        reportAvailable: false,
      };
    },
  },
  equifax: {
    async createSession(ctx) {
      const redirect = await prepareRedirectSession({
        request: ctx.request,
        providerKey: "equifax",
        requestedSessionId: makeScreeningCorrelationId("eqx_session"),
      });
      return {
        session: {
          requestId: ctx.request.id,
          providerKey: "equifax",
          status: "redirect_pending",
          providerSessionStatus: "stub_not_enabled",
          providerSessionId: redirect.providerSessionId,
          handoffType: "redirect",
          redirectUrl: redirect.redirectUrl,
          returnUrl: redirect.returnUrl,
          expiresAt: redirect.expiresAt,
          correlationId: redirect.correlationId,
          stateToken: redirect.stateToken,
          stateTokenHash: redirect.stateTokenHash,
          redirectStateId: redirect.redirectStateId,
          redirectPreparedAt: redirect.redirectPreparedAt,
          redirectLastUpdatedAt: redirect.redirectPreparedAt,
          redirectPreparationStatus: redirect.redirectPreparationStatus,
          returnState: redirect.returnState,
          returnStateResolvedAt: redirect.redirectPreparedAt,
          isActive: true,
          duplicateOfSessionId: null,
          callbackReceivedAt: null,
          normalizedResultStatus: "pending",
          createdAt: redirect.redirectPreparedAt,
          updatedAt: redirect.redirectPreparedAt,
        },
        result: null,
        requestStatus: "in_progress",
        nextAction: "provider_activation_pending",
      };
    },
    async handleCallback() {
      return {
        requestStatus: "in_progress",
        sessionStatus: "in_progress",
        resultStatus: "pending",
        summary: "Equifax redirect scaffold is not enabled in this environment.",
      };
    },
    normalizeResult(payload: any) {
      return {
        status: "pending",
        summary: "Equifax redirect scaffold is not enabled in this environment.",
        normalizedDecision: null,
        identityVerified: null,
        creditIncluded: false,
        incomeIncluded: false,
        fraudFlags: [],
        providerStatusMapped: "stub_not_enabled",
        reportAvailability: {
          summaryAvailable: false,
          fullReportAvailable: false,
        },
        reportAvailable: false,
      };
    },
  },
  transunion_redirect: {
    async createSession(ctx) {
      const redirect = await prepareRedirectSession({
        request: ctx.request,
        providerKey: "transunion_redirect",
        requestedSessionId: makeScreeningCorrelationId("tu_session"),
      });
      return {
        session: {
          requestId: ctx.request.id,
          providerKey: "transunion_redirect",
          status: "redirect_pending",
          providerSessionStatus: "stub_not_enabled",
          providerSessionId: redirect.providerSessionId,
          handoffType: "redirect",
          redirectUrl: redirect.redirectUrl,
          returnUrl: redirect.returnUrl,
          expiresAt: redirect.expiresAt,
          correlationId: redirect.correlationId,
          stateToken: redirect.stateToken,
          stateTokenHash: redirect.stateTokenHash,
          redirectStateId: redirect.redirectStateId,
          redirectPreparedAt: redirect.redirectPreparedAt,
          redirectLastUpdatedAt: redirect.redirectPreparedAt,
          redirectPreparationStatus: redirect.redirectPreparationStatus,
          returnState: redirect.returnState,
          returnStateResolvedAt: redirect.redirectPreparedAt,
          isActive: true,
          duplicateOfSessionId: null,
          callbackReceivedAt: null,
          normalizedResultStatus: "pending",
          createdAt: redirect.redirectPreparedAt,
          updatedAt: redirect.redirectPreparedAt,
        },
        result: null,
        requestStatus: "in_progress",
        nextAction: "await_redirect_provider_start",
      };
    },
    async handleCallback() {
      return {
        requestStatus: "in_progress",
        sessionStatus: "in_progress",
        resultStatus: "pending",
        summary: "TransUnion redirect scaffold is registered but live callbacks are disabled.",
      };
    },
    normalizeResult(payload: any) {
      const providerStatusMapped =
        cleanString(payload?.providerStatus || payload?.status || payload?.decision, 160) || "callback_received_stub";
      return {
        status: "pending",
        summary: "TransUnion redirect scaffold is registered but live callbacks are disabled.",
        normalizedDecision: null,
        identityVerified: null,
        creditIncluded: false,
        incomeIncluded: false,
        fraudFlags: normalizeStringList(payload?.fraudFlags, 12, 80),
        providerStatusMapped,
        reportAvailability: {
          summaryAvailable: false,
          fullReportAvailable: false,
        },
        reportAvailable: false,
      };
    },
  },
};
function shapeScreeningResponse(input: {
  request: ScreeningRequestRecord;
  consent: ScreeningConsentRecord | null;
  session: ScreeningSessionRecord | null;
  result: ScreeningResultRecord | null;
  auditTrail?: any[];
  requesterDisplayLabel?: string | null;
}) {
  const { request, consent, session, result } = input;
  const returnState = resolveReturnState(request, session, result);
  const tenantSafeState = adaptTenantSafeScreeningState({
    requestStatus: request.status,
    nextAction: request.nextAction,
    consentAcceptedAt: request.consentedAt || consent?.acceptedAt || null,
    sessionStatus: session?.status || null,
    resultStatus: result?.status || request.normalizedResultStatus,
    providerSessionStatus: session?.providerSessionStatus || result?.providerStatusMapped || null,
  });
  return {
    id: request.id,
    rentalApplicationId: request.rentalApplicationId,
    status: request.status,
    normalizedResultStatus: result?.status || request.normalizedResultStatus,
    requestedAt: request.requestedAt || request.createdAt || null,
    consentedAt: request.consentedAt || consent?.acceptedAt || null,
    startedAt: request.startedAt || session?.createdAt || null,
    completedAt: request.completedAt || result?.updatedAt || null,
    provider: session?.providerKey || request.providerSelection || null,
    providerLabel: getScreeningProviderLabel(session?.providerKey || request.providerSelection || null),
    packageType: request.packageType,
    payerType: request.payerType,
    propertyLabel: request.propertyLabel,
    unitLabel: request.unitLabel,
    applicantName: request.applicantName,
    requesterDisplayLabel: input.requesterDisplayLabel || null,
    nextAction: request.nextAction || null,
    tenantStatus: tenantSafeState.tenantStatus,
    tenantStatusLabel: tenantSafeState.tenantStatusLabel,
    tenantStatusDescription: tenantSafeState.tenantStatusDescription,
    tenantNextAction: tenantSafeState.tenantNextAction,
    consent: consent
      ? {
          id: consent.id,
          requestId: consent.requestId,
          tenantId: consent.tenantId,
          applicantId: consent.applicantId || null,
          rentalApplicationId: consent.rentalApplicationId || null,
          landlordId: consent.landlordId || null,
          propertyId: consent.propertyId || null,
          providerKey: consent.providerKey || null,
          providerLabel: consent.providerLabel || null,
          consentVersion: consent.consentVersion || consent.disclosureVersion || null,
          consentTextSummary: consent.consentTextSummary || null,
          viewedAt: consent.viewedAt,
          acceptedAt: consent.acceptedAt,
          acceptedBy: consent.acceptedBy || null,
          providerDisclosure: consent.providerDisclosure,
          disclosureVersion: consent.disclosureVersion,
        }
      : null,
    session: session
      ? {
          id: session.id,
          providerKey: session.providerKey,
          status: session.status,
          providerSessionStatus: session.providerSessionStatus || null,
          handoffType: session.handoffType,
          redirectUrl: session.redirectUrl,
          returnUrl: session.returnUrl,
          expiresAt: session.expiresAt,
          redirect: {
            eligible: session.handoffType === "redirect" && session.isActive !== false,
            prepared: Boolean(session.redirectPreparedAt),
            preparedAt: session.redirectPreparedAt || null,
            lastUpdatedAt: session.redirectLastUpdatedAt || session.updatedAt || null,
            status: session.redirectPreparationStatus || (session.handoffType === "redirect" ? "prepared" : "not_applicable"),
            activationEnabled:
              session.providerKey === "transunion_redirect"
                ? getScreeningConfig().providers.transunion_redirect
                : session.providerKey === "equifax"
                ? getScreeningConfig().providers.equifax
                : false,
          },
          returnState: session.returnState || returnState,
          callbackReceivedAt: session.callbackReceivedAt || null,
        }
      : null,
    result: result
      ? {
          id: result.id,
          status: result.status,
          summary: result.summary,
          normalizedDecision: result.normalizedDecision,
          identityVerified: result.identityVerified ?? null,
          creditIncluded: result.creditIncluded ?? null,
          incomeIncluded: result.incomeIncluded ?? null,
          fraudFlags: result.fraudFlags || [],
          providerStatusMapped: result.providerStatusMapped || null,
          reportAvailability: result.reportAvailability || {
            summaryAvailable: Boolean(result.summary),
            fullReportAvailable: Boolean(result.fullReportStorageRef),
          },
          reportAvailable: result.reportAvailable,
        }
      : null,
    returnFlow: {
      state: returnState,
      callbackReceivedAt: session?.callbackReceivedAt || null,
      resolvedAt: session?.returnStateResolvedAt || result?.updatedAt || request.updatedAt || null,
      isFinalized: ["completed", "expired", "unable_to_complete"].includes(returnState),
    },
    summary: {
      status: request.status,
      provider: session?.providerKey || request.providerSelection || "pending",
      requestedDate: request.requestedAt || request.createdAt || null,
      package: request.packageType,
      summaryResult: screeningSummaryText(request, session, result),
      nextActions: request.nextAction ? [request.nextAction] : [],
      returnState,
    },
    auditTrail: Array.isArray(input.auditTrail)
      ? input.auditTrail.map((item) => ({
          id: item.id,
          eventType: item.eventType || null,
          actorRole: item.actorRole || null,
          createdAt: Number(item.createdAt || 0) || null,
          metadata: item.metadata || {},
        }))
      : [],
  };
}

async function shapeTenantScreeningResponse(input: {
  request: ScreeningRequestRecord;
  consent: ScreeningConsentRecord | null;
  session: ScreeningSessionRecord | null;
  result: ScreeningResultRecord | null;
  auditTrail?: any[];
}) {
  const requesterDisplayLabel = await resolveTenantSafeRequesterLabel(input.request.landlordId);
  return shapeScreeningResponse({
    ...input,
    requesterDisplayLabel,
  });
}

async function createScreeningSessionSafely(input: {
  requestId: string;
  actorRole: string;
  actorId: string | null;
  tenantId: string;
}): Promise<{
  request: ScreeningRequestRecord;
  consent: ScreeningConsentRecord;
  session: ScreeningSessionRecord;
  result: ScreeningResultRecord | null;
  created: boolean;
}> {
  const config = getScreeningConfig();
  const requestRef = db.collection("screening_requests").doc(input.requestId);
  const sessionRef = db.collection("screening_sessions").doc();
  const resultRef = db.collection("screening_results").doc();

  const transactionResult = await db.runTransaction(async (tx) => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists) {
      throw new Error("NOT_FOUND");
    }
    const request = await getScreeningRequestById(input.requestId);
    if (!request) throw new Error("NOT_FOUND");
    if (!request.applicantTenantId || request.applicantTenantId !== input.tenantId) {
      throw new Error("FORBIDDEN");
    }
    if (!request.latestConsentId) {
      throw new Error("CONSENT_REQUIRED");
    }
    const consentRef = db.collection("screening_consents").doc(request.latestConsentId);
    const consentSnap = await tx.get(consentRef);
    if (!consentSnap.exists) throw new Error("CONSENT_REQUIRED");
    const consentData = (consentSnap.data() as any) || {};
    const consent: ScreeningConsentRecord = {
      id: consentSnap.id,
      requestId: input.requestId,
      tenantId: cleanString(consentData.tenantId, 160) || "",
      viewedAt: Number(consentData.viewedAt || 0) || null,
      acceptedAt: Number(consentData.acceptedAt || 0) || null,
      providerDisclosure: cleanString(consentData.providerDisclosure, 200),
      disclosureVersion: cleanString(consentData.disclosureVersion, 80),
    };
    if (!consent.acceptedAt) throw new Error("CONSENT_REQUIRED");

    if (request.activeSessionId) {
      const existingActiveSnap = await tx.get(db.collection("screening_sessions").doc(request.activeSessionId));
      if (existingActiveSnap.exists) {
        const existing = await getScreeningSessionById(request.activeSessionId);
        if (existing && existing.isActive !== false) {
          return { request, consent, session: existing, result: await getLatestResult(input.requestId), created: false };
        }
      }
    }

    if (isTerminalScreeningRequestStatus(request.status) && request.activeSessionId) {
      const terminalSession = await getScreeningSessionById(request.activeSessionId);
      if (terminalSession) {
        return { request, consent, session: terminalSession, result: await getLatestResult(input.requestId), created: false };
      }
    }

    const providerKey = selectScreeningProvider(config) || "manual";
    const adapter = screeningAdapters[providerKey];
    const started = await adapter.createSession({
      request,
      consent,
      providerKey,
      config,
    });
    const now = Date.now();
    const rawStateToken = started.session.stateToken;
    const sessionRecord: ScreeningSessionRecord = {
      id: sessionRef.id,
      ...started.session,
      stateToken: null,
      isActive: true,
      updatedAt: now,
    };
    tx.set(sessionRef, sessionRecord);

    if (sessionRecord.handoffType === "redirect" && sessionRecord.redirectStateId && rawStateToken && sessionRecord.stateTokenHash) {
      const redirectStateRecord: ScreeningRedirectStateRecord = {
        id: sessionRecord.redirectStateId,
        requestId: request.id,
        sessionId: sessionRef.id,
        providerKey,
        correlationId: sessionRecord.correlationId || null,
        providerSessionId: sessionRecord.providerSessionId || null,
        stateTokenHash: sessionRecord.stateTokenHash,
        stateTokenPreview: makeStateTokenPreview(rawStateToken),
        returnUrl: sessionRecord.returnUrl,
        expiresAt: sessionRecord.expiresAt,
        preparedAt: sessionRecord.redirectPreparedAt || now,
        updatedAt: now,
        callbackReceivedAt: null,
        consumedAt: null,
        callbackCount: 0,
        status: "prepared",
        lastOutcome: "redirect_prepared",
        lastRejectedReason: null,
      };
      tx.set(db.collection("screening_redirect_states").doc(sessionRecord.redirectStateId), redirectStateRecord);
    }

    let resultRecord: ScreeningResultRecord | null = null;
    if (started.result) {
      resultRecord = {
        id: resultRef.id,
        ...started.result,
        sessionId: sessionRef.id,
        updatedAt: now,
      };
      tx.set(resultRef, resultRecord);
    }

    tx.set(
      requestRef,
      {
        status: started.requestStatus,
        normalizedResultStatus: resultRecord?.status || sessionRecord.normalizedResultStatus,
        providerSelection: providerKey,
        activeSessionId: sessionRef.id,
        latestResultId: resultRecord?.id || null,
        nextAction: started.nextAction,
        startedAt: now,
        updatedAt: now,
        latestAuditEventType: providerKey === "manual" ? "manual_review_selected" : "provider_session_created",
      },
      { merge: true }
    );

    return {
      request: {
        ...request,
        status: started.requestStatus,
        normalizedResultStatus: resultRecord?.status || sessionRecord.normalizedResultStatus,
        providerSelection: providerKey,
        activeSessionId: sessionRef.id,
        latestResultId: resultRecord?.id || null,
        nextAction: started.nextAction,
        startedAt: now,
        updatedAt: now,
      },
      consent,
      session: sessionRecord,
      result: resultRecord,
      created: true,
    };
  });

  return transactionResult;
}

async function prepareScreeningRetrySafely(input: {
  requestId: string;
  actorId: string | null;
  tenantId: string;
}): Promise<ScreeningRequestRecord> {
  const requestRef = db.collection("screening_requests").doc(input.requestId);
  return db.runTransaction(async (tx) => {
    const requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists) throw new Error("NOT_FOUND");
    const request = await getScreeningRequestById(input.requestId);
    if (!request) throw new Error("NOT_FOUND");
    if (!request.applicantTenantId || request.applicantTenantId !== input.tenantId) throw new Error("FORBIDDEN");

    const activeSession = request.activeSessionId ? await getScreeningSessionById(request.activeSessionId) : null;
    const duplicateRetryPrepared =
      !request.activeSessionId &&
      request.status === "consented" &&
      request.nextAction === "ready_to_start" &&
      request.latestResultId === null;
    if (duplicateRetryPrepared) return request;
    if (activeSession && !isTerminalScreeningSessionStatus(activeSession.status) && request.status === "in_progress") {
      throw new Error("SCREENING_STILL_IN_PROGRESS");
    }

    const now = Date.now();
    if (request.activeSessionId) {
      if (activeSession?.redirectStateId) {
        tx.set(
          db.collection("screening_redirect_states").doc(activeSession.redirectStateId),
          {
            status: "rejected",
            updatedAt: now,
            lastOutcome: "retry_superseded",
            lastRejectedReason: "SESSION_RETIRED_ON_RETRY",
          },
          { merge: true }
        );
      }
      tx.set(
        db.collection("screening_sessions").doc(request.activeSessionId),
        {
          isActive: false,
          duplicateOfSessionId: null,
          updatedAt: now,
        },
        { merge: true }
      );
    }
    tx.set(
      requestRef,
      {
        status: "consented",
        normalizedResultStatus: "pending",
        activeSessionId: null,
        latestResultId: null,
        nextAction: "ready_to_start",
        retryCount: Number(request.retryCount || 0) + 1,
        updatedAt: now,
        latestAuditEventType: "retry_requested",
      },
      { merge: true }
    );
    return {
      ...request,
      status: "consented",
      normalizedResultStatus: "pending",
      activeSessionId: null,
      latestResultId: null,
      nextAction: "ready_to_start",
      retryCount: Number(request.retryCount || 0) + 1,
      updatedAt: now,
    };
  });
}

async function buildTenantScreeningItems(tenantId: string): Promise<TenantCommunicationItem[]> {
  const [requestSnap, readMap] = await Promise.all([
    db.collection("screening_requests").where("applicantTenantId", "==", tenantId).limit(50).get(),
    getTenantScreeningReadMap(tenantId),
  ]);

  const items = requestSnap.docs.map((doc) => {
    const data = (doc.data() as any) || {};
    const request = {
      id: doc.id,
      status: normalizeScreeningRequestStatus(data.status),
      providerSelection: cleanString(data.providerSelection, 80),
      packageType: cleanString(data.packageType, 80),
      requestedAt: Number(data.requestedAt || data.createdAt || 0) || Date.now(),
      applicantName: cleanString(data.applicantName, 200) || "Applicant",
      nextAction: cleanString(data.nextAction, 120),
    };
    const title =
      request.status === "consent_pending"
        ? "Screening consent required"
        : request.status === "manual_review_required"
        ? "Screening moved to manual review"
        : request.status === "completed"
        ? "Screening complete"
        : "Screening update";
    const body = screeningSummaryText(
      {
        id: request.id,
        rentalApplicationId: null,
        landlordId: null,
        applicantTenantId: tenantId,
        applicantUserId: null,
        applicantEmail: null,
        applicantName: request.applicantName,
        propertyId: null,
        unitId: null,
        propertyLabel: null,
        unitLabel: null,
        packageType: request.packageType,
        payerType: null,
        addOns: [],
        status: request.status,
        normalizedResultStatus: "pending",
        providerSelection: (request.providerSelection as ScreeningProviderKey | null) || null,
        latestConsentId: null,
        activeSessionId: null,
        latestResultId: null,
        nextAction: request.nextAction,
      },
      null,
      null
    );
    return {
      id: `screening_${doc.id}`,
      type: "screening_update" as const,
      title,
      body,
      createdAt: isoFromMs(request.requestedAt),
      read: readMap.has(doc.id),
      priority: request.status === "failed" || request.status === "consent_pending" ? ("high" as const) : ("normal" as const),
      fromLabel: "RentChain" as const,
      relatedEntityType: "screening" as const,
      relatedEntityId: doc.id,
    };
  });

  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function buildTenantNoticeItems(tenantId: string): Promise<TenantCommunicationItem[]> {
  const [noticesSnap, readMap] = await Promise.all([
    db.collection("tenantNotices").where("tenantId", "==", tenantId).limit(100).get(),
    getNoticeReadMap(tenantId),
  ]);

  return noticesSnap.docs
    .map((doc) => {
      const data = (doc.data() as any) || {};
      const createdAtMs = toMillis(data.createdAt) ?? Date.now();
      const noticeId = doc.id;
      const typeRaw = String(data.type || "").toUpperCase();
      const priority: "low" | "normal" | "high" =
        typeRaw.includes("WARNING") || typeRaw.includes("LATE") ? "high" : "normal";
      return {
        id: noticeId,
        type: "notice" as const,
        title: String(data.title || "Notice"),
        body: String(data.body || ""),
        createdAt: isoFromMs(createdAtMs),
        read: readMap.has(noticeId),
        priority,
        fromLabel: "Landlord" as const,
        relatedEntityType: "notice" as const,
        relatedEntityId: noticeId,
      };
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function buildTenantMessageItems(tenantId: string): Promise<TenantCommunicationItem[]> {
  const [conversationIds, readMap] = await Promise.all([
    getTenantConversationIds(tenantId),
    getMessageReadMap(tenantId),
  ]);

  if (!conversationIds.length) return [];

  const messageBatches = await Promise.all(
    conversationIds.map((conversationId) =>
      db
        .collection("messages")
        .where("conversationId", "==", conversationId)
        .orderBy("createdAt", "desc")
        .limit(50)
        .get()
    )
  );

  const items: TenantCommunicationItem[] = [];
  messageBatches.forEach((batch) => {
    batch.docs.forEach((doc) => {
      const data = (doc.data() as any) || {};
      const messageId = doc.id;
      const createdAtMs = toMillis(data.createdAt ?? data.createdAtMs) ?? Date.now();
      const senderRole = String(data.senderRole || "").toLowerCase();
      const fromLabel =
        senderRole === "tenant" ? "RentChain" : senderRole === "landlord" ? "Landlord" : "RentChain";
      items.push({
        id: messageId,
        type: "message",
        title: senderRole === "landlord" ? "Message from landlord" : "Message update",
        body: String(data.body || ""),
        createdAt: isoFromMs(createdAtMs),
        read: readMap.has(messageId),
        priority: "normal",
        fromLabel: fromLabel as "Landlord" | "RentChain" | "Maintenance Team",
        relatedEntityType: "message",
        relatedEntityId: messageId,
      });
    });
  });

  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

async function buildTenantMaintenanceUpdateItems(tenantId: string): Promise<TenantCommunicationItem[]> {
  const [maintSnap, readMap] = await Promise.all([
    db.collection("maintenanceRequests").where("tenantId", "==", tenantId).limit(50).get(),
    getMaintenanceReadMap(tenantId),
  ]);
  const highStatuses = new Set(["URGENT", "BLOCKED", "CANCELLED"]);

  const items = maintSnap.docs.map((doc) => {
    const data = (doc.data() as any) || {};
    const status = String(data.status || "NEW").toUpperCase();
    const createdAtMs = toMillis(data.updatedAt ?? data.createdAt) ?? Date.now();
    const title = `Maintenance update: ${String(data.title || "Request").trim() || "Request"}`;
    const body = `Status: ${status}${data.landlordNote ? ` — ${String(data.landlordNote)}` : ""}`;
    return {
      id: `maintenance_${doc.id}`,
      type: "maintenance_update" as const,
      title,
      body,
      createdAt: isoFromMs(createdAtMs),
      read: readMap.has(doc.id),
      priority: highStatuses.has(status) ? ("high" as const) : ("normal" as const),
      fromLabel: "Maintenance Team" as const,
      relatedEntityType: "maintenance" as const,
      relatedEntityId: doc.id,
    };
  });

  return items.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function requireTenantWorkspaceIdentity(req: any, res: any, next: any) {
  const role = String(req.user?.role || "").trim().toLowerCase();
  const userId = String(req.user?.id || "").trim();
  const tenantId = String(req.user?.tenantId || "").trim();
  if (!userId || role !== "tenant" || !tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }
  return next();
}

const TENANT_NOTIFICATION_PREFERENCE_KEYS = [
  "follow_up_requested",
  "ready_for_rereview",
  "application_updated",
  "access_changed",
  "documents_updated",
] as const;

type TenantNotificationPreferenceKey = (typeof TENANT_NOTIFICATION_PREFERENCE_KEYS)[number];

type TenantNotificationPreferences = {
  inApp: Record<TenantNotificationPreferenceKey, boolean>;
  updatedAt: number | null;
};

function defaultTenantNotificationPreferences(): TenantNotificationPreferences {
  return {
    inApp: {
      follow_up_requested: true,
      ready_for_rereview: true,
      application_updated: true,
      access_changed: true,
      documents_updated: true,
    },
    updatedAt: null,
  };
}

function normalizeTenantNotificationPreferences(input: any): TenantNotificationPreferences {
  const defaults = defaultTenantNotificationPreferences();
  const source = input?.inApp && typeof input.inApp === "object" ? input.inApp : {};
  const inApp = { ...defaults.inApp };
  for (const key of TENANT_NOTIFICATION_PREFERENCE_KEYS) {
    if (typeof source[key] === "boolean") {
      inApp[key] = source[key];
    }
  }
  return {
    inApp,
    updatedAt: typeof input?.updatedAt === "number" && Number.isFinite(input.updatedAt) ? input.updatedAt : null,
  };
}

async function loadTenantNotificationPreferences(userId: string): Promise<TenantNotificationPreferences> {
  const userSnap = await db.collection("users").doc(userId).get();
  const data = userSnap.exists ? userSnap.data() : null;
  return normalizeTenantNotificationPreferences(data?.tenantNotificationPreferences);
}

async function resolveWorkspaceContextOrRespond(req: any, res: any) {
  const context = await resolveTenancyContext({
    uid: String(req.user?.id || "").trim(),
    email: String(req.user?.email || "").trim() || null,
    tenantId: String(req.user?.tenantId || "").trim() || null,
    leaseId: String(req.user?.leaseId || "").trim() || null,
  });

  if (context.ok) return context;

  if (context.reason === "unauthenticated") {
    res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return null;
  }

  if (context.reason === "no_authority") {
    res.status(409).json({
      ok: false,
      error: "TENANT_NOT_INITIALIZED",
      status: "tenant_not_initialized",
    });
    return null;
  }

  res.status(403).json({ ok: false, error: "AMBIGUOUS_TENANCY_CONTEXT" });
  return null;
}

async function loadDocument(collectionName: string, docId: string | null) {
  const id = String(docId || "").trim();
  if (!id) return null;
  const snap = await db.collection(collectionName).doc(id).get();
  if (!snap.exists) return null;
  return { id: snap.id, data: snap.data() as any };
}

async function loadTenantWorkspaceData(context: Awaited<ReturnType<typeof resolveTenancyContext>>) {
  const propertyDoc = await loadDocument("properties", context.propertyId);

  let applicationDoc = await loadDocument("applications", context.applicationId);
  if (!applicationDoc && context.tenantId) {
    try {
      const snap = await db.collection("applications").where("tenantId", "==", context.tenantId).limit(1).get();
      if (!snap.empty) {
        applicationDoc = { id: snap.docs[0].id, data: snap.docs[0].data() as any };
      }
    } catch {
      applicationDoc = null;
    }
  }
  if (!applicationDoc && context.invitedEmail) {
    try {
      const snap = await db.collection("applications").where("applicantEmail", "==", context.invitedEmail).limit(5).get();
      const match = snap.docs.find((doc) => String((doc.data() as any)?.propertyId || "") === String(context.propertyId || ""));
      if (match) applicationDoc = { id: match.id, data: match.data() as any };
    } catch {
      applicationDoc = null;
    }
  }

  let leaseDoc = await loadDocument("leases", context.leaseId);
  if (!leaseDoc && context.tenantId) {
    try {
      const directSnap = await db.collection("leases").where("tenantId", "==", context.tenantId).limit(5).get();
      const directMatch = directSnap.docs.find((doc) => {
        const data = doc.data() as any;
        return String(data?.propertyId || "") === String(context.propertyId || "");
      });
      if (directMatch) leaseDoc = { id: directMatch.id, data: directMatch.data() as any };
    } catch {
      leaseDoc = null;
    }
  }

  const maintenanceItems: Array<{ id: string; data: any }> = [];
  if (context.tenantId) {
    try {
      const snap = await db.collection("maintenanceRequests").where("tenantId", "==", context.tenantId).limit(50).get();
      snap.docs.forEach((doc) => {
        const data = doc.data() as any;
        if (context.propertyId && String(data?.propertyId || "") !== String(context.propertyId)) return;
        maintenanceItems.push({ id: doc.id, data });
      });
    } catch {
      // ignore maintenance visibility errors and fail closed to empty list
    }
  }

  return {
    property: propertyDoc ? projectTenantProperty(propertyDoc.id, propertyDoc.data) : null,
    application: applicationDoc ? projectTenantApplication(applicationDoc.id, applicationDoc.data) : null,
    lease: leaseDoc ? projectTenantLease(leaseDoc.id, leaseDoc.data) : null,
    maintenance: maintenanceItems
      .map((item) => projectTenantMaintenance(item.id, item.data))
      .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0)),
  };
}

function completionWeight(status: CompletionStatus): number {
  switch (status) {
    case "completed":
    case "verified":
      return 1;
    case "pending":
    case "in_progress":
      return 0.55;
    case "needs_review":
      return 0.35;
    default:
      return 0;
  }
}

function aggregateCompletionStatus(statuses: CompletionStatus[]): CompletionStatus {
  if (!statuses.length) return "not_started";
  if (statuses.every((status) => status === "completed" || status === "verified")) return "completed";
  if (statuses.some((status) => status === "needs_review")) return "needs_review";
  if (statuses.every((status) => status === "missing" || status === "not_started")) return "not_started";
  if (statuses.some((status) => status === "pending")) return "pending";
  return "in_progress";
}

function mapIdentityStatus(status: string | null | undefined): CompletionStatus {
  switch (String(status || "").trim().toLowerCase()) {
    case "verified":
      return "verified";
    case "pending":
      return "pending";
    case "needs_review":
      return "needs_review";
    case "missing":
      return "missing";
    default:
      return "not_started";
  }
}

function prettyChecklistLabel(value: string): string {
  return String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function inferActionPath(params: { key: string; nextAction: string | null; authority: string | null }): string | null {
  const key = String(params.key || "").toLowerCase();
  const nextAction = String(params.nextAction || "").toLowerCase();
  if (
    key.includes("document") ||
    key.includes("income") ||
    key.includes("upload") ||
    nextAction.includes("document") ||
    nextAction.includes("upload")
  ) {
    return "/tenant/attachments";
  }
  if (key.includes("identity") || key.includes("profile") || key.includes("employer")) {
    return "/tenant/profile";
  }
  if (key.includes("invite") || params.authority === "invite") {
    return "/tenant/invite/redeem";
  }
  if (key.includes("message") || key.includes("communication") || nextAction.includes("message") || nextAction.includes("contact")) {
    return "/tenant/messages";
  }
  return null;
}

function inferActionLabel(actionPath: string | null): string | null {
  switch (actionPath) {
    case "/tenant/attachments":
      return "Open documents";
    case "/tenant/profile":
      return "Update profile";
    case "/tenant/invite/redeem":
      return "Redeem invite";
    case "/tenant/messages":
      return "Open messages";
    case "/tenant/lease":
      return "Open lease";
    case "/tenant/activity":
      return "Open feed";
    case "/tenant/application":
      return "Open application";
    default:
      return null;
  }
}

function cleanProfileField(value: unknown, max = 120): string | null {
  const next = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
  return next || null;
}

async function queryFirstDocument(collectionName: string, field: string, value: string | null) {
  const normalized = cleanProfileField(value, 160);
  if (!normalized) return null;
  try {
    const snap = await db.collection(collectionName).where(field, "==", normalized).limit(1).get();
    const doc = snap.docs?.[0];
    if (!doc) return null;
    return { id: doc.id, data: (doc.data() as any) || {} };
  } catch {
    return null;
  }
}

function buildTenantProfileActions(profile: Awaited<ReturnType<typeof loadTenantProfileProjection>>) {
  const checklist = Array.isArray(profile?.identity?.documentChecklist) ? profile.identity.documentChecklist : [];
  const pendingDocuments = checklist.filter((item: any) => {
    const status = String(item?.status || "").trim().toLowerCase();
    return status === "missing" || status === "pending" || status === "needs_review";
  }).length;

  return {
    editableFields: ["displayName", "phone"],
    documentEntry: {
      available: true,
      path: "/tenant/attachments",
      label: pendingDocuments > 0 ? "Review requested documents" : "Open documents",
      note:
        pendingDocuments > 0
          ? `${pendingDocuments} document-related step${pendingDocuments === 1 ? "" : "s"} still need attention.`
          : "Open your tenant documents area to review what has already been shared with your record.",
    },
  };
}

function shapeTenantProfileResponse(profile: Awaited<ReturnType<typeof loadTenantProfileProjection>>) {
  return {
    ...profile,
    actions: buildTenantProfileActions(profile),
  };
}

function normalizeDocumentKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function documentCategoryForLabel(value: string): string {
  const normalized = normalizeDocumentKey(value);
  if (normalized.includes("income") || normalized.includes("paystub") || normalized.includes("employment")) return "Income";
  if (normalized.includes("identity") || normalized.includes("id") || normalized.includes("passport") || normalized.includes("license")) {
    return "Identity";
  }
  if (normalized.includes("lease")) return "Lease";
  if (normalized.includes("invite")) return "Invite";
  return "Documents";
}

function labelForAttachmentRecord(item: any): string {
  const purpose = String(item?.purpose || "").trim();
  const custom = String(item?.purposeLabel || "").trim();
  if (purpose && custom) return `${purpose} — ${custom}`;
  if (custom) return custom;
  if (purpose) return purpose;
  return String(item?.title || item?.fileName || "Document").trim() || "Document";
}

function toTenantDocumentStatus(params: {
  checklistStatus: string | null;
  hasAttachment: boolean;
  nextAction: string | null;
}): TenantDocumentStatus {
  const normalized = String(params.checklistStatus || "").trim().toLowerCase();
  const nextAction = String(params.nextAction || "").trim().toLowerCase();

  if (normalized === "verified" || normalized === "completed") return "verified";
  if (normalized === "pending") return "pending_review";
  if (normalized === "needs_review") {
    if (nextAction.includes("reupload") || nextAction.includes("re-upload") || nextAction.includes("replace")) {
      return "reupload_requested";
    }
    return "needs_attention";
  }
  if (params.hasAttachment) return "uploaded";
  return "missing";
}

function documentNextActionCopy(status: TenantDocumentStatus, nextAction: string | null, hasAttachmentUrl: boolean): string | null {
  const explicit = String(nextAction || "").trim();
  if (explicit) return explicit;
  switch (status) {
    case "verified":
      return "This document has been reviewed and accepted.";
    case "pending_review":
      return "Your document has been added and is waiting for review.";
    case "uploaded":
      return "Your document has been added and is waiting to be reviewed in context.";
    case "needs_attention":
      return "This document needs attention before your application is fully complete.";
    case "reupload_requested":
      return "A clearer or updated version is needed before review can continue.";
    default:
      return hasAttachmentUrl ? "Review the latest file you added here." : "This document is still needed for completion.";
  }
}

function buildTenantDocumentWorkspace(params: {
  attachments: Array<any>;
  profile: Awaited<ReturnType<typeof loadTenantProfileProjection>>;
}) {
  const checklist = Array.isArray(params.profile?.identity?.documentChecklist) ? params.profile.identity.documentChecklist : [];
  const attachments = Array.isArray(params.attachments) ? params.attachments : [];

  const normalizedAttachmentMap = new Map<string, any[]>();
  attachments.forEach((item) => {
    const labels = [item?.purpose, item?.purposeLabel, item?.title, item?.fileName]
      .map((value) => normalizeDocumentKey(value))
      .filter(Boolean);
    labels.forEach((label) => {
      const current = normalizedAttachmentMap.get(label) || [];
      current.push(item);
      normalizedAttachmentMap.set(label, current);
    });
  });

  const usedAttachmentIds = new Set<string>();
  const items: TenantDocumentItem[] = checklist.map((entry: any, index: number) => {
    const label = String(entry?.label || "").trim() || prettyChecklistLabel(String(entry?.code || "document"));
    const normalizedTargets = [
      normalizeDocumentKey(entry?.code),
      normalizeDocumentKey(label),
      normalizeDocumentKey(entry?.nextStep),
    ].filter(Boolean);

    const matchedAttachment =
      normalizedTargets
        .flatMap((target) => normalizedAttachmentMap.get(target) || [])
        .find((item) => item && !usedAttachmentIds.has(String(item.id || ""))) || null;

    if (matchedAttachment?.id) {
      usedAttachmentIds.add(String(matchedAttachment.id));
    }

    const status = toTenantDocumentStatus({
      checklistStatus: String(entry?.status || ""),
      hasAttachment: Boolean(matchedAttachment),
      nextAction: String(entry?.nextStep || ""),
    });

    return {
      id: String(entry?.code || matchedAttachment?.id || `document_${index + 1}`),
      label,
      category: documentCategoryForLabel(String(entry?.code || label)),
      status,
      fileName: matchedAttachment?.fileName ? String(matchedAttachment.fileName) : null,
      title: matchedAttachment?.title ? String(matchedAttachment.title) : null,
      purpose: matchedAttachment?.purpose ? String(matchedAttachment.purpose) : null,
      purposeLabel: matchedAttachment?.purposeLabel ? String(matchedAttachment.purposeLabel) : null,
      url: matchedAttachment?.url ? String(matchedAttachment.url) : null,
      uploadedAt: Number(matchedAttachment?.createdAt || 0) || null,
      nextAction: documentNextActionCopy(status, String(entry?.nextStep || ""), Boolean(matchedAttachment?.url)),
      actionAvailable: false,
      actionLabel: null,
      actionPath: null,
      helpLabel: status === "missing" || status === "needs_attention" || status === "reupload_requested" ? "Open messages" : null,
      helpPath: status === "missing" || status === "needs_attention" || status === "reupload_requested" ? "/tenant/messages" : null,
    };
  });

  attachments.forEach((item, index) => {
    if (usedAttachmentIds.has(String(item?.id || ""))) return;
    const label = labelForAttachmentRecord(item);
    items.push({
      id: String(item?.id || `uploaded_document_${index + 1}`),
      label,
      category: documentCategoryForLabel(label),
      status: "uploaded",
      fileName: item?.fileName ? String(item.fileName) : null,
      title: item?.title ? String(item.title) : null,
      purpose: item?.purpose ? String(item.purpose) : null,
      purposeLabel: item?.purposeLabel ? String(item.purposeLabel) : null,
      url: item?.url ? String(item.url) : null,
      uploadedAt: Number(item?.createdAt || 0) || null,
      nextAction: "This file has been added to your record.",
      actionAvailable: false,
      actionLabel: null,
      actionPath: null,
      helpLabel: null,
      helpPath: null,
    });
  });

  const order: Record<TenantDocumentStatus, number> = {
    reupload_requested: 0,
    needs_attention: 1,
    missing: 2,
    pending_review: 3,
    uploaded: 4,
    verified: 5,
  };
  items.sort((a, b) => {
    const priority = order[a.status] - order[b.status];
    if (priority !== 0) return priority;
    return (b.uploadedAt || 0) - (a.uploadedAt || 0);
  });

  const summary = {
    total: items.length,
    missing: items.filter((item) => item.status === "missing").length,
    uploaded: items.filter((item) => item.status === "uploaded").length,
    pendingReview: items.filter((item) => item.status === "pending_review").length,
    verified: items.filter((item) => item.status === "verified").length,
    needsAttention: items.filter((item) => item.status === "needs_attention" || item.status === "reupload_requested").length,
  };

  const nextSteps = items
    .filter((item) => item.status === "missing" || item.status === "needs_attention" || item.status === "reupload_requested")
    .slice(0, 4)
    .map((item) => item.nextAction)
    .filter((value: string | null): value is string => Boolean(value));

  return {
    summary,
    guidance: {
      headline:
        summary.needsAttention > 0
          ? "Some documents need attention before your application can move forward smoothly."
          : summary.missing > 0
          ? "A few documents are still missing from your completion checklist."
          : summary.pendingReview > 0
          ? "Your latest documents are in and waiting for review."
          : items.length
          ? "Your current tenant-safe document record is up to date."
          : "You have not added any tenant-visible documents yet.",
      nextSteps,
      uploadEntryAvailable: false,
      uploadEntryLabel: null,
      uploadEntryPath: null,
      supportPath: "/tenant/messages",
      supportLabel: "Message your landlord",
    },
    updatedAt: items.find((item) => item.uploadedAt)?.uploadedAt || null,
    items,
  };
}

function buildCompletionSections(params: {
  context: Awaited<ReturnType<typeof resolveTenancyContext>>;
  workspace: Awaited<ReturnType<typeof loadTenantWorkspaceData>>;
  profile: Awaited<ReturnType<typeof loadTenantProfileProjection>>;
}) {
  const { context, workspace, profile } = params;
  const application = workspace.application;
  const profileSummary = profile.profile;
  const identity = profile.identity;

  const identityItems: TenantCompletionItem[] = [
    {
      key: "identity_verification",
      label: "Identity verification",
      status: mapIdentityStatus(identity?.identityVerification?.status),
      nextAction:
        identity?.identityVerification?.status === "verified"
          ? null
          : identity?.identityVerification?.note || "Complete identity verification",
      actionPath: identity?.identityVerification?.status === "verified" ? null : "/tenant/profile",
      actionLabel: identity?.identityVerification?.status === "verified" ? null : "Update profile",
    },
  ];

  const documentItems: TenantCompletionItem[] =
    identity?.documentChecklist?.length
      ? identity.documentChecklist.map((item: any) => ({
          key: String(item.code || "").trim(),
          label: String(item.label || "").trim() || prettyChecklistLabel(String(item.code || "")),
          status: mapIdentityStatus(item.status),
          nextAction: String(item.nextStep || "").trim() || null,
          actionPath: inferActionPath({
            key: String(item.code || ""),
            nextAction: String(item.nextStep || ""),
            authority: context.authority,
          }),
          actionLabel: inferActionLabel(
            inferActionPath({
              key: String(item.code || ""),
              nextAction: String(item.nextStep || ""),
              authority: context.authority,
            })
          ),
        }))
      : [
          {
            key: "documents_not_started",
            label: "Documents",
            status: "not_started",
            nextAction: "Add any requested identity or income documents",
            actionPath: "/tenant/attachments",
            actionLabel: "Open documents",
          },
        ];

  const missingStepItems: TenantCompletionItem[] = Array.isArray(application?.missingSteps)
    ? application.missingSteps.map((step: string) => ({
        key: String(step || "").trim().toLowerCase(),
        label: prettyChecklistLabel(step),
        status: "missing" as CompletionStatus,
        nextAction:
          (application?.nextActions || []).find((action: string) =>
            String(action || "").toLowerCase().includes(String(step || "").toLowerCase())
          ) || `Complete ${prettyChecklistLabel(step)}`,
        actionPath: inferActionPath({
          key: String(step || ""),
          nextAction:
            (application?.nextActions || []).find((action: string) =>
              String(action || "").toLowerCase().includes(String(step || "").toLowerCase())
            ) || "",
          authority: context.authority,
        }),
        actionLabel: inferActionLabel(
          inferActionPath({
            key: String(step || ""),
            nextAction:
              (application?.nextActions || []).find((action: string) =>
                String(action || "").toLowerCase().includes(String(step || "").toLowerCase())
              ) || "",
            authority: context.authority,
          })
        ),
      }))
    : [];

  const profileItems: TenantCompletionItem[] = [
    {
      key: "profile_basics",
      label: "Profile basics",
      status:
        profileSummary?.displayName && profileSummary?.email
          ? "completed"
          : profileSummary?.email
          ? "pending"
          : "missing",
      nextAction:
        profileSummary?.displayName && profileSummary?.email ? null : "Complete your profile details",
      actionPath:
        profileSummary?.displayName && profileSummary?.email ? null : "/tenant/profile",
      actionLabel: profileSummary?.displayName && profileSummary?.email ? null : "Update profile",
    },
    ...(missingStepItems.length
      ? missingStepItems
      : [
          {
            key: "application_details",
            label: "Application details",
            status: application ? "completed" : "not_started",
            nextAction: application ? null : "Start your application details",
            actionPath: application ? null : context.authority === "invite" ? "/tenant/invite/redeem" : "/tenant/profile",
            actionLabel: application ? null : context.authority === "invite" ? "Redeem invite" : "Update profile",
          } as TenantCompletionItem,
        ]),
  ];

  const readinessItems: TenantCompletionItem[] = [
    {
      key: "application_submission",
      label: "Application submission",
      status:
        !application
          ? "not_started"
          : ["approved", "submitted", "in_review", "conditional_cosigner", "conditional_deposit"].includes(
              String(application.status || "").toLowerCase()
            )
          ? "completed"
          : String(application.status || "").toLowerCase() === "draft"
          ? "in_progress"
          : "pending",
      nextAction:
        !application
          ? "Begin your application"
          : String(application.status || "").toLowerCase() === "draft"
          ? "Finish the remaining application steps"
          : null,
      actionPath:
        !application || String(application?.status || "").toLowerCase() === "draft"
          ? context.authority === "invite"
            ? "/tenant/invite/redeem"
            : "/tenant/application"
          : null,
      actionLabel:
        !application || String(application?.status || "").toLowerCase() === "draft"
          ? context.authority === "invite"
            ? "Redeem invite"
            : "Open application"
          : null,
    },
    {
      key: "lease_readiness",
      label: "Lease readiness",
      status:
        workspace.lease?.status
          ? ["active", "signed"].includes(String(workspace.lease.status || "").toLowerCase())
            ? "completed"
            : "pending"
          : "pending",
      nextAction: workspace.lease ? null : "Watch for lease updates after your application review",
      actionPath: workspace.lease ? "/tenant/lease" : "/tenant/activity",
      actionLabel: workspace.lease ? "Open lease" : "Open feed",
    },
  ];

  const sections: TenantCompletionSection[] = [
    {
      key: "identity",
      label: "Identity",
      status: aggregateCompletionStatus(identityItems.map((item) => item.status)),
      items: identityItems,
    },
    {
      key: "documents",
      label: "Documents",
      status: aggregateCompletionStatus(documentItems.map((item) => item.status)),
      items: documentItems,
    },
    {
      key: "profile",
      label: "Profile & Application Info",
      status: aggregateCompletionStatus(profileItems.map((item) => item.status)),
      items: profileItems,
    },
    {
      key: "readiness",
      label: "Application Readiness",
      status: aggregateCompletionStatus(readinessItems.map((item) => item.status)),
      items: readinessItems,
    },
  ];

  const actionableItems = sections
    .flatMap((section) => section.items)
    .filter((item) => !["completed", "verified"].includes(item.status) && item.nextAction);
  const nextSteps = Array.from(new Set(actionableItems.map((item) => String(item.nextAction || "").trim()).filter(Boolean)));

  const allStatuses = sections.flatMap((section) => section.items.map((item) => item.status));
  const weightedTotal = allStatuses.reduce((sum, status) => sum + completionWeight(status), 0);
  const progressPercent = allStatuses.length ? Math.round((weightedTotal / allStatuses.length) * 100) : 0;
  const status =
    progressPercent >= 100 && !sections.some((section) => section.status === "needs_review")
      ? "completed"
      : sections.some((section) => section.status === "needs_review")
      ? "needs_review"
      : progressPercent === 0
      ? "not_started"
      : "in_progress";

  const updatedAt =
    profile?.identity?.identityVerification?.updatedAt ||
    profileSummary?.application?.updatedAt ||
    profileSummary?.lease?.startDate ||
    null;

  const reminderMetadata = deriveCompletionReminderMetadata({
    status,
    progressPercent,
    actionableItems,
    updatedAt,
  });

  return {
    status,
    progressPercent,
    sections,
    nextSteps,
    updatedAt,
    ...reminderMetadata,
  };
}

function deriveCompletionReminderMetadata(params: {
  status: CompletionStatus;
  progressPercent: number;
  actionableItems: TenantCompletionItem[];
  updatedAt: string | number | null;
}): ReminderMetadata {
  const updatedAtMs = toMillis(params.updatedAt);
  const ageDays =
    typeof updatedAtMs === "number" && updatedAtMs > 0
      ? Math.floor((Date.now() - updatedAtMs) / (24 * 60 * 60 * 1000))
      : null;
  const primaryAction = params.actionableItems[0] || null;
  const onlyLeaseReadiness =
    params.actionableItems.length > 0 && params.actionableItems.every((item) => item.key === "lease_readiness");

  if (params.status === "completed") {
    return {
      reminderTiming: "not_applicable",
      reminderTimingLabel: "No action needed",
      reminderTimingDescription: "Your current tenant application checklist does not need any tenant action right now.",
      reminderPriority: "low",
      reminderBlockedReason: null,
      reminderNextActionLabel: null,
    };
  }

  if (params.status === "needs_review") {
    return {
      reminderTiming: "blocked",
      reminderTimingLabel: "Blocked",
      reminderTimingDescription: "Your latest updates are waiting on review before the next step can continue.",
      reminderPriority: "medium",
      reminderBlockedReason: "waiting_on_review",
      reminderNextActionLabel: primaryAction?.actionLabel || "Review your checklist",
    };
  }

  if (onlyLeaseReadiness) {
    return {
      reminderTiming: "scheduled_later",
      reminderTimingLabel: "Scheduled for later",
      reminderTimingDescription: "Your application steps look complete for now. Watch for lease updates when your review progresses.",
      reminderPriority: "low",
      reminderBlockedReason: null,
      reminderNextActionLabel: primaryAction?.actionLabel || "Open feed",
    };
  }

  if (params.status === "not_started") {
    return {
      reminderTiming: "due_now",
      reminderTimingLabel: "Due now",
      reminderTimingDescription: "Your application checklist is ready to begin whenever you are ready to continue.",
      reminderPriority: "high",
      reminderBlockedReason: null,
      reminderNextActionLabel: primaryAction?.actionLabel || "Continue application",
    };
  }

  if ((ageDays ?? 0) >= 14 && params.actionableItems.length > 0) {
    return {
      reminderTiming: "overdue",
      reminderTimingLabel: "Overdue",
      reminderTimingDescription: "Some application checklist items have been waiting for attention for a while and may delay the next review step.",
      reminderPriority: "high",
      reminderBlockedReason: null,
      reminderNextActionLabel: primaryAction?.actionLabel || "Continue application",
    };
  }

  if (params.progressPercent >= 70 && params.actionableItems.length > 0) {
    return {
      reminderTiming: "due_soon",
      reminderTimingLabel: "Due soon",
      reminderTimingDescription: "You are close to completing the current checklist. A few remaining items should be reviewed soon.",
      reminderPriority: "medium",
      reminderBlockedReason: null,
      reminderNextActionLabel: primaryAction?.actionLabel || "Review checklist",
    };
  }

  return {
    reminderTiming: "due_now",
    reminderTimingLabel: "Due now",
    reminderTimingDescription: "A current checklist step is ready for your attention now.",
    reminderPriority: params.progressPercent > 0 ? "medium" : "high",
    reminderBlockedReason: null,
    reminderNextActionLabel: primaryAction?.actionLabel || "Continue application",
  };
}

async function handleTenantWorkspaceSummary(req: any, res: any) {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const [workspace, tenantIdentityRecord] = await Promise.all([
    loadTenantWorkspaceData(context),
    loadTenantIdentityRecord({
      context,
      userId: String(req.user?.id || "").trim(),
      userEmail: req.user?.email,
    }),
  ]);
  await recordTenantEvent({
    eventType: "tenant_workspace_viewed",
    entityType: "tenant_workspace",
    entityId: String(context.propertyId || context.rc_prop_id || req.user?.id || "workspace"),
    createdBy: String(req.user?.id || "").trim(),
    context: {
      authority: context.authority,
      propertyId: context.propertyId,
      rc_prop_id: context.rc_prop_id,
      applicationId: context.applicationId,
      leaseId: context.leaseId,
    },
    payload: {
      maintenanceCount: workspace.maintenance.length,
    },
  });

  return res.json({
    ok: true,
    data: {
      context,
      property: workspace.property,
      application: workspace.application,
      lease: workspace.lease,
      maintenance: workspace.maintenance,
      tenantIdentityRecord,
    },
  });
}

router.get("/workspace", requireTenantWorkspaceIdentity, handleTenantWorkspaceSummary);
router.get("/me", requireTenantWorkspaceIdentity, handleTenantWorkspaceSummary);

router.post("/share-packages", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  try {
    const created = await createTenantSharePackage({
      tenantId,
      expiresInDays: req.body?.expiresInDays,
    });
    return res.json({ ok: true, data: created });
  } catch (err: any) {
    console.error("[tenant/share-packages:create] failed", {
      tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_SHARE_PACKAGE_CREATE_FAILED" });
  }
});

router.get("/share-packages", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  try {
    const items = await listTenantSharePackages({ tenantId });
    return res.json({ ok: true, data: items });
  } catch (err: any) {
    console.error("[tenant/share-packages:list] failed", {
      tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_SHARE_PACKAGE_LIST_FAILED" });
  }
});

router.delete("/share-packages/:id", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  const sharePackageId = String(req.params?.id || "").trim();
  if (!tenantId || !sharePackageId) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  try {
    const revoked = await revokeTenantSharePackage({ tenantId, sharePackageId });
    if (!revoked) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    return res.json({ ok: true, data: { id: sharePackageId, status: "revoked" } });
  } catch (err: any) {
    console.error("[tenant/share-packages:revoke] failed", {
      tenantId,
      sharePackageId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_SHARE_PACKAGE_REVOKE_FAILED" });
  }
});

router.get("/notification-preferences", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const userId = String(req.user?.id || "").trim();
  if (!userId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  try {
    const preferences = await loadTenantNotificationPreferences(userId);
    return res.json({ ok: true, data: preferences });
  } catch (err: any) {
    console.error("[tenant/notification-preferences] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_NOTIFICATION_PREFERENCES_FAILED" });
  }
});

router.patch("/notification-preferences", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const userId = String(req.user?.id || "").trim();
  if (!userId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  const requested = req.body?.inApp;
  if (!requested || typeof requested !== "object") {
    return res.status(400).json({ ok: false, error: "TENANT_NOTIFICATION_PREFERENCES_INVALID" });
  }

  const hasRequestedField = TENANT_NOTIFICATION_PREFERENCE_KEYS.some((key) => typeof requested[key] === "boolean");
  if (!hasRequestedField) {
    return res.status(400).json({ ok: false, error: "TENANT_NOTIFICATION_PREFERENCES_INVALID" });
  }

  try {
    const current = await loadTenantNotificationPreferences(userId);
    const next: TenantNotificationPreferences = {
      inApp: { ...current.inApp },
      updatedAt: Date.now(),
    };

    for (const key of TENANT_NOTIFICATION_PREFERENCE_KEYS) {
      if (typeof requested[key] === "boolean") {
        next.inApp[key] = requested[key];
      }
    }

    await db.collection("users").doc(userId).set(
      {
        tenantNotificationPreferences: {
          inApp: next.inApp,
          updatedAt: next.updatedAt,
        },
      },
    );

    return res.json({ ok: true, data: next });
  } catch (err: any) {
    console.error("[tenant/notification-preferences:patch] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_NOTIFICATION_PREFERENCES_UPDATE_FAILED" });
  }
});

router.get("/profile", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  try {
    const profile = await loadTenantProfileProjection({
      context,
      userId: String(req.user?.id || "").trim(),
      userEmail: String(req.user?.email || "").trim() || null,
    });

    await recordTenantEvent({
      eventType: "tenant_profile_viewed",
      entityType: "tenant_profile",
      entityId: String(context.tenantId || context.applicationId || context.propertyId || req.user?.id || "tenant_profile"),
      createdBy: String(req.user?.id || "").trim(),
      context: {
        authority: context.authority,
        propertyId: context.propertyId,
        rc_prop_id: context.rc_prop_id,
        applicationId: context.applicationId,
        leaseId: context.leaseId,
      },
      payload: {
        overallStatus: profile.identity.overallStatus,
      },
    });

    return res.json({ ok: true, data: shapeTenantProfileResponse(profile) });
  } catch (err: any) {
    console.error("[tenant/profile] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_PROFILE_FAILED" });
  }
});

router.patch("/profile", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const displayName = cleanProfileField(req.body?.displayName, 120);
  const phone = cleanProfileField(req.body?.phone, 40);
  const requestedFields = Object.keys(req.body || {}).filter((field) => ["displayName", "phone"].includes(field));
  if (!requestedFields.length) {
    return res.status(400).json({ ok: false, error: "TENANT_PROFILE_FIELDS_REQUIRED" });
  }

  try {
    const userId = String(req.user?.id || "").trim();
    const userEmail = cleanProfileField(String(req.user?.email || "").trim().toLowerCase(), 160);

    const tenantDocId = cleanProfileField(context.tenantId, 120);
    const applicationDocId =
      cleanProfileField(context.applicationId, 120) ||
      (await queryFirstDocument("applications", "applicantEmail", userEmail))?.id ||
      (await queryFirstDocument("applications", "email", userEmail))?.id ||
      null;

    if (!tenantDocId && !applicationDocId) {
      return res.status(403).json({ ok: false, error: "TENANT_PROFILE_EDIT_UNAVAILABLE" });
    }

    const now = Date.now();

    if (tenantDocId) {
      const tenantUpdates: Record<string, any> = {
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
      };
      if (requestedFields.includes("displayName")) {
        tenantUpdates.fullName = displayName;
      }
      if (requestedFields.includes("phone")) {
        tenantUpdates.phone = phone;
      }
      await db.collection("tenants").doc(tenantDocId).set(tenantUpdates, { merge: true });
    }

    if (applicationDocId) {
      const applicationUpdates: Record<string, any> = {
        updatedAt: now,
      };
      if (requestedFields.includes("displayName")) {
        applicationUpdates.applicantName = displayName;
      }
      if (requestedFields.includes("phone")) {
        applicationUpdates.phone = phone;
      }
      await db.collection("applications").doc(applicationDocId).set(applicationUpdates, { merge: true });
    }

    const profile = await loadTenantProfileProjection({
      context,
      userId,
      userEmail,
    });

    await recordTenantEvent({
      eventType: "tenant_profile_updated",
      entityType: "tenant_profile",
      entityId: String(context.tenantId || context.applicationId || context.propertyId || userId || "tenant_profile"),
      createdBy: userId,
      context: {
        authority: context.authority,
        propertyId: context.propertyId,
        rc_prop_id: context.rc_prop_id,
        applicationId: context.applicationId,
        leaseId: context.leaseId,
      },
      payload: {
        updatedFields: requestedFields,
      },
    });

    return res.json({ ok: true, data: shapeTenantProfileResponse(profile) });
  } catch (err: any) {
    console.error("[tenant/profile:patch] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_PROFILE_UPDATE_FAILED" });
  }
});

router.get("/communications", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  try {
    const workspace = await loadTenantCommunicationsWorkspace({
      context,
      userId: String(req.user?.id || "").trim(),
    });
    return res.json({ ok: true, data: workspace });
  } catch (err: any) {
    console.error("[tenant/communications] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_COMMUNICATIONS_FAILED" });
  }
});

router.post("/communications/messages", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  try {
    const result = await sendTenantCommunicationMessage({
      context,
      userId: String(req.user?.id || "").trim(),
      body: req.body?.body,
    });

    if (!result.ok) {
      const status =
        result.error === "TENANCY_CONTEXT_REQUIRED" || result.error === "LANDLORD_CONTEXT_MISSING"
          ? 403
          : result.error === "MESSAGE_BODY_REQUIRED" || result.error === "MESSAGE_BODY_TOO_LONG"
          ? 400
          : 500;
      return res.status(status).json({ ok: false, error: result.error });
    }

    return res.status(201).json({ ok: true, data: result.message });
  } catch (err: any) {
    console.error("[tenant/communications/messages] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_COMMUNICATION_SEND_FAILED" });
  }
});

router.post("/communications/read", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  try {
    const result = await markTenantCommunicationsRead({
      context,
      userId: String(req.user?.id || "").trim(),
    });
    if (!result.ok) {
      return res.status(403).json({ ok: false, error: result.error });
    }
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[tenant/communications/read] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_COMMUNICATION_READ_FAILED" });
  }
});

async function handleTenantNotifications(req: any, res: any) {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  try {
    const items = await listTenantNotificationFeed({
      context,
      userId: String(req.user?.id || "").trim(),
      userEmail: String(req.user?.email || "").trim() || null,
    });

    await recordTenantEvent({
      eventType: "tenant_notifications_viewed",
      entityType: "tenant_notifications",
      entityId: String(context.tenantId || context.applicationId || context.propertyId || req.user?.id || "tenant_notifications"),
      createdBy: String(req.user?.id || "").trim(),
      context: {
        authority: context.authority,
        propertyId: context.propertyId,
        rc_prop_id: context.rc_prop_id,
        applicationId: context.applicationId,
        leaseId: context.leaseId,
      },
      payload: {
        itemCount: items.length,
      },
    });

    return res.json({ ok: true, data: items });
  } catch (err: any) {
    console.error("[tenant/notifications] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_NOTIFICATIONS_FAILED" });
  }
}

router.get("/notifications", requireTenantWorkspaceIdentity, handleTenantNotifications);

router.get("/access", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  try {
    const tenantId = String(context.tenantId || req.user?.tenantId || "").trim();
    const propertyDoc = await loadDocument("properties", context.propertyId);
    const propertyLabel =
      [propertyDoc?.data?.street1, propertyDoc?.data?.street2].filter(Boolean).join(", ") || null;

    let shareRecords: any[] = [];
    if (tenantId) {
      const snap = await db.collection("tenantHistoryShares").where("tenantId", "==", tenantId).get();
      shareRecords = snap.docs
        .map((doc: any) => ({ id: doc.id, ...(doc.data() as any) }))
        .sort((a, b) => timestampToSort(b.lastAccessedAt || b.revokedAt || b.createdAt) - timestampToSort(a.lastAccessedAt || a.revokedAt || a.createdAt));
    }

    const workspace = buildTenantAccessWorkspace({
      shareRecords,
      propertyLabel,
    });

    await recordTenantEvent({
      eventType: "tenant_access_viewed",
      entityType: "tenant_access",
      entityId: String(context.tenantId || context.applicationId || context.propertyId || req.user?.id || "tenant_access"),
      createdBy: String(req.user?.id || "").trim(),
      context: {
        authority: context.authority,
        propertyId: context.propertyId,
        rc_prop_id: context.rc_prop_id,
        applicationId: context.applicationId,
        leaseId: context.leaseId,
      },
      payload: {
        activeGrants: workspace.summary.activeGrants,
        pendingRequests: workspace.summary.pendingRequests,
      },
    });

    return res.json({ ok: true, data: workspace });
  } catch (err: any) {
    console.error("[tenant/access] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_ACCESS_FAILED" });
  }
});

router.post("/access/:shareId/revoke", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(context.tenantId || req.user?.tenantId || "").trim();
  const shareId = String(req.params?.shareId || "").trim();
  if (!tenantId || !shareId) {
    return res.status(400).json({ ok: false, error: "TENANT_ACCESS_REVOKE_INVALID" });
  }

  try {
    const ref = db.collection("tenantHistoryShares").doc(shareId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ ok: false, error: "TENANT_ACCESS_NOT_FOUND" });
    }

    const share = snap.data() as any;
    if (String(share?.tenantId || "").trim() !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    await ref.set({ revoked: true, revokedAt: Date.now() }, { merge: true });

    await recordTenantEvent({
      eventType: "tenant_access_revoked",
      entityType: "tenant_access",
      entityId: shareId,
      createdBy: String(req.user?.id || "").trim(),
      context: {
        authority: context.authority,
        propertyId: context.propertyId,
        rc_prop_id: context.rc_prop_id,
        applicationId: context.applicationId,
        leaseId: context.leaseId,
      },
      payload: {
        tenantId,
      },
    });

    return res.json({ ok: true, shareId, revoked: true });
  } catch (err: any) {
    console.error("[tenant/access:revoke] failed", {
      userId: req.user?.id,
      shareId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_ACCESS_REVOKE_FAILED" });
  }
});

router.get("/application-status", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  const workspace = await loadTenantWorkspaceData(context);
  return res.json({ ok: true, data: workspace.application });
});

router.get("/application-completion", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  try {
    const [workspace, profile] = await Promise.all([
      loadTenantWorkspaceData(context),
      loadTenantProfileProjection({
        context,
        userId: String(req.user?.id || "").trim(),
        userEmail: String(req.user?.email || "").trim() || null,
      }),
    ]);

    const summary = buildCompletionSections({ context, workspace, profile });

    await recordTenantEvent({
      eventType: "tenant_application_completion_viewed",
      entityType: "tenant_application_completion",
      entityId: String(context.applicationId || context.tenantId || context.propertyId || req.user?.id || "tenant_application_completion"),
      createdBy: String(req.user?.id || "").trim(),
      context: {
        authority: context.authority,
        propertyId: context.propertyId,
        rc_prop_id: context.rc_prop_id,
        applicationId: context.applicationId,
        leaseId: context.leaseId,
      },
      payload: {
        progressPercent: summary.progressPercent,
        status: summary.status,
        nextStepCount: summary.nextSteps.length,
      },
    });

    return res.json({ ok: true, data: summary });
  } catch (err: any) {
    console.error("[tenant/application-completion] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_APPLICATION_COMPLETION_FAILED" });
  }
});

router.get("/lease", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  const workspace = await loadTenantWorkspaceData(context);
  return res.json({ ok: true, data: workspace.lease });
});

router.get("/maintenance-requests", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  const workspace = await loadTenantWorkspaceData(context);
  return res.json({ ok: true, data: workspace.maintenance });
});

router.post("/maintenance-requests", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  if (context.authority !== "active_tenant" || !context.tenantId) {
    return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
  }

  const title = String(req.body?.title || "").trim().slice(0, 180);
  const description = String(req.body?.description || "").trim().slice(0, 2000);
  if (!title || !description) {
    return res.status(400).json({ ok: false, error: "TITLE_AND_DESCRIPTION_REQUIRED" });
  }

  const propertyDoc = await loadDocument("properties", context.propertyId);
  const property = propertyDoc?.data || {};
  const now = Date.now();
  const ref = db.collection("maintenanceRequests").doc();
  const data = {
    id: ref.id,
    tenantId: context.tenantId,
    leaseId: context.leaseId || null,
    propertyId: context.propertyId,
    unitId: context.unitId || null,
    landlordId: String(property?.landlordId || "").trim() || null,
    title,
    description,
    category: String(req.body?.category || "GENERAL").trim().toUpperCase(),
    priority: String(req.body?.priority || "NORMAL").trim().toUpperCase(),
    status: "submitted",
    createdAt: now,
    updatedAt: now,
    lastUpdatedBy: "TENANT",
  };

  await ref.set(data);
  await recordTenantEvent({
    eventType: "tenant_maintenance_submitted",
    entityType: "maintenance_request",
    entityId: ref.id,
    createdBy: String(req.user?.id || "").trim(),
    context: {
      propertyId: context.propertyId,
      rc_prop_id: context.rc_prop_id,
      leaseId: context.leaseId,
      tenantId: context.tenantId,
    },
    payload: {
      title,
      category: data.category,
      priority: data.priority,
    },
  });
  let emailed = false;
  let emailError: string | null = null;
  try {
    const maintenanceNotifyEmail = String(process.env.MAINTENANCE_NOTIFY_EMAIL || "").trim();
    const adminEmails = getAdminEmails().filter((email) => emailRegex.test(email));
    let landlordEmail: string | null = null;
    if (data.landlordId) {
      const userDoc = await loadDocument("users", data.landlordId);
      landlordEmail = String(userDoc?.data?.email || "").trim() || null;
      if (!landlordEmail) {
        const landlordDoc = await loadDocument("landlords", data.landlordId);
        landlordEmail = String(landlordDoc?.data?.email || "").trim() || null;
      }
    }

    const recipients: string[] = [];
    if (maintenanceNotifyEmail && emailRegex.test(maintenanceNotifyEmail)) {
      recipients.push(maintenanceNotifyEmail);
    } else if (landlordEmail && emailRegex.test(landlordEmail)) {
      recipients.push(landlordEmail);
    } else if (adminEmails.length) {
      recipients.push(...adminEmails);
    }

    const from =
      process.env.EMAIL_FROM ||
      process.env.SENDGRID_FROM_EMAIL ||
      process.env.SENDGRID_FROM ||
      process.env.FROM_EMAIL;
    if (!recipients.length) {
      emailError = "MISSING_RECIPIENT_EMAIL";
    } else if (!getEnvFlags().emailConfigured || !from) {
      emailError = "EMAIL_NOT_CONFIGURED";
    } else {
      const tenantDoc = await loadDocument("tenants", context.tenantId);
      const tenantName =
        String(tenantDoc?.data?.fullName || tenantDoc?.data?.name || req.user?.name || req.user?.email || "").trim() || "Unknown";
      const tenantEmail = String(tenantDoc?.data?.email || req.user?.email || "").trim() || null;
      const propertyName = String(property?.name || property?.addressLine1 || context.propertyId || "").trim() || "Property";
      const baseUrl = (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
      const requestLink = `${baseUrl}/maintenance`;
      await sendEmail({
        to: recipients,
        from,
        replyTo: from,
        subject: `New maintenance request: ${title}`,
        text: buildEmailText({
          intro: `A tenant submitted a new maintenance request.\nTenant: ${tenantName}${tenantEmail ? ` (${tenantEmail})` : ""}\nProperty: ${propertyName}\nCategory: ${data.category}\nPriority: ${data.priority}\nRequest ID: ${ref.id}\n\n${description}`,
          ctaText: "Open maintenance",
          ctaUrl: requestLink,
        }),
        html: buildEmailHtml({
          title: "New maintenance request",
          intro: `Tenant: ${tenantName}${tenantEmail ? ` (${tenantEmail})` : ""}. Property: ${propertyName}. Category: ${data.category}. Priority: ${data.priority}. Request ID: ${ref.id}.`,
          ctaText: "Open maintenance",
          ctaUrl: requestLink,
        }),
      });
      emailed = true;
    }
  } catch (err: any) {
    emailError = err?.message || "SEND_FAILED";
    console.error("[tenant/workspace-maintenance] email send failed", {
      requestId: ref.id,
      landlordId: data.landlordId,
      message: err?.message || "send_failed",
    });
  }

  return res.status(201).json({ ok: true, data: projectTenantMaintenance(ref.id, data), emailed, emailError });
});

router.post("/invite/redeem", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const token = String(req.body?.token || "").trim();
  if (!token) return res.status(400).json({ ok: false, error: "TOKEN_REQUIRED" });

  const redeemed = await redeemTenancyInvite({
    token,
    redeemedByUid: String(req.user?.id || "").trim(),
    redeemedByEmail: String(req.user?.email || "").trim() || null,
  });

  if (!redeemed.ok) {
    const status =
      redeemed.error === "invite_not_found"
        ? 404
        : redeemed.error === "invite_used"
        ? 409
        : redeemed.error === "invite_email_mismatch"
        ? 403
        : 400;
    return res.status(status).json({ ok: false, error: redeemed.error });
  }

  return res.json({
    ok: true,
    data: {
      inviteId: redeemed.invite?.id || null,
      propertyId: redeemed.invite?.propertyId || null,
      applicationId: redeemed.invite?.applicationId || null,
      rc_prop_id: redeemed.invite?.rc_prop_id || null,
      status: redeemed.invite?.status || null,
    },
  });
});

router.get("/me", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const tenantRef = db.collection("tenants").doc(tenantId);
    const tenantSnap = await tenantRef.get();
    const tenantData = (tenantSnap.exists ? (tenantSnap.data() as any) : null) || {};

    let landlordId = tenantData.landlordId ?? req.user?.landlordId ?? null;
    let propertyId = tenantData.propertyId ?? req.user?.propertyId ?? null;
    let unitId = tenantData.unitId ?? tenantData.unit ?? req.user?.unitId ?? null;

    // Invite redemption timestamp takes precedence for joinedAt
    let joinedAt: number | null = null;
    try {
      const inviteSnap = await db
        .collection("tenantInvites")
        .where("tenantId", "==", tenantId)
        .limit(1)
        .get();
      const inviteDoc = inviteSnap.docs[0];
      if (inviteDoc?.exists) {
        const invite = inviteDoc.data() as any;
        joinedAt = toMillis(invite.redeemedAt ?? invite.createdAt ?? null);
      }
    } catch {
      joinedAt = null;
    }
    if (!joinedAt) {
      joinedAt = toMillis(tenantData.redeemedAt ?? tenantData.createdAt ?? null);
    }

    let propertyName: string | null = tenantData.propertyName ?? tenantData.property ?? null;
    if (propertyId) {
      try {
        const propSnap = await db.collection("properties").doc(propertyId).get();
        if (propSnap.exists) {
          const prop = propSnap.data() as any;
          propertyName = prop?.name ?? prop?.addressLine1 ?? propertyName ?? null;
          landlordId = landlordId ?? prop?.landlordId ?? prop?.ownerId ?? prop?.owner ?? null;
        }
      } catch {
        // ignore property lookup errors
      }
    }

    let unitLabel: string | null = tenantData.unit ?? null;
    if (unitId) {
      try {
        const unitSnap = await db.collection("units").doc(unitId).get();
        if (unitSnap.exists) {
          const unit = unitSnap.data() as any;
          unitLabel = unit?.unitNumber ?? unit?.label ?? unitLabel ?? null;
          propertyId = propertyId ?? unit?.propertyId ?? null;
          landlordId = landlordId ?? unit?.landlordId ?? null;
        }
      } catch {
        unitLabel = unitLabel ?? null;
      }
      if (!unitLabel && propertyName) {
        unitLabel = typeof tenantData.unit === "string" ? tenantData.unit : null;
      }
    }

    if (!propertyName && propertyId) {
      try {
        const propSnap = await db.collection("properties").doc(propertyId).get();
        if (propSnap.exists) {
          const prop = propSnap.data() as any;
          propertyName = prop?.name ?? prop?.addressLine1 ?? null;
          landlordId = landlordId ?? prop?.landlordId ?? prop?.ownerId ?? prop?.owner ?? null;
        }
      } catch {
        propertyName = propertyName ?? null;
      }
    }

    let landlordName: string | null = null;
    if (landlordId) {
      try {
        const llSnap = await db.collection("landlords").doc(landlordId).get();
        if (llSnap.exists) {
          const ll = llSnap.data() as any;
          landlordName = ll?.name ?? ll?.fullName ?? ll?.company ?? ll?.email ?? null;
        }
      } catch {
        landlordName = null;
      }
    }

    let tenancySnapshot: any | null = null;
    try {
      const tenanciesSnap = await db
        .collection("tenancies")
        .where("tenantId", "==", tenantId)
        .limit(20)
        .get();
      const records = tenanciesSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
      records.sort((a, b) => {
        const aActive = String(a?.status || "").toLowerCase() === "active" ? 1 : 0;
        const bActive = String(b?.status || "").toLowerCase() === "active" ? 1 : 0;
        if (aActive !== bActive) return bActive - aActive;
        return (
          timestampToSort(b?.updatedAt ?? b?.createdAt) -
          timestampToSort(a?.updatedAt ?? a?.createdAt)
        );
      });
      tenancySnapshot = records[0] || null;
    } catch {
      tenancySnapshot = null;
    }

    if (tenancySnapshot) {
      propertyId = propertyId ?? tenancySnapshot.propertyId ?? null;
      unitId = unitId ?? tenancySnapshot.unitId ?? null;
      landlordId = landlordId ?? tenancySnapshot.landlordId ?? null;
      unitLabel = unitLabel ?? tenancySnapshot.unitLabel ?? null;
    }

    const leaseStart = toMillis(
      tenancySnapshot?.moveInAt ??
      tenantData.leaseStart ??
        tenantData.lease_begin ??
        tenantData.leaseStartDate ??
        tenantData.createdAt ??
        null
    );
    const leaseEnd = toMillis(tenancySnapshot?.moveOutAt ?? tenantData.leaseEnd ?? null);
    const hasLeaseContext =
      Boolean(propertyId || propertyName) && Boolean(unitId || unitLabel);
    const leaseStatusRaw = String(
      tenancySnapshot?.status ??
      tenantData.leaseStatus ?? tenantData.status ?? ""
    ).toLowerCase();
    const leaseStatus =
      hasLeaseContext && (leaseStatusRaw === "active" || leaseStatusRaw === "current")
        ? "Active"
        : hasLeaseContext && leaseStatusRaw === "inactive"
        ? "Inactive"
        : hasLeaseContext && leaseStatusRaw === "pending"
        ? "Pending"
        : "Unknown";
    const rentCents =
      hasLeaseContext && typeof tenantData.rentCents === "number"
        ? tenantData.rentCents
        : hasLeaseContext && typeof tenantData.monthlyRent === "number"
        ? Math.round(Number(tenantData.monthlyRent) * 100)
        : null;

    return res.json({
      ok: true,
      data: {
        tenant: {
          id: tenantId,
          shortId: tenantId.slice(0, 8),
          name: tenantData.fullName ?? tenantData.name ?? null,
          email: tenantData.email ?? req.user?.email ?? null,
          joinedAt,
          status: "Active",
        },
        landlord: { name: landlordName },
        property: { name: propertyName ?? null },
        unit: { label: unitLabel ?? null },
        lease: {
          status: leaseStatus,
          startDate: hasLeaseContext ? leaseStart : null,
          endDate: hasLeaseContext ? leaseEnd : null,
          rentCents,
          currency: hasLeaseContext ? tenantData.currency ?? null : null,
        },
      },
    });
  } catch (err) {
    console.error("[tenantPortalRoutes] /tenant/me error", err);
    return res.status(500).json({ ok: false, error: "TENANT_ME_FAILED" });
  }
});

router.get("/activity", requireTenantWorkspaceIdentity, handleTenantNotifications);

router.get("/messages", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const includeMaintenance = String(req.query?.includeMaintenance ?? "1") !== "0";
    const includeScreening = String(req.query?.includeScreening ?? "1") !== "0";
    const [messageItems, maintenanceItems, screeningItems] = await Promise.all([
      buildTenantMessageItems(tenantId),
      includeMaintenance ? buildTenantMaintenanceUpdateItems(tenantId) : Promise.resolve([]),
      includeScreening ? buildTenantScreeningItems(tenantId) : Promise.resolve([]),
    ]);

    const items = [...messageItems, ...maintenanceItems, ...screeningItems]
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 200);
    const unreadCount = items.filter((item) => !item.read).length;
    console.info("[tenant.messages.opened]", {
      tenantId,
      count: items.length,
      unreadCount,
    });
    return res.json({ ok: true, items, unreadCount });
  } catch (err: any) {
    console.error("[tenant/messages] failed", {
      tenantId: req.user?.tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_MESSAGES_FAILED" });
  }
});

router.post("/messages/read-all", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const [messageItems, maintenanceItems, screeningItems] = await Promise.all([
      buildTenantMessageItems(tenantId),
      buildTenantMaintenanceUpdateItems(tenantId),
      buildTenantScreeningItems(tenantId),
    ]);
    const unreadMessages = messageItems.filter((item) => !item.read).slice(0, 400);
    const unreadMaintenance = maintenanceItems.filter((item) => !item.read).slice(0, 400);
    const unreadScreening = screeningItems.filter((item) => !item.read).slice(0, 400);
    const totalUnread = unreadMessages.length + unreadMaintenance.length + unreadScreening.length;
    if (!totalUnread) {
      console.info("[tenant.messages.read_all]", { tenantId, count: 0 });
      return res.json({ ok: true, updated: 0 });
    }

    const batch = db.batch();
    const now = Date.now();
    unreadMessages.forEach((item) => {
      const ref = db.collection("tenantMessageReads").doc(`${tenantId}_${item.id}`);
      batch.set(
        ref,
        {
          tenantId,
          messageId: item.id,
          readAtMs: now,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    unreadMaintenance.forEach((item) => {
      const requestId = String(item.relatedEntityId || "").trim();
      if (!requestId) return;
      const ref = db.collection("tenantMaintenanceReads").doc(`${tenantId}_${requestId}`);
      batch.set(
        ref,
        {
          tenantId,
          requestId,
          readAtMs: now,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    unreadScreening.forEach((item) => {
      const requestId = String(item.relatedEntityId || "").trim();
      if (!requestId) return;
      const ref = db.collection("tenantScreeningReads").doc(`${tenantId}_${requestId}`);
      batch.set(
        ref,
        {
          tenantId,
          requestId,
          readAtMs: now,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
    console.info("[tenant.messages.read_all]", { tenantId, count: totalUnread });
    return res.json({ ok: true, updated: totalUnread });
  } catch (err: any) {
    console.error("[tenant/messages/read-all] failed", {
      tenantId: req.user?.tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_MESSAGES_READ_ALL_FAILED" });
  }
});

router.post("/messages/:id/read", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const messageId = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!messageId) return res.status(400).json({ ok: false, error: "MESSAGE_ID_REQUIRED" });

    const ref = db.collection("tenantMessageReads").doc(`${tenantId}_${messageId}`);
    await ref.set(
      {
        tenantId,
        messageId,
        readAtMs: Date.now(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.info("[tenant.message.read]", { tenantId, messageId });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[tenant/messages/:id/read] failed", {
      tenantId: req.user?.tenantId,
      messageId: req.params?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_MESSAGE_READ_FAILED" });
  }
});

router.post("/messages/maintenance/:requestId/read", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const requestId = String(req.params?.requestId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!requestId) return res.status(400).json({ ok: false, error: "REQUEST_ID_REQUIRED" });

    const maintenanceDoc = await db.collection("maintenanceRequests").doc(requestId).get();
    if (!maintenanceDoc.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const maintenanceData = (maintenanceDoc.data() as any) || {};
    if (maintenanceData.tenantId && maintenanceData.tenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const ref = db.collection("tenantMaintenanceReads").doc(`${tenantId}_${requestId}`);
    await ref.set(
      {
        tenantId,
        requestId,
        readAtMs: Date.now(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.info("[tenant.maintenance.read]", { tenantId, requestId });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[tenant/messages/maintenance/:requestId/read] failed", {
      tenantId: req.user?.tenantId,
      requestId: req.params?.requestId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINTENANCE_READ_FAILED" });
  }
});

router.post("/messages/screening/:requestId/read", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const requestId = String(req.params?.requestId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!requestId) return res.status(400).json({ ok: false, error: "REQUEST_ID_REQUIRED" });

    const request = await getScreeningRequestById(requestId);
    if (!request) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (!request.applicantTenantId || request.applicantTenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    await db
      .collection("tenantScreeningReads")
      .doc(`${tenantId}_${requestId}`)
      .set(
        {
          tenantId,
          requestId,
          readAtMs: Date.now(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[tenant/messages/screening/:requestId/read] failed", {
      tenantId: req.user?.tenantId,
      requestId: req.params?.requestId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_SCREENING_READ_FAILED" });
  }
});

router.get("/screening", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const snap = await db
      .collection("screening_requests")
      .where("applicantTenantId", "==", tenantId)
      .limit(50)
      .get();
    const requests = snap.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
      .sort((a, b) => Number(b.updatedAt || b.createdAt || 0) - Number(a.updatedAt || a.createdAt || 0));

    const items = await Promise.all(
      requests.map(async (item) => {
        const request = await getScreeningRequestById(item.id);
        if (!request) return null;
        const [consent, session, result] = await Promise.all([
          getLatestConsent(item.id),
          getLatestSession(item.id),
          getLatestResult(item.id),
        ]);
        return shapeTenantScreeningResponse({ request, consent, session, result });
      })
    );

    return res.json({ ok: true, items: items.filter(Boolean) });
  } catch (err: any) {
    console.error("[tenant/screening] failed", {
      tenantId: req.user?.tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_SCREENING_LIST_FAILED" });
  }
});

router.get("/screening/:requestId/status", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const requestId = String(req.params?.requestId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!requestId) return res.status(400).json({ ok: false, error: "REQUEST_ID_REQUIRED" });

    const request = await getScreeningRequestById(requestId);
    if (!request) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (!request.applicantTenantId || request.applicantTenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const [consent, session, result, auditTrail] = await Promise.all([
      getLatestConsent(requestId),
      getLatestSession(requestId),
      getLatestResult(requestId),
      getScreeningAuditTrail(requestId),
    ]);

    if (result) {
      await writeScreeningAuditEvent({
        requestId,
        eventType: "result_viewed",
        actorRole: "tenant",
        actorId: String(req.user?.id || tenantId).trim() || tenantId,
        tenantId,
        landlordId: request.landlordId,
        sessionId: session?.id || null,
        idempotencyKey: `${tenantId}_${result.id}`,
        metadata: {
          resultId: result.id,
          resultStatus: result.status,
        },
      });
    }

      return res.json({
      ok: true,
      screeningRequest: await shapeTenantScreeningResponse({ request, consent, session, result, auditTrail }),
    });
  } catch (err: any) {
    console.error("[tenant/screening/:requestId/status] failed", {
      tenantId: req.user?.tenantId,
      requestId: req.params?.requestId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_SCREENING_STATUS_FAILED" });
  }
});

router.post("/screening/:requestId/consent", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const actorId = String(req.user?.id || tenantId).trim() || tenantId;
    const requestId = String(req.params?.requestId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!requestId) return res.status(400).json({ ok: false, error: "REQUEST_ID_REQUIRED" });

    const request = await getScreeningRequestById(requestId);
    if (!request) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (!request.applicantTenantId || request.applicantTenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const existingConsent = await getLatestConsent(requestId);
    const viewOnly = Boolean(req.body?.viewed) && !Boolean(req.body?.accepted);
    const accepted = Boolean(req.body?.accepted);
    if (!viewOnly && !accepted) {
      return res.status(400).json({ ok: false, error: "CONSENT_ACTION_REQUIRED" });
    }

    if (accepted && existingConsent?.acceptedAt) {
      return res.json({
        ok: true,
        screeningRequest: await shapeTenantScreeningResponse({
          request,
          consent: existingConsent,
          session: await getLatestSession(requestId),
          result: await getLatestResult(requestId),
        }),
      });
    }

    const now = Date.now();
    const consentRef =
      existingConsent && !existingConsent.acceptedAt
        ? db.collection("screening_consents").doc(existingConsent.id)
        : db.collection("screening_consents").doc();
    const providerDisclosure =
      cleanString(req.body?.providerDisclosure, 200) ||
      (request.providerSelection ? `This screening may be completed using ${request.providerSelection}.` : "This screening may be completed by a secure screening provider selected at runtime.");
    const disclosureVersion = cleanString(req.body?.disclosureVersion, 80) || "screening-consent-v1";
    const providerKey = request.providerSelection || null;
    const providerLabel = getScreeningProviderLabel(providerKey);
    const consentSummary =
      cleanString(req.body?.consentSummary, 600) ||
      buildScreeningConsentSummary({
        providerKey,
        propertyLabel: request.propertyLabel,
        unitLabel: request.unitLabel,
      });

    await consentRef.set(
      {
        id: consentRef.id,
        requestId,
        tenantId,
        applicantId: request.applicantUserId || request.applicantTenantId || null,
        rentalApplicationId: request.rentalApplicationId || null,
        landlordId: request.landlordId || null,
        propertyId: request.propertyId || null,
        providerKey,
        providerLabel,
        consentVersion: disclosureVersion,
        consentTextSummary: consentSummary,
        applicantName: request.applicantName || null,
        viewedAt: existingConsent?.viewedAt || now,
        acceptedAt: accepted ? now : existingConsent?.acceptedAt || null,
        acceptedBy: accepted ? actorId : existingConsent?.acceptedBy || null,
        providerDisclosure,
        disclosureVersion,
        ipAddress: cleanString(req.ip, 120),
        userAgent: cleanString(req.headers["user-agent"], 240),
        createdAt: existingConsent?.viewedAt || now,
        updatedAt: now,
        updatedAtServer: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const nextStatus: ScreeningRequestStatus = accepted ? "consented" : request.status === "requested" ? "consent_pending" : request.status;
    await db.collection("screening_requests").doc(requestId).set(
      {
        latestConsentId: consentRef.id,
        status: nextStatus,
        consentedAt: accepted ? now : request.consentedAt || null,
        lastViewedAt: now,
        updatedAt: now,
        nextAction: accepted ? "ready_to_start" : "awaiting_applicant_consent",
        latestAuditEventType: accepted ? "consent_accepted" : "consent_viewed",
      },
      { merge: true }
    );

    await writeScreeningAuditEvent({
      requestId,
      eventType: accepted ? "consent_accepted" : "consent_viewed",
      actorRole: "tenant",
      actorId,
      tenantId,
      landlordId: request.landlordId,
      idempotencyKey: accepted ? `${consentRef.id}_accepted` : `${consentRef.id}_viewed`,
      metadata: {
        consentId: consentRef.id,
        disclosureVersion,
        providerKey,
        providerLabel,
      },
    });

    const refreshedRequest = await getScreeningRequestById(requestId);
    const refreshedConsent = await getLatestConsent(requestId);
    if (accepted && refreshedConsent) {
      await writeScreeningConsentCanonicalEvent({
        request,
        consent: refreshedConsent,
        actorId,
      });
    }
    return res.json({
      ok: true,
      screeningRequest: await shapeTenantScreeningResponse({
        request: refreshedRequest || request,
        consent: refreshedConsent,
        session: await getLatestSession(requestId),
        result: await getLatestResult(requestId),
      }),
    });
  } catch (err: any) {
    console.error("[tenant/screening/:requestId/consent] failed", {
      tenantId: req.user?.tenantId,
      requestId: req.params?.requestId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_SCREENING_CONSENT_FAILED" });
  }
});

router.post("/screening/:requestId/start", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const actorId = String(req.user?.id || tenantId).trim() || tenantId;
    const requestId = String(req.params?.requestId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!requestId) return res.status(400).json({ ok: false, error: "REQUEST_ID_REQUIRED" });

    const request = await getScreeningRequestById(requestId);
    if (!request) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (!request.applicantTenantId || request.applicantTenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const started = await createScreeningSessionSafely({
      requestId,
      actorRole: "tenant",
      actorId,
      tenantId,
    });

    await writeScreeningAuditEvent({
      requestId,
      eventType: "screening_started",
      actorRole: "tenant",
      actorId,
      tenantId,
      landlordId: started.request.landlordId,
      sessionId: started.session.id,
      idempotencyKey: `screening_started_${started.session.id}`,
      metadata: {
        providerKey: started.session.providerKey,
        sessionStatus: started.session.status,
        created: started.created,
      },
    });
    await writeScreeningAuditEvent({
      requestId,
      eventType: "provider_session_created",
      actorRole: "tenant",
      actorId,
      tenantId,
      landlordId: started.request.landlordId,
      sessionId: started.session.id,
      idempotencyKey: `provider_session_created_${started.session.id}`,
      metadata: {
        providerKey: started.session.providerKey,
        handoffType: started.session.handoffType,
        correlationId: started.session.correlationId,
        providerSessionId: started.session.providerSessionId || null,
      },
    });
    if (started.session.handoffType === "redirect") {
      await writeScreeningAuditEvent({
        requestId,
        eventType: "redirect_prepared",
        actorRole: "system",
        actorId: null,
        tenantId,
        landlordId: started.request.landlordId,
        sessionId: started.session.id,
        idempotencyKey: `redirect_prepared_${started.session.id}`,
        metadata: {
          providerKey: started.session.providerKey,
          redirectPreparedAt: started.session.redirectPreparedAt || started.session.createdAt,
          expiresAt: started.session.expiresAt,
          returnState: started.session.returnState || "pending",
        },
      });
      await writeScreeningAuditEvent({
        requestId,
        eventType: "return_state_resolved",
        actorRole: "system",
        actorId: null,
        tenantId,
        landlordId: started.request.landlordId,
        sessionId: started.session.id,
        idempotencyKey: `return_state_${started.session.id}_${started.session.returnState || "pending"}`,
        metadata: {
          providerKey: started.session.providerKey,
          returnState: started.session.returnState || "pending",
        },
      });
    }
    if (started.session.providerKey === "manual") {
      await writeScreeningAuditEvent({
        requestId,
        eventType: "manual_review_selected",
        actorRole: "system",
        actorId: null,
        tenantId,
        landlordId: started.request.landlordId,
        sessionId: started.session.id,
        idempotencyKey: `manual_review_${started.session.id}`,
        metadata: {
          reason: "provider_fallback",
        },
      });
    }
    if (started.result?.status === "manual_review_required" || started.result?.status === "completed") {
      await writeScreeningAuditEvent({
        requestId,
        eventType: "screening_completed",
        actorRole: "system",
        actorId: null,
        tenantId,
        landlordId: started.request.landlordId,
        sessionId: started.session.id,
        idempotencyKey: `screening_completed_${started.session.id}_${started.result?.status}`,
        metadata: {
          resultStatus: started.result?.status,
        },
      });
    }

    const refreshedRequest = await getScreeningRequestById(requestId);
    return res.json({
      ok: true,
      screeningRequest: await shapeTenantScreeningResponse({
        request: refreshedRequest || started.request,
        consent: started.consent,
        session: await getLatestSession(requestId),
        result: await getLatestResult(requestId),
        auditTrail: await getScreeningAuditTrail(requestId),
      }),
    });
  } catch (err: any) {
    const code = err?.message || "failed";
    console.error("[tenant/screening/:requestId/start] failed", {
      tenantId: req.user?.tenantId,
      requestId: req.params?.requestId,
      message: code,
    });
    const status =
      code === "NOT_FOUND"
        ? 404
        : code === "FORBIDDEN"
        ? 403
        : code === "CONSENT_REQUIRED"
        ? 400
        : code === "SCREENING_STILL_IN_PROGRESS"
        ? 409
        : 500;
    return res.status(status).json({
      ok: false,
      error: status === 500 ? "TENANT_SCREENING_START_FAILED" : code,
      blockReason: code === "CONSENT_REQUIRED" ? "missing_tenant_consent" : null,
    });
  }
});

router.post("/screening/:requestId/retry", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const actorId = String(req.user?.id || tenantId).trim() || tenantId;
    const requestId = String(req.params?.requestId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!requestId) return res.status(400).json({ ok: false, error: "REQUEST_ID_REQUIRED" });

    const request = await getScreeningRequestById(requestId);
    if (!request) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    if (!request.applicantTenantId || request.applicantTenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
}
    await writeScreeningAuditEvent({
      requestId,
      eventType: "retry_requested",
      actorRole: "tenant",
      actorId,
      tenantId,
      landlordId: request.landlordId,
      idempotencyKey: `retry_prepare_${request.activeSessionId || request.latestResultId || request.retryCount || 0}`,
      metadata: {
        previousSessionId: request.activeSessionId,
      },
    });

    const refreshedRequest = await prepareScreeningRetrySafely({
      requestId,
      actorId,
      tenantId,
    });
    return res.json({
      ok: true,
      screeningRequest: await shapeTenantScreeningResponse({
        request: refreshedRequest || request,
        consent: await getLatestConsent(requestId),
        session: await getLatestSession(requestId),
        result: await getLatestResult(requestId),
        auditTrail: await getScreeningAuditTrail(requestId),
      }),
    });
  } catch (err: any) {
    const code = err?.message || "failed";
    console.error("[tenant/screening/:requestId/retry] failed", {
      tenantId: req.user?.tenantId,
      requestId: req.params?.requestId,
      message: code,
    });
    const status =
      code === "NOT_FOUND" ? 404 : code === "FORBIDDEN" ? 403 : code === "SCREENING_STILL_IN_PROGRESS" ? 409 : 500;
    return res.status(status).json({ ok: false, error: status === 500 ? "TENANT_SCREENING_RETRY_FAILED" : code });
  }
});

router.post("/screening/provider/transunion/callback", async (req: any, res) => {
  try {
    const role = String(req.user?.role || "").trim().toLowerCase();
    if (role !== "admin") {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const stateToken = cleanString(req.body?.stateToken || req.body?.state, 160);
    if (!stateToken) {
      return res.status(400).json({ ok: false, error: "STATE_TOKEN_REQUIRED" });
    }

    const redirectState = await getRedirectStateByToken(stateToken);
    if (!redirectState || redirectState.providerKey !== "transunion_redirect") {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    const session = await getScreeningSessionById(redirectState.sessionId);
    if (!session || session.providerKey !== "transunion_redirect") {
      return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });
    }
    const request = await getScreeningRequestById(session.requestId);
    if (!request) {
      return res.status(404).json({ ok: false, error: "REQUEST_NOT_FOUND" });
    }

    const callbackSummary = summarizeCallbackPayload(req.body || {});
    const now = Date.now();
    const expired = Boolean(redirectState.expiresAt && redirectState.expiresAt <= now);
    const correlationMismatch =
      Boolean(callbackSummary.correlationId && session.correlationId && callbackSummary.correlationId !== session.correlationId);
    const providerSessionMismatch =
      Boolean(callbackSummary.providerSessionId && session.providerSessionId && callbackSummary.providerSessionId !== session.providerSessionId);
    const sessionMismatch =
      request.activeSessionId !== session.id ||
      session.redirectStateId !== redirectState.id ||
      redirectState.stateTokenHash !== hashOpaqueToken(stateToken);
    const duplicateCallback = Boolean(redirectState.consumedAt || session.callbackReceivedAt);
    const finalizedSession = isTerminalScreeningRequestStatus(request.status) || isTerminalScreeningSessionStatus(session.status);

    if (expired || correlationMismatch || providerSessionMismatch || sessionMismatch || (finalizedSession && !duplicateCallback)) {
      const rejectionReason = expired
        ? "STATE_TOKEN_EXPIRED"
        : correlationMismatch
        ? "CORRELATION_MISMATCH"
        : providerSessionMismatch
        ? "PROVIDER_SESSION_MISMATCH"
        : sessionMismatch
        ? "SESSION_MISMATCH"
        : "SESSION_ALREADY_FINALIZED";

      await db.runTransaction(async (tx) => {
        tx.set(
          db.collection("screening_redirect_states").doc(redirectState.id),
          {
            status: expired ? "expired" : "rejected",
            updatedAt: now,
            callbackCount: Number(redirectState.callbackCount || 0) + 1,
            lastOutcome: "callback_rejected",
            lastRejectedReason: rejectionReason,
          },
          { merge: true }
        );
        if (expired && !isTerminalScreeningSessionStatus(session.status)) {
          tx.set(
            db.collection("screening_sessions").doc(session.id),
            {
              status: "expired",
              updatedAt: now,
              redirectLastUpdatedAt: now,
              redirectPreparationStatus: "expired",
              returnState: "expired",
              returnStateResolvedAt: now,
              normalizedResultStatus: "failed",
            },
            { merge: true }
          );
          tx.set(
            db.collection("screening_requests").doc(request.id),
            {
              status: request.status === "completed" ? request.status : "failed",
              normalizedResultStatus: request.status === "completed" ? request.normalizedResultStatus : "failed",
              failedAt: request.failedAt || now,
              nextAction: request.status === "completed" ? request.nextAction || null : "retry_available",
              updatedAt: now,
              latestAuditEventType: "callback_rejected",
            },
            { merge: true }
          );
        }
      });

      await writeScreeningAuditEvent({
        requestId: request.id,
        eventType: "callback_rejected",
        actorRole: "system",
        actorId: null,
        tenantId: request.applicantTenantId,
        landlordId: request.landlordId,
        sessionId: session.id,
        idempotencyKey: `tu_callback_rejected_${session.id}_${redirectState.callbackCount}_${rejectionReason}`,
        metadata: {
          providerKey: "transunion_redirect",
          rejectionReason,
          callback: callbackSummary,
        },
      });

      const status =
        rejectionReason === "STATE_TOKEN_EXPIRED" ? 410 : rejectionReason === "SESSION_ALREADY_FINALIZED" ? 409 : 400;
      return res.status(status).json({ ok: false, error: rejectionReason });
    }

    if (duplicateCallback) {
      await db.collection("screening_redirect_states").doc(redirectState.id).set(
        {
          status: "duplicate",
          updatedAt: now,
          callbackCount: Number(redirectState.callbackCount || 0) + 1,
          lastOutcome: "callback_duplicate_ignored",
        },
        { merge: true }
      );
      await writeScreeningAuditEvent({
        requestId: request.id,
        eventType: "callback_duplicate_ignored",
        actorRole: "system",
        actorId: null,
        tenantId: request.applicantTenantId,
        landlordId: request.landlordId,
        sessionId: session.id,
        idempotencyKey: `tu_callback_duplicate_${session.id}_${redirectState.callbackCount}`,
        metadata: {
          providerKey: "transunion_redirect",
          callback: callbackSummary,
        },
      });
      return res.json({
        ok: true,
        duplicate: true,
        screeningRequest: await shapeTenantScreeningResponse({
          request,
          consent: await getLatestConsent(request.id),
          session,
          result: await getLatestResult(request.id),
          auditTrail: await getScreeningAuditTrail(request.id),
        }),
      });
    }

    const callbackResult = await screeningAdapters.transunion_redirect.handleCallback({
      session,
      request,
      payload: req.body || {},
    });
    const normalized = screeningAdapters.transunion_redirect.normalizeResult(req.body || {});
    const resultRef = db.collection("screening_results").doc(
      makeDeterministicDocId([request.id, session.id, "tu_callback_result"])
    );

    await db.runTransaction(async (tx) => {
      const [requestSnap, sessionSnap, redirectSnap] = await Promise.all([
        tx.get(db.collection("screening_requests").doc(request.id)),
        tx.get(db.collection("screening_sessions").doc(session.id)),
        tx.get(db.collection("screening_redirect_states").doc(redirectState.id)),
      ]);
      const currentRequest = (requestSnap.data() as any) || {};
      const currentSession = (sessionSnap.data() as any) || {};
      const currentRedirect = (redirectSnap.data() as any) || {};
      if (currentSession.callbackReceivedAt || currentRedirect.consumedAt) return;
      if (String(currentRequest.activeSessionId || "") !== session.id) {
        throw new Error("SESSION_MISMATCH");
      }
      if (isTerminalScreeningRequestStatus(normalizeScreeningRequestStatus(currentRequest.status))) {
        throw new Error("SESSION_ALREADY_FINALIZED");
      }

      const requestStatus = callbackResult.requestStatus;
      const sessionStatus = callbackResult.sessionStatus;
      const callbackReceivedAt = now;
      const returnState =
        requestStatus === "completed"
          ? "completed"
          : requestStatus === "failed"
          ? "unable_to_complete"
          : "callback_received_but_not_finalized";

      tx.set(
        db.collection("screening_redirect_states").doc(redirectState.id),
        {
          providerSessionId: session.providerSessionId || callbackSummary.providerSessionId || null,
          callbackReceivedAt,
          consumedAt: callbackReceivedAt,
          updatedAt: callbackReceivedAt,
          callbackCount: Number(currentRedirect.callbackCount || 0) + 1,
          status: requestStatus === "completed" ? "completed" : "callback_received",
          lastOutcome: "callback_received",
          lastRejectedReason: null,
        },
        { merge: true }
      );
      tx.set(
        db.collection("screening_sessions").doc(session.id),
        {
          status: sessionStatus,
          providerSessionStatus: normalized.providerStatusMapped || "callback_received_stub",
          providerSessionId: session.providerSessionId || callbackSummary.providerSessionId || null,
          callbackReceivedAt,
          updatedAt: callbackReceivedAt,
          redirectLastUpdatedAt: callbackReceivedAt,
          redirectPreparationStatus: "consumed",
          normalizedResultStatus: callbackResult.resultStatus,
          returnState,
          returnStateResolvedAt: callbackReceivedAt,
        },
        { merge: true }
      );
      tx.set(
        resultRef,
        {
          id: resultRef.id,
          requestId: request.id,
          sessionId: session.id,
          providerKey: "transunion_redirect",
          status: normalized.status,
          summary: normalized.summary,
          normalizedDecision: normalized.normalizedDecision,
          identityVerified: normalized.identityVerified,
          creditIncluded: normalized.creditIncluded,
          incomeIncluded: normalized.incomeIncluded,
          fraudFlags: normalized.fraudFlags,
          providerStatusMapped: normalized.providerStatusMapped,
          reportAvailability: normalized.reportAvailability,
          reportAvailable: normalized.reportAvailable,
          rawPayloadRef: "transunion://callback/stub",
          fullReportStorageRef: null,
          createdAt: now,
          updatedAt: now,
        },
        { merge: true }
      );
      tx.set(
        db.collection("screening_requests").doc(request.id),
        {
          status: requestStatus,
          normalizedResultStatus: callbackResult.resultStatus,
          latestResultId: resultRef.id,
          nextAction: requestStatus === "completed" ? "view_result" : "await_internal_finalization",
          updatedAt: now,
          completedAt: requestStatus === "completed" ? now : currentRequest.completedAt || null,
          failedAt: requestStatus === "failed" ? now : currentRequest.failedAt || null,
          latestAuditEventType: requestStatus === "completed" ? "screening_completed" : "callback_received",
        },
        { merge: true }
      );
    });

    const [refreshedRequest, refreshedSession, refreshedResult] = await Promise.all([
      getScreeningRequestById(request.id),
      getScreeningSessionById(session.id),
      getLatestResult(request.id),
    ]);
    const resolvedReturnState = resolveReturnState(
      refreshedRequest || request,
      refreshedSession || session,
      refreshedResult
    );

    await writeScreeningAuditEvent({
      requestId: request.id,
      eventType: "callback_received",
      actorRole: "system",
      actorId: null,
      tenantId: request.applicantTenantId,
      landlordId: request.landlordId,
      sessionId: session.id,
      idempotencyKey: `tu_callback_received_${session.id}_${redirectState.id}`,
      metadata: {
        providerKey: "transunion_redirect",
        resultStatus: normalized.status,
        callbackMode: "disabled_scaffold",
        callback: callbackSummary,
      },
    });
    await writeScreeningAuditEvent({
      requestId: request.id,
      eventType: "return_state_resolved",
      actorRole: "system",
      actorId: null,
      tenantId: request.applicantTenantId,
      landlordId: request.landlordId,
      sessionId: session.id,
      idempotencyKey: `tu_return_state_${session.id}_${resolvedReturnState}`,
      metadata: {
        providerKey: "transunion_redirect",
        returnState: resolvedReturnState,
      },
    });
    if (resolvedReturnState === "completed" || resolvedReturnState === "unable_to_complete") {
      await writeScreeningAuditEvent({
        requestId: request.id,
        eventType: "screening_completed",
        actorRole: "system",
        actorId: null,
        tenantId: request.applicantTenantId,
        landlordId: request.landlordId,
        sessionId: session.id,
        idempotencyKey: `tu_callback_complete_${session.id}_${normalized.status}`,
        metadata: {
          providerKey: "transunion_redirect",
          resultStatus: normalized.status,
        },
      });
    }

    return res.json({
      ok: true,
      duplicate: false,
      screeningRequest: await shapeTenantScreeningResponse({
        request: refreshedRequest || request,
        consent: await getLatestConsent(request.id),
        session: refreshedSession || session,
        result: refreshedResult,
        auditTrail: await getScreeningAuditTrail(request.id),
      }),
    });
  } catch (err: any) {
    const code = err?.message || "failed";
    const status =
      code === "FORBIDDEN"
        ? 403
        : code === "STATE_TOKEN_REQUIRED"
        ? 400
        : code === "SESSION_NOT_FOUND" || code === "REQUEST_NOT_FOUND"
        ? 404
        : code === "STATE_TOKEN_EXPIRED"
        ? 410
        : code === "SESSION_ALREADY_FINALIZED" || code === "SESSION_MISMATCH"
        ? 409
        : 500;
    console.error("[tenant/screening/provider/transunion/callback] failed", {
      message: code,
    });
    return res.status(status).json({ ok: false, error: code === "failed" ? "TRANSUNION_CALLBACK_FAILED" : code });
  }
});

router.get("/ledger", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    console.info("[tenant-ledger] request start", {
      tenantId,
      path: req.originalUrl || req.path || "",
      hasAuthHeader: Boolean(req.headers?.authorization),
      role: req.user?.role || null,
    });

    const { getTenantLedger } = await import("../services/tenantLedgerService");
    const entries = await getTenantLedger(tenantId);

    const toMillis = (v: any): number | null => {
      if (!v) return null;
      if (typeof v === "number") return v;
      if (typeof v === "string") {
        const ts = Date.parse(v);
        return Number.isNaN(ts) ? null : ts;
      }
      if (typeof v?.toMillis === "function") return v.toMillis();
      if (typeof v?.seconds === "number") return v.seconds * 1000;
      return null;
    };

    const normalizeAmount = (amount: any): number | null => {
      if (typeof amount !== "number" || Number.isNaN(amount)) return null;
      return Math.round(amount * 100);
    };

    const mapType = (t: string): "rent" | "fee" | "adjustment" | "payment" => {
      const type = (t || "").toLowerCase();
      if (type.includes("payment")) return "payment";
      if (type.includes("fee")) return "fee";
      if (type.includes("adjust")) return "adjustment";
      return "rent";
    };

    const toPeriod = (date: any): string | null => {
      const ts = toMillis(date);
      if (!ts) return null;
      const d = new Date(ts);
      const yyyy = d.getUTCFullYear();
      const mm = `${d.getUTCMonth() + 1}`.padStart(2, "0");
      return `${yyyy}-${mm}`;
    };

    const inferPurpose = (t: string): string | null => {
      const type = (t || "").toUpperCase();
      if (type.startsWith("RENT")) return "RENT";
      if (type.includes("LATE")) return "LATE_FEE";
      if (type.includes("FEE")) return "LATE_FEE";
      if (type.includes("DEPOSIT")) return "SECURITY_DEPOSIT";
      if (type.includes("PARK")) return "PARKING";
      if (type.includes("UTIL")) return "UTILITIES";
      return "OTHER";
    };

    const items = (entries || []).map((entry: any) => {
      const occurredAt = toMillis(entry.date ?? entry.occurredAt);
      const purpose =
        entry.purpose ??
        entry?.meta?.purpose ??
        inferPurpose(entry.type || "") ??
        "OTHER";
      const purposeLabel =
        entry.purposeLabel ?? entry?.meta?.purposeLabel ?? entry.period ?? null;
      return {
        id: entry.id,
        type: mapType(entry.type || ""),
        title:
          mapType(entry.type || "") === "payment"
            ? "Payment recorded"
            : mapType(entry.type || "") === "fee"
            ? "Fee recorded"
            : mapType(entry.type || "") === "adjustment"
            ? "Adjustment recorded"
            : "Rent recorded",
        description: entry.notes ?? entry.label ?? entry.description ?? undefined,
        amountCents: normalizeAmount(entry.amount),
        currency: entry.currency ?? null,
        period: entry.period ?? toPeriod(entry.date ?? entry.occurredAt),
        purpose: purpose ?? null,
        purposeLabel: purposeLabel ?? null,
        occurredAt: occurredAt ?? Date.now(),
      };
    });

    const fetchTenantEventsForLedger = async () => {
      try {
        return await db
          .collection("tenantEvents")
          .where("tenantId", "==", tenantId)
          .orderBy("occurredAt", "desc")
          .limit(50)
          .get();
      } catch {
        return db
          .collection("tenantEvents")
          .where("tenantId", "==", tenantId)
          .orderBy("createdAt", "desc")
          .limit(50)
          .get();
      }
    };

    try {
      const isFinanceType = (t: string): boolean => {
        const x = (t || "").toUpperCase();
        return ["RENT", "FEE", "DEPOSIT", "PAY", "PAYMENT", "ADJUST", "CHARGE", "CREDIT", "DAMAGE", "PARK", "UTIL"].some(
          (k) => x.includes(k)
        );
      };
      const eventsSnap = await fetchTenantEventsForLedger();
      const eventItems =
        eventsSnap.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) }))
          .filter((ev) => isFinanceType(ev.type || ""))
          .map((ev) => {
            const occurredAt = toMillis(ev.occurredAt ?? ev.createdAt);
            const purpose = ev.purpose ?? inferPurpose(ev.type || "");
            const purposeLabel = ev.purposeLabel ?? ev.period ?? null;
            const mapType = (t: string): "rent" | "fee" | "adjustment" | "payment" => {
              const type = (t || "").toLowerCase();
              if (type.includes("payment") || type.includes("pay")) return "payment";
              if (type.includes("fee")) return "fee";
              if (type.includes("adjust") || type.includes("credit")) return "adjustment";
              return "rent";
            };
            const normalizeAmount = (amount: any): number | null => {
              if (typeof amount !== "number" || Number.isNaN(amount)) return null;
              return Math.round(amount * 100);
            };
            return {
              id: ev.id,
              type: mapType(ev.type || ""),
              title: ev.title || "Ledger entry",
              description: ev.description || undefined,
              amountCents: normalizeAmount(ev.amount ?? ev.amountCents),
              currency: ev.currency ?? null,
              period: ev.period ?? null,
              purpose: purpose ?? null,
              purposeLabel: purposeLabel ?? null,
              occurredAt: occurredAt ?? Date.now(),
            };
          }) || [];
      const mergedMap = new Map<string, any>();
      [...items, ...eventItems].forEach((it) => {
        if (!it?.id) return;
        mergedMap.set(it.id, it);
      });
      const merged = Array.from(mergedMap.values());
      merged.sort((a, b) => b.occurredAt - a.occurredAt);
      return res.json({ ok: true, data: merged.slice(0, 25) });
    } catch (err) {
      console.warn("[tenant/ledger] event bridge failed; returning base ledger", {
        tenantId,
        err: (err as any)?.message,
      });
      items.sort((a, b) => b.occurredAt - a.occurredAt);
      return res.json({ ok: true, data: items.slice(0, 25) });
    }
  } catch (err) {
    console.error("[tenantPortalRoutes] /tenant/ledger error", {
      tenantId: req.user?.tenantId || null,
      path: req.originalUrl || req.path || "",
      message: (err as any)?.message || "failed",
      code: (err as any)?.code || null,
    });
    return res.status(500).json({ ok: false, error: "TENANT_LEDGER_FAILED" });
  }
});

router.get("/attachments", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const [snap, profile] = await Promise.all([
      db.collection("ledgerAttachments").where("tenantId", "==", tenantId).limit(50).get(),
      loadTenantProfileProjection({
        context,
        userId: String(req.user?.id || "").trim(),
        userEmail: String(req.user?.email || "").trim() || null,
      }),
    ]);

    const rawAttachments = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    rawAttachments.sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0));

    const workspace = buildTenantDocumentWorkspace({
      attachments: rawAttachments,
      profile,
    });

    return res.json({
      ok: true,
      data: workspace.items,
      summary: workspace.summary,
      guidance: workspace.guidance,
      updatedAt: workspace.updatedAt,
    });
  } catch (err) {
    console.error("[tenant/attachments] failed", {
      tenantId: req.user?.tenantId,
      err: (err as any)?.message,
      code: (err as any)?.code,
    });
    return res.status(500).json({ ok: false, error: "TENANT_ATTACHMENTS_FAILED" });
  }
});

router.get("/ledger/:ledgerItemId/attachments", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const ledgerItemId = String(req.params?.ledgerItemId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!ledgerItemId) return res.status(400).json({ ok: false, error: "ledgerItemId required" });

    const snap = await db
      .collection("ledgerAttachments")
      .where("tenantId", "==", tenantId)
      .where("ledgerItemId", "==", ledgerItemId)
      .limit(25)
      .get();

    const data = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    data.sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0));
    return res.json({ ok: true, data });
  } catch (err) {
    console.error("[tenant/ledger/:id/attachments] failed", {
      tenantId: req.user?.tenantId,
      ledgerItemId: req.params?.ledgerItemId,
      err: (err as any)?.message,
      code: (err as any)?.code,
    });
    return res.status(500).json({ ok: false, error: "TENANT_ATTACHMENTS_FAILED" });
  }
});

router.get("/lease", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const tenantSnap = await db.collection("tenants").doc(tenantId).get();
    const tenantData = (tenantSnap.exists ? (tenantSnap.data() as any) : {}) || {};

    let propertyId = String(tenantData?.propertyId || "").trim() || null;
    let unitId = String(tenantData?.unitId || tenantData?.unit || "").trim() || null;
    let leaseId = String(tenantData?.leaseId || "").trim() || null;

    let leaseRecord: any = null;
    if (leaseId) {
      const leaseSnap = await db.collection("leases").doc(leaseId).get();
      if (leaseSnap.exists) {
        leaseRecord = leaseSnap.data() as any;
      }
    }
    if (!leaseRecord) {
      const leaseSnap = await db.collection("leases").where("tenantId", "==", tenantId).limit(20).get();
      const ranked = leaseSnap.docs
        .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
        .sort((a, b) => {
          const aActive = ["signed", "active", "current"].includes(String(a?.status || "").toLowerCase()) ? 1 : 0;
          const bActive = ["signed", "active", "current"].includes(String(b?.status || "").toLowerCase()) ? 1 : 0;
          if (aActive !== bActive) return bActive - aActive;
          return Number(b?.updatedAt || b?.createdAt || 0) - Number(a?.updatedAt || a?.createdAt || 0);
        });
      if (ranked.length > 0) {
        leaseRecord = ranked[0];
        leaseId = leaseId || String(leaseRecord.id || "").trim() || null;
      }
    }

    propertyId = propertyId || String(leaseRecord?.propertyId || "").trim() || null;
    unitId =
      unitId ||
      String(leaseRecord?.unitId || leaseRecord?.unit || leaseRecord?.unitNumber || "").trim() ||
      null;

    let propertyName: string | null = null;
    if (propertyId) {
      const propertySnap = await db.collection("properties").doc(propertyId).get();
      if (propertySnap.exists) {
        const property = propertySnap.data() as any;
        propertyName = property?.name || property?.addressLine1 || null;
      }
    }

    let unitNumber: string | null = null;
    if (unitId) {
      const unitSnap = await db.collection("units").doc(unitId).get();
      if (unitSnap.exists) {
        const unit = unitSnap.data() as any;
        unitNumber = unit?.unitNumber || unit?.label || null;
        propertyId = propertyId || (unit?.propertyId ? String(unit.propertyId) : null);
      } else if (leaseRecord?.unitNumber) {
        unitNumber = String(leaseRecord.unitNumber);
      }
    }

    const projectedLease = leaseId
      ? projectTenantLease(leaseId, {
          ...(leaseRecord || {}),
          startDate: leaseRecord?.startDate || leaseRecord?.leaseStart || tenantData?.leaseStart || tenantData?.leaseStartDate || null,
          endDate: leaseRecord?.endDate || tenantData?.leaseEnd || null,
          monthlyRent:
            typeof leaseRecord?.monthlyRent === "number"
              ? leaseRecord.monthlyRent
              : typeof tenantData?.monthlyRent === "number"
              ? tenantData.monthlyRent
              : typeof tenantData?.rentCents === "number"
              ? tenantData.rentCents / 100
              : null,
          status: leaseRecord?.status || tenantData?.leaseStatus || tenantData?.status || null,
        })
      : null;

    const lease = {
      ...(projectedLease || {
        leaseId,
        startDate: null,
        endDate: null,
        monthlyRent: null,
        status: null,
        documentUrl: null,
        signatureStatus: "unavailable",
        signatureReadinessLabel: "Lease signing unavailable",
        signatureReadinessDescription: "Lease signing details are not available in this workspace yet.",
        tenantSignature: null,
        leasePdfStatus: "not_available",
        leasePdfLabel: "Lease document unavailable",
        leasePdfDescription: "No tenant-safe lease document is available in this workspace yet.",
      }),
      propertyId,
      propertyName,
      unitId,
      unitNumber,
      rentAmount: projectedLease?.monthlyRent ?? null,
      leaseStart: projectedLease?.startDate ?? null,
      leaseEnd: projectedLease?.endDate ?? null,
    };

    return res.json({ ok: true, data: lease, lease, ...lease });
  } catch (err) {
    console.error("[tenantPortalRoutes] /tenant/lease error", err);
    return res.status(500).json({ ok: false, error: "TENANT_LEASE_FAILED" });
  }
});

router.get("/payments", requireTenant, (_req: any, res) => {
  return res.json({ ok: true, items: [] });
});

router.get("/ledger", requireTenant, (_req: any, res) => {
  return res.json({ ok: true, items: [] });
});

router.get("/notices", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const items = await buildTenantNoticeItems(tenantId);
    const unreadCount = items.filter((item) => !item.read).length;
    console.info("[tenant.notices.opened]", {
      tenantId,
      count: items.length,
      unreadCount,
    });
    return res.json({ ok: true, items, unreadCount, data: items });
  } catch (err) {
    console.error("[tenant/notices] failed", {
      tenantId: req.user?.tenantId,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_NOTICES_FAILED" });
  }
});

router.post("/notices/:noticeId/read", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const noticeId = String(req.params?.noticeId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!noticeId) return res.status(400).json({ ok: false, error: "NOTICE_ID_REQUIRED" });

    const noticeDoc = await db.collection("tenantNotices").doc(noticeId).get();
    if (!noticeDoc.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const noticeData = (noticeDoc.data() as any) || {};
    if (noticeData.tenantId && noticeData.tenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    await db
      .collection("tenantNoticeReads")
      .doc(`${tenantId}_${noticeId}`)
      .set(
        {
          tenantId,
          noticeId,
          readAtMs: Date.now(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    console.info("[tenant.notice.read]", { tenantId, noticeId });
    return res.json({ ok: true });
  } catch (err: any) {
    console.error("[tenant/notices/:noticeId/read] failed", {
      tenantId: req.user?.tenantId,
      noticeId: req.params?.noticeId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_NOTICE_READ_FAILED" });
  }
});

router.get("/notices/:noticeId", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const noticeId = String(req.params?.noticeId || "").trim();
    if (!noticeId) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const doc = await db.collection("tenantNotices").doc(noticeId).get();
    if (!doc.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const data = (doc.data() as any) || {};
    const docTenantId = data.tenantId ?? data.tenant ?? null;
    if (docTenantId && docTenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const payload = {
      id: doc.id,
      landlordId: data.landlordId ?? null,
      tenantId: docTenantId ?? null,
      type: data.type ?? "GENERAL",
      title: data.title ?? "Notice",
      body: data.body ?? "",
      effectiveAt: toMillis(data.effectiveAt),
      createdAt: toMillis(data.createdAt) ?? Date.now(),
      createdBy: data.createdBy ?? null,
      status: data.status ?? "ACTIVE",
    };
    return res.json({ ok: true, data: payload });
  } catch (err) {
    console.error("[tenant/notices/:noticeId] failed", {
      tenantId: req.user?.tenantId,
      noticeId: req.params?.noticeId,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_NOTICE_READ_FAILED" });
  }
});

router.get("/communication/summary", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const [messages, notices, maintenance, screening] = await Promise.all([
      buildTenantMessageItems(tenantId),
      buildTenantNoticeItems(tenantId),
      buildTenantMaintenanceUpdateItems(tenantId),
      buildTenantScreeningItems(tenantId),
    ]);
    const unreadMessages = messages.filter((item) => !item.read).length;
    const unreadNotices = notices.filter((item) => !item.read).length;
    const unreadMaintenanceUpdates = maintenance.filter((item) => !item.read).length;
    const unreadScreeningUpdates = screening.filter((item) => !item.read).length;
    return res.json({
      ok: true,
      unreadMessages,
      unreadNotices,
      unreadMaintenanceUpdates,
      unreadScreeningUpdates,
      unreadTotal: unreadMessages + unreadNotices + unreadMaintenanceUpdates + unreadScreeningUpdates,
    });
  } catch (err: any) {
    console.error("[tenant/communication/summary] failed", {
      tenantId: req.user?.tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_COMM_SUMMARY_FAILED" });
  }
});

router.post("/maintenance-requests", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const { category, priority, title, description, tenantContact } = req.body || {};
    const trimmedTitle = typeof title === "string" ? title.trim().slice(0, 120) : "";
    const trimmedDescription = typeof description === "string" ? description.trim().slice(0, 5000) : "";
    const normalizedCategory = typeof category === "string" ? category.trim().toUpperCase() : "GENERAL";
    const normalizedPriority = typeof priority === "string" ? priority.trim().toUpperCase() : "NORMAL";
    const allowedCategories = [
      "PLUMBING",
      "ELECTRICAL",
      "HVAC",
      "APPLIANCE",
      "PEST",
      "CLEANING",
      "GENERAL",
      "OTHER",
    ];
    const allowedPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
    if (!trimmedTitle || !trimmedDescription) {
      return res.status(400).json({ ok: false, error: "INVALID_REQUEST" });
    }
    const categorySafe = allowedCategories.includes(normalizedCategory) ? normalizedCategory : "GENERAL";
    const prioritySafe = allowedPriorities.includes(normalizedPriority) ? normalizedPriority : "NORMAL";

    // Derive property/unit/landlord from tenant doc when possible
    let propertyId: string | null = null;
    let unitId: string | null = null;
    let landlordId: string | null = null;
    let tenantName: string | null = null;
    let tenantEmail: string | null = null;
    try {
      const tenantSnap = await db.collection("tenants").doc(tenantId).get();
      if (tenantSnap.exists) {
        const t = tenantSnap.data() as any;
        propertyId = t?.propertyId || t?.property || null;
        unitId = t?.unitId || t?.unit || null;
        landlordId = t?.landlordId || t?.ownerId || t?.owner || null;
        tenantName = t?.fullName || t?.name || null;
        tenantEmail = t?.email || null;
      }
    } catch {
      // ignore lookup errors
    }

    const now = Date.now();
    const contact = typeof tenantContact === "object" && tenantContact !== null ? tenantContact : null;
    const doc = {
      landlordId,
      tenantId,
      propertyId,
      unitId,
      category: categorySafe,
      priority: prioritySafe,
      title: trimmedTitle,
      description: trimmedDescription,
      status: "NEW",
      tenantContact: {
        phone: contact?.phone ?? null,
        preferredTimes: contact?.preferredTimes ?? null,
      },
      createdAt: now,
      updatedAt: now,
      lastUpdatedBy: "TENANT",
      landlordNote: null,
    };

    const ref = await db.collection("maintenanceRequests").add(doc);

    let emailed = false;
    let emailError: string | undefined;
    const envFlags = getEnvFlags();
    const maintenanceNotifyEmail = String(process.env.MAINTENANCE_NOTIFY_EMAIL || "").trim();
    const adminEmails = getAdminEmails().filter((e) => emailRegex.test(e));
    let landlordEmail: string | null = null;

    if (landlordId) {
      try {
        const userSnap = await db.collection("users").doc(landlordId).get();
        if (userSnap.exists) {
          const u = userSnap.data() as any;
          landlordEmail = u?.email || landlordEmail;
        }
      } catch {
        // ignore lookup errors
      }
      if (!landlordEmail) {
        try {
          const llSnap = await db.collection("landlords").doc(landlordId).get();
          if (llSnap.exists) {
            const ll = llSnap.data() as any;
            landlordEmail = ll?.email || landlordEmail;
          }
        } catch {
          // ignore lookup errors
        }
      }
    }

    const recipients: string[] = [];
    if (maintenanceNotifyEmail && emailRegex.test(maintenanceNotifyEmail)) {
      recipients.push(maintenanceNotifyEmail);
    } else if (landlordEmail && emailRegex.test(landlordEmail)) {
      recipients.push(landlordEmail);
    } else if (adminEmails.length > 0) {
      recipients.push(...adminEmails);
    }

    if (recipients.length === 0) {
      emailError = "MISSING_RECIPIENT_EMAIL";
    } else if (!envFlags.emailConfigured) {
      emailError = "EMAIL_NOT_CONFIGURED";
    } else {
      const from =
        process.env.EMAIL_FROM ||
        process.env.SENDGRID_FROM_EMAIL ||
        process.env.SENDGRID_FROM ||
        process.env.FROM_EMAIL;
      const replyTo =
        process.env.EMAIL_REPLY_TO ||
        process.env.SENDGRID_REPLY_TO ||
        process.env.SENDGRID_REPLYTO_EMAIL;
      const baseUrl = (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
      const requestLink = `${baseUrl}/maintenance`;
      const excerpt =
        trimmedDescription.length > 400 ? `${trimmedDescription.slice(0, 400)}...` : trimmedDescription;

      if (!from) {
        emailError = "EMAIL_NOT_CONFIGURED";
      } else {
        try {
          await sendEmail({
            to: recipients,
            from,
            replyTo: replyTo || from,
            subject: `New maintenance request: ${trimmedTitle}`,
            text: buildEmailText({
              intro: `A tenant submitted a new maintenance request.\nTenant: ${tenantName || "Unknown"}${tenantEmail ? ` (${tenantEmail})` : ""}\nCategory: ${categorySafe}\nPriority: ${prioritySafe}\nRequest ID: ${ref.id}\n\n${excerpt}`,
              ctaText: "Open maintenance",
              ctaUrl: requestLink,
            }),
            html: buildEmailHtml({
              title: "New maintenance request",
              intro: `Tenant: ${tenantName || "Unknown"}${tenantEmail ? ` (${tenantEmail})` : ""}. Category: ${categorySafe}. Priority: ${prioritySafe}. Request ID: ${ref.id}.`,
              ctaText: "Open maintenance",
              ctaUrl: requestLink,
            }),
          });
          emailed = true;
        } catch (err: any) {
          const correlationId = makeCorrelationId("maint_mail");
          emailed = false;
          emailError = err?.message || "SEND_FAILED";
          console.error("[tenant/maintenance-requests] email send failed", {
            provider: envFlags.emailProvider,
            correlationId,
            requestId: ref.id,
            landlordId,
            message: err?.message || "send_failed",
          });
        }
      }
    }

    return res.json({ ok: true, data: { id: ref.id, ...doc }, emailed, emailError });
  } catch (err) {
    console.error("[tenant/maintenance-requests] create failed", {
      tenantId: req.user?.tenantId,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINT_REQUEST_CREATE_FAILED" });
  }
});

router.get("/maintenance-requests", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const snap = await db.collection("maintenanceRequests").where("tenantId", "==", tenantId).limit(50).get();
    const items = snap.docs.map((d) => {
      const data = (d.data() as any) || {};
      return {
        ...projectTenantMaintenance(d.id, data),
      };
    });
    items.sort((a, b) => (Number(b.updatedAt || 0) || 0) - (Number(a.updatedAt || 0) || 0));
    return res.json({ ok: true, data: items });
  } catch (err) {
    console.error("[tenant/maintenance-requests] list failed", {
      tenantId: req.user?.tenantId,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINT_REQUESTS_FAILED" });
  }
});

router.get("/maintenance", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    const snap = await db.collection("maintenanceRequests").where("tenantId", "==", tenantId).limit(50).get();
    const items = snap.docs.map((d) => {
      const data = (d.data() as any) || {};
      return {
        ...projectTenantMaintenance(d.id, data),
      };
    });
    items.sort((a, b) => (Number(b.updatedAt || 0) || 0) - (Number(a.updatedAt || 0) || 0));
    return res.json({ ok: true, items, data: items });
  } catch (err) {
    console.error("[tenant/maintenance] list failed", {
      tenantId: req.user?.tenantId,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINTENANCE_LIST_FAILED" });
  }
});

function projectTenantSafeReworkReview(value: any) {
  if (!value || typeof value !== "object") return null;
  return {
    status:
      value.status === "pending_review" ||
      value.status === "landlord_approved" ||
      value.status === "tenant_pending_signoff" ||
      value.status === "closed" ||
      value.status === "follow_up_required"
        ? value.status
        : null,
    reviewedAt: toMillis(value.reviewedAt),
    tenantSignoffStatus:
      value.tenantSignoffStatus === "pending" ||
      value.tenantSignoffStatus === "accepted" ||
      value.tenantSignoffStatus === "declined"
        ? value.tenantSignoffStatus
        : null,
    tenantSignedOffAt: toMillis(value.tenantSignedOffAt),
    tenantDeclinedAt: toMillis(value.tenantDeclinedAt),
    tenantDeclineReason: String(value.tenantDeclineReason || "").trim() || null,
    closureOutcome:
      value.closureOutcome === "resolved" ||
      value.closureOutcome === "partial" ||
      value.closureOutcome === "needs_more_followup"
        ? value.closureOutcome
        : null,
    closedAt: toMillis(value.closedAt),
  };
}

function projectTenantSafeReworkCycle(value: any) {
  if (!value || typeof value !== "object") return null;
  return {
    cycleNumber: Number(value.cycleNumber || 1),
    status:
      value.status === "not_started" ||
      value.status === "assigned" ||
      value.status === "in_progress" ||
      value.status === "completed" ||
      value.status === "cancelled"
        ? value.status
        : "not_started",
    createdAt: toMillis(value.createdAt),
    assignedAt: toMillis(value.assignedAt),
    startedAt: toMillis(value.startedAt),
    completedAt: toMillis(value.completedAt),
    completionSummary: String(value.completionSummary || "").trim() || null,
    schedule:
      value.schedule && typeof value.schedule === "object"
        ? {
            scheduledFor: toMillis(value.schedule.scheduledFor),
            timeWindowStart: toMillis(value.schedule.timeWindowStart),
            timeWindowEnd: toMillis(value.schedule.timeWindowEnd),
            status:
              value.schedule.status === "not_scheduled" ||
              value.schedule.status === "scheduled" ||
              value.schedule.status === "contractor_confirmed" ||
              value.schedule.status === "tenant_pending" ||
              value.schedule.status === "confirmed" ||
              value.schedule.status === "reschedule_requested" ||
              value.schedule.status === "cancelled"
                ? value.schedule.status
                : null,
            requiresTenantAccess:
              typeof value.schedule.requiresTenantAccess === "boolean" ? value.schedule.requiresTenantAccess : null,
            tenantAccessStatus:
              value.schedule.tenantAccessStatus === "pending" ||
              value.schedule.tenantAccessStatus === "confirmed" ||
              value.schedule.tenantAccessStatus === "denied" ||
              value.schedule.tenantAccessStatus === "not_required"
                ? value.schedule.tenantAccessStatus
                : null,
            tenantAccessNote: String(value.schedule.tenantAccessNote || "").trim() || null,
          }
        : null,
  };
}

function projectTenantSafeReworkHistory(value: any) {
  return Array.isArray(value)
    ? value.map((entry: any) => ({
        cycleNumber: Number(entry?.cycleNumber || 1),
        startedAt: toMillis(entry?.startedAt),
        completedAt: toMillis(entry?.completedAt),
        outcome:
          entry?.outcome === "resolved" || entry?.outcome === "failed" || entry?.outcome === "partial"
            ? entry.outcome
            : null,
        notes: String(entry?.notes || "").trim() || null,
      }))
    : [];
}

async function buildTenantMaintenanceDetailResponse(docId: string, maintenanceData: any, workOrderData: any, workOrderExists: boolean) {
  return {
    ...projectTenantMaintenance(docId, maintenanceData || {}),
    evidence: workOrderExists ? await serializeEvidenceForAudience(workOrderData?.evidence, "tenant") : [],
    reopenedAt: toMillis(workOrderData?.reopenedAt),
    reopenedByActorId: String(workOrderData?.reopenedByActorId || "").trim() || null,
    reopenedByActorRole:
      workOrderData?.reopenedByActorRole === "tenant" ||
      workOrderData?.reopenedByActorRole === "landlord" ||
      workOrderData?.reopenedByActorRole === "admin"
        ? workOrderData.reopenedByActorRole
        : null,
    reopenReason: String(workOrderData?.reopenReason || "").trim() || null,
    resolutionStatus:
      workOrderData?.resolutionStatus === "completed_pending_review" ||
      workOrderData?.resolutionStatus === "landlord_approved" ||
      workOrderData?.resolutionStatus === "tenant_pending_signoff" ||
      workOrderData?.resolutionStatus === "resolved" ||
      workOrderData?.resolutionStatus === "follow_up_required"
        ? workOrderData.resolutionStatus
        : null,
    landlordApprovedAt: toMillis(workOrderData?.landlordApprovedAt),
    tenantSignoffStatus:
      workOrderData?.tenantSignoffStatus === "pending" ||
      workOrderData?.tenantSignoffStatus === "accepted" ||
      workOrderData?.tenantSignoffStatus === "declined"
        ? workOrderData.tenantSignoffStatus
        : null,
    tenantSignedOffAt: toMillis(workOrderData?.tenantSignedOffAt),
    tenantDeclinedAt: toMillis(workOrderData?.tenantDeclinedAt),
    tenantDeclineReason: String(workOrderData?.tenantDeclineReason || "").trim() || null,
    followUpRequired: typeof workOrderData?.followUpRequired === "boolean" ? workOrderData.followUpRequired : null,
    followUpReason: String(workOrderData?.followUpReason || "").trim() || null,
    finalResolvedAt: toMillis(workOrderData?.finalResolvedAt),
    notifications: buildTenantSafeWorkOrderNotifications(workOrderData),
    reworkCycle: projectTenantSafeReworkCycle(workOrderData?.reworkCycle),
    reworkHistory: projectTenantSafeReworkHistory(workOrderData?.reworkHistory),
    reworkReview: projectTenantSafeReworkReview(workOrderData?.reworkReview),
  };
}

router.get("/maintenance-requests/:id", requireTenant, async (req: any, res) => {
  try {
    const tenantId = req.user?.tenantId;
    const id = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const doc = await db.collection("maintenanceRequests").doc(id).get();
    if (!doc.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    const data = (doc.data() as any) || {};
    if (data.tenantId && data.tenantId !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    const workOrderSnap = await db.collection("workOrders").doc(`maintenance_${doc.id}`).get();
    const workOrderData = workOrderSnap.exists ? ((workOrderSnap.data() as any) || {}) : {};
    const payload = await buildTenantMaintenanceDetailResponse(doc.id, data, workOrderData, workOrderSnap.exists);
    return res.json({ ok: true, data: payload });
  } catch (err) {
    console.error("[tenant/maintenance-requests/:id] read failed", {
      tenantId: req.user?.tenantId,
      id: req.params?.id,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINT_REQUEST_READ_FAILED" });
  }
});

router.post("/maintenance/:id/reopen", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const reason = String(req.body?.reason || "").trim().slice(0, 2000);
    if (!reason) {
      return res.status(400).json({ ok: false, error: "REOPEN_REASON_REQUIRED" });
    }

    const docRef = db.collection("maintenanceRequests").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const data = (snap.data() as any) || {};
    if (String(data.tenantId || "").trim() !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const workOrderRef = db.collection("workOrders").doc(`maintenance_${id}`);
    const workOrderSnap = await workOrderRef.get();
    if (!workOrderSnap.exists) {
      return res.status(404).json({ ok: false, error: "WORK_ORDER_NOT_FOUND" });
    }

    const workOrder = (workOrderSnap.data() as any) || {};
    if (String(workOrder.status || "").trim().toLowerCase() !== "completed") {
      return res.status(400).json({ ok: false, error: "REOPEN_NOT_AVAILABLE" });
    }
    if (String(workOrder.resolutionStatus || "").trim().toLowerCase() === "tenant_pending_signoff") {
      return res.status(400).json({ ok: false, error: "TENANT_SIGNOFF_REQUIRED" });
    }
    if (String(workOrder?.reworkReview?.status || "").trim().toLowerCase() === "tenant_pending_signoff") {
      return res.status(400).json({ ok: false, error: "REWORK_SIGNOFF_REQUIRED" });
    }
    if (
      String(workOrder.resolutionStatus || "").trim().toLowerCase() === "follow_up_required" ||
      workOrder.followUpRequired === true
    ) {
      return res.status(400).json({ ok: false, error: "FOLLOW_UP_ALREADY_ACTIVE" });
    }

    const hasClosedOrResolvedState =
      typeof toMillis(workOrder.finalResolvedAt) === "number" ||
      String(workOrder.resolutionStatus || "").trim().toLowerCase() === "resolved" ||
      String(workOrder.tenantSignoffStatus || "").trim().toLowerCase() === "accepted" ||
      String(workOrder?.reworkReview?.status || "").trim().toLowerCase() === "closed";
    if (!hasClosedOrResolvedState) {
      return res.status(400).json({ ok: false, error: "REOPEN_NOT_AVAILABLE" });
    }

    const now = Date.now();
    const historyMessage = `Tenant reopened the request: ${reason}`;
    const contractorLastUpdate = `Tenant reported the issue still needs attention: ${reason}`;

    await workOrderRef.set(
      {
        tenantSignoffStatus: "declined",
        tenantSignedOffAt: null,
        tenantDeclinedAt: now,
        tenantDeclineReason: reason,
        resolutionStatus: "follow_up_required",
        followUpRequired: true,
        followUpReason: reason,
        finalResolvedAt: null,
        reopenedAt: now,
        reopenedByActorId: tenantId,
        reopenedByActorRole: "tenant",
        reopenReason: reason,
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
      },
      { merge: true }
    );
    const refreshedReopenWorkOrder = await workOrderRef.get();
    const refreshedReopenWorkOrderData = (refreshedReopenWorkOrder.data() as any) || {};
    const reopenNotifications = await applyNotificationUpdate(workOrderRef, refreshedReopenWorkOrderData, now);

    await Promise.all([
      docRef.set(
        {
          updatedAt: now,
          lastUpdatedBy: "TENANT",
          contractorLastUpdate,
          tenantSignoffStatus: "declined",
          tenantSignedOffAt: null,
          tenantDeclinedAt: now,
          tenantDeclineReason: reason,
          resolutionStatus: "follow_up_required",
          followUpRequired: true,
          followUpReason: reason,
          finalResolvedAt: null,
          reopenedAt: now,
          reopenedByActorId: tenantId,
          reopenedByActorRole: "tenant",
          reopenReason: reason,
          notifications: buildTenantSafeWorkOrderNotifications({
            ...refreshedReopenWorkOrderData,
            notifications: reopenNotifications,
          }),
          statusHistory: FieldValue.arrayUnion({
            status: String(data.status || "completed"),
            actorRole: "tenant",
            actorId: tenantId,
            message: historyMessage,
            createdAt: now,
          }),
        },
        { merge: true }
      ),
      db.collection("workOrderUpdates").doc().set({
        workOrderId: workOrderRef.id,
        actorRole: "tenant",
        actorId: tenantId,
        updateType: "reopened",
        message: historyMessage,
        createdAtMs: now,
      }),
    ]);

    const [refreshed, refreshedWorkOrder] = await Promise.all([docRef.get(), workOrderRef.get()]);
    const refreshedWorkOrderData = refreshedWorkOrder.exists ? ((refreshedWorkOrder.data() as any) || {}) : {};
    return res.json({
      ok: true,
      data: await buildTenantMaintenanceDetailResponse(refreshed.id, refreshed.data() || {}, refreshedWorkOrderData, refreshedWorkOrder.exists),
    });
  } catch (err) {
    console.error("[tenant/maintenance/:id/reopen] update failed", {
      tenantId: req.user?.tenantId,
      id: req.params?.id,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINT_REQUEST_REOPEN_FAILED" });
  }
});

router.post("/maintenance/:id/signoff", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const docRef = db.collection("maintenanceRequests").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const data = (snap.data() as any) || {};
    if (String(data.tenantId || "").trim() !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const workOrderRef = db.collection("workOrders").doc(`maintenance_${id}`);
    const workOrderSnap = await workOrderRef.get();
    if (!workOrderSnap.exists) {
      return res.status(404).json({ ok: false, error: "WORK_ORDER_NOT_FOUND" });
    }

    const workOrder = (workOrderSnap.data() as any) || {};
    if (String(workOrder.status || "").trim().toLowerCase() !== "completed") {
      return res.status(400).json({ ok: false, error: "WORK_ORDER_NOT_COMPLETED" });
    }
    if (String(workOrder?.reworkReview?.status || "").trim().toLowerCase() === "tenant_pending_signoff") {
      return res.status(400).json({ ok: false, error: "REWORK_SIGNOFF_REQUIRED" });
    }
    if (String(workOrder.resolutionStatus || "").trim().toLowerCase() !== "tenant_pending_signoff") {
      return res.status(400).json({ ok: false, error: "TENANT_SIGNOFF_NOT_AVAILABLE" });
    }

    const decision = req.body?.decision === "resolved" || req.body?.decision === "not_resolved" ? req.body.decision : null;
    if (!decision) {
      return res.status(400).json({ ok: false, error: "INVALID_SIGNOFF_DECISION" });
    }
    const reason = String(req.body?.reason || "").trim().slice(0, 2000);
    if (decision === "not_resolved" && !reason) {
      return res.status(400).json({ ok: false, error: "TENANT_DECLINE_REASON_REQUIRED" });
    }

    const now = Date.now();
    const workOrderUpdate: Record<string, unknown> = {
      updatedAtMs: now,
      lastExecutionUpdateAt: now,
    };
    const maintenanceUpdate: Record<string, unknown> = {
      updatedAt: now,
      lastUpdatedBy: "TENANT",
    };
    let historyMessage = "";
    let contractorLastUpdate = "";

    if (decision === "resolved") {
      Object.assign(workOrderUpdate, {
        tenantSignoffStatus: "accepted",
        tenantSignedOffAt: now,
        tenantDeclinedAt: null,
        tenantDeclineReason: null,
        resolutionStatus: "resolved",
        followUpRequired: false,
        followUpReason: null,
        finalResolvedAt: now,
      });
      Object.assign(maintenanceUpdate, {
        tenantSignoffStatus: "accepted",
        tenantSignedOffAt: now,
        tenantDeclinedAt: null,
        tenantDeclineReason: null,
        resolutionStatus: "resolved",
        followUpRequired: false,
        followUpReason: null,
        finalResolvedAt: now,
      });
      historyMessage = "Tenant confirmed that the maintenance issue is resolved.";
      contractorLastUpdate = "Tenant confirmed that the maintenance issue is resolved.";
    } else {
      Object.assign(workOrderUpdate, {
        tenantSignoffStatus: "declined",
        tenantSignedOffAt: null,
        tenantDeclinedAt: now,
        tenantDeclineReason: reason,
        resolutionStatus: "follow_up_required",
        followUpRequired: true,
        followUpReason: reason,
        finalResolvedAt: null,
      });
      Object.assign(maintenanceUpdate, {
        tenantSignoffStatus: "declined",
        tenantSignedOffAt: null,
        tenantDeclinedAt: now,
        tenantDeclineReason: reason,
        resolutionStatus: "follow_up_required",
        followUpRequired: true,
        followUpReason: reason,
        finalResolvedAt: null,
      });
      historyMessage = `Tenant reported the issue is not resolved: ${reason}`;
      contractorLastUpdate = `Tenant requested follow-up: ${reason}`;
    }

    await workOrderRef.set(workOrderUpdate, { merge: true });
    const refreshedWorkOrderAfterSignoff = await workOrderRef.get();
    const refreshedWorkOrderAfterSignoffData = (refreshedWorkOrderAfterSignoff.data() as any) || {};
    const notifications = await applyNotificationUpdate(workOrderRef, refreshedWorkOrderAfterSignoffData, now);

    await Promise.all([
      docRef.set(
        {
          ...maintenanceUpdate,
          notifications: buildTenantSafeWorkOrderNotifications({
            ...refreshedWorkOrderAfterSignoffData,
            notifications,
          }),
          contractorLastUpdate,
          statusHistory: FieldValue.arrayUnion({
            status: String(data.status || "completed"),
            actorRole: "tenant",
            actorId: tenantId,
            message: historyMessage,
            createdAt: now,
          }),
        },
        { merge: true }
      ),
      db.collection("workOrderUpdates").doc().set({
        workOrderId: workOrderRef.id,
        actorRole: "tenant",
        actorId: tenantId,
        updateType: "confirmed",
        message: historyMessage,
        createdAtMs: now,
      }),
    ]);

    const [refreshed, refreshedWorkOrder] = await Promise.all([docRef.get(), workOrderRef.get()]);
    const refreshedWorkOrderData = refreshedWorkOrder.exists ? ((refreshedWorkOrder.data() as any) || {}) : {};
    return res.json({
      ok: true,
      data: await buildTenantMaintenanceDetailResponse(refreshed.id, refreshed.data() || {}, refreshedWorkOrderData, refreshedWorkOrder.exists),
    });
  } catch (err) {
    console.error("[tenant/maintenance/:id/signoff] update failed", {
      tenantId: req.user?.tenantId,
      id: req.params?.id,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINT_REQUEST_SIGNOFF_FAILED" });
  }
});

router.post("/maintenance/:id/rework-signoff", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const docRef = db.collection("maintenanceRequests").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const data = (snap.data() as any) || {};
    if (String(data.tenantId || "").trim() !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const workOrderRef = db.collection("workOrders").doc(`maintenance_${id}`);
    const workOrderSnap = await workOrderRef.get();
    if (!workOrderSnap.exists) return res.status(404).json({ ok: false, error: "WORK_ORDER_NOT_FOUND" });
    const workOrder = (workOrderSnap.data() as any) || {};
    if (String(workOrder.status || "").trim().toLowerCase() !== "completed") {
      return res.status(400).json({ ok: false, error: "WORK_ORDER_NOT_COMPLETED" });
    }
    if (String(workOrder?.reworkReview?.status || "").trim().toLowerCase() !== "tenant_pending_signoff") {
      return res.status(400).json({ ok: false, error: "REWORK_SIGNOFF_NOT_AVAILABLE" });
    }

    const decision = req.body?.decision === "resolved" || req.body?.decision === "not_resolved" ? req.body.decision : null;
    if (!decision) return res.status(400).json({ ok: false, error: "INVALID_REWORK_SIGNOFF_DECISION" });

    const reason = String(req.body?.reason || "").trim().slice(0, 2000);
    if (decision === "not_resolved" && !reason) {
      return res.status(400).json({ ok: false, error: "TENANT_DECLINE_REASON_REQUIRED" });
    }

    const now = Date.now();
    const historyMessage =
      decision === "resolved"
        ? "Tenant confirmed that the rework return visit resolved the issue."
        : `Tenant reported the rework return visit is still not resolved: ${reason}`;

    const reworkReviewUpdate =
      decision === "resolved"
        ? {
            ...(workOrder.reworkReview || {}),
            status: "closed",
            tenantSignoffStatus: "accepted",
            tenantSignedOffAt: now,
            tenantDeclinedAt: null,
            tenantDeclineReason: null,
            closureOutcome: "resolved",
            closedAt: now,
          }
        : {
            ...(workOrder.reworkReview || {}),
            status: "follow_up_required",
            tenantSignoffStatus: "declined",
            tenantSignedOffAt: null,
            tenantDeclinedAt: now,
            tenantDeclineReason: reason,
            closureOutcome: "needs_more_followup",
            closedAt: null,
          };

    await workOrderRef.set(
      {
        reworkReview: reworkReviewUpdate,
        resolutionStatus: decision === "resolved" ? "resolved" : "follow_up_required",
        followUpRequired: decision !== "resolved",
        followUpReason: decision === "resolved" ? null : reason,
        finalResolvedAt: decision === "resolved" ? now : null,
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
      },
      { merge: true }
    );
    const refreshedReworkSignoffWorkOrder = await workOrderRef.get();
    const refreshedReworkSignoffWorkOrderData = (refreshedReworkSignoffWorkOrder.data() as any) || {};
    const reworkNotifications = await applyNotificationUpdate(workOrderRef, refreshedReworkSignoffWorkOrderData, now);

    await Promise.all([
      docRef.set(
        {
          contractorLastUpdate: historyMessage,
          updatedAt: now,
          lastUpdatedBy: "TENANT",
          notifications: buildTenantSafeWorkOrderNotifications({
            ...refreshedReworkSignoffWorkOrderData,
            notifications: reworkNotifications,
          }),
          statusHistory: FieldValue.arrayUnion({
            status: String(data.status || "completed"),
            actorRole: "tenant",
            actorId: tenantId,
            message: historyMessage,
            createdAt: now,
          }),
        },
        { merge: true }
      ),
      db.collection("workOrderUpdates").doc().set({
        workOrderId: workOrderRef.id,
        actorRole: "tenant",
        actorId: tenantId,
        updateType: "confirmed",
        message: historyMessage,
        createdAtMs: now,
      }),
    ]);

    const [refreshed, refreshedWorkOrder] = await Promise.all([docRef.get(), workOrderRef.get()]);
    const refreshedWorkOrderData = refreshedWorkOrder.exists ? ((refreshedWorkOrder.data() as any) || {}) : {};
    return res.json({
      ok: true,
      data: await buildTenantMaintenanceDetailResponse(refreshed.id, refreshed.data() || {}, refreshedWorkOrderData, refreshedWorkOrder.exists),
    });
  } catch (err) {
    console.error("[tenant/maintenance/:id/rework-signoff] update failed", {
      tenantId: req.user?.tenantId,
      id: req.params?.id,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_REWORK_SIGNOFF_FAILED" });
  }
});

router.post("/maintenance/:id/rework-signoff", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const docRef = db.collection("maintenanceRequests").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const data = (snap.data() as any) || {};
    if (String(data.tenantId || "").trim() !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const workOrderRef = db.collection("workOrders").doc(`maintenance_${id}`);
    const workOrderSnap = await workOrderRef.get();
    if (!workOrderSnap.exists) return res.status(404).json({ ok: false, error: "WORK_ORDER_NOT_FOUND" });
    const workOrder = (workOrderSnap.data() as any) || {};
    if (String(workOrder.status || "").trim().toLowerCase() !== "completed") {
      return res.status(400).json({ ok: false, error: "WORK_ORDER_NOT_COMPLETED" });
    }
    if (String(workOrder?.reworkReview?.status || "").trim().toLowerCase() !== "tenant_pending_signoff") {
      return res.status(400).json({ ok: false, error: "REWORK_SIGNOFF_NOT_AVAILABLE" });
    }

    const decision = req.body?.decision === "resolved" || req.body?.decision === "not_resolved" ? req.body.decision : null;
    if (!decision) return res.status(400).json({ ok: false, error: "INVALID_REWORK_SIGNOFF_DECISION" });

    const reason = String(req.body?.reason || "").trim().slice(0, 2000);
    if (decision === "not_resolved" && !reason) {
      return res.status(400).json({ ok: false, error: "TENANT_DECLINE_REASON_REQUIRED" });
    }

    const now = Date.now();
    const historyMessage =
      decision === "resolved"
        ? "Tenant confirmed that the rework return visit resolved the issue."
        : `Tenant reported the rework return visit is still not resolved: ${reason}`;

    const reworkReviewUpdate =
      decision === "resolved"
        ? {
            ...(workOrder.reworkReview || {}),
            status: "closed",
            tenantSignoffStatus: "accepted",
            tenantSignedOffAt: now,
            tenantDeclinedAt: null,
            tenantDeclineReason: null,
            closureOutcome: "resolved",
            closedAt: now,
          }
        : {
            ...(workOrder.reworkReview || {}),
            status: "follow_up_required",
            tenantSignoffStatus: "declined",
            tenantSignedOffAt: null,
            tenantDeclinedAt: now,
            tenantDeclineReason: reason,
            closureOutcome: "needs_more_followup",
            closedAt: null,
          };

    await workOrderRef.set(
      {
        reworkReview: reworkReviewUpdate,
        resolutionStatus: decision === "resolved" ? "resolved" : "follow_up_required",
        followUpRequired: decision !== "resolved",
        followUpReason: decision === "resolved" ? null : reason,
        finalResolvedAt: decision === "resolved" ? now : null,
        updatedAtMs: now,
        lastExecutionUpdateAt: now,
      },
      { merge: true }
    );
    const refreshedReworkSignoffWorkOrder = await workOrderRef.get();
    const refreshedReworkSignoffWorkOrderData = (refreshedReworkSignoffWorkOrder.data() as any) || {};
    const reworkNotifications = await applyNotificationUpdate(workOrderRef, refreshedReworkSignoffWorkOrderData, now);

    await Promise.all([
      docRef.set(
        {
          contractorLastUpdate: historyMessage,
          updatedAt: now,
          lastUpdatedBy: "TENANT",
          notifications: buildTenantSafeWorkOrderNotifications({
            ...refreshedReworkSignoffWorkOrderData,
            notifications: reworkNotifications,
          }),
          statusHistory: FieldValue.arrayUnion({
            status: String(data.status || "completed"),
            actorRole: "tenant",
            actorId: tenantId,
            message: historyMessage,
            createdAt: now,
          }),
        },
        { merge: true }
      ),
      db.collection("workOrderUpdates").doc().set({
        workOrderId: workOrderRef.id,
        actorRole: "tenant",
        actorId: tenantId,
        updateType: "confirmed",
        message: historyMessage,
        createdAtMs: now,
      }),
    ]);

    const [refreshed, refreshedWorkOrder] = await Promise.all([docRef.get(), workOrderRef.get()]);
    const refreshedWorkOrderData = refreshedWorkOrder.exists ? ((refreshedWorkOrder.data() as any) || {}) : {};
    return res.json({
      ok: true,
      data: await buildTenantMaintenanceDetailResponse(refreshed.id, refreshed.data() || {}, refreshedWorkOrderData, refreshedWorkOrder.exists),
    });
  } catch (err) {
    console.error("[tenant/maintenance/:id/rework-signoff] update failed", {
      tenantId: req.user?.tenantId,
      id: req.params?.id,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_REWORK_SIGNOFF_FAILED" });
  }
});

router.post("/maintenance/:id/confirm-rework-access", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const docRef = db.collection("maintenanceRequests").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    const data = (snap.data() as any) || {};
    if (String(data.tenantId || "").trim() !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const workOrderRef = db.collection("workOrders").doc(`maintenance_${id}`);
    const workOrderSnap = await workOrderRef.get();
    if (!workOrderSnap.exists) return res.status(404).json({ ok: false, error: "WORK_ORDER_NOT_FOUND" });
    const workOrder = (workOrderSnap.data() as any) || {};
    const reworkCycle = workOrder?.reworkCycle || null;
    const schedule = reworkCycle?.schedule || null;
    if (!reworkCycle || !schedule) return res.status(400).json({ ok: false, error: "REWORK_SCHEDULE_NOT_AVAILABLE" });
    if (schedule.requiresTenantAccess !== true) {
      return res.status(400).json({ ok: false, error: "REWORK_ACCESS_CONFIRMATION_NOT_REQUIRED" });
    }

    const decision = req.body?.decision === "confirm" || req.body?.decision === "deny" ? req.body.decision : null;
    if (!decision) return res.status(400).json({ ok: false, error: "INVALID_REWORK_ACCESS_DECISION" });

    const note = String(req.body?.note || "").trim().slice(0, 2000) || null;
    const now = Date.now();
    const nextSchedule = {
      ...schedule,
      tenantAccessStatus: decision === "confirm" ? "confirmed" : "denied",
      tenantAccessNote: note,
      status:
        decision === "deny"
          ? "reschedule_requested"
          : schedule.contractorScheduleStatus === "confirmed"
          ? "confirmed"
          : "tenant_pending",
      lastUpdatedAt: now,
    };

    const historyMessage =
      decision === "confirm"
        ? "Tenant confirmed access for the rework return visit."
        : `Tenant denied access for the rework return visit.${note ? ` ${note}` : ""}`;

    await workOrderRef.set(
      {
        reworkCycle: {
          ...reworkCycle,
          schedule: nextSchedule,
        },
        updatedAtMs: now,
      },
      { merge: true }
    );
    const refreshedAccessWorkOrder = await workOrderRef.get();
    const refreshedAccessWorkOrderData = (refreshedAccessWorkOrder.data() as any) || {};
    const accessNotifications = await applyNotificationUpdate(workOrderRef, refreshedAccessWorkOrderData, now);

    await Promise.all([
      docRef.set(
        {
          contractorLastUpdate: historyMessage,
          updatedAt: now,
          lastUpdatedBy: "TENANT",
          notifications: buildTenantSafeWorkOrderNotifications({
            ...refreshedAccessWorkOrderData,
            notifications: accessNotifications,
          }),
          statusHistory: FieldValue.arrayUnion({
            status: String(data.status || "assigned"),
            actorRole: "tenant",
            actorId: tenantId,
            message: historyMessage,
            createdAt: now,
          }),
        },
        { merge: true }
      ),
      db.collection("workOrderUpdates").doc().set({
        workOrderId: workOrderRef.id,
        actorRole: "tenant",
        actorId: tenantId,
        updateType: "confirmed",
        message: historyMessage,
        createdAtMs: now,
      }),
    ]);

    const [refreshed, refreshedWorkOrder] = await Promise.all([docRef.get(), workOrderRef.get()]);
    const refreshedWorkOrderData = refreshedWorkOrder.exists ? ((refreshedWorkOrder.data() as any) || {}) : {};
    return res.json({
      ok: true,
      data: await buildTenantMaintenanceDetailResponse(refreshed.id, refreshed.data() || {}, refreshedWorkOrderData, refreshedWorkOrder.exists),
    });
  } catch (err) {
    console.error("[tenant/maintenance/:id/confirm-rework-access] update failed", {
      tenantId: req.user?.tenantId,
      id: req.params?.id,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_REWORK_ACCESS_CONFIRMATION_FAILED" });
  }
});

router.post("/maintenance-requests/:id/confirmation", requireTenant, async (req: any, res) => {
  try {
    const tenantId = String(req.user?.tenantId || "").trim();
    const id = String(req.params?.id || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!id) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const docRef = db.collection("maintenanceRequests").doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ ok: false, error: "NOT_FOUND" });

    const data = (snap.data() as any) || {};
    if (String(data.tenantId || "").trim() !== tenantId) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const confirmationStatus =
      req.body?.confirmationStatus === undefined
        ? undefined
        : req.body?.confirmationStatus === "confirmed" || req.body?.confirmationStatus === "needs_schedule_change"
        ? req.body.confirmationStatus
        : null;
    if (req.body?.confirmationStatus !== undefined && confirmationStatus === null) {
      return res.status(400).json({ ok: false, error: "INVALID_CONFIRMATION_STATUS" });
    }

    const acknowledgeAccess = req.body?.acknowledgeAccess === true;
    const serviceWindowStartAt = toMillis(data.serviceWindowStartAt);
    const accessRequired = data.accessRequired === true;
    if (confirmationStatus && !serviceWindowStartAt) {
      return res.status(400).json({ ok: false, error: "SERVICE_WINDOW_REQUIRED" });
    }
    if (acknowledgeAccess && !accessRequired) {
      return res.status(400).json({ ok: false, error: "ACCESS_ACKNOWLEDGEMENT_NOT_REQUIRED" });
    }
    if (confirmationStatus === undefined && !acknowledgeAccess) {
      return res.status(400).json({ ok: false, error: "NO_CONFIRMATION_UPDATE" });
    }

    const now = Date.now();
    const update: Record<string, unknown> = {
      updatedAt: now,
      lastUpdatedBy: "TENANT",
    };
    if (confirmationStatus !== undefined) {
      update.tenantConfirmationStatus = confirmationStatus;
      update.tenantConfirmationUpdatedAt = now;
    }
    if (acknowledgeAccess) {
      update.accessAcknowledgedAt = now;
    }

    await docRef.set(update, { merge: true });

    const historyEntries: Array<{ status: string; actorRole: string; actorId: string; message: string; createdAt: number }> = [];
    if (confirmationStatus === "confirmed") {
      historyEntries.push({
        status: String(data.status || "scheduled"),
        actorRole: "tenant",
        actorId: tenantId,
        message: "Tenant confirmed the scheduled service window.",
        createdAt: now,
      });
    } else if (confirmationStatus === "needs_schedule_change") {
      historyEntries.push({
        status: String(data.status || "scheduled"),
        actorRole: "tenant",
        actorId: tenantId,
        message: "Tenant requested a schedule change.",
        createdAt: now,
      });
    }
    if (acknowledgeAccess) {
      historyEntries.push({
        status: String(data.status || "scheduled"),
        actorRole: "tenant",
        actorId: tenantId,
        message: "Tenant acknowledged the access requirement.",
        createdAt: now,
      });
    }
    if (historyEntries.length) {
      await docRef.set({ statusHistory: FieldValue.arrayUnion(...historyEntries) }, { merge: true });
    }

    const refreshed = await docRef.get();
    return res.json({
      ok: true,
      data: {
        ...projectTenantMaintenance(refreshed.id, refreshed.data() || {}),
      },
    });
  } catch (err) {
    console.error("[tenant/maintenance-requests/:id/confirmation] update failed", {
      tenantId: req.user?.tenantId,
      id: req.params?.id,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_MAINT_REQUEST_CONFIRMATION_FAILED" });
  }
});

export default router;
