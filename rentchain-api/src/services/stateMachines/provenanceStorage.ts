import { db } from "../../firebase";
import {
  provenanceMetadata,
  stableProvenanceHash,
  validateProvenanceIntegrity,
  workflowInstanceKey,
} from "./evidenceProvenance";
import type {
  ActorRole,
  EvidenceChain,
  ReviewWorkflowType,
  TransitionProvenanceEvent,
} from "./types";

export const PROVENANCE_EVENTS_COLLECTION = "transitionProvenanceEvents";

export type ProvenanceAuthority = {
  actorRole: ActorRole;
  actorRef?: string | null;
  landlordRef?: string | null;
  tenantRef?: string | null;
  supportAllowed?: boolean;
};

type DocSnapshotLike = {
  exists?: boolean;
  id?: string;
  data: () => Record<string, unknown> | undefined;
};

type QuerySnapshotLike = {
  docs: DocSnapshotLike[];
};

type DocumentRefLike = {
  get?: () => Promise<DocSnapshotLike>;
  set?: (data: TransitionProvenanceEvent, options?: { merge?: boolean }) => Promise<unknown>;
  create?: (data: TransitionProvenanceEvent) => Promise<unknown>;
};

type QueryLike = {
  where: (field: string, op: string, value: unknown) => QueryLike;
  orderBy?: (field: string, direction?: "asc" | "desc") => QueryLike;
  limit?: (count: number) => QueryLike;
  get: () => Promise<QuerySnapshotLike>;
};

type CollectionLike = QueryLike & {
  doc: (id?: string) => DocumentRefLike;
};

export type FirestoreLike = {
  collection: (name: string) => CollectionLike;
};

export type ProvenanceQuery = {
  workflowType?: ReviewWorkflowType;
  workflowInstanceId?: string;
  actorRole?: ActorRole;
  outcome?: "valid" | "invalid";
  from?: string;
  to?: string;
  limit?: number;
  authority: ProvenanceAuthority;
  firestore?: FirestoreLike;
};

function collection(firestore?: FirestoreLike): CollectionLike {
  return (firestore || (db as unknown as FirestoreLike)).collection(PROVENANCE_EVENTS_COLLECTION);
}

function normalizedAccessRef(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return raw.startsWith("access:") ? raw : `access:${stableProvenanceHash(raw)}`;
}

function canAccessProvenance(authority: ProvenanceAuthority, event: TransitionProvenanceEvent): boolean {
  if (authority.actorRole === "admin") return true;
  if (authority.actorRole === "support") return authority.supportAllowed === true;
  if (authority.actorRole === "landlord") {
    return Boolean(normalizedAccessRef(authority.landlordRef) && event.access.landlordRef === normalizedAccessRef(authority.landlordRef));
  }
  if (authority.actorRole === "tenant") {
    return Boolean(normalizedAccessRef(authority.tenantRef) && event.access.tenantRef === normalizedAccessRef(authority.tenantRef));
  }
  return false;
}

function eventFromSnapshot(snapshot: DocSnapshotLike): TransitionProvenanceEvent | null {
  const data = snapshot.data();
  if (!data) return null;
  const candidate = data as unknown as TransitionProvenanceEvent;
  const integrity = validateProvenanceIntegrity(candidate);
  return integrity.valid ? candidate : null;
}

function sortEvents(events: TransitionProvenanceEvent[]): TransitionProvenanceEvent[] {
  return [...events].sort((a, b) => `${a.occurredAt}:${a.eventId}`.localeCompare(`${b.occurredAt}:${b.eventId}`));
}

export async function appendProvenanceEvent(
  event: TransitionProvenanceEvent,
  options: { authority: ProvenanceAuthority; firestore?: FirestoreLike }
): Promise<TransitionProvenanceEvent> {
  if (options.authority.actorRole !== "admin" && options.authority.actorRole !== "landlord" && options.authority.actorRole !== "system") {
    throw new Error("provenance_append_forbidden");
  }
  const integrity = validateProvenanceIntegrity(event);
  if (!integrity.valid) throw new Error(integrity.reason || "provenance_integrity_failed");
  if (options.authority.actorRole === "landlord" && !canAccessProvenance(options.authority, event)) {
    throw new Error("provenance_append_forbidden");
  }
  const ref = collection(options.firestore).doc(event.eventId);
  if (ref.create) {
    await ref.create(event);
    return event;
  }
  const existing = ref.get ? await ref.get() : null;
  if (existing?.exists) throw new Error("provenance_event_already_exists");
  if (!ref.set) throw new Error("provenance_storage_unavailable");
  await ref.set(event, { merge: false });
  return event;
}

export async function getProvenanceEvent(
  eventId: string,
  options: { authority: ProvenanceAuthority; firestore?: FirestoreLike }
): Promise<TransitionProvenanceEvent | null> {
  const snap = await collection(options.firestore).doc(eventId).get?.();
  if (!snap?.exists) return null;
  const event = eventFromSnapshot(snap);
  if (!event || !canAccessProvenance(options.authority, event)) return null;
  return event;
}

export async function getProvenanceChain(input: {
  workflowType: ReviewWorkflowType;
  workflowInstanceId: string;
  authority: ProvenanceAuthority;
  firestore?: FirestoreLike;
}): Promise<EvidenceChain> {
  const instanceKey = workflowInstanceKey(input.workflowType, input.workflowInstanceId);
  let query = collection(input.firestore)
    .where("workflowType", "==", input.workflowType)
    .where("workflowInstanceKey", "==", instanceKey);
  if (query.orderBy) query = query.orderBy("occurredAt", "asc");
  const snap = await query.get();
  const events = sortEvents(
    snap.docs
      .map(eventFromSnapshot)
      .filter((event): event is TransitionProvenanceEvent => Boolean(event))
      .filter((event) => canAccessProvenance(input.authority, event))
  );
  return {
    workflowType: input.workflowType,
    workflowInstanceKey: instanceKey,
    events,
    metadata: provenanceMetadata(),
  };
}

export async function queryProvenanceEvents(input: ProvenanceQuery): Promise<TransitionProvenanceEvent[]> {
  let query = collection(input.firestore) as QueryLike;
  if (input.workflowType) query = query.where("workflowType", "==", input.workflowType);
  if (input.workflowInstanceId && input.workflowType) {
    query = query.where("workflowInstanceKey", "==", workflowInstanceKey(input.workflowType, input.workflowInstanceId));
  }
  if (query.orderBy) query = query.orderBy("occurredAt", "asc");
  if (query.limit) query = query.limit(Math.min(Math.max(input.limit || 100, 1), 500));
  const snap = await query.get();
  const from = input.from ? Date.parse(input.from) : null;
  const to = input.to ? Date.parse(input.to) : null;
  return sortEvents(
    snap.docs
      .map(eventFromSnapshot)
      .filter((event): event is TransitionProvenanceEvent => Boolean(event))
      .filter((event) => canAccessProvenance(input.authority, event))
      .filter((event) => !input.actorRole || event.actor.actorRole === input.actorRole)
      .filter((event) => !input.outcome || event.transition.outcome === input.outcome)
      .filter((event) => {
        const occurred = Date.parse(event.occurredAt);
        if (from != null && Number.isFinite(from) && occurred < from) return false;
        if (to != null && Number.isFinite(to) && occurred > to) return false;
        return true;
      })
  );
}
