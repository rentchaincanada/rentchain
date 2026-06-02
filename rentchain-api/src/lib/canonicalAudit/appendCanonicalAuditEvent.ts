import crypto from "crypto";
import { db } from "../../config/firebase";
import { CANONICAL_EVENTS_COLLECTION } from "../events/buildEvent";
import type {
  CanonicalAuditActor,
  CanonicalAuditAuthority,
  CanonicalAuditEvent,
  CanonicalAuditEventMetadata,
  CanonicalAuditEventType,
} from "../../types/canonicalAuditEvent";

type SnapshotLike = {
  exists?: boolean;
  data: () => Record<string, unknown> | undefined;
};

type DocumentRefLike<T> = {
  get?: () => Promise<SnapshotLike>;
  create?: (data: T) => Promise<unknown>;
  set?: (data: T, options?: { merge?: boolean }) => Promise<unknown>;
};

type CollectionLike<T> = {
  doc: (id: string) => DocumentRefLike<T>;
};

export type CanonicalAuditFirestoreLike = {
  collection: <T = Record<string, unknown>>(name: string) => CollectionLike<T>;
};

export type AppendCanonicalAuditEventInput = {
  eventType: CanonicalAuditEventType;
  actor: CanonicalAuditActor;
  authority: CanonicalAuditAuthority;
  sourceReferenceId: string;
  metadata: CanonicalAuditEventMetadata;
  timestamp?: string;
  visibility?: CanonicalAuditEvent["visibility"];
};

type AppendCanonicalAuditEventOptions = {
  firestore?: CanonicalAuditFirestoreLike;
};

function toSafeText(value: unknown, max = 1000): string {
  return String(value ?? "").trim().slice(0, max);
}

function toUtcIso(value: unknown): string {
  const raw = toSafeText(value, 120);
  if (!raw) return new Date().toISOString();
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function stableHash(parts: readonly unknown[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 32);
}

export function safeAuditReference(prefix: string, value: unknown): string {
  const cleanPrefix = toSafeText(prefix, 80).toLowerCase().replace(/[^a-z0-9_.:-]+/g, "_") || "ref";
  const raw = toSafeText(value, 1000) || "unknown";
  return `${cleanPrefix}:${stableHash([cleanPrefix, raw])}`;
}

function eventIdFor(input: {
  eventType: CanonicalAuditEventType;
  sourceReferenceId: string;
  timestamp: string;
  actor: CanonicalAuditActor;
  metadata: CanonicalAuditEventMetadata;
}): string {
  return `canonical_audit:${stableHash([
    input.eventType,
    input.sourceReferenceId,
    input.timestamp,
    input.actor.role,
    input.actor.operatorRef,
    input.metadata,
  ])}`;
}

function canonicalAuditDb(firestore?: CanonicalAuditFirestoreLike): CanonicalAuditFirestoreLike {
  return firestore || (db as unknown as CanonicalAuditFirestoreLike);
}

/**
 * Appends one immutable canonical audit event to the existing canonicalEvents collection.
 * The write uses create() when available so existing audit documents cannot be overwritten.
 */
export async function appendCanonicalAuditEvent(
  input: AppendCanonicalAuditEventInput,
  options: AppendCanonicalAuditEventOptions = {}
): Promise<CanonicalAuditEvent> {
  const timestamp = toUtcIso(input.timestamp);
  const sourceReferenceId = safeAuditReference("audit_source", input.sourceReferenceId);
  const event: CanonicalAuditEvent = {
    eventId: eventIdFor({
      eventType: input.eventType,
      sourceReferenceId,
      timestamp,
      actor: input.actor,
      metadata: input.metadata,
    }),
    eventType: input.eventType,
    timestamp,
    actor: {
      role: input.actor.role,
      operatorRef: input.actor.operatorRef ? safeAuditReference("operator", input.actor.operatorRef) : null,
      rawIdsIncluded: false,
    },
    authority: {
      role: input.authority.role,
      landlordRef: input.authority.landlordRef ? safeAuditReference("landlord", input.authority.landlordRef) : null,
      supportAllowed: input.authority.supportAllowed,
      rawIdsIncluded: false,
    },
    sourceReferenceId,
    metadata: input.metadata,
    sourceCollection: CANONICAL_EVENTS_COLLECTION,
    visibility: input.visibility || "admin_support_internal",
    metadataOnly: true,
    appendOnly: true,
    immutable: true,
    rawIdsIncluded: false,
    redactionSummary: "Raw actor, workflow, tenant, landlord, and data-store identifiers are replaced with safe references.",
  };

  const ref = canonicalAuditDb(options.firestore).collection<CanonicalAuditEvent>(CANONICAL_EVENTS_COLLECTION).doc(event.eventId);
  if (ref.create) {
    await ref.create(event);
    return event;
  }
  const existing = ref.get ? await ref.get() : null;
  if (existing?.exists) throw new Error("canonical_audit_event_already_exists");
  if (!ref.set) throw new Error("canonical_audit_event_append_unavailable");
  await ref.set(event, { merge: false });
  return event;
}

/**
 * Emits a canonical audit event without failing the caller if audit storage is unavailable.
 */
export async function appendCanonicalAuditEventSafely(
  input: AppendCanonicalAuditEventInput,
  options: AppendCanonicalAuditEventOptions = {}
): Promise<CanonicalAuditEvent | null> {
  try {
    return await appendCanonicalAuditEvent(input, options);
  } catch (error) {
    console.warn("[canonical-audit] append skipped", { message: error instanceof Error ? error.message : "failed" });
    return null;
  }
}
