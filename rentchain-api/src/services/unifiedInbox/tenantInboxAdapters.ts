import {
  buildSafeSourceRef,
  generateSafeInboxId,
  generateSafeScopeKey,
  safeSourceId,
} from "./safeInboxReferences";
import type {
  SourceKind,
  TenantScopeContext,
  UnifiedInboxEvent,
  UnifiedInboxPriority,
  UnifiedInboxStatus,
} from "./types";

const SAFETY_FLAGS = {
  rawIdsIncluded: false,
  tokensIncluded: false,
  secretsIncluded: false,
  providerPayloadIncluded: false,
  storagePathIncluded: false,
  privateNotesIncluded: false,
} as const;

const SENSITIVE_KEYS = [
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
  "contractorInternalNotes",
];

const TENANT_NOTIFICATION_SOURCE_KINDS: SourceKind[] = [
  "tenant.application",
  "tenant.lease",
  "tenant.maintenance",
  "tenant.message",
  "tenant.notice",
  "tenant.screening",
  "tenant.viewing",
];

// TENANT PROJECTION: tenant events must exclude landlord notes, provider payloads, raw IDs, admin decisions, and private operational notes.
function asString(value: unknown, fallback = "", max = 500): string {
  const next = String(value || "").trim().slice(0, max);
  return next || fallback;
}

function toIso(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (value && typeof (value as any).toMillis === "function") {
    return new Date((value as any).toMillis()).toISOString();
  }
  if (value && typeof (value as any).seconds === "number") {
    return new Date((value as any).seconds * 1000).toISOString();
  }
  return new Date(0).toISOString();
}

function normalizePriority(value: unknown): UnifiedInboxPriority {
  const next = asString(value, "normal", 40).toLowerCase();
  if (next === "critical" || next === "high" || next === "low") return next;
  return "normal";
}

function normalizeStatus(value: unknown, readAt: string | null): UnifiedInboxStatus {
  const next = asString(value, "", 40).toLowerCase();
  if (next === "archived" || next === "muted" || next === "resolved") return next;
  return readAt ? "read" : "unread";
}

function hasTenantScope(record: any, context: TenantScopeContext): boolean {
  const tenantWorkspaceId = asString(context.tenantWorkspaceId, "", 160);
  const tenantId = asString(context.tenantId, "", 160);
  if (!tenantWorkspaceId) return false;

  const candidates = [
    record?.tenantWorkspaceId,
    record?.audienceScopeKey,
    record?.tenantScopeKey,
    record?.workspaceId,
  ].map((value) => asString(value, "", 160));
  if (candidates.some((value) => value === tenantWorkspaceId)) return true;

  const recordTenantId = asString(record?.tenantId || record?.applicantTenantId, "", 160);
  return Boolean(tenantId && recordTenantId === tenantId);
}

function hasSensitiveValues(record: any): boolean {
  return SENSITIVE_KEYS.some((key) => record?.[key] != null);
}

function hasUnsafeText(...values: unknown[]): boolean {
  return values.some((value) =>
    /(gs:\/\/|storage\/|firestore|providerPayload|token|secret|-----BEGIN|rawId|landlordNotes|adminNotes)/i.test(
      String(value || "")
    )
  );
}

function normalizeTenantSourceKind(value: unknown): SourceKind {
  const next = asString(value, "tenant.application", 80);
  return TENANT_NOTIFICATION_SOURCE_KINDS.includes(next as SourceKind) ? (next as SourceKind) : "tenant.application";
}

function makeTenantEvent(params: {
  sourceKind: SourceKind;
  sourceStableKey: string;
  context: TenantScopeContext;
  title: string;
  body: string;
  priority?: UnifiedInboxPriority;
  status?: UnifiedInboxStatus;
  occurredAt: string;
  readAt?: string | null;
}): UnifiedInboxEvent {
  const audienceScopeKey = generateSafeScopeKey("tenant", asString(params.context.tenantWorkspaceId, "", 160));
  const id = generateSafeInboxId(params.sourceKind, params.sourceStableKey, audienceScopeKey);
  return {
    ...SAFETY_FLAGS,
    id,
    sourceKind: params.sourceKind,
    sourceId: safeSourceId(params.sourceKind, params.sourceStableKey, audienceScopeKey),
    audienceRole: "tenant",
    audienceScopeKey,
    title: params.title,
    body: params.body,
    priority: params.priority || "normal",
    status: params.status || normalizeStatus(null, params.readAt || null),
    occurredAt: params.occurredAt,
    readAt: params.readAt || null,
    sourceRef: buildSafeSourceRef(params.sourceKind, params.sourceStableKey, audienceScopeKey),
  };
}

