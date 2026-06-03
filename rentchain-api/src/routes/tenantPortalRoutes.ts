import { createHash, randomBytes } from "crypto";
import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { routeSource } from "../middleware/routeSource";
import { db, FieldValue } from "../firebase";
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
  tenantSafeMaintenanceReferenceKey,
} from "../services/tenantPortal/tenantProjectionService";
import {
  deriveTenantSafeProjectionMetadata,
  deriveTenantSafeSourceRefs,
  type TenantSafeProjectionSourceReference,
} from "../services/tenantPortal/tenantSafeProjectionContract";
import {
  buildTenantFinancialProjectionMetadata,
  projectTenantFinancialEvent,
  projectTenantLedgerItem,
  projectTenantRentPaymentSummary,
} from "../services/tenantPortal/tenantFinancialProjectionService";
import { deriveLeaseExecution } from "../services/leaseExecution/deriveLeaseExecution";
import { recordTenantEvent } from "../services/tenantPortal/tenantEventLogService";
import { redeemTenancyInvite } from "../services/tenantPortal/tenantInviteService";
import {
  loadTenantApplicationReuseProjection,
  loadTenantIdentityRecord,
  loadTenantProfileProjection,
  sanitizeTenantApplicationReuseProjection,
  sanitizeTenantProfileProjection,
} from "../services/tenantPortal/tenantProfileService";
import { deriveTenantCredibilitySignals } from "../services/tenantCredibility/deriveTenantCredibilitySignals";
import { deriveIdentityTimeline } from "../services/identityTimeline/deriveIdentityTimeline";
import { deriveIdentityPortability } from "../services/identityPortability/deriveIdentityPortability";
import { deriveInstitutionalIdentityPackage } from "../services/institutional/deriveInstitutionalIdentityPackage";
import { deriveInstitutionalSchemaV2 } from "../services/institutional/deriveInstitutionalSchemaV2";
import { validateInstitutionalSchema } from "../services/institutional/validateInstitutionalSchema";
import { deriveComplianceReadiness } from "../services/compliance/deriveComplianceReadiness";
import {
  createInstitutionalHandoffDraft,
  listInstitutionalHandoffsForTenant,
  softVoidInstitutionalHandoff,
  type InstitutionType,
} from "../services/institutional/institutionalHandoffService";
import { derivePaymentReadiness } from "../services/paymentReadiness/derivePaymentReadiness";
import {
  createRentPaymentCheckout,
  deriveRentPaymentEligibility,
  getRentPaymentSummaryForLease,
} from "../services/rentPayments/rentPaymentService";
import { isStripeConfigured } from "../services/stripeService";
import {
  loadTenantCommunicationsWorkspace,
  markTenantCommunicationsRead,
  sendTenantCommunicationMessage,
} from "../services/tenantPortal/tenantCommunicationsService";
import {
  listTenantNotificationFeed,
  markTenantNotificationRead,
} from "../services/tenantPortal/tenantNotificationsService";
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
  respondToTenantShareVerificationRequest,
  respondToTenantSharePackage,
  revokeTenantShareVerificationRequest,
  revokeTenantSharePackage,
} from "../services/tenantPortal/tenantSharePackageService";
import {
  listTenantTrustExports,
  prepareTenantTrustExport,
  previewTenantTrustExport,
  revokeTenantTrustExport,
} from "../services/tenantPortal/tenantTrustExportService";
import {
  createInstitutionReviewInvite,
  createTenantInstitutionAccessGrant,
  listTenantInstitutionAccessGrants,
  previewTenantInstitutionAccess,
  resendInstitutionReviewDelivery,
  revokeTenantInstitutionAccessGrant,
} from "../services/tenantPortal/tenantInstitutionAccessService";
import { recordSystemObservabilityEvent } from "../services/observability/recordSystemObservabilityEvent";
import { buildLeasePaymentProjection } from "../services/projections/buildLeasePaymentProjection";
import { getSignedDownloadUrl } from "../lib/gcsSignedUrl";

const router = Router();
router.use(authenticateJwt);
const tenantPortalRouteSource = routeSource("tenantPortalRoutes.ts");

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

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function tenantPublicReference(kind: string, raw: unknown): string | null {
  const value = String(raw || "").trim();
  if (!value) return null;
  const digest = createHash("sha256").update(`${kind}:${value}`).digest("hex").slice(0, 12);
  return `${kind}-ref-${digest}`;
}

function dollarsFromCents(value: unknown): number | null {
  const cents = Number(value);
  if (!Number.isFinite(cents)) return null;
  return Math.round(cents) / 100;
}

function normalizePaymentStatusForTenant(status: unknown): "on_time" | "late" | "partial" | "unpaid" | "unknown" {
  const next = String(status || "").trim().toLowerCase();
  if (next === "paid") return "on_time";
  if (next === "payment_pending" || next === "checkout_created") return "partial";
  if (next === "failed" || next === "expired") return "late";
  if (next === "canceled") return "unpaid";
  return "unknown";
}

function buildTenantPaymentsSummaryResponse(params: {
  tenantId: string;
  leaseId: string;
  leaseData: any;
  projectedSummary: ReturnType<typeof projectTenantRentPaymentSummary>;
}) {
  const monthlyRent = typeof params.leaseData?.monthlyRent === "number" ? params.leaseData.monthlyRent : null;
  const rentDayOfMonth = typeof params.leaseData?.dueDay === "number" ? params.leaseData.dueDay : null;
  const history = params.projectedSummary.paymentExperience.history || [];
  const latestPaid = history.find((payment: any) => payment?.status === "paid") || null;
  const latest = params.projectedSummary.latestPayment || history[0] || null;
  const latestAmount = dollarsFromCents(latestPaid?.amountCents ?? latest?.amountCents);

  return {
    tenantReference: tenantPublicReference("tenant", params.tenantId),
    leaseReference: tenantPublicReference("lease", params.leaseId),
    rentAmount: monthlyRent,
    rentDayOfMonth,
    nextDueDate: null,
    lastPayment: latest
      ? {
          paymentReference: latest?.id || null,
          amount: latestAmount,
          paidAt: latestPaid?.paidAt || latest?.paidAt || null,
          dueDate: null,
          status: normalizePaymentStatusForTenant(latestPaid?.status || latest?.status),
        }
      : null,
    currentPeriod: {
      periodStart: null,
      periodEnd: null,
      amountDue: monthlyRent,
      amountPaid: latestPaid?.amountCents != null ? dollarsFromCents(latestPaid.amountCents) : null,
      status: normalizePaymentStatusForTenant(params.projectedSummary.paymentExperience.latestStatus),
    },
    paymentRail: params.projectedSummary.paymentRail,
    paymentExperience: params.projectedSummary.paymentExperience,
  };
}

function projectTenantRentCharge(doc: any) {
  const data = (doc?.data?.() || {}) as any;
  return {
    id: tenantPublicReference("rent-charge", doc?.id) || "rent-charge-ref-unavailable",
    amount: typeof data?.amount === "number" && Number.isFinite(data.amount) ? data.amount : 0,
    dueDate: asString(data?.dueDate),
    period: asString(data?.period),
    status: asString(data?.status) || "issued",
    issuedAt: asString(data?.issuedAt) || asString(data?.createdAt),
    confirmedAt: asString(data?.confirmedAt),
    paidAt: asString(data?.paidAt),
    description: asString(data?.description),
    leaseReference: tenantPublicReference("lease", data?.leaseId),
    propertyReference: tenantPublicReference("property", data?.propertyId),
    unitReference: tenantPublicReference("unit", data?.unitId),
  };
}

function displayStringUnlessId(value: unknown, rawId?: unknown): string | null {
  const next = asString(value);
  if (!next) return null;
  const id = asString(rawId);
  return id && next === id ? null : next;
}

