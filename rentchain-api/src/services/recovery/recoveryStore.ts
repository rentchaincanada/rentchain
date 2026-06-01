import { db } from "../../config/firebase";
import type { OperatorRecoveryLog, RecoveryTimelineEntry } from "../../types/recovery";

type SnapshotLike = {
  exists?: boolean;
  id?: string;
  data: () => Record<string, unknown> | undefined;
};

type QuerySnapshotLike = {
  docs: SnapshotLike[];
};

type DocumentRefLike<T> = {
  get?: () => Promise<SnapshotLike>;
  create?: (data: T) => Promise<unknown>;
  set?: (data: T, options?: { merge?: boolean }) => Promise<unknown>;
};

type QueryLike = {
  where: (field: string, op: string, value: unknown) => QueryLike;
  orderBy?: (field: string, direction?: "asc" | "desc") => QueryLike;
  limit?: (count: number) => QueryLike;
  get: () => Promise<QuerySnapshotLike>;
};

type CollectionLike<T> = QueryLike & {
  doc: (id?: string) => DocumentRefLike<T>;
};

export type RecoveryFirestoreLike = {
  collection: <T = Record<string, unknown>>(name: string) => CollectionLike<T>;
};

export const OPERATOR_RECOVERY_LOGS_COLLECTION = "operatorRecoveryLogs";
export const RECOVERY_TIMELINE_COLLECTION = "canonicalRecoveryTimelineEntries";
export const DECISION_CONTINUITY_SNAPSHOTS_COLLECTION = "decisionContinuitySnapshots";

export function recoveryDb(firestore?: RecoveryFirestoreLike): RecoveryFirestoreLike {
  return firestore || (db as unknown as RecoveryFirestoreLike);
}

export async function appendDocument<T>(
  collectionName: string,
  documentId: string,
  data: T,
  firestore?: RecoveryFirestoreLike
): Promise<T> {
  const ref = recoveryDb(firestore).collection<T>(collectionName).doc(documentId);
  if (ref.create) {
    await ref.create(data);
    return data;
  }
  const existing = ref.get ? await ref.get() : null;
  if (existing?.exists) throw new Error("append_document_already_exists");
  if (!ref.set) throw new Error("append_document_unavailable");
  await ref.set(data, { merge: false });
  return data;
}

export async function loadSnapshot(
  collectionName: string,
  documentId: string,
  firestore?: RecoveryFirestoreLike
): Promise<Record<string, unknown> | null> {
  const snap = await recoveryDb(firestore).collection(collectionName).doc(documentId).get?.();
  if (!snap?.exists) return null;
  return snap.data() || null;
}

export async function queryByWorkflow(
  collectionName: string,
  workflowInstanceKey: string,
  firestore?: RecoveryFirestoreLike
): Promise<Record<string, unknown>[]> {
  const snap = await recoveryDb(firestore)
    .collection(collectionName)
    .where("workflowInstanceKey", "==", workflowInstanceKey)
    .get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
}

export function isRecoveryLog(value: Record<string, unknown>): value is OperatorRecoveryLog {
  return value.metadataOnly === true && value.appendOnly === true && typeof value.logId === "string";
}

export function isRecoveryTimelineEntry(value: Record<string, unknown>): value is RecoveryTimelineEntry {
  return value.metadataOnly === true && value.appendOnly === true && value.entryType === "RECOVERY_ACTION";
}
