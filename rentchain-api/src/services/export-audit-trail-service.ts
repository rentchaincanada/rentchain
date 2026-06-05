import crypto from "crypto";
import { db } from "../firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../lib/events/buildEvent";
import type { ExportAuthorizationContext } from "../types/export-authorization-types";
import type { ExportAuthorizationDecision } from "../types/export-authorization-types";
import type {
  ExportAuditActorRole,
  ExportAuditEventPayload,
  ExportAuditEventSafeReference,
  ExportAuditEventType,
  ExportAuditTargetType,
  ExportAuditTrailResponse,
} from "../types/export-audit-types";
import type { ExportPackage } from "../types/export-package-types";
import type { ExportProfile } from "../types/export-profile-types";
import type { ExportRequest } from "../types/export-request-types";

type SnapshotLike<T> = {
  exists?: boolean;
  data: () => T | undefined;
};

type QuerySnapshotLike<T> = {
  docs?: Array<{
    data: () => T;
  }>;
};

type DocumentRefLike<T> = {
  get?: () => Promise<SnapshotLike<T>>;
  create?: (data: T) => Promise<unknown>;
  set?: (data: T, options?: { merge?: boolean }) => Promise<unknown>;
};

type CollectionLike<T> = {
  doc: (id: string) => DocumentRefLike<T>;
  where?: (fieldPath: string, opStr: string, value: unknown) => QueryLike<T>;
  orderBy?: (fieldPath: string, directionStr?: "asc" | "desc") => QueryLike<T>;
  limit?: (limit: number) => QueryLike<T>;
  get?: () => Promise<QuerySnapshotLike<T>>;
};

type QueryLike<T> = {
  where?: (fieldPath: string, opStr: string, value: unknown) => QueryLike<T>;
  orderBy?: (fieldPath: string, directionStr?: "asc" | "desc") => QueryLike<T>;
  limit?: (limit: number) => QueryLike<T>;
  get: () => Promise<QuerySnapshotLike<T>>;
};

export type ExportAuditTrailFirestoreLike = {
  collection: <T = Record<string, unknown>>(name: string) => CollectionLike<T>;
};

export type AppendExportAuditEventInput = {
  eventType: ExportAuditEventType;
  targetType: ExportAuditTargetType;
  targetId: string;
  landlordId: string;
  context: ExportAuthorizationContext;
  eventSummary: string;
  statusSummary: string;
  reason?: string | null;
  details?: Record<string, string | number | boolean | null>;
  timestamp?: string;
  visibility?: ExportAuditEventPayload["visibility"];
};

export type ExportAuditTrailQuery = {
  landlordId: string;
  targetType?: ExportAuditTargetType;
  targetId?: string;
  eventType?: ExportAuditEventType;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  limit?: number;
};

const RESTRICTED_AUDIT_CONTENT =
  /token|secret|credential|password|bearer|provider payload|raw report|request body|response body|gs:\/\/|storage\.googleapis\.com|bank account|card number|tenant-id|landlord-id|lease-id|unit-id|firestore/i;

function stableHash(value: unknown, length = 32): string {
  return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, length);
}