function firstDisplayString(values: unknown[], rawIds: unknown[] = []): string | null {
  const raw = new Set(rawIds.map((value) => asString(value)).filter(Boolean) as string[]);
  for (const value of values) {
    const next = asString(value);
    if (next && !raw.has(next)) return next;
  }
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
  documentReference: string;
  label: string;
  category: string;
  status: TenantDocumentStatus;
  fileName: string | null;
  title: string | null;
  purpose: string | null;
  purposeLabel: string | null;
  tenantReference: string | null;
  leaseReference: string | null;
  draftReference: string | null;
  ledgerReference: string | null;
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

function tenantConversationMatchesContext(conversation: any, context: Awaited<ReturnType<typeof resolveTenancyContext>> | null) {
  if (!context?.ok) return true;
  const conversationTenantId = String(conversation?.tenantId || "").trim();
  const conversationLeaseId = String(conversation?.leaseId || "").trim();
  const conversationApplicationId = String(conversation?.applicationId || "").trim();
  const conversationPropertyId = String(conversation?.propertyId || "").trim();
  const conversationUnitId = String(conversation?.unitId || "").trim();
  const tenantId = String(context.tenantId || "").trim();
  const leaseId = String(context.leaseId || "").trim();
  const applicationId = String(context.applicationId || "").trim();
  const propertyId = String(context.propertyId || "").trim();
  const unitId = String(context.unitId || "").trim();

  if (tenantId && conversationTenantId === tenantId) return true;
  if (leaseId && conversationLeaseId === leaseId) return true;
  if (applicationId && conversationApplicationId === applicationId) return true;
  if (unitId && conversationUnitId === unitId) {
    return !propertyId || !conversationPropertyId || conversationPropertyId === propertyId;
  }
  return false;
}

async function addTenantConversationCandidates(
  candidates: Map<string, any>,
  field: string,
  value: string | null | undefined,
  context: Awaited<ReturnType<typeof resolveTenancyContext>> | null
) {
  const normalized = String(value || "").trim();
  if (!normalized) return;
  try {
    const snap = await db.collection("conversations").where(field, "==", normalized).limit(25).get();
    for (const doc of snap.docs || []) {
      const data = (doc.data() as any) || {};
      if (tenantConversationMatchesContext(data, context)) {
        candidates.set(doc.id, data);
      }
    }
  } catch {
    // Keep the communications summary best-effort; a failed optional lookup must not break the tenant shell.
  }
}

async function getTenantConversationIds(
  tenantId: string,
  context: Awaited<ReturnType<typeof resolveTenancyContext>> | null = null
): Promise<string[]> {
  const candidates = new Map<string, any>();
  await addTenantConversationCandidates(candidates, "tenantId", tenantId, context);

  if (context?.ok) {
    await addTenantConversationCandidates(candidates, "unitId", context.unitId, context);
    await addTenantConversationCandidates(candidates, "leaseId", context.leaseId, context);
    await addTenantConversationCandidates(candidates, "applicationId", context.applicationId, context);
  }

  return Array.from(candidates.keys());
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

async function buildTenantMessageItems(
  tenantId: string,
  context: Awaited<ReturnType<typeof resolveTenancyContext>> | null = null
): Promise<TenantCommunicationItem[]> {
  const [conversationIds, readMap] = await Promise.all([
    getTenantConversationIds(tenantId, context),
    getMessageReadMap(tenantId),
  ]);

  if (!conversationIds.length) return [];

  const messageBatches = await Promise.all(
    conversationIds.map((conversationId) =>
      db
        .collection("messages")
        .where("conversationId", "==", conversationId)
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

async function loadApplicationDocument(docId: string | null) {
  const id = String(docId || "").trim();
  if (!id) return null;
  return (await loadDocument("applications", id)) || (await loadDocument("rentalApplications", id));
}

async function queryFirstApplicationDocument(field: string, value: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  for (const collectionName of ["applications", "rentalApplications"]) {
    try {
      const snap = await db.collection(collectionName).where(field, "==", normalized).limit(5).get();
      const doc = snap.docs?.[0];
      if (doc) return { id: doc.id, data: doc.data() as any };
    } catch {
      // keep looking in the next application collection
    }
  }
  return null;
}

function leaseSelectionRank(record: { id: string; data: any }): number {
  const status = String(record.data?.status || "").trim().toLowerCase();
  const archived = Boolean(record.data?.archivedAt || record.data?.deletedAt) || ["archived", "past", "ended", "inactive", "void"].includes(status);
  if (archived) return -100;
  if (["active", "current", "signed", "fully_executed"].includes(status)) return 100;
  if (["sent", "awaiting_tenant_signature", "pending_tenant_signature", "ready_for_signature", "lease_sent"].includes(status)) return 80;
  if (["draft", "pending", "lease_pending"].includes(status)) return 50;
  return 20;
}

async function findBestTenantLease(params: {
  current: { id: string; data: any } | null;
  tenantId: string | null;
  propertyId: string | null;
  tenantEmail?: string | null;
}) {
  const tenantId = String(params.tenantId || "").trim();
  const propertyId = String(params.propertyId || "").trim();
  const tenantEmail = String(params.tenantEmail || "").trim().toLowerCase();
  const candidates = new Map<string, { id: string; data: any }>();
  if (params.current?.id) candidates.set(params.current.id, params.current);
  if (tenantId) {
    for (const query of [
      () => db.collection("leases").where("tenantId", "==", tenantId).limit(20).get(),
      () => db.collection("leases").where("tenantIds", "array-contains", tenantId).limit(20).get(),
    ]) {
      try {
        const snap = await query();
        snap.docs.forEach((doc) => candidates.set(doc.id, { id: doc.id, data: doc.data() as any }));
      } catch {
        // Keep the explicitly linked lease if one of the compatibility queries is unavailable.
      }
    }
  }
  if (tenantEmail) {
    for (const query of [
      () => db.collection("leases").where("tenantEmail", "==", tenantEmail).limit(20).get(),
      () => db.collection("leases").where("email", "==", tenantEmail).limit(20).get(),
    ]) {
      try {
        const snap = await query();
        snap.docs.forEach((doc) => candidates.set(doc.id, { id: doc.id, data: doc.data() as any }));
      } catch {
        // Email-linked leases are a compatibility path only.
      }
    }
  }

  const ranked = Array.from(candidates.values())
    .filter((candidate) => !propertyId || String(candidate.data?.propertyId || "").trim() === propertyId)
    .filter((candidate) => leaseMatchesTenantIdentity(candidate.data, tenantId, tenantEmail))
    .sort((left, right) => {
      const rankDelta = leaseSelectionRank(right) - leaseSelectionRank(left);
      if (rankDelta !== 0) return rankDelta;
      return timestampToSort(right.data?.updatedAt || right.data?.createdAt) - timestampToSort(left.data?.updatedAt || left.data?.createdAt);
    });

  return ranked[0] || params.current;
}

async function loadTenantWorkspaceData(context: Awaited<ReturnType<typeof resolveTenancyContext>>) {
  const propertyDoc = await loadDocument("properties", context.propertyId);

  let applicationDoc = await loadApplicationDocument(context.applicationId);
  if (!applicationDoc && context.tenantId) {
    applicationDoc =
      (await queryFirstApplicationDocument("tenantId", context.tenantId)) ||
      (await queryFirstApplicationDocument("convertedTenantId", context.tenantId)) ||
      (await queryFirstApplicationDocument("applicantTenantId", context.tenantId));
  }
  if (!applicationDoc && context.invitedEmail) {
    for (const field of ["applicantEmail", "email", "applicant.email"]) {
      const match = await queryFirstApplicationDocument(field, context.invitedEmail);
      if (match && String(match.data?.propertyId || "") === String(context.propertyId || "")) {
        applicationDoc = match;
        break;
      }
    }
  }

  let leaseDoc = await loadDocument("leases", context.leaseId);
  leaseDoc = await findBestTenantLease({
    current: leaseDoc,
    tenantId: context.tenantId,
    tenantEmail: context.invitedEmail,
    propertyId: context.propertyId,
  });

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

  const leaseDocumentContext = leaseDoc
    ? await getTenantLeaseDocumentContext({
        leaseId: leaseDoc.id,
        tenantId: context.tenantId,
        tenantEmail: context.invitedEmail,
        propertyId: String(leaseDoc.data?.propertyId || context.propertyId || "").trim() || null,
        unitId: String(leaseDoc.data?.unitId || context.unitId || "").trim() || null,
        leaseData: leaseDoc.data,
      })
    : null;
  const scheduleADocumentContext = leaseDoc
    ? await getTenantLeaseDocumentContext({
        leaseId: leaseDoc.id,
        tenantId: context.tenantId,
        tenantEmail: context.invitedEmail,
        propertyId: String(leaseDoc.data?.propertyId || context.propertyId || "").trim() || null,
        unitId: String(leaseDoc.data?.unitId || context.unitId || "").trim() || null,
        leaseData: leaseDoc.data,
        documentKind: "schedule-a",
      })
    : null;
  const leaseProjectionData =
    leaseDoc && leaseDocumentContext?.documentUrl
      ? {
          ...leaseDoc.data,
          documentUrl: leaseDocumentContext.documentUrl,
          approvedDocumentUrl: leaseDocumentContext.documentUrl,
        }
      : leaseDoc?.data;
  const lease = leaseDoc ? projectTenantLease(leaseDoc.id, leaseProjectionData) : null;
  const rentPaymentSummary = lease
    ? (
        await buildLeasePaymentProjection({
          rawLease: leaseDoc?.data || {},
          lease: {
            id: lease.leaseId,
            landlordId: asString(leaseDoc?.data?.landlordId),
            tenantId: asString(leaseDoc?.data?.tenantId),
            tenantIds: Array.isArray(leaseDoc?.data?.tenantIds) ? leaseDoc?.data?.tenantIds : [],
            primaryTenantId: asString(leaseDoc?.data?.primaryTenantId),
            propertyId: asString(leaseDoc?.data?.propertyId),
            unitId: asString(leaseDoc?.data?.unitId),
            unitNumber: asString(leaseDoc?.data?.unitNumber),
            monthlyRent: lease.monthlyRent,
            startDate: lease.startDate,
            endDate: lease.endDate,
            status: lease.status,
          },
          leaseId: lease.leaseId,
          documentUrl: lease.documentUrl,
        })
      ).rentPaymentSummary
    : null;
  const tenantSafeRentPaymentSummary = rentPaymentSummary ? projectTenantRentPaymentSummary(rentPaymentSummary) : null;

  return {
    property: propertyDoc ? projectTenantProperty(propertyDoc.id, propertyDoc.data) : null,
    application: applicationDoc ? projectTenantApplication(applicationDoc.id, applicationDoc.data) : null,
    lease: lease ? { ...lease, leaseDocumentContext, scheduleADocumentContext, rentPaymentSummary: tenantSafeRentPaymentSummary } : null,
    maintenance: maintenanceItems
      .map((item) => projectTenantMaintenance(item.id, item.data))
      .sort((left, right) => Number(right.updatedAt || 0) - Number(left.updatedAt || 0)),
  };
}

async function resolveTenantMaintenanceDocumentIdForRequest(tenantId: string | null, requestId: string | null) {
  const normalizedTenantId = String(tenantId || "").trim();
  const normalizedRequestId = String(requestId || "").trim();
  if (!normalizedTenantId || !normalizedRequestId) return null;
  if (!normalizedRequestId.startsWith("maintenance:")) return normalizedRequestId;

  const snap = await db.collection("maintenanceRequests").where("tenantId", "==", normalizedTenantId).limit(50).get();
  for (const doc of snap.docs || []) {
    if (tenantSafeMaintenanceReferenceKey(doc.id) === normalizedRequestId) return doc.id;
  }
  return null;
}

function buildTenantWorkspaceContextMetadata(
  context: Awaited<ReturnType<typeof resolveTenancyContext>>,
  workspace: Awaited<ReturnType<typeof loadTenantWorkspaceData>>
) {
  const sourceRefs: TenantSafeProjectionSourceReference[] = deriveTenantSafeSourceRefs({
    leaseId: context.leaseId,
    propertyId: context.propertyId,
    unitId: context.unitId,
    tenantId: context.tenantId,
  });
  if (context.applicationId) {
    sourceRefs.push({ sourceCollection: "applications", sourceId: context.applicationId });
  }
  for (const item of workspace.maintenance || []) {
    if (item?.requestId) {
      sourceRefs.push({ sourceCollection: "maintenanceRequests", sourceId: item.requestId });
    }
  }
  const byKey = new Map<string, TenantSafeProjectionSourceReference>();
  for (const ref of sourceRefs) byKey.set(`${ref.sourceCollection}:${ref.sourceId}`, ref);
  const normalizedRefs = Array.from(byKey.values()).sort((a, b) =>
    `${a.sourceCollection}:${a.sourceId}`.localeCompare(`${b.sourceCollection}:${b.sourceId}`)
  );
  const sourceCollections = Array.from(new Set(normalizedRefs.map((item) => item.sourceCollection))).sort((a, b) =>
    a.localeCompare(b)
  );
  const metadata = deriveTenantSafeProjectionMetadata({
    projectionName: "tenant_safe_workspace_context_projection",
    scopeType: "tenant_workspace_context",
    sourceCollections,
    relationshipBasis: "Workspace context projection must be derived from authenticated tenant authority resolution.",
  });
  return { ...metadata, sourceCollections, sourceRefs: normalizedRefs };
}

function normalizeTenantSourceRefs(sourceRefs: TenantSafeProjectionSourceReference[]) {
  const byKey = new Map<string, TenantSafeProjectionSourceReference>();
  for (const ref of sourceRefs) {
    if (ref.sourceCollection && ref.sourceId) byKey.set(`${ref.sourceCollection}:${ref.sourceId}`, ref);
  }
  return Array.from(byKey.values()).sort((a, b) =>
    `${a.sourceCollection}:${a.sourceId}`.localeCompare(`${b.sourceCollection}:${b.sourceId}`)
  );
}

function tenantSourceCollections(sourceRefs: TenantSafeProjectionSourceReference[]) {
  return Array.from(new Set(sourceRefs.map((item) => item.sourceCollection))).sort((a, b) => a.localeCompare(b));
}

function buildTenantDocumentAccessMetadata(params: {
  leaseId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
}) {
  const sourceRefs = normalizeTenantSourceRefs(deriveTenantSafeSourceRefs(params));
  const sourceCollections = tenantSourceCollections(sourceRefs);
  const metadata = deriveTenantSafeProjectionMetadata({
    projectionName: "tenant_safe_document_access_projection",
    scopeType: "tenant_document_access",
    sourceCollections,
    relationshipBasis: "Document access projection must be derived from authenticated tenant lease ownership.",
  });
  return { ...metadata, sourceCollections, sourceRefs };
}

function buildTenantLeaseProjectionMetadata(params: {
  leaseId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
}) {
  const sourceRefs = normalizeTenantSourceRefs(deriveTenantSafeSourceRefs(params));
  const sourceCollections = tenantSourceCollections(sourceRefs);
  const metadata = deriveTenantSafeProjectionMetadata({
    projectionName: "tenant_safe_workspace_projection",
    scopeType: "tenant_current_lease",
    sourceCollections,
    relationshipBasis: "Projection must be derived from the authenticated tenant's current lease relationship.",
  });
  return { ...metadata, sourceCollections, sourceRefs };
}

function buildTenantAttachmentProjectionMetadata(params: {
  leaseId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  tenantId?: string | null;
  attachmentIds?: string[];
}) {
  const sourceRefs = deriveTenantSafeSourceRefs(params);
  for (const attachmentId of params.attachmentIds || []) {
    if (attachmentId) sourceRefs.push({ sourceCollection: "ledgerAttachments", sourceId: attachmentId });
  }
  const normalizedRefs = normalizeTenantSourceRefs(sourceRefs);
  const sourceCollections = tenantSourceCollections(normalizedRefs);
  const metadata = deriveTenantSafeProjectionMetadata({
    projectionName: "tenant_safe_attachment_projection",
    scopeType: "tenant_attachment",
    sourceCollections,
    relationshipBasis: "Attachment projection must be derived from authenticated tenant workspace and tenant-safe document visibility.",
  });
  return { ...metadata, sourceCollections, sourceRefs: normalizedRefs };
}

async function buildTenantWorkspaceDisplayProjection(
  context: Awaited<ReturnType<typeof resolveTenancyContext>>,
  workspace: Awaited<ReturnType<typeof loadTenantWorkspaceData>>,
  req: any
) {
  const tenantId = asString(context.tenantId) || asString(req.user?.tenantId);
  const propertyId = asString(context.propertyId);
  const unitId = asString(context.unitId) || asString(req.user?.unitId);

  const [tenantDoc, propertyDoc, unitDoc] = await Promise.all([
    loadDocument("tenants", tenantId),
    loadDocument("properties", propertyId),
    loadDocument("units", unitId),
  ]);

  const tenantData = tenantDoc?.data || {};
  const propertyData = propertyDoc?.data || {};
  let unitData = unitDoc?.data || {};
  const tenantUnitId = asString(tenantData?.unitId) || asString(tenantData?.unit);
  if (
    tenantUnitId &&
    tenantUnitId !== unitId &&
    !firstDisplayString([unitData?.unitNumber, unitData?.label, unitData?.name], [unitId])
  ) {
    const tenantUnitDoc = await loadDocument("units", tenantUnitId);
    if (tenantUnitDoc?.data) {
      unitData = tenantUnitDoc.data;
    }
  }
  const tenantRawIds = [tenantId];
  const propertyRawIds = [propertyId, asString(context.rc_prop_id)];
  const unitRawIds = [unitId, tenantUnitId];

  const propertyName = firstDisplayString(
    [
      tenantData?.propertyName,
      tenantData?.propertyLabel,
      tenantData?.property,
      propertyData?.name,
      propertyData?.addressLine1,
      propertyData?.street1,
      propertyData?.address,
      workspace.property?.street1,
    ],
    propertyRawIds
  );

  const unitLabel = firstDisplayString(
    [
      tenantData?.unitLabel,
      tenantData?.unitNumber,
      tenantData?.unit,
      unitData?.unitNumber,
      unitData?.label,
      unitData?.name,
    ],
    unitRawIds
  );

  const landlordId =
    asString(tenantData?.landlordId) ||
    asString(propertyData?.landlordId) ||
    asString(propertyData?.ownerId) ||
    asString(propertyData?.owner) ||
    asString(unitData?.landlordId) ||
    asString(req.user?.landlordId);
  const landlordDoc = await loadDocument("landlords", landlordId);
  const landlordData = landlordDoc?.data || {};
  const landlordName = firstDisplayString(
    [landlordData?.name, landlordData?.fullName, landlordData?.company, landlordData?.email],
    [landlordId]
  );
  const tenantName = firstDisplayString(
    [tenantData?.fullName, tenantData?.displayName, tenantData?.name],
    tenantRawIds
  );

  return {
    tenant: {
      id: tenantId,
      shortId: tenantId ? tenantId.slice(0, 8) : "",
      name: tenantName,
      email: asString(tenantData?.email) || asString(req.user?.email),
      joinedAt: toMillis(tenantData?.redeemedAt ?? tenantData?.createdAt ?? null),
      status: "Active",
    },
    landlord: { name: landlordName },
    property: {
      ...(workspace.property || {
        propertyId: propertyId || "",
        rc_prop_id: asString(context.rc_prop_id),
        street1: null,
        street2: null,
        city: null,
        province: null,
        postalCode: null,
        features: [],
      }),
      name: propertyName ?? (propertyId ? "Selected property" : null),
    },
    unit: { label: unitLabel ?? (unitId ? "Assigned unit" : null) },
  };
}

async function buildInstitutionalSchemaV2ExportForTenant(
  req: any,
  context: Awaited<ReturnType<typeof resolveTenancyContext>>
) {
  const [workspace, tenantIdentityRecord, identityTimeline] = await Promise.all([
    loadTenantWorkspaceData(context),
    loadTenantIdentityRecord({
      context,
      userId: String(req.user?.id || "").trim(),
      userEmail: req.user?.email,
    }),
    deriveIdentityTimeline({
      tenantId: String(req.user?.tenantId || context.tenantId || "").trim(),
      applicationId: context.applicationId,
      leaseId: context.leaseId,
    }),
  ]);
  const { tenantCredibilitySignals } = deriveTenantCredibilitySignals({
    tenantIdentityRecord,
    leaseExecution: workspace.lease?.leaseExecution || null,
  });
  const { portableIdentity } = deriveIdentityPortability({
    tenantIdentityRecord,
    credibilitySummary: tenantCredibilitySignals.summary,
    shareAvailability: {
      sharingEnabled: Boolean(context.tenantId || req.user?.tenantId || req.user?.id),
    },
    timelineAvailability: {
      hasIdentityTimeline: Array.isArray(identityTimeline?.events) && identityTimeline.events.length > 0,
    },
  });

  const institutionalIdentityPackage = deriveInstitutionalIdentityPackage({
    tenantIdentityRecord,
    credibilitySummary: tenantCredibilitySignals.summary,
    leaseExecution: workspace.lease?.leaseExecution || null,
    paymentReadiness: workspace.lease?.paymentReadiness || null,
    identityTimeline,
    portableIdentity,
    leaseStatus: workspace.lease?.status || null,
  });

  const schemaV2 = deriveInstitutionalSchemaV2({
    packageV1: institutionalIdentityPackage,
    latestPaymentStatus: workspace.lease?.rentPaymentSummary?.latestPayment?.status || null,
  });
  const consentControls = {
    sharingEnabled: Boolean(portableIdentity?.readiness?.sharingEnabled),
    verificationRequestsAvailable: false,
    approvedScopeCount: 0,
  };
  schemaV2.validation = validateInstitutionalSchema(schemaV2, {
    consentControlsLimited:
      consentControls.sharingEnabled &&
      !consentControls.verificationRequestsAvailable &&
      consentControls.approvedScopeCount === 0,
  });
  schemaV2.complianceReadiness = deriveComplianceReadiness({
    validation: schemaV2.validation,
    identityTimeline: {
      totalEvents: schemaV2.audit.totalIdentityEvents,
      recentActivityAvailable: schemaV2.audit.recentActivityAvailable,
    },
    consentControls,
    exportContext: {
      schemaVersion: "2.0",
      dataScope: schemaV2.schema.dataScope,
      consentRequired: schemaV2.schema.consentRequired,
    },
    auditTraceabilityContext: {
      handoffDraftMetadataAvailable: true,
      manualReleasePreparationAvailable: true,
      observabilityCoverage: "draft_creation_only",
      canonicalInstitutionEventsAvailable: false,
    },
  });

  return schemaV2;
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

const TENANT_PROFILE_PATCH_ALLOWED_FIELDS = new Set(["displayName", "phone"]);

function getTenantProfilePatchFieldNames(body: any) {
  return Object.keys(body && typeof body === "object" && !Array.isArray(body) ? body : {});
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
  const tenantSafeProfile = sanitizeTenantProfileProjection(profile);
  return {
    ...tenantSafeProfile,
    actions: buildTenantProfileActions(tenantSafeProfile),
  };
}

async function withTenantLeaseDocumentContext(profile: Awaited<ReturnType<typeof loadTenantProfileProjection>>) {
  const lease = profile?.profile?.lease;
  const leaseId = String(lease?.leaseId || profile?.context?.leaseId || "").trim();
  const tenantId = String(profile?.context?.tenantId || "").trim();
  if (!leaseId || !tenantId) return profile;
  let leaseSnap: any = null;
  try {
    leaseSnap = await db.collection("leases").doc(leaseId).get();
  } catch (err: any) {
    console.warn("[tenant/profile] lease document context unavailable", {
      message: err?.message || "failed",
    });
    return profile;
  }
  if (!leaseSnap.exists) return profile;
  const leaseData = leaseSnap.data() as any;
  const leaseDocumentContext = await getTenantLeaseDocumentContext({
    leaseId,
    tenantId,
    tenantEmail: String(profile?.context?.invitedEmail || "").trim() || null,
    propertyId: String(profile?.context?.propertyId || leaseData?.propertyId || "").trim() || null,
    unitId: String(profile?.context?.unitId || leaseData?.unitId || "").trim() || null,
    leaseData,
  });
  const scheduleADocumentContext = await getTenantLeaseDocumentContext({
    leaseId,
    tenantId,
    tenantEmail: String(profile?.context?.invitedEmail || "").trim() || null,
    propertyId: String(profile?.context?.propertyId || leaseData?.propertyId || "").trim() || null,
    unitId: String(profile?.context?.unitId || leaseData?.unitId || "").trim() || null,
    leaseData,
    documentKind: "schedule-a",
  });
  const nextLease = leaseDocumentContext.documentUrl
    ? projectTenantLease(leaseId, {
        ...leaseData,
        documentUrl: leaseDocumentContext.documentUrl,
        approvedDocumentUrl: leaseDocumentContext.documentUrl,
      })
    : lease;
  return {
    ...profile,
    profile: {
      ...profile.profile,
      lease: nextLease ? { ...nextLease, leaseDocumentContext, scheduleADocumentContext } : lease,
    },
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
  if (normalized.includes("schedule a") || normalized.includes("schedulea")) return "Attachments";
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

function tenantDocumentReferences(raw: {
  id?: unknown;
  tenantId?: unknown;
  leaseId?: unknown;
  draftId?: unknown;
  ledgerItemId?: unknown;
}) {
  const fallbackSeed =
    asString(raw.id) ||
    [raw.tenantId, raw.leaseId, raw.draftId, raw.ledgerItemId]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(":") ||
    "document";
  return {
    documentReference: tenantPublicReference("document", fallbackSeed) || "document-ref-unavailable",
    tenantReference: tenantPublicReference("tenant", raw.tenantId),
    leaseReference: tenantPublicReference("lease", raw.leaseId),
    draftReference: tenantPublicReference("draft", raw.draftId),
    ledgerReference: tenantPublicReference("ledger", raw.ledgerItemId),
  };
}

function isVisibleLeaseDocumentAttachment(raw: any): boolean {
  const category = String(raw?.category || "").trim().toLowerCase();
  const purpose = String(raw?.purpose || "").trim().toUpperCase();
  const purposeLabel = String(raw?.purposeLabel || "").trim().toLowerCase();
  const title = String(raw?.title || "").trim().toLowerCase();
  return category === "lease" || purpose === "LEASE" || purposeLabel === "lease" || title === "lease document";
}

function visibleLeaseDocumentDedupeKeys(raw: any): string[] {
  if (!isVisibleLeaseDocumentAttachment(raw)) return [];
  const tenantId = String(raw?.tenantId || "").trim();
  if (!tenantId) return [];

  const leaseId = String(raw?.leaseId || "").trim();
  return [
    `${tenantId}|lease:current|LEASE`,
    leaseId ? `${tenantId}|lease:${leaseId}|LEASE` : null,
  ].filter((value): value is string => Boolean(value));
}

function dedupeTenantVisibleLeaseAttachments(attachments: any[]): any[] {
  const output: any[] = [];
  const leaseKeySets: Set<string>[] = [];

  attachments.forEach((item) => {
    const keys = visibleLeaseDocumentDedupeKeys(item);
    if (!keys.length) {
      output.push(item);
      return;
    }

    const existingIndex = leaseKeySets.findIndex((knownKeys) => keys.some((key) => knownKeys.has(key)));
    if (existingIndex >= 0) {
      keys.forEach((key) => leaseKeySets[existingIndex].add(key));
      return;
    }

    output.push(item);
    leaseKeySets.push(new Set(keys));
  });

  return output;
}

type TenantLeaseDocumentContext = {
  leaseId?: string;
  tenantId?: string;
  propertyId?: string;
  unitId?: string;
  leaseStatus?: string;
  signingStatus?: string;
  documentStatus: "signed" | "generated" | "pending" | "missing";
  documentId?: string;
  documentUrl?: string;
  displayLabel: string;
  source: string;
  confidence: "high" | "medium" | "low";
  warnings: string[];
};

function isScheduleADocumentValue(value: unknown): boolean {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && (normalized.includes("schedule-a") || normalized.includes("schedule_a"));
}

function isScheduleADocumentRecord(record: any): boolean {
  if (!record || typeof record !== "object") return false;
  return [
    record.kind,
    record.fileName,
    record.name,
    record.title,
    record.path,
    record.objectKey,
    record.storagePath,
    record.url,
  ].some(isScheduleADocumentValue);
}

function firstLeaseDocumentUrl(raw: any, fields: string[], options?: { scheduleAOnly?: boolean; includeScheduleA?: boolean }): string | null {
  for (const field of fields) {
    const value = String(raw?.[field] || "").trim();
    if (!value.startsWith("https://") || isAppDomainLeasePdfUrl(value)) continue;
    const isScheduleA = isScheduleADocumentValue(value);
    if (options?.scheduleAOnly && !isScheduleA) continue;
    if (!options?.includeScheduleA && !options?.scheduleAOnly && isScheduleA) continue;
    return value;
  }
  return null;
}

function isAppDomainLeasePdfUrl(value: unknown): boolean {
  const raw = String(value || "").trim();
  if (!raw) return false;
  try {
    const url = new URL(raw, "https://app.rentchain.invalid");
    return /^\/leases\/.+\.pdf$/i.test(url.pathname);
  } catch {
    return /^\/leases\/.+\.pdf(?:$|\?)/i.test(raw);
  }
}

function leaseHasTenant(raw: any, tenantId: string): boolean {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) return false;
  if (String(raw?.tenantId || "").trim() === normalizedTenantId) return true;
  if (String(raw?.primaryTenantId || "").trim() === normalizedTenantId) return true;
  return Array.isArray(raw?.tenantIds) && raw.tenantIds.map((value: any) => String(value || "").trim()).includes(normalizedTenantId);
}

function leaseMatchesTenantIdentity(raw: any, tenantId?: string | null, tenantEmail?: string | null): boolean {
  const normalizedTenantId = String(tenantId || "").trim();
  if (normalizedTenantId && leaseHasTenant(raw, normalizedTenantId)) return true;
  const normalizedEmail = String(tenantEmail || "").trim().toLowerCase();
  if (!normalizedEmail) return false;
  const emails = [
    raw?.tenantEmail,
    raw?.email,
    raw?.primaryTenantEmail,
    raw?.tenant?.email,
    raw?.applicantEmail,
  ]
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);
  return emails.includes(normalizedEmail);
}

function isLeaseSigned(raw: any): boolean {
  const status = String(raw?.status || "").trim().toLowerCase();
  return Boolean(
    raw?.fullyExecutedAt ||
      raw?.fullySignedAt ||
      raw?.signatureCompletedAt ||
      (raw?.tenantSignature?.signedAt && raw?.landlordSignature?.signedAt) ||
      (raw?.tenantSignedAt && raw?.landlordSignedAt) ||
      ["signed", "executed", "fully_executed"].includes(status)
  );
}

function isLeaseDocumentWorkflowPending(raw: any): boolean {
  const status = String(raw?.status || "").trim().toLowerCase();
  const documentStatus = String(raw?.documentStatus || raw?.leaseDocumentStatus || raw?.pdfStatus || raw?.generationStatus || "")
    .trim()
    .toLowerCase();
  return Boolean(
    raw?.documentGeneratedAt ||
      raw?.documentPreparedAt ||
      raw?.leaseDocumentGeneratedAt ||
      raw?.leaseDocumentPreparedAt ||
      raw?.pdfGeneratedAt ||
      raw?.scheduleAGeneratedAt ||
      ["sent", "awaiting_tenant_signature", "pending_tenant_signature", "ready_for_signature", "signature_requested"].includes(status) ||
      ["pending", "preparing", "generating", "generated", "ready_for_review", "review_pending"].includes(documentStatus)
  );
}

function bestTenantLeaseAttachment(params: {
  attachments: any[];
  leaseId: string | null;
  propertyId: string | null;
  unitId: string | null;
}) {
  const leaseId = String(params.leaseId || "").trim();
  const propertyId = String(params.propertyId || "").trim();
  const unitId = String(params.unitId || "").trim();

  const candidates = (Array.isArray(params.attachments) ? params.attachments : [])
    .filter((item) => isVisibleLeaseDocumentAttachment(item) && String(item?.url || "").trim().startsWith("https://"))
    .map((item) => {
      const candidateLeaseId = String(item?.leaseId || "").trim();
      const candidateLedgerItemId = String(item?.ledgerItemId || "").trim();
      const candidatePropertyId = String(item?.propertyId || "").trim();
      const candidateUnitId = String(item?.unitId || "").trim();
      const exactLease = leaseId && (candidateLeaseId === leaseId || candidateLedgerItemId === leaseId) ? 4 : 0;
      const propertyMatch = propertyId && candidatePropertyId === propertyId ? 2 : 0;
      const unitMatch = unitId && candidateUnitId === unitId ? 1 : 0;
      return {
        item,
        score: exactLease + propertyMatch + unitMatch,
        createdAt: Number(item?.createdAt || 0) || 0,
      };
    })
    .filter((entry) => entry.score > 0 || !leaseId);

  candidates.sort((left, right) => right.score - left.score || right.createdAt - left.createdAt);
  return candidates[0]?.item || null;
}

type TenantLeaseDocumentStorageRef = {
  bucket: string;
  path: string;
  source: string;
};

function isTenantScheduleAStorageRef(ref: TenantLeaseDocumentStorageRef | null): boolean {
  return Boolean(ref && (isScheduleADocumentValue(ref.path) || isScheduleADocumentValue(ref.source)));
}

function normalizeLeaseDocumentStoragePath(value: unknown): string {
  return String(value || "").trim().replace(/^\/+/, "");
}

function tenantLeaseStorageRefFromRecord(record: any, source: string): TenantLeaseDocumentStorageRef | null {
  if (!record || typeof record !== "object") return null;
  const bucket = String(record?.bucket || record?.storageBucket || "").trim();
  const path = normalizeLeaseDocumentStoragePath(record?.path || record?.objectKey || record?.storagePath);
  if (!bucket || !path) return null;
  return { bucket, path, source };
}

function parseTenantLeaseGcsSignedUrlStorageRef(value: unknown, source: string): TenantLeaseDocumentStorageRef | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "storage.googleapis.com" || url.hostname === "storage.cloud.google.com") {
      const segments = url.pathname.split("/").filter(Boolean);
      const bucket = segments.shift() || "";
      const path = normalizeLeaseDocumentStoragePath(segments.join("/"));
      return bucket && path ? { bucket, path, source } : null;
    }
    if (url.hostname.endsWith(".storage.googleapis.com")) {
      const bucket = url.hostname.slice(0, -".storage.googleapis.com".length);
      const path = normalizeLeaseDocumentStoragePath(decodeURIComponent(url.pathname).replace(/^\/+/, ""));
      return bucket && path ? { bucket, path, source } : null;
    }
  } catch {
    return null;
  }
  return null;
}

function tenantLeaseStorageRefFromSignedUrlFields(record: any, source: string): TenantLeaseDocumentStorageRef | null {
  const fields = [
    "signedDocumentUrl",
    "signedLeaseDocumentUrl",
    "executedDocumentUrl",
    "finalDocumentUrl",
    "fullyExecutedDocumentUrl",
    "documentUrl",
    "approvedDocumentUrl",
    "documentRef",
    "url",
  ];
  for (const field of fields) {
    const ref = parseTenantLeaseGcsSignedUrlStorageRef(record?.[field], `${source}.${field}`);
    if (ref) return ref;
  }
  return null;
}

function tenantLeaseDocumentStorageRef(params: {
  leaseData?: any;
  attachment?: any;
}): TenantLeaseDocumentStorageRef | null {
  const refs = [
    tenantLeaseStorageRefFromRecord(params.leaseData?.leaseDocument, "leaseDocument"),
    tenantLeaseStorageRefFromRecord(params.leaseData?.referenceDocument, "referenceDocument"),
    tenantLeaseStorageRefFromRecord(params.leaseData?.documentStorage, "documentStorage"),
    tenantLeaseStorageRefFromRecord(params.leaseData?.signedDocument, "signedDocument"),
    tenantLeaseStorageRefFromRecord(params.attachment, "ledgerAttachments"),
    tenantLeaseStorageRefFromSignedUrlFields(params.leaseData, "lease"),
    tenantLeaseStorageRefFromSignedUrlFields(params.attachment, "ledgerAttachments"),
  ];
  return refs.find((ref) => ref && !isTenantScheduleAStorageRef(ref)) || null;
}

function tenantScheduleAStorageRef(params: {
  leaseData?: any;
  attachment?: any;
}): TenantLeaseDocumentStorageRef | null {
  const refs = [
    tenantLeaseStorageRefFromRecord(params.leaseData?.scheduleADocument, "scheduleADocument"),
    tenantLeaseStorageRefFromRecord(params.leaseData?.scheduleA, "scheduleA"),
    tenantLeaseStorageRefFromRecord(params.leaseData?.leaseDocument, "leaseDocument"),
    tenantLeaseStorageRefFromRecord(params.leaseData?.referenceDocument, "referenceDocument"),
    tenantLeaseStorageRefFromRecord(params.leaseData?.documentStorage, "documentStorage"),
    tenantLeaseStorageRefFromRecord(params.leaseData?.signedDocument, "signedDocument"),
    tenantLeaseStorageRefFromRecord(params.attachment, "ledgerAttachments"),
    tenantLeaseStorageRefFromSignedUrlFields(params.leaseData, "lease"),
    tenantLeaseStorageRefFromSignedUrlFields(params.attachment, "ledgerAttachments"),
  ];
  return refs.find((ref) => ref && isTenantScheduleAStorageRef(ref)) || null;
}

function tenantStorageRefFromGeneratedFile(
  file: any,
  source: string,
  options?: { scheduleAOnly?: boolean; includeScheduleA?: boolean }
): TenantLeaseDocumentStorageRef | null {
  const kind = String(file?.kind || "").trim().toLowerCase();
  const url = String(file?.url || "").trim();
  const isScheduleA = isScheduleADocumentRecord(file);
  if (options?.scheduleAOnly && !isScheduleA) return null;
  if (!options?.includeScheduleA && !options?.scheduleAOnly && isScheduleA) return null;
  const looksLikePdf = !kind || kind.includes("pdf") || kind.includes("lease") || kind.includes("document") || kind.includes("schedule");
  if (!looksLikePdf && !url) return null;
  return tenantLeaseStorageRefFromRecord(file, source) || tenantLeaseStorageRefFromSignedUrlFields(file, source);
}

async function loadTenantGeneratedDocumentStorageRef(
  leaseData: any,
  options?: { scheduleAOnly?: boolean; includeScheduleA?: boolean }
): Promise<TenantLeaseDocumentStorageRef | null> {
  const snapshotIds = [
    leaseData?.latestLeaseSnapshotId,
    leaseData?.lastGeneratedSnapshotId,
    leaseData?.leaseSnapshotId,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  const draftId = String(leaseData?.sourceDraftId || leaseData?.draftId || "").trim();
  if (draftId) {
    try {
      const draftSnap = await db.collection("leaseDrafts").doc(draftId).get();
      if (draftSnap.exists) {
        const draft = draftSnap.data() as any;
        [draft?.lastGeneratedSnapshotId, draft?.latestLeaseSnapshotId]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .forEach((snapshotId) => snapshotIds.push(snapshotId));
      }
    } catch {
      // Missing draft metadata should not expose or hide unrelated tenant documents.
    }
  }

  for (const snapshotId of Array.from(new Set(snapshotIds))) {
    try {
      const snapshotSnap = await db.collection("leaseSnapshots").doc(snapshotId).get();
      if (!snapshotSnap.exists) continue;
      const snapshot = snapshotSnap.data() as any;
      const generatedFiles = Array.isArray(snapshot?.generatedFiles) ? snapshot.generatedFiles : [];
      for (const file of generatedFiles) {
        const ref = tenantStorageRefFromGeneratedFile(file, `leaseSnapshots/${snapshotId}`, options);
        if (ref) return ref;
      }
    } catch {
      // Continue through remaining snapshot candidates.
    }
  }

  return null;
}

async function refreshTenantLeaseSignedUrl(storageRef: TenantLeaseDocumentStorageRef | null): Promise<string | null> {
  if (!storageRef) return null;
  try {
    return await getSignedDownloadUrl({ bucket: storageRef.bucket, path: storageRef.path, expiresMinutes: 30 });
  } catch {
    return null;
  }
}

async function loadTenantLeaseAttachments(tenantId: string): Promise<any[]> {
  const normalizedTenantId = String(tenantId || "").trim();
  if (!normalizedTenantId) return [];
  const snap = await db.collection("ledgerAttachments").where("tenantId", "==", normalizedTenantId).limit(50).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
}

async function getTenantLeaseDocumentContext(params: {
  leaseId: string | null;
  tenantId: string | null;
  tenantEmail?: string | null;
  propertyId: string | null;
  unitId: string | null;
  leaseData: any;
  attachments?: any[];
  documentKind?: "lease" | "schedule-a";
}): Promise<TenantLeaseDocumentContext> {
  const leaseId = String(params.leaseId || "").trim();
  const tenantId = String(params.tenantId || "").trim();
  const tenantEmail = String(params.tenantEmail || "").trim().toLowerCase();
  const propertyId = String(params.propertyId || params.leaseData?.propertyId || "").trim();
  const unitId = String(params.unitId || params.leaseData?.unitId || params.leaseData?.unit || "").trim();
  const leaseStatus = String(params.leaseData?.status || "").trim() || undefined;
  const warnings: string[] = [];

  if (!leaseId || !params.leaseData) {
    return {
      tenantId: tenantId || undefined,
      propertyId: propertyId || undefined,
      unitId: unitId || undefined,
      leaseStatus,
      documentStatus: "missing",
      displayLabel: "No lease document available yet",
      source: "missing_lease",
      confidence: "low",
      warnings: ["No current lease record is available for this tenant workspace."],
    };
  }

  if ((tenantId || tenantEmail) && !leaseMatchesTenantIdentity(params.leaseData, tenantId, tenantEmail)) {
    return {
      leaseId,
      tenantId: tenantId || undefined,
      propertyId: propertyId || undefined,
      unitId: unitId || undefined,
      leaseStatus,
      documentStatus: "missing",
      displayLabel: "No lease document available yet",
      source: "tenant_mismatch",
      confidence: "low",
      warnings: ["The visible lease record is not linked to this tenant workspace."],
    };
  }

  const signed = isLeaseSigned(params.leaseData);

  if (params.documentKind === "schedule-a") {
    const directScheduleRef = tenantScheduleAStorageRef({ leaseData: params.leaseData });
    const generatedScheduleRef = directScheduleRef
      ? null
      : await loadTenantGeneratedDocumentStorageRef(params.leaseData, { scheduleAOnly: true });
    const storageRef = directScheduleRef || generatedScheduleRef;
    const refreshedUrl = await refreshTenantLeaseSignedUrl(storageRef);
    const scheduleUrl =
      firstLeaseDocumentUrl(params.leaseData, ["scheduleAUrl", "scheduleADocumentUrl"], { includeScheduleA: true }) ||
      firstLeaseDocumentUrl(params.leaseData?.scheduleADocument, ["url"], { includeScheduleA: true }) ||
      firstLeaseDocumentUrl(params.leaseData?.scheduleA, ["url"], { includeScheduleA: true }) ||
      firstLeaseDocumentUrl(params.leaseData, ["documentUrl", "approvedDocumentUrl", "documentRef"], { scheduleAOnly: true });
    if (refreshedUrl || (!storageRef && scheduleUrl)) {
      return {
        leaseId,
        tenantId: tenantId || undefined,
        propertyId: propertyId || undefined,
        unitId: unitId || undefined,
        leaseStatus,
        signingStatus: signed ? "signed" : "unsigned",
        documentStatus: "generated",
        documentId: String(params.leaseData?.scheduleADocumentId || params.leaseData?.latestLeaseSnapshotId || "").trim() || undefined,
        documentUrl: refreshedUrl || scheduleUrl || undefined,
        displayLabel: "Schedule A",
        source: refreshedUrl ? storageRef?.source || "schedule_a_document" : "schedule_a_document",
        confidence: "medium",
        warnings,
      };
    }
    return {
      leaseId,
      tenantId: tenantId || undefined,
      propertyId: propertyId || undefined,
      unitId: unitId || undefined,
      leaseStatus,
      documentStatus: "missing",
      displayLabel: "No Schedule A available yet",
      source: "schedule_a_missing",
      confidence: "low",
      warnings: ["No tenant-safe Schedule A link is available yet."],
    };
  }

  const directStorageRef =
    tenantLeaseDocumentStorageRef({ leaseData: params.leaseData }) ||
    (await loadTenantGeneratedDocumentStorageRef(params.leaseData));
  const refreshedDirectUrl = await refreshTenantLeaseSignedUrl(directStorageRef);
  const signedUrl = firstLeaseDocumentUrl(params.leaseData, [
    "signedDocumentUrl",
    "signedLeaseDocumentUrl",
    "executedDocumentUrl",
    "finalDocumentUrl",
    "fullyExecutedDocumentUrl",
    "documentUrl",
    "approvedDocumentUrl",
    "documentRef",
  ]);
  if (signed && (refreshedDirectUrl || (!directStorageRef && signedUrl))) {
    return {
      leaseId,
      tenantId: tenantId || undefined,
      propertyId: propertyId || undefined,
      unitId: unitId || undefined,
      leaseStatus,
      signingStatus: "signed",
      documentStatus: "signed",
      documentId: String(params.leaseData?.signedDocumentId || params.leaseData?.documentId || params.leaseData?.latestLeaseSnapshotId || "").trim() || undefined,
      documentUrl: refreshedDirectUrl || signedUrl || undefined,
      displayLabel: "Signed lease document",
      source: refreshedDirectUrl ? directStorageRef?.source || "lease_signed_document" : "lease_signed_document",
      confidence: "high",
      warnings,
    };
  }

  const generatedUrl = firstLeaseDocumentUrl(params.leaseData, ["documentUrl", "approvedDocumentUrl", "documentRef"]);
  if (refreshedDirectUrl || (!directStorageRef && generatedUrl)) {
    return {
      leaseId,
      tenantId: tenantId || undefined,
      propertyId: propertyId || undefined,
      unitId: unitId || undefined,
      leaseStatus,
      signingStatus: signed ? "signed" : "unsigned",
      documentStatus: signed ? "signed" : "generated",
      documentId: String(params.leaseData?.documentId || params.leaseData?.latestLeaseSnapshotId || "").trim() || undefined,
      documentUrl: refreshedDirectUrl || generatedUrl || undefined,
      displayLabel: signed ? "Signed lease document" : "Generated lease package",
      source: refreshedDirectUrl ? directStorageRef?.source || "lease_document_fields" : "lease_document_fields",
      confidence: "high",
      warnings,
    };
  }

  const attachments = params.attachments || (tenantId ? await loadTenantLeaseAttachments(tenantId) : []);
  const attachment = bestTenantLeaseAttachment({ attachments, leaseId, propertyId, unitId });
  if (attachment) {
    const attachmentStorageRef = tenantLeaseDocumentStorageRef({ attachment });
    const refreshedAttachmentUrl = await refreshTenantLeaseSignedUrl(attachmentStorageRef);
    const attachmentUrl = refreshedAttachmentUrl || (!attachmentStorageRef ? String(attachment.url || "").trim() : "");
    if (attachmentUrl) {
      return {
        leaseId,
        tenantId: tenantId || undefined,
        propertyId: propertyId || undefined,
        unitId: unitId || undefined,
        leaseStatus,
        signingStatus: signed ? "signed" : "unsigned",
        documentStatus: signed ? "signed" : "generated",
        documentId: String(attachment?.id || "").trim() || undefined,
        documentUrl: attachmentUrl,
        displayLabel: signed ? "Signed lease document" : "Generated lease package",
        source: refreshedAttachmentUrl ? attachmentStorageRef?.source || "ledgerAttachments" : "ledgerAttachments",
        confidence: "high",
        warnings,
      };
    }
  }

  if (isLeaseDocumentWorkflowPending(params.leaseData)) {
    return {
      leaseId,
      tenantId: tenantId || undefined,
      propertyId: propertyId || undefined,
      unitId: unitId || undefined,
      leaseStatus,
      signingStatus: signed ? "signed" : "unsigned",
      documentStatus: "pending",
      displayLabel: "Lease document pending",
      source: "lease_document_workflow",
      confidence: "medium",
      warnings: ["A lease workflow is visible, but no tenant-safe document link is available yet."],
    };
  }

  return {
    leaseId,
    tenantId: tenantId || undefined,
    propertyId: propertyId || undefined,
    unitId: unitId || undefined,
    leaseStatus,
    signingStatus: signed ? "signed" : "unsigned",
    documentStatus: "missing",
    displayLabel: "No lease document available yet",
    source: "missing_document",
    confidence: "medium",
    warnings: ["No tenant-safe lease document link is available yet."],
  };
}

function buildTenantDocumentWorkspace(params: {
  attachments: Array<any>;
  profile: Awaited<ReturnType<typeof loadTenantProfileProjection>>;
  leaseDocumentContext?: TenantLeaseDocumentContext | null;
  scheduleADocumentContext?: TenantLeaseDocumentContext | null;
}) {
  const checklist = Array.isArray(params.profile?.identity?.documentChecklist) ? params.profile.identity.documentChecklist : [];
  const leaseDocumentContext = params.leaseDocumentContext || null;
  const scheduleADocumentContext = params.scheduleADocumentContext || null;
  const contextAttachment =
    leaseDocumentContext?.documentUrl &&
    leaseDocumentContext.documentStatus !== "missing" &&
    leaseDocumentContext.source !== "ledgerAttachments"
      ? {
          id: leaseDocumentContext.documentId || `lease-document-context-${leaseDocumentContext.leaseId || "current"}`,
          tenantId: leaseDocumentContext.tenantId || null,
          leaseId: leaseDocumentContext.leaseId || null,
          propertyId: leaseDocumentContext.propertyId || null,
          unitId: leaseDocumentContext.unitId || null,
          ledgerItemId: leaseDocumentContext.leaseId || null,
          title: leaseDocumentContext.displayLabel,
          fileName: leaseDocumentContext.documentStatus === "signed" ? "signed-lease.pdf" : "lease-package.pdf",
          category: "Lease",
          purpose: "LEASE",
          purposeLabel: "Lease",
          url: leaseDocumentContext.documentUrl,
          createdAt: 0,
          source: leaseDocumentContext.source,
        }
      : null;
  const scheduleAContextAttachment =
    scheduleADocumentContext?.documentUrl &&
    scheduleADocumentContext.documentStatus !== "missing"
      ? {
          id: scheduleADocumentContext.documentId || `schedule-a-context-${scheduleADocumentContext.leaseId || "current"}`,
          tenantId: scheduleADocumentContext.tenantId || null,
          leaseId: scheduleADocumentContext.leaseId || null,
          propertyId: scheduleADocumentContext.propertyId || null,
          unitId: scheduleADocumentContext.unitId || null,
          ledgerItemId: scheduleADocumentContext.leaseId || null,
          title: "Schedule A",
          fileName: "schedule-a.pdf",
          category: "Attachments",
          purpose: "SCHEDULE_A",
          purposeLabel: "Schedule A",
          url: scheduleADocumentContext.documentUrl,
          createdAt: 0,
          source: scheduleADocumentContext.source,
        }
      : null;
  const attachments = dedupeTenantVisibleLeaseAttachments([
    ...(contextAttachment ? [contextAttachment] : []),
    ...(scheduleAContextAttachment ? [scheduleAContextAttachment] : []),
    ...(Array.isArray(params.attachments) ? params.attachments : []),
  ]);

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
    const references = tenantDocumentReferences({
      id: matchedAttachment?.id || entry?.code || `document_${index + 1}`,
      tenantId: matchedAttachment?.tenantId,
      leaseId: matchedAttachment?.leaseId,
      draftId: matchedAttachment?.draftId,
      ledgerItemId: matchedAttachment?.ledgerItemId,
    });

    const status = toTenantDocumentStatus({
      checklistStatus: String(entry?.status || ""),
      hasAttachment: Boolean(matchedAttachment),
      nextAction: String(entry?.nextStep || ""),
    });

    return {
      id: references.documentReference,
      documentReference: references.documentReference,
      label,
      category: documentCategoryForLabel(String(entry?.code || label)),
      status,
      fileName: matchedAttachment?.fileName ? String(matchedAttachment.fileName) : null,
      title: matchedAttachment?.title ? String(matchedAttachment.title) : null,
      purpose: matchedAttachment?.purpose ? String(matchedAttachment.purpose) : null,
      purposeLabel: matchedAttachment?.purposeLabel ? String(matchedAttachment.purposeLabel) : null,
      tenantReference: references.tenantReference,
      leaseReference: references.leaseReference,
      draftReference: references.draftReference,
      ledgerReference: references.ledgerReference,
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
    const references = tenantDocumentReferences({
      id: item?.id || `uploaded_document_${index + 1}`,
      tenantId: item?.tenantId,
      leaseId: item?.leaseId,
      draftId: item?.draftId,
      ledgerItemId: item?.ledgerItemId,
    });
    items.push({
      id: references.documentReference,
      documentReference: references.documentReference,
      label,
      category: documentCategoryForLabel(label),
      status: "uploaded",
      fileName: item?.fileName ? String(item.fileName) : null,
      title: item?.title ? String(item.title) : null,
      purpose: item?.purpose ? String(item.purpose) : null,
      purposeLabel: item?.purposeLabel ? String(item.purposeLabel) : null,
      tenantReference: references.tenantReference,
      leaseReference: references.leaseReference,
      draftReference: references.draftReference,
      ledgerReference: references.ledgerReference,
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

  const [workspace, tenantIdentityRecord, identityTimeline] = await Promise.all([
    loadTenantWorkspaceData(context),
    loadTenantIdentityRecord({
      context,
      userId: String(req.user?.id || "").trim(),
      userEmail: req.user?.email,
    }),
    deriveIdentityTimeline({
      tenantId: String(req.user?.tenantId || context.tenantId || "").trim(),
      applicationId: context.applicationId,
      leaseId: context.leaseId,
    }),
  ]);
  const { tenantCredibilitySignals } = deriveTenantCredibilitySignals({
    tenantIdentityRecord,
    leaseExecution: workspace.lease?.leaseExecution || null,
  });
  const { portableIdentity } = deriveIdentityPortability({
    tenantIdentityRecord,
    credibilitySummary: tenantCredibilitySignals.summary,
    shareAvailability: {
      // Tenant-side capability signal only. This does not imply any active share link exists.
      sharingEnabled: Boolean(context.tenantId || req.user?.tenantId || req.user?.id),
    },
    timelineAvailability: {
      hasIdentityTimeline: Array.isArray(identityTimeline?.events) && identityTimeline.events.length > 0,
    },
  });
  const displayProjection = await buildTenantWorkspaceDisplayProjection(context, workspace, req);
  const workspaceProjectionMetadata = buildTenantWorkspaceContextMetadata(context, workspace);
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
      ...workspaceProjectionMetadata,
      context,
      tenant: displayProjection.tenant,
      landlord: displayProjection.landlord,
      property: displayProjection.property,
      unit: displayProjection.unit,
      application: workspace.application,
      lease: workspace.lease,
      maintenance: workspace.maintenance,
      tenantIdentityRecord,
      tenantCredibilitySignals,
      portableIdentity,
      identityTimeline,
    },
  });
}
router.get("/workspace", requireTenantWorkspaceIdentity, handleTenantWorkspaceSummary);
router.get("/me", requireTenantWorkspaceIdentity, handleTenantWorkspaceSummary);

router.post("/identity/export", requireTenantWorkspaceIdentity, async (req: any, res: any) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  const schemaVersion = String(req.body?.schemaVersion || "1.0").trim() || "1.0";
  if (!["1.0", "2.0"].includes(schemaVersion)) {
    return res.status(400).json({ ok: false, error: "UNSUPPORTED_SCHEMA_VERSION" });
  }

  if (schemaVersion === "2.0") {
    const schemaV2 = await buildInstitutionalSchemaV2ExportForTenant(req, context);
    return res.json({
      ok: true,
      data: schemaV2,
    });
  }

  const [workspace, tenantIdentityRecord, identityTimeline] = await Promise.all([
    loadTenantWorkspaceData(context),
    loadTenantIdentityRecord({
      context,
      userId: String(req.user?.id || "").trim(),
      userEmail: req.user?.email,
    }),
    deriveIdentityTimeline({
      tenantId: String(req.user?.tenantId || context.tenantId || "").trim(),
      applicationId: context.applicationId,
      leaseId: context.leaseId,
    }),
  ]);
  const { tenantCredibilitySignals } = deriveTenantCredibilitySignals({
    tenantIdentityRecord,
    leaseExecution: workspace.lease?.leaseExecution || null,
  });
  const { portableIdentity } = deriveIdentityPortability({
    tenantIdentityRecord,
    credibilitySummary: tenantCredibilitySignals.summary,
    shareAvailability: {
      sharingEnabled: Boolean(context.tenantId || req.user?.tenantId || req.user?.id),
    },
    timelineAvailability: {
      hasIdentityTimeline: Array.isArray(identityTimeline?.events) && identityTimeline.events.length > 0,
    },
  });

  const institutionalIdentityPackage = deriveInstitutionalIdentityPackage({
    tenantIdentityRecord,
    credibilitySummary: tenantCredibilitySignals.summary,
    leaseExecution: workspace.lease?.leaseExecution || null,
    paymentReadiness: workspace.lease?.paymentReadiness || null,
    identityTimeline,
    portableIdentity,
    leaseStatus: workspace.lease?.status || null,
  });

  return res.json({
    ok: true,
    data: institutionalIdentityPackage,
  });
});

router.get("/trust-exports", tenantPortalRouteSource, requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  try {
    const items = await listTenantTrustExports({ tenantId });
    return res.json({ ok: true, data: { items } });
  } catch (err: any) {
    console.error("[tenant/trust-exports:list] failed", {
      tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_TRUST_EXPORT_LIST_FAILED" });
  }
});

router.post("/trust-exports/preview", tenantPortalRouteSource, requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  try {
    const preview = await previewTenantTrustExport({
      tenantId,
      audience: req.body?.audience,
      purpose: req.body?.purpose,
      expiresInDays: req.body?.expiresInDays,
      consentAccepted: req.body?.consentAccepted === true,
    });
    if (!preview) {
      return res.status(404).json({ ok: false, error: "TENANT_TRUST_EXPORT_UNAVAILABLE" });
    }
    return res.json({ ok: true, data: preview });
  } catch (err: any) {
    console.error("[tenant/trust-exports:preview] failed", {
      tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_TRUST_EXPORT_PREVIEW_FAILED" });
  }
});

router.post("/trust-exports", tenantPortalRouteSource, requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  try {
    const prepared = await prepareTenantTrustExport({
      tenantId,
      audience: req.body?.audience,
      purpose: req.body?.purpose,
      expiresInDays: req.body?.expiresInDays,
      consentAccepted: req.body?.consentAccepted === true,
    });
    if (!prepared) {
      return res.status(404).json({ ok: false, error: "TENANT_TRUST_EXPORT_UNAVAILABLE" });
    }
    return res.json({ ok: true, data: prepared });
  } catch (err: any) {
    if (err?.message === "tenant_trust_export_consent_required") {
      return res.status(400).json({ ok: false, error: "TENANT_TRUST_EXPORT_CONSENT_REQUIRED" });
    }
    console.error("[tenant/trust-exports:prepare] failed", {
      tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_TRUST_EXPORT_PREPARE_FAILED" });
  }
});

router.post("/trust-exports/:id/revoke", tenantPortalRouteSource, requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  const exportId = String(req.params?.id || "").trim();
  if (!tenantId || !exportId) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  try {
    const revoked = await revokeTenantTrustExport({ tenantId, exportId });
    if (!revoked) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    return res.json({ ok: true, data: revoked });
  } catch (err: any) {
    console.error("[tenant/trust-exports:revoke] failed", {
      tenantId,
      exportId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_TRUST_EXPORT_REVOKE_FAILED" });
  }
});

router.get("/institution-access/grants", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  try {
    const items = await listTenantInstitutionAccessGrants({ tenantId });
    return res.json({ ok: true, data: { items } });
  } catch (err: any) {
    console.error("[tenant/institution-access:list] failed", {
      tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_LIST_FAILED" });
  }
});

router.post("/institution-access/preview", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  try {
    const preview = await previewTenantInstitutionAccess({
      tenantId,
      audience: req.body?.audience,
      purpose: req.body?.purpose,
      recipient: req.body?.recipient,
      expiresInDays: req.body?.expiresInDays,
      consentAccepted: req.body?.consentAccepted === true,
    });
    if (!preview) {
      return res.status(404).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_UNAVAILABLE" });
    }
    return res.json({ ok: true, data: preview });
  } catch (err: any) {
    if (err?.message === "tenant_institution_access_recipient_required") {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_RECIPIENT_REQUIRED" });
    }
    if (err?.message === "tenant_institution_access_expiration_required") {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_EXPIRATION_REQUIRED" });
    }
    console.error("[tenant/institution-access:preview] failed", {
      tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_PREVIEW_FAILED" });
  }
});

router.post("/institution-access/grants", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  try {
    const grant = await createTenantInstitutionAccessGrant({
      tenantId,
      audience: req.body?.audience,
      purpose: req.body?.purpose,
      recipient: req.body?.recipient,
      expiresInDays: req.body?.expiresInDays,
      consentAccepted: req.body?.consentAccepted === true,
    });
    if (!grant) {
      return res.status(404).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_UNAVAILABLE" });
    }
    return res.json({ ok: true, data: grant });
  } catch (err: any) {
    if (err?.message === "tenant_institution_access_consent_required") {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_CONSENT_REQUIRED" });
    }
    if (err?.message === "tenant_institution_access_recipient_required") {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_RECIPIENT_REQUIRED" });
    }
    if (err?.message === "tenant_institution_access_expiration_required") {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_EXPIRATION_REQUIRED" });
    }
    if (err?.message === "tenant_institution_access_policy_blocked") {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_POLICY_BLOCKED" });
    }
    if (String(err?.message || "").startsWith("tenant_institution_delivery_blocked")) {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_DELIVERY_BLOCKED" });
    }
    console.error("[tenant/institution-access:create] failed", {
      tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_CREATE_FAILED" });
  }
});

router.post("/institution-access/invites", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  try {
    const invite = await createInstitutionReviewInvite({
      tenantId,
      audience: req.body?.audience,
      purpose: req.body?.purpose,
      recipient: req.body?.recipient,
      expiresInDays: req.body?.expiresInDays,
      consentAccepted: req.body?.consentAccepted === true,
    });
    if (!invite) {
      return res.status(404).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_UNAVAILABLE" });
    }
    return res.json({ ok: true, data: invite });
  } catch (err: any) {
    if (err?.message === "tenant_institution_access_consent_required") {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_CONSENT_REQUIRED" });
    }
    if (err?.message === "tenant_institution_access_recipient_required") {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_RECIPIENT_REQUIRED" });
    }
    if (err?.message === "tenant_institution_access_expiration_required") {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_EXPIRATION_REQUIRED" });
    }
    if (err?.message === "tenant_institution_access_policy_blocked") {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_POLICY_BLOCKED" });
    }
    if (String(err?.message || "").startsWith("tenant_institution_delivery_blocked")) {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_DELIVERY_BLOCKED" });
    }
    console.error("[tenant/institution-access:invite] failed", {
      tenantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_INVITE_FAILED" });
  }
});

router.post("/institution-access/grants/:id/delivery/resend", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  const grantId = String(req.params?.id || "").trim();
  if (!tenantId || !grantId) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  try {
    const delivered = await resendInstitutionReviewDelivery({ tenantId, grantId });
    if (!delivered) {
      return res.status(404).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_NOT_FOUND" });
    }
    if ((delivered as unknown) === false) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }
    return res.json({ ok: true, data: delivered });
  } catch (err: any) {
    if (err?.message === "tenant_institution_delivery_invite_required") {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_DELIVERY_INVITE_REQUIRED" });
    }
    if (String(err?.message || "").startsWith("tenant_institution_delivery_blocked")) {
      return res.status(400).json({ ok: false, error: "TENANT_INSTITUTION_DELIVERY_BLOCKED" });
    }
    console.error("[tenant/institution-access:delivery-resend] failed", {
      tenantId,
      grantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_INSTITUTION_DELIVERY_RESEND_FAILED" });
  }
});

router.post("/institution-access/grants/:id/revoke", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  const grantId = String(req.params?.id || "").trim();
  if (!tenantId || !grantId) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  try {
    const revoked = await revokeTenantInstitutionAccessGrant({ tenantId, grantId });
    if (!revoked) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    return res.json({ ok: true, data: revoked });
  } catch (err: any) {
    console.error("[tenant/institution-access:revoke] failed", {
      tenantId,
      grantId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_INSTITUTION_ACCESS_REVOKE_FAILED" });
  }
});

router.post("/institutional/handoffs", requireTenantWorkspaceIdentity, async (req: any, res: any) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  const institutionType = String(req.body?.institutionProfile?.institutionType || "").trim() as InstitutionType;
  if (!["bank", "lender", "insurer", "regulator", "internal_review"].includes(institutionType)) {
    return res.status(400).json({ ok: false, error: "INVALID_INSTITUTION_TYPE" });
  }

  const integrationMode = String(req.body?.institutionProfile?.integrationMode || "sandbox").trim();
  if (!["sandbox", "manual_export"].includes(integrationMode)) {
    return res.status(400).json({ ok: false, error: "INVALID_INTEGRATION_MODE" });
  }

  try {
    const schemaV2 = await buildInstitutionalSchemaV2ExportForTenant(req, context);
    const created = await createInstitutionalHandoffDraft({
      tenantId,
      institutionProfile: {
        institutionType,
        displayName: req.body?.institutionProfile?.displayName,
        integrationMode: integrationMode as "sandbox" | "manual_export",
      },
      schema: {
        name: schemaV2.schema.name,
        version: schemaV2.schema.version,
      },
      compliance: {
        readinessStatus: schemaV2.complianceReadiness.readinessStatus,
        validationStatus: schemaV2.validation.status,
      },
    });
    await recordSystemObservabilityEvent(
      {
        eventType: "workflow_started",
        workflow: "institutional",
        severity: "info",
        actorType: "tenant",
        status: "open",
        title: "Institutional handoff draft created",
        description: "A tenant created an institutional handoff draft for a downstream review workflow.",
        safeContext: {
          route: "/api/tenant/institutional/handoffs",
          actionKey: "institutional_handoff_created",
          resourceType: "institutional_handoff",
          resourceId: created.id,
        },
        occurredAt: created.createdAt,
      },
      { failSoft: true }
    );
    return res.json({ ok: true, data: created });
  } catch (err: any) {
    if (err?.message === "invalid_institution_display_name") {
      return res.status(400).json({ ok: false, error: "INVALID_INSTITUTION_DISPLAY_NAME" });
    }
    return res.status(500).json({ ok: false, error: "INSTITUTIONAL_HANDOFF_CREATE_FAILED" });
  }
});

router.get("/institutional/handoffs", requireTenantWorkspaceIdentity, async (req: any, res: any) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  const items = await listInstitutionalHandoffsForTenant(tenantId);
  return res.json({
    ok: true,
    data: {
      items,
    },
  });
});

router.delete("/institutional/handoffs/:handoffId", requireTenantWorkspaceIdentity, async (req: any, res: any) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  if (!tenantId) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  const updated = await softVoidInstitutionalHandoff(tenantId, req.params?.handoffId);
  if (!updated) {
    return res.status(404).json({ ok: false, error: "INSTITUTIONAL_HANDOFF_NOT_FOUND" });
  }

  return res.json({ ok: true, data: updated });
});

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

router.post("/share-packages/:id/respond", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
  const sharePackageId = String(req.params?.id || "").trim();
  if (!tenantId || !sharePackageId) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }

  try {
    const updated = await respondToTenantSharePackage({
      tenantId,
      sharePackageId,
      approvedItems: req.body?.approvedItems,
    });
    if (!updated) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }
    return res.json({ ok: true, data: updated });
  } catch (err: any) {
    console.error("[tenant/share-packages:respond] failed", {
      tenantId,
      sharePackageId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_SHARE_PACKAGE_RESPOND_FAILED" });
  }
});

router.post(
  "/share-packages/:id/verification-requests/:requestId/respond",
  requireTenantWorkspaceIdentity,
  async (req: any, res) => {
    const context = await resolveWorkspaceContextOrRespond(req, res);
    if (!context) return;

    const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
    const sharePackageId = String(req.params?.id || "").trim();
    const requestId = String(req.params?.requestId || "").trim();
    if (!tenantId || !sharePackageId || !requestId) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    try {
      const updated = await respondToTenantShareVerificationRequest({
        tenantId,
        sharePackageId,
        requestId,
        approvedScopes: req.body?.approvedScopes,
      });
      if (!updated) {
        return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      }
      return res.json({ ok: true, data: updated });
    } catch (err: any) {
      console.error("[tenant/share-packages:verification-respond] failed", {
        tenantId,
        sharePackageId,
        requestId,
        message: err?.message || "failed",
      });
      return res.status(500).json({ ok: false, error: "TENANT_SHARE_VERIFICATION_RESPOND_FAILED" });
    }
  }
);

router.post(
  "/share-packages/:id/verification-requests/:requestId/revoke",
  requireTenantWorkspaceIdentity,
  async (req: any, res) => {
    const context = await resolveWorkspaceContextOrRespond(req, res);
    if (!context) return;

    const tenantId = String(req.user?.tenantId || context.tenantId || "").trim();
    const sharePackageId = String(req.params?.id || "").trim();
    const requestId = String(req.params?.requestId || "").trim();
    if (!tenantId || !sharePackageId || !requestId) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    try {
      const updated = await revokeTenantShareVerificationRequest({
        tenantId,
        sharePackageId,
        requestId,
      });
      if (!updated) {
        return res.status(404).json({ ok: false, error: "NOT_FOUND" });
      }
      return res.json({ ok: true, data: updated });
    } catch (err: any) {
      console.error("[tenant/share-packages:verification-revoke] failed", {
        tenantId,
        sharePackageId,
        requestId,
        message: err?.message || "failed",
      });
      return res.status(500).json({ ok: false, error: "TENANT_SHARE_VERIFICATION_REVOKE_FAILED" });
    }
  }
);

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
    const profile = await withTenantLeaseDocumentContext(await loadTenantProfileProjection({
      context,
      userId: String(req.user?.id || "").trim(),
      userEmail: String(req.user?.email || "").trim() || null,
    }));

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

router.get("/application-reuse", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  try {
    const projection = await loadTenantApplicationReuseProjection({
      context,
      userEmail: String(req.user?.email || "").trim() || null,
    });
    return res.json({ ok: true, data: sanitizeTenantApplicationReuseProjection(projection) });
  } catch (err: any) {
    console.error("[tenant/application-reuse] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_APPLICATION_REUSE_FAILED" });
  }
});

router.patch("/profile", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  const bodyFields = getTenantProfilePatchFieldNames(req.body);
  if (bodyFields.some((field) => !TENANT_PROFILE_PATCH_ALLOWED_FIELDS.has(field))) {
    return res.status(400).json({ ok: false, error: "TENANT_PROFILE_INVALID_FIELDS" });
  }
  const displayName = cleanProfileField(req.body?.displayName, 120);
  const phone = cleanProfileField(req.body?.phone, 40);
  const requestedFields = bodyFields.filter((field) => TENANT_PROFILE_PATCH_ALLOWED_FIELDS.has(field));
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

router.post("/notifications/:id/read", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;

  try {
    const result = await markTenantNotificationRead({
      context,
      userId: String(req.user?.id || "").trim(),
      userEmail: String(req.user?.email || "").trim() || null,
      notificationId: String(req.params?.id || "").trim(),
    });

    if (!result.ok) {
      const status = result.error === "NOTIFICATION_ID_REQUIRED" ? 400 : 404;
      return res.status(status).json({ ok: false, error: result.error });
    }

    await recordTenantEvent({
      eventType: "tenant_notification_read",
      entityType: "tenant_notification",
      entityId: result.readAt ? String(req.params?.id || "").trim() : "tenant_notification",
      createdBy: String(req.user?.id || "").trim(),
      context: {
        authority: context.authority,
        propertyId: context.propertyId,
        rc_prop_id: context.rc_prop_id,
        applicationId: context.applicationId,
        leaseId: context.leaseId,
      },
      payload: {
        readAt: result.readAt,
      },
    });

    return res.json({ ok: true, readAt: result.readAt });
  } catch (err: any) {
    console.error("[tenant/notifications/:id/read] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_NOTIFICATION_READ_FAILED" });
  }
});

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

// Primary tenant-safe lease projection route. A legacy duplicate registration exists below; keep this route first until a separate consolidation mission retires the duplicate.
router.get("/lease", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  const workspace = await loadTenantWorkspaceData(context);
  return res.json({ ok: true, data: workspace.lease });
});

router.get("/lease/document-url", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  if (context.authority !== "active_tenant" || !context.tenantId || !context.leaseId) {
    return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
  }

  try {
    const leaseSnap = await db.collection("leases").doc(context.leaseId).get();
    if (!leaseSnap.exists) return res.status(404).json({ ok: false, error: "lease_document_not_found" });
    const leaseData = leaseSnap.data() as any;
    if (!leaseMatchesTenantIdentity(leaseData, context.tenantId, context.invitedEmail || req.user?.email)) {
      return res.status(403).json({ ok: false, error: "lease_not_owned_by_tenant" });
    }
    const requestQuery = new URLSearchParams(String(req.originalUrl || req.url || "").split("?")[1] || "");
    const requestedDocument = String(
      req.query?.document || req.query?.kind || requestQuery.get("document") || requestQuery.get("kind") || "lease"
    )
      .trim()
      .toLowerCase();
    const documentContext = await getTenantLeaseDocumentContext({
      leaseId: context.leaseId,
      tenantId: context.tenantId,
      tenantEmail: String(context.invitedEmail || req.user?.email || "").trim() || null,
      propertyId: context.propertyId,
      unitId: context.unitId,
      leaseData,
      documentKind:
        requestedDocument === "schedule-a" || requestedDocument === "schedule_a" || requestedDocument === "schedule"
          ? "schedule-a"
          : "lease",
    });
    if (!documentContext.documentUrl || documentContext.documentStatus === "missing") {
      return res.status(404).json({ ok: false, error: "lease_document_not_found" });
    }
    await recordTenantEvent({
      eventType: "tenant_lease_document_accessed",
      entityType: "tenant_lease_document",
      entityId:
        tenantPublicReference(
          requestedDocument === "schedule-a" || requestedDocument === "schedule_a" || requestedDocument === "schedule"
            ? "schedule-document"
            : "lease-document",
          `${context.leaseId}:${requestedDocument}`
        ) || "document-ref-unavailable",
      createdBy: String(req.user?.id || "").trim(),
      context: {
        authority: context.authority,
        documentStatus: documentContext.documentStatus,
        source: documentContext.source,
      },
      payload: {
        displayLabel: documentContext.displayLabel,
      },
    });
    return res.json({
      ok: true,
      data: {
        ...buildTenantDocumentAccessMetadata({
          leaseId: context.leaseId,
          propertyId: context.propertyId,
          unitId: context.unitId,
          tenantId: context.tenantId,
        }),
        documentUrl: documentContext.documentUrl,
        displayLabel: documentContext.displayLabel,
        documentStatus: documentContext.documentStatus,
        source: documentContext.source,
        expiresInSeconds: 30 * 60,
      },
    });
  } catch (err: any) {
    console.error("[tenant/lease/document-url] failed", {
      userId: req.user?.id,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_LEASE_DOCUMENT_URL_FAILED" });
  }
});

router.post("/leases/:leaseId/payments/checkout", requireTenantWorkspaceIdentity, async (req: any, res: any) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  if (context.authority !== "active_tenant" || !context.tenantId) {
    return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
  }

  const leaseId = String(req.params?.leaseId || "").trim();
  if (!leaseId) {
    return res.status(404).json({ ok: false, error: "lease_not_found" });
  }
  if (context.leaseId && String(context.leaseId).trim() !== leaseId) {
    return res.status(403).json({ ok: false, error: "lease_not_owned_by_tenant" });
  }

  try {
    const leaseSnap = await db.collection("leases").doc(leaseId).get();
    if (!leaseSnap.exists) {
      return res.status(404).json({ ok: false, error: "lease_not_found" });
    }
    const leaseData = (leaseSnap.data() as any) || {};
    const leaseTenantId = String(
      leaseData?.tenantId || leaseData?.primaryTenantId || leaseData?.tenantIds?.[0] || ""
    ).trim();
    const leaseTenantIds = Array.isArray(leaseData?.tenantIds)
      ? leaseData.tenantIds.map((value: any) => String(value || "").trim()).filter(Boolean)
      : [];
    if (
      leaseTenantId !== String(context.tenantId || "").trim() &&
      !leaseTenantIds.includes(String(context.tenantId || "").trim())
    ) {
      return res.status(403).json({ ok: false, error: "lease_not_owned_by_tenant" });
    }
    if (leaseData?.paymentRailEnabled !== true || String(leaseData?.paymentRailProcessor || "").trim() !== "stripe") {
      return res.status(400).json({ ok: false, error: "TENANT_RENT_PAYMENT_BLOCKED", detail: "payment_rail_not_enabled" });
    }

    const projectedLease = projectTenantLease(leaseId, leaseData);
    const eligibility = deriveRentPaymentEligibility({
      lease: {
        id: leaseId,
        landlordId: asString(leaseData?.landlordId),
        tenantId: leaseTenantId,
        tenantIds: leaseTenantIds,
        primaryTenantId: asString(leaseData?.primaryTenantId),
        propertyId: asString(leaseData?.propertyId),
        unitId: asString(leaseData?.unitId),
        unitNumber: asString(leaseData?.unitNumber),
        monthlyRent: projectedLease.monthlyRent,
        status: projectedLease.status,
      },
      paymentReadiness: projectedLease.paymentReadiness || null,
      stripeConfigured: isStripeConfigured(),
    });
    if (!eligibility.eligible) {
      return res.status(400).json({ ok: false, error: "TENANT_RENT_PAYMENT_BLOCKED", detail: eligibility.blockedReason });
    }

    const created = await createRentPaymentCheckout({
      lease: {
        id: leaseId,
        landlordId: asString(leaseData?.landlordId),
        tenantId: leaseTenantId,
        tenantIds: leaseTenantIds,
        primaryTenantId: asString(leaseData?.primaryTenantId),
        propertyId: asString(leaseData?.propertyId),
        unitId: asString(leaseData?.unitId),
        unitNumber: asString(leaseData?.unitNumber),
        monthlyRent: projectedLease.monthlyRent,
        status: projectedLease.status,
      },
      tenantId: String(context.tenantId || "").trim(),
      successPath: "/tenant/lease",
      cancelPath: "/tenant/lease",
    });

    if (!created.ok) {
      return res.status(400).json({ ok: false, error: "TENANT_RENT_PAYMENT_BLOCKED", detail: created.error });
    }

    return res.json({
      ok: true,
      data: {
        rentPaymentId: created.rentPaymentId,
        status: created.status,
        redirectUrl: created.redirectUrl,
      },
    });
  } catch (err: any) {
    console.error("[tenant/leases/:leaseId/payments/checkout] failed", {
      tenantId: context.tenantId,
      leaseId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_RENT_PAYMENT_CHECKOUT_FAILED" });
  }
});

router.get("/leases/:leaseId/payments", requireTenantWorkspaceIdentity, async (req: any, res: any) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  if (context.authority !== "active_tenant" || !context.tenantId) {
    return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
  }

  const leaseId = String(req.params?.leaseId || "").trim();
  if (!leaseId) {
    return res.status(404).json({ ok: false, error: "lease_not_found" });
  }
  if (context.leaseId && String(context.leaseId).trim() !== leaseId) {
    return res.status(403).json({ ok: false, error: "lease_not_owned_by_tenant" });
  }

  try {
    const leaseSnap = await db.collection("leases").doc(leaseId).get();
    if (!leaseSnap.exists) {
      return res.status(404).json({ ok: false, error: "lease_not_found" });
    }
    const leaseData = (leaseSnap.data() as any) || {};
    const projectedLease = projectTenantLease(leaseId, leaseData);
    const data = projectTenantRentPaymentSummary((
      await buildLeasePaymentProjection({
        rawLease: leaseData,
        lease: {
          id: leaseId,
          landlordId: asString(leaseData?.landlordId),
          tenantId: asString(leaseData?.tenantId),
          tenantIds: Array.isArray(leaseData?.tenantIds) ? leaseData.tenantIds : [],
          primaryTenantId: asString(leaseData?.primaryTenantId),
          propertyId: asString(leaseData?.propertyId),
          unitId: asString(leaseData?.unitId),
          unitNumber: asString(leaseData?.unitNumber),
          monthlyRent: projectedLease.monthlyRent,
          startDate: projectedLease.startDate,
          endDate: projectedLease.endDate,
          status: projectedLease.status,
        },
        leaseId,
        documentUrl: projectedLease.documentUrl,
      })
    ).rentPaymentSummary);
    const paymentProjectionMetadata = buildTenantFinancialProjectionMetadata({
      projectionName: "tenant_safe_payment_projection",
      scopeType: "tenant_payment",
      sourceCollections: ["leases", "rentPayments"],
      relationshipBasis: "Payment projection must be derived from authenticated tenant lease ownership.",
    });
    return res.json({ ok: true, ...paymentProjectionMetadata, data });
  } catch (err: any) {
    console.error("[tenant/leases/:leaseId/payments] failed", {
      tenantId: context.tenantId,
      leaseId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_RENT_PAYMENT_STATUS_FAILED" });
  }
});

router.post("/leases/:leaseId/sign", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  if (context.authority !== "active_tenant" || !context.tenantId) {
    return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
  }

  const leaseId = String(req.params?.leaseId || "").trim();
  if (!leaseId) {
    return res.status(404).json({ ok: false, error: "NOT_FOUND" });
  }
  if (context.leaseId && String(context.leaseId).trim() !== leaseId) {
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  }

  try {
    const leaseRef = db.collection("leases").doc(leaseId);
    const leaseSnap = await leaseRef.get();
    if (!leaseSnap.exists) {
      return res.status(404).json({ ok: false, error: "NOT_FOUND" });
    }

    const leaseData = (leaseSnap.data() as any) || {};
    const leaseTenantId = String(
      leaseData?.tenantId || leaseData?.primaryTenantId || leaseData?.tenantIds?.[0] || ""
    ).trim();
    const leaseTenantIds = Array.isArray(leaseData?.tenantIds)
      ? leaseData.tenantIds.map((value: any) => String(value || "").trim()).filter(Boolean)
      : [];
    if (
      leaseTenantId !== context.tenantId &&
      !leaseTenantIds.includes(String(context.tenantId || "").trim())
    ) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const alreadySignedAt =
      String(leaseData?.tenantSignature?.signedAt || "").trim() ||
      String(leaseData?.tenantSignedAt || leaseData?.tenantSignatureCompletedAt || "").trim();
    if (alreadySignedAt) {
      return res.status(200).json({ ok: true, data: projectTenantLease(leaseId, leaseData) });
    }

    const currentExecution = deriveLeaseExecution({
      leaseId,
      documentUrl:
        String(leaseData?.documentUrl || leaseData?.approvedDocumentUrl || leaseData?.documentRef || "").trim() || null,
      startDate: String(leaseData?.startDate || leaseData?.leaseStart || "").trim() || null,
      monthlyRent:
        typeof leaseData?.monthlyRent === "number"
          ? leaseData.monthlyRent
          : typeof leaseData?.rentAmount === "number"
          ? leaseData.rentAmount
          : typeof leaseData?.rentCents === "number"
          ? Math.round(leaseData.rentCents) / 100
          : null,
      status: String(leaseData?.status || "").trim() || null,
      raw: leaseData,
    });
    if (currentExecution.requiredNextAction !== "tenant_signature") {
      return res.status(400).json({ ok: false, error: "TENANT_LEASE_SIGN_NOT_AVAILABLE" });
    }

    const tenantSnap = await db.collection("tenants").doc(String(context.tenantId)).get().catch(() => null);
    const tenantData = tenantSnap?.exists ? ((tenantSnap.data() as any) || {}) : {};
    const signatureDisplayName =
      String(
        req.body?.signatureDisplayName ||
          tenantData?.fullName ||
          tenantData?.name ||
          req.user?.displayName ||
          req.user?.email ||
          ""
      ).trim() || "Tenant";
    const signatureMethod = req.body?.signatureMethod === "drawn" ? "drawn" : "typed";
    const nowIso = new Date().toISOString();

    // Signature writes update tenant-visible state and append canonical events; historical signing evidence remains preserved.
    await leaseRef.set(
      {
        tenantSignedAt: nowIso,
        tenantSignatureMethod: signatureMethod,
        tenantSignatureDisplayName: signatureDisplayName,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    await writeCanonicalEvent({
      domain: "lease",
      action: "tenant_signed",
      status: "tenant_signed",
      actor: {
        type: "tenant",
        role: "tenant",
        id: String(context.tenantId),
        displayName: signatureDisplayName,
      },
      resource: {
        type: "lease",
        id: leaseId,
      },
      occurredAt: nowIso,
      visibility: "internal",
      summary: "Tenant signature metadata recorded for lease execution",
      metadata: {
        previousStatus: String(leaseData?.status || "").trim() || null,
        nextStatus: "tenant_signed",
      },
    });
    await recordSystemObservabilityEvent(
      {
        eventType: "workflow_completed",
        workflow: "lease",
        severity: "info",
        actorType: "tenant",
        status: "resolved",
        title: "Tenant lease signature recorded",
        description: "A tenant signature milestone was recorded for lease execution.",
        safeContext: {
          route: "/api/tenant/leases/sign",
          actionKey: "tenant_lease_signed",
          resourceType: "lease",
          resourceId: leaseId,
        },
        occurredAt: nowIso,
      },
      { failSoft: true }
    );

    const refreshedSnap = await leaseRef.get();
    const refreshed = refreshedSnap.exists ? ((refreshedSnap.data() as any) || {}) : leaseData;
    return res.status(200).json({ ok: true, data: projectTenantLease(leaseId, refreshed) });
  } catch (err) {
    console.error("[tenant/leases/:leaseId/sign] failed", {
      tenantId: context.tenantId,
      leaseId,
      err,
    });
    return res.status(500).json({ ok: false, error: "TENANT_LEASE_SIGN_FAILED" });
  }
});

router.get("/maintenance-requests", requireTenantWorkspaceIdentity, async (req: any, res) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  try {
    const workspace = await loadTenantWorkspaceData(context);
    return res.json({ ok: true, data: workspace.maintenance });
  } catch (err: any) {
    console.warn("[tenant/workspace-maintenance] list failed closed", {
      tenantId: context.tenantId,
      propertyId: context.propertyId,
      message: err?.message || "failed",
    });
    return res.json({ ok: true, data: [] });
  }
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

  let propertyDoc: Awaited<ReturnType<typeof loadDocument>> = null;
  try {
    propertyDoc = await loadDocument("properties", context.propertyId);
  } catch (err: any) {
    console.warn("[tenant/workspace-maintenance] property lookup failed closed", {
      tenantId: context.tenantId,
      message: err?.message || "failed",
    });
    return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
  }
  const property = propertyDoc?.data || {};
  const now = Date.now();
  const ref = db.collection("maintenanceRequests").doc();
  const category = String(req.body?.category || "GENERAL").trim().toUpperCase();
  const priority = String(req.body?.priority || "NORMAL").trim().toUpperCase();
  const allowedCategories = new Set(["PLUMBING", "ELECTRICAL", "HVAC", "APPLIANCE", "PEST", "CLEANING", "GENERAL", "OTHER", "SECURITY"]);
  const allowedPriorities = new Set(["LOW", "NORMAL", "HIGH", "URGENT"]);
  const data = {
    id: ref.id,
    tenantId: context.tenantId,
    leaseId: context.leaseId || null,
    propertyId: context.propertyId,
    unitId: context.unitId || null,
    landlordId: String(property?.landlordId || "").trim() || null,
    title,
    description,
    category: allowedCategories.has(category) ? category : "GENERAL",
    priority: allowedPriorities.has(priority) ? priority : "NORMAL",
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
  const safeRequestId = tenantSafeMaintenanceReferenceKey(ref.id);
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
      const propertyName = String(property?.name || property?.addressLine1 || "").trim() || "Selected property";
      const baseUrl = (process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL || "https://www.rentchain.ai").replace(/\/$/, "");
      const requestLink = `${baseUrl}/maintenance`;
      await sendEmail({
        to: recipients,
        from,
        replyTo: from,
        subject: `New maintenance request: ${title}`,
        text: buildEmailText({
          intro: `A tenant submitted a new maintenance request.\nTenant: ${tenantName}${tenantEmail ? ` (${tenantEmail})` : ""}\nProperty: ${propertyName}\nCategory: ${data.category}\nPriority: ${data.priority}\nReference: ${safeRequestId}\n\n${description}`,
          ctaText: "Open maintenance",
          ctaUrl: requestLink,
        }),
        html: buildEmailHtml({
          title: "New maintenance request",
          intro: `Tenant: ${tenantName}${tenantEmail ? ` (${tenantEmail})` : ""}. Property: ${propertyName}. Category: ${data.category}. Priority: ${data.priority}. Reference: ${safeRequestId}.`,
          ctaText: "Open maintenance",
          ctaUrl: requestLink,
        }),
      });
      emailed = true;
    }
  } catch (err: any) {
    emailError = err?.message || "SEND_FAILED";
    console.error("[tenant/workspace-maintenance] email send failed", {
      requestReference: safeRequestId,
      message: err?.message || "send_failed",
    });
  }

  const projection = projectTenantMaintenance(ref.id, data);
  return res.status(201).json({
    ok: true,
    data: {
      requestId: projection.requestId,
      status: projection.status,
      title: projection.title,
      summary: projection.summary,
      category: projection.category,
      priority: projection.priority,
      createdAt: projection.createdAt,
      updatedAt: projection.updatedAt,
      read: projection.read,
      readAt: projection.readAt,
    },
    emailed,
    emailError,
  });
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
      tenantId: redeemed.invite?.tenantId || null,
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

    let unitLabel: string | null =
      asString(tenantData.unitLabel) ||
      asString(tenantData.unitNumber) ||
      displayStringUnlessId(tenantData.unit, unitId);
    if (unitId) {
      try {
        const unitSnap = await db.collection("units").doc(unitId).get();
        if (unitSnap.exists) {
          const unit = unitSnap.data() as any;
          unitLabel = unit?.unitNumber ?? unit?.label ?? unit?.name ?? unitLabel ?? null;
          propertyId = propertyId ?? unit?.propertyId ?? null;
          landlordId = landlordId ?? unit?.landlordId ?? null;
        }
      } catch {
        unitLabel = unitLabel ?? null;
      }
      if (!unitLabel && propertyName) {
        unitLabel = displayStringUnlessId(tenantData.unit, unitId);
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
      unitLabel =
        unitLabel ??
        asString(tenancySnapshot.unitLabel) ??
        asString(tenancySnapshot.unitNumber) ??
        displayStringUnlessId(tenancySnapshot.unit, unitId);
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
        property: { name: propertyName ?? (propertyId ? "Selected property" : null) },
        unit: { label: unitLabel ?? (unitId ? "Assigned unit" : null) },
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
    const context = await resolveTenancyContext({
      uid: String(req.user?.id || "").trim(),
      email: String(req.user?.email || "").trim() || null,
      tenantId,
      leaseId: String(req.user?.leaseId || "").trim() || null,
    });

    const includeMaintenance = String(req.query?.includeMaintenance ?? "1") !== "0";
    const includeScreening = String(req.query?.includeScreening ?? "1") !== "0";
    const [messageItems, maintenanceItems, screeningItems] = await Promise.all([
      buildTenantMessageItems(tenantId, context),
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
    const context = await resolveTenancyContext({
      uid: String(req.user?.id || "").trim(),
      email: String(req.user?.email || "").trim() || null,
      tenantId,
      leaseId: String(req.user?.leaseId || "").trim() || null,
    });

    const [messageItems, maintenanceItems, screeningItems] = await Promise.all([
      buildTenantMessageItems(tenantId, context),
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

    const ledgerProjectionMetadata = buildTenantFinancialProjectionMetadata({
      projectionName: "tenant_safe_ledger_projection",
      scopeType: "tenant_ledger",
      sourceCollections: ["ledgerEvents", "payments", "tenantEvents"],
      relationshipBasis: "Ledger projection must be derived from authenticated tenant scope and tenant-owned financial events.",
    });

    const items = (entries || []).map((entry: any) => {
      const occurredAt = toMillis(entry.date ?? entry.occurredAt);
      const purpose =
        entry.purpose ??
        entry?.meta?.purpose ??
        inferPurpose(entry.type || "") ??
        "OTHER";
      const purposeLabel =
        entry.purposeLabel ?? entry?.meta?.purposeLabel ?? entry.period ?? null;
      return projectTenantLedgerItem({
        ...entry,
        period: entry.period ?? toPeriod(entry.date ?? entry.occurredAt),
        purpose,
        purposeLabel,
        occurredAt: occurredAt ?? Date.now(),
      });
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
            return projectTenantFinancialEvent({
              ...ev,
              amount: typeof ev.amount === "number" ? ev.amount : typeof ev.amountCents === "number" ? ev.amountCents / 100 : null,
              period: ev.period ?? null,
              purpose: purpose ?? null,
              purposeLabel: purposeLabel ?? null,
              occurredAt: occurredAt ?? Date.now(),
            });
          }) || [];
      const mergedMap = new Map<string, any>();
      [...items, ...eventItems].forEach((it) => {
        if (!it?.id) return;
        mergedMap.set(it.id, it);
      });
      const merged = Array.from(mergedMap.values());
      merged.sort((a, b) => b.occurredAt - a.occurredAt);
      return res.json({ ok: true, ...ledgerProjectionMetadata, data: merged.slice(0, 25) });
    } catch (err) {
      console.warn("[tenant/ledger] event bridge failed; returning base ledger", {
        tenantId,
        err: (err as any)?.message,
      });
      items.sort((a, b) => b.occurredAt - a.occurredAt);
      return res.json({ ok: true, ...ledgerProjectionMetadata, data: items.slice(0, 25) });
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
    const tenantId = String(context.tenantId || "").trim();
    if (!tenantId) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

    const [snap, profile, workspaceData] = await Promise.all([
      db.collection("ledgerAttachments").where("tenantId", "==", tenantId).limit(50).get(),
      loadTenantProfileProjection({
        context,
        userId: String(req.user?.id || "").trim(),
        userEmail: String(req.user?.email || "").trim() || null,
      }).then((profile) => withTenantLeaseDocumentContext(profile)),
      loadTenantWorkspaceData(context),
    ]);

    const rawAttachments = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    rawAttachments.sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0));

    const documentWorkspace = buildTenantDocumentWorkspace({
      attachments: rawAttachments,
      profile,
      leaseDocumentContext: workspaceData.lease?.leaseDocumentContext || (profile.profile?.lease as any)?.leaseDocumentContext || null,
      scheduleADocumentContext: workspaceData.lease?.scheduleADocumentContext || (profile.profile?.lease as any)?.scheduleADocumentContext || null,
    });
    await recordTenantEvent({
      eventType: "tenant_documents_viewed",
      entityType: "tenant_document_workspace",
      entityId: tenantPublicReference("tenant", tenantId) || "tenant-ref-unavailable",
      createdBy: String(req.user?.id || "").trim(),
      context: {
        authority: context.authority,
        documentCount: documentWorkspace.items.length,
      },
      payload: {
        summary: documentWorkspace.summary,
      },
    });

    return res.json({
      ok: true,
      ...buildTenantAttachmentProjectionMetadata({
        leaseId: context.leaseId,
        propertyId: context.propertyId,
        unitId: context.unitId,
        tenantId,
        attachmentIds: documentWorkspace.items.map((item: any) => String(item?.id || "").trim()).filter(Boolean),
      }),
      data: documentWorkspace.items,
      summary: documentWorkspace.summary,
      guidance: documentWorkspace.guidance,
      updatedAt: documentWorkspace.updatedAt,
      leaseDocumentContext: workspaceData.lease?.leaseDocumentContext || (profile.profile?.lease as any)?.leaseDocumentContext || null,
      scheduleADocumentContext: workspaceData.lease?.scheduleADocumentContext || (profile.profile?.lease as any)?.scheduleADocumentContext || null,
    });
  } catch (err) {
    console.error("[tenant/attachments] failed", {
      tenantId: context.tenantId,
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
      .limit(25)
      .get();

    const rawAttachments = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((item) => String(item?.ledgerItemId || "").trim() === ledgerItemId);
    rawAttachments.sort((a, b) => (Number(b.createdAt || 0) || 0) - (Number(a.createdAt || 0) || 0));
    const data: TenantDocumentItem[] = rawAttachments.map((item, index) => {
      const label = labelForAttachmentRecord(item);
      const references = tenantDocumentReferences({
        id: item?.id || `ledger_attachment_${index + 1}`,
        tenantId: item?.tenantId,
        leaseId: item?.leaseId,
        draftId: item?.draftId,
        ledgerItemId: item?.ledgerItemId,
      });
      return {
        id: references.documentReference,
        documentReference: references.documentReference,
        label,
        category: documentCategoryForLabel(label),
        status: "uploaded",
        fileName: item?.fileName ? String(item.fileName) : null,
        title: item?.title ? String(item.title) : null,
        purpose: item?.purpose ? String(item.purpose) : null,
        purposeLabel: item?.purposeLabel ? String(item.purposeLabel) : null,
        tenantReference: references.tenantReference,
        leaseReference: references.leaseReference,
        draftReference: references.draftReference,
        ledgerReference: references.ledgerReference,
        url: item?.url ? String(item.url) : null,
        uploadedAt: Number(item?.createdAt || 0) || null,
        nextAction: "This file has been added to your record.",
        actionAvailable: false,
        actionLabel: null,
        actionPath: null,
        helpLabel: null,
        helpPath: null,
      };
    });
    await recordTenantEvent({
      eventType: "tenant_ledger_attachments_viewed",
      entityType: "tenant_ledger_attachments",
      entityId: tenantPublicReference("ledger", ledgerItemId) || "ledger-ref-unavailable",
      createdBy: String(req.user?.id || "").trim(),
      context: {
        documentCount: data.length,
      },
      payload: null,
    });
    return res.json({
      ok: true,
      ...buildTenantAttachmentProjectionMetadata({
        tenantId,
        attachmentIds: data.map((item) => String(item?.id || "").trim()).filter(Boolean),
      }),
      ledgerReference: tenantPublicReference("ledger", ledgerItemId),
      data,
    });
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

// Legacy duplicate lease route shadowed by the workspace-context route above. Preserve route order and leave consolidation to a separately scoped cleanup.
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
    const bestLease = await findBestTenantLease({
      current: leaseRecord && leaseId ? { id: leaseId, data: leaseRecord } : null,
      tenantId,
      tenantEmail: String(tenantData?.email || req.user?.email || "").trim() || null,
      propertyId,
    });
    if (bestLease) {
      leaseRecord = bestLease.data;
      leaseId = bestLease.id;
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

    const leaseDocumentContext =
      leaseId && leaseRecord
        ? await getTenantLeaseDocumentContext({
            leaseId,
            tenantId,
            tenantEmail: String(tenantData?.email || req.user?.email || "").trim() || null,
            propertyId,
            unitId,
            leaseData: leaseRecord,
          })
        : null;
    const scheduleADocumentContext =
      leaseId && leaseRecord
        ? await getTenantLeaseDocumentContext({
            leaseId,
            tenantId,
            tenantEmail: String(tenantData?.email || req.user?.email || "").trim() || null,
            propertyId,
            unitId,
            leaseData: leaseRecord,
            documentKind: "schedule-a",
          })
        : null;
    const projectedLease = leaseId
      ? projectTenantLease(leaseId, {
          ...(leaseRecord || {}),
          ...(leaseDocumentContext?.documentUrl
            ? {
                documentUrl: leaseDocumentContext.documentUrl,
                approvedDocumentUrl: leaseDocumentContext.documentUrl,
              }
            : {}),
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

    const fallbackLeaseExecution = deriveLeaseExecution({
      leaseId,
      documentUrl: null,
      startDate: null,
      monthlyRent: null,
      status: null,
      raw: {},
    });

    const lease = {
      ...(projectedLease || {
        ...buildTenantLeaseProjectionMetadata({
          leaseId,
          propertyId,
          unitId,
          tenantId,
        }),
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
        leaseExecution: fallbackLeaseExecution,
        paymentReadiness: derivePaymentReadiness({
          leaseId,
          monthlyRent: null,
          startDate: null,
          endDate: null,
          dueDay: null,
          tenantId,
          propertyId,
          unitId,
          leaseExecution: fallbackLeaseExecution,
        }),
      }),
      propertyId,
      propertyName,
      unitId,
      unitNumber,
      rentAmount: projectedLease?.monthlyRent ?? null,
      leaseStart: projectedLease?.startDate ?? null,
      leaseEnd: projectedLease?.endDate ?? null,
      leaseDocumentContext,
      scheduleADocumentContext,
    };

    return res.json({ ok: true, data: lease, lease, ...lease });
  } catch (err) {
    console.error("[tenantPortalRoutes] /tenant/lease error", err);
    return res.status(500).json({ ok: false, error: "TENANT_LEASE_FAILED" });
  }
});

router.get("/payments/summary", requireTenantWorkspaceIdentity, async (req: any, res: any) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  if (context.authority !== "active_tenant" || !context.tenantId) {
    return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
  }

  if (!context.leaseId) {
    const emptySummary = buildTenantPaymentsSummaryResponse({
      tenantId: context.tenantId,
      leaseId: "",
      leaseData: {},
      projectedSummary: projectTenantRentPaymentSummary({
        paymentRail: {
          enabled: false,
          enabledAt: null,
          processor: null,
          blockedReason: null,
        },
        latestPayment: null,
        paymentExperience: {
          history: [],
          latestStatus: null,
          retryAvailable: false,
          receiptSummary: {
            available: false,
            label: "No payment summary available yet",
            amountCents: null,
            paidAt: null,
            leaseReference: null,
          },
        },
      }),
    });
    const paymentProjectionMetadata = buildTenantFinancialProjectionMetadata({
      projectionName: "tenant_safe_payment_projection",
      scopeType: "tenant_payment",
      sourceCollections: ["leases", "rentPayments"],
      relationshipBasis: "Payment summary must be derived from authenticated tenant lease ownership.",
    });
    return res.json({ ok: true, ...paymentProjectionMetadata, data: emptySummary, summary: emptySummary });
  }

  try {
    const leaseSnap = await db.collection("leases").doc(context.leaseId).get();
    if (!leaseSnap.exists) {
      return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
    }
    const leaseData = (leaseSnap.data() as any) || {};
    const leaseTenantIds = [
      asString(leaseData?.tenantId),
      asString(leaseData?.primaryTenantId),
      ...(Array.isArray(leaseData?.tenantIds) ? leaseData.tenantIds.map((value: any) => asString(value)) : []),
    ].filter(Boolean);
    if (!leaseTenantIds.includes(context.tenantId)) {
      return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
    }

    const projectedLease = projectTenantLease(context.leaseId, leaseData);
    const projectedPaymentSummary = projectTenantRentPaymentSummary(
      (
        await buildLeasePaymentProjection({
          rawLease: leaseData,
          lease: {
            id: context.leaseId,
            landlordId: asString(leaseData?.landlordId),
            tenantId: asString(leaseData?.tenantId),
            tenantIds: Array.isArray(leaseData?.tenantIds) ? leaseData.tenantIds : [],
            primaryTenantId: asString(leaseData?.primaryTenantId),
            propertyId: asString(leaseData?.propertyId),
            unitId: asString(leaseData?.unitId),
            unitNumber: asString(leaseData?.unitNumber),
            monthlyRent: projectedLease.monthlyRent,
            startDate: projectedLease.startDate,
            endDate: projectedLease.endDate,
            status: projectedLease.status,
          },
          leaseId: context.leaseId,
          documentUrl: projectedLease.documentUrl,
        })
      ).rentPaymentSummary
    );
    const summary = buildTenantPaymentsSummaryResponse({
      tenantId: context.tenantId,
      leaseId: context.leaseId,
      leaseData,
      projectedSummary: projectedPaymentSummary,
    });
    const paymentProjectionMetadata = buildTenantFinancialProjectionMetadata({
      projectionName: "tenant_safe_payment_projection",
      scopeType: "tenant_payment",
      sourceCollections: ["leases", "rentPayments"],
      relationshipBasis: "Payment summary must be derived from authenticated tenant lease ownership.",
    });
    return res.json({ ok: true, ...paymentProjectionMetadata, data: summary, summary });
  } catch (err: any) {
    console.error("[tenant/payments/summary] failed", {
      tenantId: context.tenantId,
      leaseId: context.leaseId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_PAYMENT_SUMMARY_FAILED" });
  }
});

router.get("/rent-charges", requireTenantWorkspaceIdentity, async (req: any, res: any) => {
  const context = await resolveWorkspaceContextOrRespond(req, res);
  if (!context) return;
  if (context.authority !== "active_tenant" || !context.tenantId) {
    return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
  }

  try {
    if (context.leaseId) {
      const leaseSnap = await db.collection("leases").doc(context.leaseId).get();
      if (!leaseSnap.exists) {
        return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
      }
      const leaseData = (leaseSnap.data() as any) || {};
      const leaseTenantIds = [
        asString(leaseData?.tenantId),
        asString(leaseData?.primaryTenantId),
        ...(Array.isArray(leaseData?.tenantIds) ? leaseData.tenantIds.map((value: any) => asString(value)) : []),
      ].filter(Boolean);
      if (!leaseTenantIds.includes(context.tenantId)) {
        return res.status(403).json({ ok: false, error: "TENANT_CONTEXT_REQUIRED" });
      }
    }

    const snap = await db.collection("rentCharges").where("tenantId", "==", context.tenantId).get();
    const charges = ((snap.docs || []) as any[])
      .filter((doc) => {
        const data = (doc.data() as any) || {};
        const chargeLeaseId = asString(data?.leaseId);
        return !chargeLeaseId || !context.leaseId || chargeLeaseId === context.leaseId;
      })
      .map(projectTenantRentCharge)
      .sort((left, right) => timestampToSort(right.dueDate || right.issuedAt) - timestampToSort(left.dueDate || left.issuedAt));
    const chargeProjectionMetadata = buildTenantFinancialProjectionMetadata({
      projectionName: "tenant_safe_balance_projection",
      scopeType: "tenant_balance",
      sourceCollections: ["rentCharges"],
      relationshipBasis: "Rent charges must be derived from authenticated tenant ownership.",
    });
    return res.json({ ok: true, ...chargeProjectionMetadata, charges, items: charges, data: charges });
  } catch (err: any) {
    console.error("[tenant/rent-charges] failed", {
      tenantId: context.tenantId,
      leaseId: context.leaseId,
      message: err?.message || "failed",
    });
    return res.status(500).json({ ok: false, error: "TENANT_RENT_CHARGES_FAILED" });
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
    const context = await resolveTenancyContext({
      uid: String(req.user?.id || "").trim(),
      email: String(req.user?.email || "").trim() || null,
      tenantId,
      leaseId: String(req.user?.leaseId || "").trim() || null,
    });
    const [messages, notices, maintenance, screening] = await Promise.all([
      buildTenantMessageItems(tenantId, context),
      buildTenantNoticeItems(tenantId),
      buildTenantMaintenanceUpdateItems(tenantId),
      buildTenantScreeningItems(tenantId),
    ]);
    const unreadMessages = messages.filter((item) => !item.read).length;
    const unreadNotices = notices.filter((item) => !item.read).length;
    const unreadMaintenanceUpdates = maintenance.filter((item) => !item.read).length;
    const unreadScreeningUpdates = screening.filter((item) => !item.read).length;
    const latestMessage = messages[0] || null;
    return res.json({
      ok: true,
      unreadMessages,
      unreadNotices,
      unreadMaintenanceUpdates,
      unreadScreeningUpdates,
      unreadTotal: unreadMessages + unreadNotices + unreadMaintenanceUpdates + unreadScreeningUpdates,
      latestMessagePreview: latestMessage?.body || null,
      latestMessageAt: latestMessage?.createdAt || null,
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
    const tenantId = String(req.user?.tenantId || "").trim();
    const id = await resolveTenantMaintenanceDocumentIdForRequest(tenantId, String(req.params?.id || "").trim());
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