export function adaptTenantNotificationToInboxEvent(
  notification: any,
  tenantScopeContext: TenantScopeContext
): UnifiedInboxEvent | null {
  if (!hasTenantScope(notification, tenantScopeContext) || hasSensitiveValues(notification)) return null;
  const stableKey = asString(notification?.id || notification?.notificationId || notification?.sourceKey, "", 240);
  if (!stableKey) return null;
  if (hasUnsafeText(notification?.title, notification?.summary, notification?.body, notification?.message)) return null;
  const readAt = notification?.readAt ? toIso(notification.readAt) : null;
  return makeTenantEvent({
    sourceKind: normalizeTenantSourceKind(notification?.sourceKind),
    sourceStableKey: stableKey,
    context: tenantScopeContext,
    title: asString(notification?.title, "Tenant notification", 160),
    body: asString(notification?.summary || notification?.body || notification?.message, "Tenant workspace update", 1000),
    priority: normalizePriority(notification?.priority || notification?.status),
    status: normalizeStatus(notification?.status, readAt),
    occurredAt: toIso(notification?.createdAt || notification?.occurredAt || notification?.updatedAt),
    readAt,
  });
}

export function adaptTenantMessageToInboxEvent(
  message: any,
  tenantScopeContext: TenantScopeContext
): UnifiedInboxEvent | null {
  if (!hasTenantScope(message, tenantScopeContext) || hasSensitiveValues(message)) return null;
  const stableKey = asString(message?.id || message?.messageId, "", 240);
  if (!stableKey) return null;
  if (hasUnsafeText(message?.body, message?.text, message?.summary)) return null;
  const readAt = message?.readAt ? toIso(message.readAt) : null;
  const senderRole = asString(message?.senderRole, "landlord", 40).toLowerCase();
  return makeTenantEvent({
    sourceKind: "tenant.message",
    sourceStableKey: stableKey,
    context: tenantScopeContext,
    title: senderRole === "landlord" ? "Message from landlord" : "Message update",
    body: asString(message?.body || message?.text || message?.summary, "You have a message update.", 1000),
    priority: normalizePriority(message?.priority),
    status: normalizeStatus(message?.status, readAt),
    occurredAt: toIso(message?.createdAt || message?.createdAtMs || message?.occurredAt),
    readAt,
  });
}

export function adaptTenantMaintenanceToInboxEvent(
  maintenanceRequest: any,
  tenantScopeContext: TenantScopeContext
): UnifiedInboxEvent | null {
  if (!hasTenantScope(maintenanceRequest, tenantScopeContext) || hasSensitiveValues(maintenanceRequest)) return null;
  const stableKey = asString(maintenanceRequest?.id || maintenanceRequest?.requestId, "", 240);
  if (!stableKey) return null;
  if (hasUnsafeText(maintenanceRequest?.title, maintenanceRequest?.status)) return null;
  const status = asString(maintenanceRequest?.status, "submitted", 80);
  const readAt = maintenanceRequest?.readAt ? toIso(maintenanceRequest.readAt) : null;
  return makeTenantEvent({
    sourceKind: "tenant.maintenance",
    sourceStableKey: stableKey,
    context: tenantScopeContext,
    title: asString(maintenanceRequest?.title, "Maintenance request", 160),
    body: `Status: ${status}`,
    priority: normalizePriority(maintenanceRequest?.priority || (/(urgent|blocked|cancelled)/i.test(status) ? "high" : "normal")),
    status: normalizeStatus(maintenanceRequest?.inboxStatus, readAt),
    occurredAt: toIso(maintenanceRequest?.updatedAt || maintenanceRequest?.createdAt || maintenanceRequest?.occurredAt),
    readAt,
  });
}

export function adaptTenantScreeningToInboxEvent(
  screeningRequest: any,
  tenantScopeContext: TenantScopeContext
): UnifiedInboxEvent | null {
  if (!hasTenantScope(screeningRequest, tenantScopeContext) || hasSensitiveValues(screeningRequest)) return null;
  const stableKey = asString(screeningRequest?.id || screeningRequest?.requestId, "", 240);
  if (!stableKey) return null;
  if (hasUnsafeText(screeningRequest?.status, screeningRequest?.nextAction)) return null;
  const screeningStatus = asString(screeningRequest?.status, "pending", 80);
  const readAt = screeningRequest?.readAt ? toIso(screeningRequest.readAt) : null;
  return makeTenantEvent({
    sourceKind: "tenant.screening",
    sourceStableKey: stableKey,
    context: tenantScopeContext,
    title: screeningStatus === "consent_pending" ? "Screening consent required" : "Screening update",
    body: asString(screeningRequest?.nextAction || `Screening status: ${screeningStatus}`, `Screening status: ${screeningStatus}`, 1000),
    priority: normalizePriority(screeningRequest?.priority || (screeningStatus === "consent_pending" ? "high" : "normal")),
    status: normalizeStatus(screeningRequest?.inboxStatus, readAt),
    occurredAt: toIso(screeningRequest?.requestedAt || screeningRequest?.createdAt || screeningRequest?.updatedAt),
    readAt,
  });
}
