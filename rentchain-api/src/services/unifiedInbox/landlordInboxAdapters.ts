import {
  buildSafeSourceRef,
  generateSafeInboxId,
  generateSafeScopeKey,
  safeSourceId,
} from "./safeInboxReferences";
import type {
  LandlordScopeContext,
  SourceKind,
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
  "adminMetadata",
  "adminNotes",
  "providerPayload",
  "providerResponse",
  "screeningReport",
  "tenantPrivateDocuments",
  "privateDocuments",
  "storagePath",
  "token",
  "secret",
  "rawId",
  "unrelatedContractorThread",
];

// LANDLORD PROJECTION: landlord events must exclude cross-landlord records, admin-only metadata, tenant private documents, and unrelated contractor threads.
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
  if (value && typeof (value as any).toMillis === "function") return new Date((value as any).toMillis()).toISOString();
  if (value && typeof (value as any).seconds === "number") return new Date((value as any).seconds * 1000).toISOString();
  return new Date(0).toISOString();
}

function normalizePriority(value: unknown): UnifiedInboxPriority {
  const next = asString(value, "normal", 40).toLowerCase();
  if (next === "critical" || next === "high" || next === "low") return next;
  if (next === "medium") return "normal";
  return "normal";
}

function normalizeStatus(value: unknown, readAt: string | null): UnifiedInboxStatus {
  const next = asString(value, "", 40).toLowerCase();
  if (next === "archived" || next === "muted" || next === "resolved") return next;
  if (next === "completed") return "resolved";
  return readAt ? "read" : "unread";
}

function hasLandlordScope(record: any, context: LandlordScopeContext): boolean {
  const landlordId = asString(context.landlordId, "", 160);
  if (!landlordId) return false;
  const candidates = [record?.landlordId, record?.ownerId, record?.userId, record?.audienceScopeKey].map((value) =>
    asString(value, "", 160)
  );
  return candidates.some((value) => value === landlordId);
}

function hasSensitiveValues(record: any): boolean {
  return SENSITIVE_KEYS.some((key) => record?.[key] != null);
}

function hasUnsafeText(...values: unknown[]): boolean {
  return values.some((value) =>
    /(gs:\/\/|storage\/|firestore|providerPayload|token|secret|-----BEGIN|rawId|adminNotes|privateDocuments)/i.test(
      String(value || "")
    )
  );
}

