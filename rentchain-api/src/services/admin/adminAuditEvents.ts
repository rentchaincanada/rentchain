import { db } from "../../config/firebase";

type FirestoreLike = Pick<FirebaseFirestore.Firestore, "collection">;

export type AdminAuditEventCategory = "adminAction" | "export" | "integrity" | "savedFilter";

export type AdminAuditEventRecord = {
  id: string;
  userId: string;
  category: AdminAuditEventCategory;
  action: string;
  label: string;
  pageKey?: string | null;
  route?: string | null;
  relatedAdminPath?: string | null;
  exportType?: string | null;
  rowCount?: number | null;
  capped?: boolean | null;
  severity?: string | null;
  occurredAt: string | number;
};

type RecordInput = Omit<AdminAuditEventRecord, "id" | "occurredAt"> & {
  occurredAt?: string | number | null;
  firestore?: FirestoreLike;
};

function asTrimmedString(value: unknown) {
  return String(value || "").trim();
}

export async function recordAdminAuditEvent(input: RecordInput): Promise<void> {
  const firestore = (input.firestore || (db as any)) as FirestoreLike;
  const userId = asTrimmedString(input.userId);
  const label = asTrimmedString(input.label);
  const action = asTrimmedString(input.action);
  if (!userId || !label || !action) return;

  const occurredAt = typeof input.occurredAt === "number" || typeof input.occurredAt === "string"
    ? input.occurredAt
    : Date.now();

  await (firestore.collection("adminAuditEvents") as any).add({
    userId,
    category: input.category,
    action,
    label,
    pageKey: input.pageKey || null,
    route: input.route || null,
    relatedAdminPath: input.relatedAdminPath || null,
    exportType: input.exportType || null,
    rowCount: typeof input.rowCount === "number" ? input.rowCount : null,
    capped: typeof input.capped === "boolean" ? input.capped : null,
    severity: input.severity || null,
    occurredAt,
    createdAt: Date.now(),
  });
}
