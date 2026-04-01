import { db } from "../../config/firebase";

type FirestoreLike = Pick<FirebaseFirestore.Firestore, "collection">;
type AuditDoc = { id: string; raw: Record<string, unknown> };

export type AdminAuditView = {
  summary: {
    recentAdminActions: number;
    recentExports: number;
    recentIntegrityEvents: number;
    recentSavedFilterActions: number;
  };
  sections: {
    adminActions: Array<{
      id: string;
      type: string;
      label: string;
      pageKey?: string | null;
      route?: string | null;
      occurredAt: string | number | null;
      relatedAdminPath?: string | null;
    }>;
    exports: Array<{
      id: string;
      exportType: string;
      label: string;
      rowCount?: number | null;
      capped?: boolean | null;
      occurredAt: string | number | null;
      relatedAdminPath?: string | null;
    }>;
    integrityEvents: Array<{
      id: string;
      severity?: string | null;
      label: string;
      eventType?: string | null;
      occurredAt: string | number | null;
      relatedAdminPath?: string | null;
    }>;
    savedFilterActions: Array<{
      id: string;
      action: string;
      pageKey?: string | null;
      label: string;
      occurredAt: string | number | null;
      relatedAdminPath?: string | null;
    }>;
  };
};

const MAX_PER_SECTION = 25;

function asTrimmedString(value: unknown) {
  return String(value || "").trim();
}

function asNullableString(value: unknown) {
  const next = asTrimmedString(value);
  return next || null;
}

function normalizeTs(value: unknown): string | number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") return value.trim() || null;
  return null;
}

export async function loadAdminAudit(options?: { firestore?: FirestoreLike }): Promise<AdminAuditView> {
  const firestore = (options?.firestore || (db as any)) as FirestoreLike;
  const snap = await firestore.collection("adminAuditEvents").get().catch(() => ({ docs: [] } as any));
  const docs: AuditDoc[] = (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, raw: (doc.data() || {}) as Record<string, unknown> }))
    .sort((a: AuditDoc, b: AuditDoc) => {
      const aTs = Number(normalizeTs(a.raw.occurredAt ?? a.raw.createdAt) || 0);
      const bTs = Number(normalizeTs(b.raw.occurredAt ?? b.raw.createdAt) || 0);
      return bTs - aTs;
    });

  const adminActions = docs
    .filter((doc) => asTrimmedString(doc.raw.category) === "adminAction")
    .slice(0, MAX_PER_SECTION)
    .map((doc) => ({
      id: doc.id,
      type: asTrimmedString(doc.raw.action) || "admin_action",
      label: asTrimmedString(doc.raw.label) || "Admin action",
      pageKey: asNullableString(doc.raw.pageKey),
      route: asNullableString(doc.raw.route),
      occurredAt: normalizeTs(doc.raw.occurredAt ?? doc.raw.createdAt),
      relatedAdminPath: asNullableString(doc.raw.relatedAdminPath),
    }));

  const exports = docs
    .filter((doc) => asTrimmedString(doc.raw.category) === "export")
    .slice(0, MAX_PER_SECTION)
    .map((doc) => ({
      id: doc.id,
      exportType: asTrimmedString(doc.raw.exportType) || "unknown",
      label: asTrimmedString(doc.raw.label) || "Admin export",
      rowCount: typeof doc.raw.rowCount === "number" ? (doc.raw.rowCount as number) : null,
      capped: typeof doc.raw.capped === "boolean" ? (doc.raw.capped as boolean) : null,
      occurredAt: normalizeTs(doc.raw.occurredAt ?? doc.raw.createdAt),
      relatedAdminPath: asNullableString(doc.raw.relatedAdminPath),
    }));

  const integrityEvents = docs
    .filter((doc) => asTrimmedString(doc.raw.category) === "integrity")
    .slice(0, MAX_PER_SECTION)
    .map((doc) => ({
      id: doc.id,
      severity: asNullableString(doc.raw.severity),
      label: asTrimmedString(doc.raw.label) || "Integrity event",
      eventType: asNullableString(doc.raw.action),
      occurredAt: normalizeTs(doc.raw.occurredAt ?? doc.raw.createdAt),
      relatedAdminPath: asNullableString(doc.raw.relatedAdminPath),
    }));

  const savedFilterActions = docs
    .filter((doc) => asTrimmedString(doc.raw.category) === "savedFilter")
    .slice(0, MAX_PER_SECTION)
    .map((doc) => ({
      id: doc.id,
      action: asTrimmedString(doc.raw.action) || "saved_filter",
      pageKey: asNullableString(doc.raw.pageKey),
      label: asTrimmedString(doc.raw.label) || "Saved filter activity",
      occurredAt: normalizeTs(doc.raw.occurredAt ?? doc.raw.createdAt),
      relatedAdminPath: asNullableString(doc.raw.relatedAdminPath),
    }));

  return {
    summary: {
      recentAdminActions: adminActions.length,
      recentExports: exports.length,
      recentIntegrityEvents: integrityEvents.length,
      recentSavedFilterActions: savedFilterActions.length,
    },
    sections: {
      adminActions,
      exports,
      integrityEvents,
      savedFilterActions,
    },
  };
}