function safeText(value: unknown, max = 500): string {
  return String(value ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

function toUtcIso(value: unknown): string {
  const raw = safeText(value, 120);
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function auditDb(firestore?: ExportAuditTrailFirestoreLike): ExportAuditTrailFirestoreLike {
  return firestore || (db as unknown as ExportAuditTrailFirestoreLike);
}

export function generateExportAuditSafeReference(prefix: string, value: unknown): string {
  const cleanPrefix = safeText(prefix, 80).toLowerCase().replace(/[^a-z0-9_.:-]+/g, "_") || "export_audit";
  return `${cleanPrefix}:${stableHash([cleanPrefix, value], 20)}`;
}

export function generateExportAuditEventId(input: {
  eventType: ExportAuditEventType;
  timestamp: string;
  landlordId: string;
  targetType: ExportAuditTargetType;
  targetId: string;
  actorId: string;
}): string {
  return `export_audit:${stableHash([
    input.eventType,
    input.timestamp,
    input.landlordId,
    input.targetType,
    input.targetId,
    input.actorId,
  ])}`;
}

function validateSafeDetails(details: Record<string, string | number | boolean | null>): void {
  if (RESTRICTED_AUDIT_CONTENT.test(JSON.stringify(details))) {
    throw new Error("export_audit_details_unsafe");
  }
}

export function createExportAuditEventPayload(input: AppendExportAuditEventInput): ExportAuditEventPayload {
  if (!input.context.requestingActorId || input.context.rawIdsIncluded !== false) {
    throw new Error("export_audit_context_invalid");
  }
  if (input.context.requestingActorScope !== input.landlordId && input.context.requestingActorRole !== "SystemService") {
    throw new Error("export_audit_landlord_scope_mismatch");
  }
  const timestamp = toUtcIso(input.timestamp || input.context.timestamp);
  const details = input.details || {};
  validateSafeDetails(details);
  const eventId = generateExportAuditEventId({
    eventType: input.eventType,
    timestamp,
    landlordId: input.landlordId,
    targetType: input.targetType,
    targetId: input.targetId,
    actorId: input.context.requestingActorId,
  });
  const targetReferenceId = generateExportAuditSafeReference(input.targetType, input.targetId);
  const landlordReferenceId = generateExportAuditSafeReference("landlord", input.landlordId);
  return {
    eventId,
    eventType: input.eventType,
    timestamp,
    actor: {
      role: input.context.requestingActorRole as ExportAuditActorRole,
      operatorRef: generateExportAuditSafeReference("actor", input.context.requestingActorId),
      rawIdsIncluded: false,
    },
    authority: {
      role: input.context.requestingActorRole as ExportAuditActorRole,
      landlordRef: landlordReferenceId,
      supportAllowed: input.context.requestingActorRole === "AdminSupport",
      rawIdsIncluded: false,
    },
    sourceReferenceId: targetReferenceId,
    targetType: input.targetType,
    targetReferenceId,
    landlordReferenceId,
    metadata: {
      eventSummary: safeText(input.eventSummary, 240),
      statusSummary: safeText(input.statusSummary, 160),
      reason: input.reason ? safeText(input.reason, 240) : null,
      details,
      metadataOnly: true,
      rawIdsIncluded: false,
      payloadIncluded: false,
    },
    sourceCollection: CANONICAL_EVENTS_COLLECTION,
    visibility: input.visibility || "landlord_operator_internal",
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    payloadIncluded: false,
    redactionSummary:
      "Export audit trail is metadata-only. Sensitive identifiers and source material are represented as safe references.",
  };
}

export function projectExportAuditEvent(event: ExportAuditEventPayload): ExportAuditEventSafeReference {
  return {
    auditEventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.timestamp,
    actor: {
      actorRef: event.actor.operatorRef,
      actorRole: event.actor.role,
      rawIdsIncluded: false,
    },
    target: {
      targetRef: event.targetReferenceId,
      targetType: event.targetType,
      rawIdsIncluded: false,
    },
    landlordRef: event.landlordReferenceId,
    statusSummary: event.metadata.statusSummary,
    reason: event.metadata.reason,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export function projectExportAuditTrailResponse(event: ExportAuditEventPayload): ExportAuditTrailResponse {
  const projected = projectExportAuditEvent(event);
  return {
    auditEventId: projected.auditEventId,
    eventType: projected.eventType,
    timestamp: projected.timestamp,
    actor: projected.actor,
    targetType: projected.target.targetType,
    targetId: projected.target.targetRef,
    reason: projected.reason,
    eventSummary: event.metadata.eventSummary,
    auditTimestamp: event.timestamp,
    rawIdsIncluded: false,
    payloadIncluded: false,
  };
}

export async function appendAuditEvent(
  input: AppendExportAuditEventInput,
  options: { firestore?: ExportAuditTrailFirestoreLike } = {}
): Promise<ExportAuditEventPayload> {
  const event = createExportAuditEventPayload(input);
  const ref = auditDb(options.firestore).collection<ExportAuditEventPayload>(CANONICAL_EVENTS_COLLECTION).doc(event.eventId);
  if (ref.create) {
    await ref.create(event);
    return event;
  }
  const existing = ref.get ? await ref.get() : null;
  if (existing?.exists) throw new Error("export_audit_event_already_exists");
  if (!ref.set) throw new Error("export_audit_event_append_unavailable");
  await ref.set(event, { merge: false });
  return event;
}

export async function appendAuditEventSafely(
  input: AppendExportAuditEventInput,
  options: { firestore?: ExportAuditTrailFirestoreLike } = {}
): Promise<ExportAuditEventPayload | null> {
  try {
    return await appendAuditEvent(input, options);
  } catch (error) {
    console.warn("[export-audit] append skipped", { message: error instanceof Error ? error.message : "failed" });
    return null;
  }
}

export async function appendExportProfileAuditEvent(
  profile: ExportProfile,
  eventType: Extract<ExportAuditEventType, "ExportProfileCreated" | "ExportProfileModified" | "ExportProfileArchived">,
  context: ExportAuthorizationContext,
  options: { firestore?: ExportAuditTrailFirestoreLike; reason?: string | null } = {}
): Promise<ExportAuditEventPayload | null> {
  return appendAuditEventSafely(
    {
      eventType,
      targetType: "ExportProfile",
      targetId: profile.exportProfileId,
      landlordId: profile.landlordId,
      context,
      eventSummary: `Export profile ${eventType.replace("ExportProfile", "").toLowerCase()}.`,
      statusSummary: profile.isActive ? "active" : "archived",
      reason: options.reason || profile.createdReason,
      details: {
        recipientType: profile.recipientType,
        purpose: profile.purpose,
        approvedEvidenceClassCount: profile.approvedEvidenceClasses.length,
        dataMinimizationLevel: profile.dataMinimizationLevel,
        metadataOnly: true,
      },
    },
    { firestore: options.firestore }
  );
}

export async function appendExportRequestAuthorizationAuditEvent(
  request: ExportRequest,
  decision: ExportAuthorizationDecision,
  context: ExportAuthorizationContext,
  options: { firestore?: ExportAuditTrailFirestoreLike } = {}
): Promise<ExportAuditEventPayload | null> {
  return appendAuditEventSafely(
    {
      eventType: decision.isApproved ? "ExportRequestAuthorized" : "ExportRequestDenied",
      targetType: "ExportRequest",
      targetId: request.exportRequestId,
      landlordId: request.landlordId,
      context,
      eventSummary: decision.isApproved ? "Export request authorized." : "Export request denied.",
      statusSummary: decision.decision,
      reason: decision.denialReason || request.requestReason,
      details: {
        authorizationDecision: decision.decision,
        policyRuleName: decision.policyRuleName,
        redactionOverrideApplied: Boolean(request.redactionPolicyOverride),
        metadataOnly: true,
      },
    },
    { firestore: options.firestore }
  );
}

export async function appendExportPackageLifecycleAuditEvent(
  pkg: ExportPackage,
  eventType: Extract<
    ExportAuditEventType,
    | "ExportPackageAssembled"
    | "ExportPackageSigned"
    | "ExportPackageSignatureRequested"
    | "ExportPackageSignatureGenerated"
    | "ExportPackageSignatureVerified"
    | "ExportPackageAttestationLinked"
    | "ExportPackageAttestationRevoked"
    | "ExportPackageDelivered"
    | "ExportPackageArchived"
    | "ExportPackageRevoked"
  >,
  context: ExportAuthorizationContext,
  options: { firestore?: ExportAuditTrailFirestoreLike; reason?: string | null } = {}
): Promise<ExportAuditEventPayload | null> {
  return appendAuditEventSafely(
    {
      eventType,
      targetType: "ExportPackage",
      targetId: pkg.exportPackageId,
      landlordId: pkg.landlordId,
      context,
      eventSummary: `Export package ${eventType.replace("ExportPackage", "").toLowerCase()}.`,
      statusSummary: pkg.status,
      reason: options.reason || null,
      details: {
        exportRequestRef: pkg.exportRequestId,
        evidenceCount: pkg.packageMetadata.includedEvidenceCount,
        checksumReference: pkg.packageMetadata.checksumValue ? `checksum:${pkg.packageMetadata.checksumValue.slice(0, 20)}` : null,
        signaturePresent: pkg.signatureMetadata?.isSigned === true,
        deliveryMethod: pkg.deliveryMetadata?.deliveryMethod || null,
        metadataOnly: true,
      },
    },
    { firestore: options.firestore }
  );
}

function queryMatchesDate(event: ExportAuditEventPayload, query: ExportAuditTrailQuery): boolean {
  const timestamp = Date.parse(event.timestamp);
  const start = query.dateRangeStart ? Date.parse(query.dateRangeStart) : null;
  const end = query.dateRangeEnd ? Date.parse(query.dateRangeEnd) : null;
  if (!Number.isFinite(timestamp)) return false;
  if (start !== null && Number.isFinite(start) && timestamp < start) return false;
  if (end !== null && Number.isFinite(end) && timestamp > end) return false;
  return true;
}

async function queryAuditTrail(
  query: ExportAuditTrailQuery,
  options: { firestore?: ExportAuditTrailFirestoreLike } = {}
): Promise<ExportAuditTrailResponse[]> {
  if (!query.landlordId) throw new Error("export_audit_landlord_scope_required");
  const landlordReferenceId = generateExportAuditSafeReference("landlord", query.landlordId);
  const collection = auditDb(options.firestore).collection<ExportAuditEventPayload>(CANONICAL_EVENTS_COLLECTION);
  let auditQuery = collection.where?.("landlordReferenceId", "==", landlordReferenceId);
  if (query.targetType) auditQuery = auditQuery?.where?.("targetType", "==", query.targetType);
  if (query.targetId) auditQuery = auditQuery?.where?.("targetReferenceId", "==", generateExportAuditSafeReference(query.targetType || "ExportTarget", query.targetId));
  if (query.eventType) auditQuery = auditQuery?.where?.("eventType", "==", query.eventType);
  auditQuery = auditQuery?.orderBy?.("timestamp", "asc") || auditQuery;
  auditQuery = auditQuery?.limit?.(query.limit || 100) || auditQuery;
  if (!auditQuery?.get) throw new Error("export_audit_query_unavailable");
  const snapshot = await auditQuery.get();
  return (snapshot.docs || [])
    .map((doc) => doc.data())
    .filter((event) => event.landlordReferenceId === landlordReferenceId)
    .filter((event) => queryMatchesDate(event, query))
    .map(projectExportAuditTrailResponse);
}

export async function getAuditTrailForPackage(
  landlordId: string,
  exportPackageId: string,
  options: { firestore?: ExportAuditTrailFirestoreLike } = {}
): Promise<ExportAuditTrailResponse[]> {
  return queryAuditTrail({ landlordId, targetType: "ExportPackage", targetId: exportPackageId }, options);
}

export async function getAuditTrailForRequest(
  landlordId: string,
  exportRequestId: string,
  options: { firestore?: ExportAuditTrailFirestoreLike } = {}
): Promise<ExportAuditTrailResponse[]> {
  return queryAuditTrail({ landlordId, targetType: "ExportRequest", targetId: exportRequestId }, options);
}

export async function getAuditTrailForProfile(
  landlordId: string,
  exportProfileId: string,
  options: { firestore?: ExportAuditTrailFirestoreLike } = {}
): Promise<ExportAuditTrailResponse[]> {
  return queryAuditTrail({ landlordId, targetType: "ExportProfile", targetId: exportProfileId }, options);
}

export async function getExportAuditTrail(
  query: ExportAuditTrailQuery,
  options: { firestore?: ExportAuditTrailFirestoreLike } = {}
): Promise<ExportAuditTrailResponse[]> {
  return queryAuditTrail(query, options);
}
