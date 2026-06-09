import { db } from "../../firebase";
import {
  deriveContractorUnifiedInbox,
  deriveLandlordUnifiedInbox,
  deriveTenantUnifiedInbox,
} from "./deriveUnifiedInbox";
import type { SourceKind, UnifiedInboxEvent } from "./types";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

const SOURCE_KINDS = new Set<SourceKind>([
  "tenant.message",
  "tenant.maintenance",
  "tenant.screening",
  "tenant.lease",
  "tenant.application",
  "tenant.notice",
  "tenant.viewing",
  "landlord.application",
  "landlord.screening",
  "landlord.lease",
  "landlord.maintenance",
  "landlord.message",
  "landlord.notice",
  "landlord.viewing",
  "landlord.work_order",
  "contractor.work_order",
  "contractor.message",
]);

export type UnifiedInboxRole = "tenant" | "landlord" | "contractor";

export type UnifiedInboxQuery = {
  limit?: unknown;
  offset?: unknown;
  source?: unknown;
  dateFrom?: unknown;
  dateTo?: unknown;
  tenantId?: unknown;
  tenantWorkspaceId?: unknown;
  workspaceId?: unknown;
  landlordId?: unknown;
  contractorId?: unknown;
  audienceScopeKey?: unknown;
};

export type UnifiedInboxRequest = {
  limit: number;
  offset: number;
  source: SourceKind | null;
  dateFrom: string | null;
  dateTo: string | null;
};

export type UnifiedInboxContext = {
  role: UnifiedInboxRole;
  tenantId?: string;
  tenantWorkspaceId?: string;
  landlordId?: string;
  contractorId?: string;
};

export type UnifiedInboxResult = {
  ok: true;
  role: UnifiedInboxRole;
  items: UnifiedInboxEvent[];
  records: UnifiedInboxEvent[];
  total: number;
  limit: number;
  offset: number;
};

export type UnifiedInboxValidationResult =
  | { ok: true; value: UnifiedInboxRequest }
  | { ok: false; status: number; error: string; message: string };