function makeLandlordEvent(params: {
  sourceKind: SourceKind;
  sourceStableKey: string;
  context: LandlordScopeContext;
  title: string;
  body: string;
  priority?: UnifiedInboxPriority;
  status?: UnifiedInboxStatus;
  occurredAt: string;
  readAt?: string | null;
}): UnifiedInboxEvent {
  const audienceScopeKey = generateSafeScopeKey("landlord", asString(params.context.landlordId, "", 160));
  const id = generateSafeInboxId(params.sourceKind, params.sourceStableKey, audienceScopeKey);
  return {
    ...SAFETY_FLAGS,
    id,
    sourceKind: params.sourceKind,
    sourceId: safeSourceId(params.sourceKind, params.sourceStableKey, audienceScopeKey),
    audienceRole: "landlord",
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

export function adaptLandlordApplicationInboxToInboxEvent(
  inboxItem: any,
  landlordScopeContext: LandlordScopeContext
): UnifiedInboxEvent | null {
  if (!hasLandlordScope(inboxItem, landlordScopeContext) || hasSensitiveValues(inboxItem)) return null;
  const stableKey = asString(inboxItem?.id || inboxItem?.applicationId || inboxItem?.subjectId, "", 240);
  if (!stableKey) return null;
  if (hasUnsafeText(inboxItem?.title, inboxItem?.description, inboxItem?.summary)) return null;
  const readAt = inboxItem?.readAt ? toIso(inboxItem.readAt) : null;
  return makeLandlordEvent({
    sourceKind: "landlord.application",
    sourceStableKey: stableKey,
    context: landlordScopeContext,
    title: asString(inboxItem?.title, "Application ready for review", 180),
    body: asString(inboxItem?.description || inboxItem?.summary, "Application update is available.", 1000),
    priority: normalizePriority(inboxItem?.priority),
    status: normalizeStatus(inboxItem?.status, readAt),
    occurredAt: toIso(inboxItem?.occurredAt || inboxItem?.createdAt || inboxItem?.updatedAt),
    readAt,
  });
}

export function adaptLandlordScreeningInboxToInboxEvent(
  inboxItem: any,
  landlordScopeContext: LandlordScopeContext
): UnifiedInboxEvent | null {
  if (!hasLandlordScope(inboxItem, landlordScopeContext) || hasSensitiveValues(inboxItem)) return null;
  const stableKey = asString(inboxItem?.id || inboxItem?.screeningRequestId || inboxItem?.applicationId, "", 240);
  if (!stableKey) return null;
  if (hasUnsafeText(inboxItem?.title, inboxItem?.description, inboxItem?.nextAction, inboxItem?.summary)) return null;
  const readAt = inboxItem?.readAt ? toIso(inboxItem.readAt) : null;
  return makeLandlordEvent({
    sourceKind: "landlord.screening",
    sourceStableKey: stableKey,
    context: landlordScopeContext,
    title: asString(inboxItem?.title, "Screening needs review", 180),
    body: asString(inboxItem?.description || inboxItem?.nextAction || inboxItem?.summary, "Screening update is available.", 1000),
    priority: normalizePriority(inboxItem?.priority || "high"),
    status: normalizeStatus(inboxItem?.status, readAt),
    occurredAt: toIso(inboxItem?.occurredAt || inboxItem?.createdAt || inboxItem?.updatedAt),
    readAt,
  });
}

export function adaptLandlordLeaseInboxToInboxEvent(
  decisionItem: any,
  landlordScopeContext: LandlordScopeContext
): UnifiedInboxEvent | null {
  if (!hasLandlordScope(decisionItem, landlordScopeContext) || hasSensitiveValues(decisionItem)) return null;
  const stableKey = asString(decisionItem?.id || decisionItem?.leaseId || decisionItem?.subjectId, "", 240);
  if (!stableKey) return null;
  if (hasUnsafeText(decisionItem?.title, decisionItem?.actionLabel, decisionItem?.description, decisionItem?.explanation, decisionItem?.summary)) return null;
  const readAt = decisionItem?.readAt ? toIso(decisionItem.readAt) : null;
  return makeLandlordEvent({
    sourceKind: "landlord.lease",
    sourceStableKey: stableKey,
    context: landlordScopeContext,
    title: asString(decisionItem?.title || decisionItem?.actionLabel, "Lease action available", 180),
    body: asString(decisionItem?.description || decisionItem?.explanation || decisionItem?.summary, "Lease lifecycle update is available.", 1000),
    priority: normalizePriority(decisionItem?.priority),
    status: normalizeStatus(decisionItem?.status || decisionItem?.state, readAt),
    occurredAt: toIso(decisionItem?.occurredAt || decisionItem?.createdAt || decisionItem?.updatedAt),
    readAt,
  });
}

export function adaptLandlordMaintenanceInboxToInboxEvent(
  maintenanceRequest: any,
  landlordScopeContext: LandlordScopeContext
): UnifiedInboxEvent | null {
  if (!hasLandlordScope(maintenanceRequest, landlordScopeContext) || hasSensitiveValues(maintenanceRequest)) return null;
  const stableKey = asString(maintenanceRequest?.id || maintenanceRequest?.requestId, "", 240);
  if (!stableKey) return null;
  if (hasUnsafeText(maintenanceRequest?.title, maintenanceRequest?.status)) return null;
  const status = asString(maintenanceRequest?.status, "submitted", 80);
  const readAt = maintenanceRequest?.readAt ? toIso(maintenanceRequest.readAt) : null;
  return makeLandlordEvent({
    sourceKind: "landlord.maintenance",
    sourceStableKey: stableKey,
    context: landlordScopeContext,
    title: asString(maintenanceRequest?.title, "Maintenance request", 180),
    body: `Status: ${status}`,
    priority: normalizePriority(maintenanceRequest?.priority || (/(urgent|blocked|cancelled)/i.test(status) ? "high" : "normal")),
    status: normalizeStatus(maintenanceRequest?.inboxStatus, readAt),
    occurredAt: toIso(maintenanceRequest?.updatedAt || maintenanceRequest?.createdAt || maintenanceRequest?.occurredAt),
    readAt,
  });
}

export function adaptLandlordMessageInboxToInboxEvent(
  message: any,
  landlordScopeContext: LandlordScopeContext
): UnifiedInboxEvent | null {
  if (!hasLandlordScope(message, landlordScopeContext) || hasSensitiveValues(message)) return null;
  const stableKey = asString(message?.id || message?.messageId, "", 240);
  if (!stableKey) return null;
  if (hasUnsafeText(message?.body, message?.text, message?.summary)) return null;
  const readAt = message?.readAt ? toIso(message.readAt) : null;
  const senderRole = asString(message?.senderRole, "tenant", 40).toLowerCase();
  return makeLandlordEvent({
    sourceKind: "landlord.message",
    sourceStableKey: stableKey,
    context: landlordScopeContext,
    title: senderRole === "contractor" ? "Contractor message" : "Tenant message",
    body: asString(message?.body || message?.text || message?.summary, "You have a message update.", 1000),
    priority: normalizePriority(message?.priority),
    status: normalizeStatus(message?.status, readAt),
    occurredAt: toIso(message?.createdAt || message?.createdAtMs || message?.occurredAt),
    readAt,
  });
}
