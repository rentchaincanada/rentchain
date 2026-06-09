import { Router, type NextFunction, type Request, type Response } from "express";
import { db } from "../firebase";
import { requireAuth } from "../middleware/requireAuth";
import { deriveTenantUnifiedInbox, type SourceKind, type UnifiedInboxEvent } from "../services/unifiedInbox";

const router = Router();

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

type TenantInboxRequest = {
  limit: number;
  offset: number;
  source: SourceKind | null;
  dateFrom: string | null;
  dateTo: string | null;
};

export type TenantInboxItem = UnifiedInboxEvent;

export type TenantInboxResponse = {
  ok: true;
  items: TenantInboxItem[];
  total: number;
  limit: number;
  offset: number;
};

type TenantInboxContext = {
  tenantId: string;
  tenantWorkspaceId: string;
};

type ValidationResult =
  | { ok: true; value: TenantInboxRequest }
  | { ok: false; status: number; error: string; message: string };

const SOURCE_MAP: Record<string, SourceKind> = {
  application: "tenant.application",
  "tenant.application": "tenant.application",
  lease: "tenant.lease",
  "tenant.lease": "tenant.lease",
  screening: "tenant.screening",
  "tenant.screening": "tenant.screening",
  maintenance: "tenant.maintenance",
  "tenant.maintenance": "tenant.maintenance",
  notice: "tenant.notice",
  "tenant.notice": "tenant.notice",
  message: "tenant.message",
  "tenant.message": "tenant.message",
};

const SENSITIVE_SOURCE_KEYS = [
  "landlordNote",
  "landlordNotes",
  "adminMetadata",
  "adminNotes",
  "providerPayload",
  "providerResponse",
  "screeningReport",
  "reportContents",
  "storagePath",
  "token",
  "secret",
  "rawId",
  "firestoreId",
];

function asString(value: unknown, max = 240): string {
  const next = String(value || "").trim().slice(0, max);
  return next || "";
}

function hasTenantScope(record: any, context: TenantInboxContext) {
  const directValues = [
    record?.tenantWorkspaceId,
    record?.tenantScopeKey,
    record?.workspaceId,
    record?.tenantId,
    record?.applicantTenantId,
    record?.convertedTenantId,
    record?.primaryTenantId,
  ].map((value) => asString(value, 240));
  if (directValues.some((value) => value === context.tenantWorkspaceId || value === context.tenantId)) return true;

  const tenantIds = Array.isArray(record?.tenantIds) ? record.tenantIds.map((value: unknown) => asString(value, 240)) : [];
  return tenantIds.includes(context.tenantId);
}

function hasSensitiveSourceValues(record: any) {
  return SENSITIVE_SOURCE_KEYS.some((key) => record?.[key] != null);
}

function parseInteger(value: unknown, fallback: number) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return null;
  return parsed;
}

function parseIso(value: unknown): string | null {
  const raw = asString(value, 120);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function validateQuery(query: any): ValidationResult {
  const limit = parseInteger(query?.limit, DEFAULT_LIMIT);
  if (limit == null || limit < 1 || limit > MAX_LIMIT) {
    return { ok: false, status: 400, error: "INVALID_LIMIT", message: "limit must be an integer between 1 and 100" };
  }

  const offset = parseInteger(query?.offset, 0);
  if (offset == null || offset < 0) {
    return { ok: false, status: 400, error: "INVALID_OFFSET", message: "offset must be a non-negative integer" };
  }

  const sourceRaw = asString(query?.source, 80).toLowerCase();
  const source = sourceRaw ? SOURCE_MAP[sourceRaw] : null;
  if (sourceRaw && !source) {
    return {
      ok: false,
      status: 400,
      error: "INVALID_SOURCE",
      message: "source must be one of application, lease, screening, maintenance, notice, or message",
    };
  }

  const dateFrom = parseIso(query?.dateFrom);
  if (query?.dateFrom && !dateFrom) {
    return { ok: false, status: 400, error: "INVALID_DATE_FROM", message: "dateFrom must be an ISO8601 timestamp" };
  }

  const dateTo = parseIso(query?.dateTo);
  if (query?.dateTo && !dateTo) {
    return { ok: false, status: 400, error: "INVALID_DATE_TO", message: "dateTo must be an ISO8601 timestamp" };
  }

  if (dateFrom && dateTo && Date.parse(dateFrom) > Date.parse(dateTo)) {
    return { ok: false, status: 400, error: "INVALID_DATE_RANGE", message: "dateFrom must be earlier than dateTo" };
  }

  return { ok: true, value: { limit, offset, source, dateFrom, dateTo } };
}

function resolveTenantInboxContext(req: Request): TenantInboxContext | null {
  const user = (req as any).user || {};
  const tenantId = asString(user?.tenantId, 240);
  const tenantWorkspaceId = asString(user?.tenantWorkspaceId || user?.workspaceId || tenantId, 240);
  if (!tenantId || !tenantWorkspaceId) return null;
  return { tenantId, tenantWorkspaceId };
}

function requireTenantInboxIdentity(req: Request, res: Response, next: NextFunction) {
  const role = asString((req as any).user?.role, 80).toLowerCase();
  if (role !== "tenant") {
    return res.status(403).json({ ok: false, error: "FORBIDDEN", message: "Tenant role is required" });
  }
  if (!resolveTenantInboxContext(req)) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED", message: "Tenant workspace context is required" });
  }
  return next();
}

