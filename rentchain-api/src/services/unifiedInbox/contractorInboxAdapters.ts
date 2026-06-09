import {
  buildSafeSourceRef,
  generateSafeInboxId,
  generateSafeScopeKey,
  safeSourceId,
} from "./safeInboxReferences";
import type {
  ContractorScopeContext,
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
  "firestoreId",
  "landlordInternalNotes",
  "tenantNotes",
  "billingInfo",
];

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
  if (next === "urgent") return "high";
  return "normal";
}

function normalizeStatus(value: unknown, readAt: string | null): UnifiedInboxStatus {
  const next = asString(value, "", 40).toLowerCase();
  if (next === "archived" || next === "muted" || next === "resolved") return next;
  if (next === "completed" || next === "closed") return "resolved";
  return readAt ? "read" : "unread";
}

function hasContractorScope(record: any, context: ContractorScopeContext): boolean {
  const contractorId = asString(context.contractorId, "", 160);
  if (!contractorId) return false;
  const candidates = [
    record?.assignedContractorId,
    record?.contractorId,
    record?.recipientContractorId,
    record?.audienceScopeKey,
  ].map((value) => asString(value, "", 160));
  return candidates.some((value) => value === contractorId);
}

function hasSensitiveValues(record: any): boolean {
  return SENSITIVE_KEYS.some((key) => record?.[key] != null);
}

function hasUnsafeText(...values: unknown[]): boolean {
  return values.some((value) =>
    /(gs:\/\/|storage\/|firestore|providerPayload|token|secret|-----BEGIN|rawId|adminNotes|tenantId|landlordId)/i.test(
      String(value || "")
    )
  );
}

function makeContractorEvent(params: {
  sourceKind: SourceKind;
  sourceStableKey: string;
  context: ContractorScopeContext;
  title: string;
  body: string;
  priority?: UnifiedInboxPriority;
  status?: UnifiedInboxStatus;
  occurredAt: string;
  readAt?: string | null;
}): UnifiedInboxEvent {
  const audienceScopeKey = generateSafeScopeKey("contractor", asString(params.context.contractorId, "", 160));
  const id = generateSafeInboxId(params.sourceKind, params.sourceStableKey, audienceScopeKey);
  return {
    ...SAFETY_FLAGS,
    id,
    sourceKind: params.sourceKind,
    sourceId: safeSourceId(params.sourceKind, params.sourceStableKey, audienceScopeKey),
    audienceRole: "contractor",
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

export function adaptContractorWorkOrderToInboxEvent(
  workOrder: any,
  contractorScopeContext: ContractorScopeContext
): UnifiedInboxEvent | null {
  if (!hasContractorScope(workOrder, contractorScopeContext) || hasSensitiveValues(workOrder)) return null;
  const stableKey = asString(workOrder?.id || workOrder?.workOrderId || workOrder?.assignmentId, "", 240);
  if (!stableKey) return null;
  if (hasUnsafeText(workOrder?.title, workOrder?.status, workOrder?.category)) return null;
  const status = asString(workOrder?.status, "assigned", 80);
  const readAt = workOrder?.readAt ? toIso(workOrder.readAt) : null;
  return makeContractorEvent({
    sourceKind: "contractor.work_order",
    sourceStableKey: stableKey,
    context: contractorScopeContext,
    title: asString(workOrder?.title || workOrder?.category, "Work order update", 180),
    body: `Status: ${status}`,
    priority: normalizePriority(workOrder?.priority || (/(urgent|blocked|overdue)/i.test(status) ? "high" : "normal")),
    status: normalizeStatus(workOrder?.inboxStatus || workOrder?.inboxState, readAt),
    occurredAt: toIso(workOrder?.updatedAt || workOrder?.assignedAt || workOrder?.createdAt || workOrder?.dueAt),
    readAt,
  });
}

export function adaptContractorMessageToInboxEvent(
  message: any,
  contractorScopeContext: ContractorScopeContext
): UnifiedInboxEvent | null {
  if (!hasContractorScope(message, contractorScopeContext) || hasSensitiveValues(message)) return null;
  const stableKey = asString(message?.id || message?.messageId, "", 240);
  if (!stableKey) return null;
  if (hasUnsafeText(message?.body, message?.text, message?.summary)) return null;
  const readAt = message?.readAt ? toIso(message.readAt) : null;
  const senderRole = asString(message?.senderRole, "landlord", 40).toLowerCase();
  return makeContractorEvent({
    sourceKind: "contractor.message",
    sourceStableKey: stableKey,
    context: contractorScopeContext,
    title: senderRole === "landlord" ? "Message from landlord" : "Contractor message",
    body: asString(message?.body || message?.text || message?.summary, "You have a message update.", 1000),
    priority: normalizePriority(message?.priority),
    status: normalizeStatus(message?.status, readAt),
    occurredAt: toIso(message?.createdAt || message?.createdAtMs || message?.occurredAt),
    readAt,
  });
}