export class UnifiedInboxError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function asString(value: unknown, max = 240): string {
  return String(value || "").trim().slice(0, max);
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

export function validateUnifiedInboxQuery(query: UnifiedInboxQuery): UnifiedInboxValidationResult {
  const limit = parseInteger(query.limit, DEFAULT_LIMIT);
  if (limit == null || limit < 1 || limit > MAX_LIMIT) {
    return { ok: false, status: 400, error: "INVALID_LIMIT", message: "limit must be an integer between 1 and 100" };
  }

  const offset = parseInteger(query.offset, 0);
  if (offset == null || offset < 0) {
    return { ok: false, status: 400, error: "INVALID_OFFSET", message: "offset must be a non-negative integer" };
  }

  const sourceRaw = asString(query.source, 80).toLowerCase();
  const source = sourceRaw ? (sourceRaw as SourceKind) : null;
  if (sourceRaw && !SOURCE_KINDS.has(source as SourceKind)) {
    return { ok: false, status: 400, error: "INVALID_SOURCE", message: "source is not supported for unified inbox" };
  }

  const dateFrom = parseIso(query.dateFrom);
  if (query.dateFrom && !dateFrom) {
    return { ok: false, status: 400, error: "INVALID_DATE_FROM", message: "dateFrom must be an ISO8601 timestamp" };
  }

  const dateTo = parseIso(query.dateTo);
  if (query.dateTo && !dateTo) {
    return { ok: false, status: 400, error: "INVALID_DATE_TO", message: "dateTo must be an ISO8601 timestamp" };
  }

  if (dateFrom && dateTo && Date.parse(dateFrom) > Date.parse(dateTo)) {
    return { ok: false, status: 400, error: "INVALID_DATE_RANGE", message: "dateFrom must be earlier than dateTo" };
  }

  return { ok: true, value: { limit, offset, source, dateFrom, dateTo } };
}

async function loadCollection(name: string) {
  const snap = await db.collection(name).get().catch(() => ({ docs: [] } as { docs: Array<{ id: string; data: () => unknown }> }));
  return (snap.docs || []).map((doc) => ({ id: doc.id, ...((doc.data() as Record<string, unknown>) || {}) }));
}

function hasTenantScope(record: Record<string, unknown>, context: UnifiedInboxContext) {
  const tenantWorkspaceId = asString(context.tenantWorkspaceId, 240);
  const tenantId = asString(context.tenantId, 240);
  const directValues = [
    record.tenantWorkspaceId,
    record.tenantScopeKey,
    record.workspaceId,
    record.audienceScopeKey,
    record.tenantId,
    record.applicantTenantId,
    record.convertedTenantId,
    record.primaryTenantId,
  ].map((value) => asString(value, 240));
  if (directValues.some((value) => value === tenantWorkspaceId || value === tenantId)) return true;

  const tenantIds = Array.isArray(record.tenantIds) ? record.tenantIds.map((value) => asString(value, 240)) : [];
  return Boolean(tenantId && tenantIds.includes(tenantId));
}

function hasLandlordScope(record: Record<string, unknown>, landlordId: string) {
  return [record.landlordId, record.ownerId, record.userId, record.audienceScopeKey].some(
    (value) => asString(value, 240) === landlordId
  );
}

function hasContractorScope(record: Record<string, unknown>, contractorId: string) {
  return [record.assignedContractorId, record.contractorId, record.recipientContractorId, record.audienceScopeKey].some(
    (value) => asString(value, 160) === contractorId
  );
}

function filterTenantScoped(records: Array<Record<string, unknown>>, context: UnifiedInboxContext) {
  return records.filter((record) => hasTenantScope(record, context));
}

function filterLandlordScoped(records: Array<Record<string, unknown>>, landlordId: string) {
  return records.filter((record) => hasLandlordScope(record, landlordId));
}

function filterContractorScoped(records: Array<Record<string, unknown>>, contractorId: string) {
  return records.filter((record) => hasContractorScope(record, contractorId));
}

function matchesDateRange(item: UnifiedInboxEvent, request: UnifiedInboxRequest) {
  const occurredAt = Date.parse(item.occurredAt);
  if (!Number.isFinite(occurredAt)) return false;
  if (request.dateFrom && occurredAt < Date.parse(request.dateFrom)) return false;
  if (request.dateTo && occurredAt > Date.parse(request.dateTo)) return false;
  return true;
}

function applySafeFilters(items: UnifiedInboxEvent[], request: UnifiedInboxRequest, role: UnifiedInboxRole) {
  return items.filter((item) => {
    if (item.audienceRole !== role) return false;
    if (request.source && item.sourceKind !== request.source) return false;
    return matchesDateRange(item, request);
  });
}

function assertNoCrossScopeAttempt(query: UnifiedInboxQuery, context: UnifiedInboxContext) {
  const tenantId = asString(query.tenantId, 240);
  const tenantWorkspaceId = asString(query.tenantWorkspaceId || query.workspaceId, 240);
  const landlordId = asString(query.landlordId, 240);
  const contractorId = asString(query.contractorId, 160);
  const audienceScopeKey = asString(query.audienceScopeKey, 240);

  if (context.role === "tenant") {
    if (tenantId && tenantId !== context.tenantId) throw new UnifiedInboxError(403, "TENANT_SCOPE_FORBIDDEN", "Tenant scope is not available");
    if (tenantWorkspaceId && tenantWorkspaceId !== context.tenantWorkspaceId) {
      throw new UnifiedInboxError(403, "TENANT_SCOPE_FORBIDDEN", "Tenant scope is not available");
    }
  }

  if (context.role === "landlord" && landlordId && landlordId !== context.landlordId) {
    throw new UnifiedInboxError(403, "LANDLORD_SCOPE_FORBIDDEN", "Landlord scope is not available");
  }

  if (context.role === "contractor") {
    if (contractorId && contractorId !== context.contractorId) {
      throw new UnifiedInboxError(403, "CONTRACTOR_SCOPE_FORBIDDEN", "Contractor scope is not available");
    }
    if (audienceScopeKey && audienceScopeKey !== context.contractorId) {
      throw new UnifiedInboxError(403, "CONTRACTOR_SCOPE_FORBIDDEN", "Contractor scope is not available");
    }
  }
}

async function loadTenantInbox(context: UnifiedInboxContext) {
  const tenantWorkspaceId = asString(context.tenantWorkspaceId, 240);
  if (!tenantWorkspaceId) throw new UnifiedInboxError(401, "MISSING_TENANT_CONTEXT", "Tenant workspace context is required");

  const [notifications, messages, maintenanceRequests, screeningRequests, viewingRequests, notices, applicationStatusItems] =
    await Promise.all([
      loadCollection("tenantNotifications"),
      loadCollection("messages"),
      loadCollection("maintenanceRequests"),
      loadCollection("screening_requests"),
      loadCollection("viewingRequests"),
      loadCollection("tenantNotices"),
      loadCollection("rentalApplications"),
    ]);

  return deriveTenantUnifiedInbox(
    { tenantWorkspaceId, tenantId: context.tenantId },
    {
      notifications: filterTenantScoped(notifications, context),
      messages: filterTenantScoped(messages, context),
      maintenanceRequests: filterTenantScoped(maintenanceRequests, context),
      screeningRequests: filterTenantScoped(screeningRequests, context),
      viewingRequests: filterTenantScoped(viewingRequests, context),
      notices: filterTenantScoped(notices, context),
      applicationStatusItems: filterTenantScoped(applicationStatusItems, context),
      limit: MAX_LIMIT,
      cursor: undefined,
    }
  );
}

async function loadLandlordInbox(context: UnifiedInboxContext) {
  const landlordId = asString(context.landlordId, 240);
  if (!landlordId) throw new UnifiedInboxError(401, "MISSING_LANDLORD_CONTEXT", "Landlord context is required");

  const [applicationStatusItems, screeningItems, leaseItems, maintenanceRequests, messages, viewingRequests, workOrders, notices] =
    await Promise.all([
      loadCollection("rentalApplications"),
      loadCollection("screening_requests"),
      loadCollection("leases"),
      loadCollection("maintenanceRequests"),
      loadCollection("messages"),
      loadCollection("viewingRequests"),
      loadCollection("workOrders"),
      loadCollection("tenantNotices"),
    ]);

  return deriveLandlordUnifiedInbox(landlordId, {
    applicationStatusItems: filterLandlordScoped(applicationStatusItems, landlordId),
    screeningItems: filterLandlordScoped(screeningItems, landlordId),
    leaseItems: filterLandlordScoped(leaseItems, landlordId),
    maintenanceRequests: filterLandlordScoped(maintenanceRequests, landlordId),
    messages: filterLandlordScoped(messages, landlordId),
    viewingRequests: filterLandlordScoped(viewingRequests, landlordId),
    workOrders: filterLandlordScoped(workOrders, landlordId),
    notices: filterLandlordScoped(notices, landlordId),
    limit: MAX_LIMIT,
    cursor: undefined,
  });
}

async function loadContractorInbox(context: UnifiedInboxContext) {
  const contractorId = asString(context.contractorId, 160);
  if (!contractorId) throw new UnifiedInboxError(401, "MISSING_CONTRACTOR_CONTEXT", "Contractor context is required");

  const [workOrders, messages, workOrderCommunications] = await Promise.all([
    loadCollection("workOrders"),
    loadCollection("contractorMessages"),
    loadCollection("workOrderUpdates"),
  ]);

  return deriveContractorUnifiedInbox(contractorId, {
    workOrders: filterContractorScoped(workOrders, contractorId),
    messages: filterContractorScoped(messages, contractorId),
    workOrderCommunications: filterContractorScoped(workOrderCommunications, contractorId),
    limit: MAX_LIMIT,
    cursor: undefined,
  });
}

export async function getUnifiedInbox(context: UnifiedInboxContext, query: UnifiedInboxQuery = {}): Promise<UnifiedInboxResult> {
  const parsed = validateUnifiedInboxQuery(query);
  if (!parsed.ok) throw new UnifiedInboxError(parsed.status, parsed.error, parsed.message);
  assertNoCrossScopeAttempt(query, context);

  const request = parsed.value;
  const page =
    context.role === "tenant"
      ? await loadTenantInbox(context)
      : context.role === "landlord"
      ? await loadLandlordInbox(context)
      : await loadContractorInbox(context);

  const filteredItems = applySafeFilters(page.items, request, context.role);
  const items = filteredItems.slice(request.offset, request.offset + request.limit);

  return {
    ok: true,
    role: context.role,
    items,
    records: items,
    total: filteredItems.length,
    limit: request.limit,
    offset: request.offset,
  };
}