async function loadCollection(name: string) {
  const snap = await db.collection(name).get().catch(() => ({ docs: [] } as any));
  return (snap?.docs || []).map((doc: any) => ({ id: doc.id, ...((doc.data() as any) || {}) }));
}

function filterScopedRecords(records: any[], context: TenantInboxContext) {
  return records.filter((record) => hasTenantScope(record, context));
}

function toTenantNotificationDescriptor(record: any, context: TenantInboxContext, sourceKind: SourceKind, fallbackTitle: string) {
  if (!hasTenantScope(record, context) || hasSensitiveSourceValues(record)) return null;
  const id = asString(record?.id || record?.notificationId || record?.applicationId || record?.leaseId || record?.noticeId, 240);
  if (!id) return null;
  return {
    id,
    tenantId: context.tenantId,
    tenantWorkspaceId: context.tenantWorkspaceId,
    sourceKind,
    title: asString(record?.title || record?.statusLabel || fallbackTitle, 160) || fallbackTitle,
    summary:
      asString(record?.summary || record?.description || record?.status || record?.message, 1000) ||
      `${fallbackTitle} update is available.`,
    priority: asString(record?.priority, 40) || "normal",
    status: asString(record?.inboxStatus || record?.status, 80),
    createdAt: record?.createdAt || record?.submittedAt || record?.signedAt || record?.startDate || record?.updatedAt,
    updatedAt: record?.updatedAt || record?.createdAt,
    readAt: record?.readAt || null,
  };
}

function matchesDateRange(item: UnifiedInboxEvent, request: TenantInboxRequest) {
  const occurredAt = Date.parse(item.occurredAt);
  if (!Number.isFinite(occurredAt)) return false;
  if (request.dateFrom && occurredAt < Date.parse(request.dateFrom)) return false;
  if (request.dateTo && occurredAt > Date.parse(request.dateTo)) return false;
  return true;
}

function applySafeFilters(items: UnifiedInboxEvent[], request: TenantInboxRequest) {
  return items.filter((item) => {
    if (request.source && item.sourceKind !== request.source) return false;
    return matchesDateRange(item, request);
  });
}

function hasCrossTenantScopeAttempt(query: any, context: TenantInboxContext) {
  const requestedTenantId = asString(query?.tenantId, 240);
  const requestedWorkspaceId = asString(query?.tenantWorkspaceId || query?.workspaceId, 240);
  if (requestedTenantId && requestedTenantId !== context.tenantId) return true;
  if (requestedWorkspaceId && requestedWorkspaceId !== context.tenantWorkspaceId) return true;
  return false;
}

router.get("/inbox", requireAuth, requireTenantInboxIdentity, async (req: Request, res: Response) => {
  try {
    const context = resolveTenantInboxContext(req);
    if (!context) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED", message: "Tenant workspace context is required" });
    }

    const parsed = validateQuery(req.query);
    if (!parsed.ok) {
      return res.status(parsed.status).json({ ok: false, error: parsed.error, message: parsed.message });
    }
    const request = parsed.value;
    if (hasCrossTenantScopeAttempt(req.query, context)) {
      return res.status(403).json({ ok: false, error: "TENANT_SCOPE_FORBIDDEN", message: "Tenant scope is not available" });
    }

    const [notifications, applications, leases, notices, messages, maintenanceRequests, screeningRequests] = await Promise.all([
      loadCollection("tenantNotifications"),
      loadCollection("rentalApplications"),
      loadCollection("leases"),
      loadCollection("tenantNotices"),
      loadCollection("messages"),
      loadCollection("maintenanceRequests"),
      loadCollection("screening_requests"),
    ]);

    const notificationDescriptors = [
      ...filterScopedRecords(notifications, context),
      ...applications
        .map((record: any) => toTenantNotificationDescriptor(record, context, "tenant.application", "Application update"))
        .filter(Boolean),
      ...leases.map((record: any) => toTenantNotificationDescriptor(record, context, "tenant.lease", "Lease update")).filter(Boolean),
      ...notices.map((record: any) => toTenantNotificationDescriptor(record, context, "tenant.notice", "Notice available")).filter(Boolean),
    ];

    const safePage = await deriveTenantUnifiedInbox(context, {
      notifications: notificationDescriptors,
      messages: filterScopedRecords(messages, context),
      maintenanceRequests: filterScopedRecords(maintenanceRequests, context),
      screeningRequests: filterScopedRecords(screeningRequests, context),
      limit: MAX_LIMIT,
    });

    const filteredItems = applySafeFilters(safePage.items, request);
    const items = filteredItems.slice(request.offset, request.offset + request.limit);

    return res.json({
      ok: true,
      items,
      total: filteredItems.length,
      limit: request.limit,
      offset: request.offset,
    } satisfies TenantInboxResponse);
  } catch (err: any) {
    console.error("[tenant-unified-inbox] failed", err?.message || err);
    return res.status(500).json({ ok: false, error: "TENANT_INBOX_FAILED", message: "Unable to load inbox" });
  }
});

export default router;
