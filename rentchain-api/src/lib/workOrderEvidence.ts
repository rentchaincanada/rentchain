import crypto from "crypto";
import path from "path";
import { getSignedDownloadUrl } from "./gcsSignedUrl";

export const WORK_ORDER_EVIDENCE_TYPES = [
  "before",
  "during",
  "after",
  "completion",
  "inspection",
  "damage",
  "other",
] as const;

export const WORK_ORDER_EVIDENCE_VISIBILITIES = ["internal", "landlord_contractor", "tenant_safe"] as const;

export type WorkOrderEvidenceType = (typeof WORK_ORDER_EVIDENCE_TYPES)[number];
export type WorkOrderEvidenceVisibility = (typeof WORK_ORDER_EVIDENCE_VISIBILITIES)[number];
export type WorkOrderEvidenceAudience = "landlord" | "contractor" | "tenant";

export type WorkOrderEvidenceItem = {
  id: string;
  storagePath?: string | null;
  url?: string | null;
  filename?: string | null;
  contentType?: string | null;
  uploadedAt: number;
  uploadedByActorRole: "contractor" | "landlord" | "admin";
  uploadedByActorId: string;
  evidenceType: WorkOrderEvidenceType;
  caption?: string | null;
  visibility: WorkOrderEvidenceVisibility;
};

function asString(value: unknown, max = 2000): string {
  return String(value || "").trim().slice(0, max);
}

export function normalizeEvidenceType(value: unknown): WorkOrderEvidenceType | null {
  const next = asString(value, 60).toLowerCase();
  return (WORK_ORDER_EVIDENCE_TYPES as readonly string[]).includes(next) ? (next as WorkOrderEvidenceType) : null;
}

export function normalizeEvidenceVisibility(value: unknown): WorkOrderEvidenceVisibility | null {
  const next = asString(value, 60).toLowerCase();
  return (WORK_ORDER_EVIDENCE_VISIBILITIES as readonly string[]).includes(next)
    ? (next as WorkOrderEvidenceVisibility)
    : null;
}

export function sanitizeFilename(filename: unknown) {
  const raw = asString(filename, 180);
  const base = raw || "evidence-upload";
  return base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "evidence-upload";
}

export function makeEvidenceId() {
  return crypto.randomUUID();
}

export function buildEvidenceStoragePath(params: { workOrderId: string; evidenceId: string; filename: string }) {
  const safeName = sanitizeFilename(params.filename);
  const ext = path.extname(safeName);
  const basename = safeName.slice(0, safeName.length - ext.length) || "evidence";
  return `work-orders/evidence/${params.workOrderId}/${params.evidenceId}_${basename}${ext}`;
}

export function filterEvidenceForAudience(
  items: unknown,
  audience: WorkOrderEvidenceAudience
): WorkOrderEvidenceItem[] {
  const list = Array.isArray(items) ? items : [];
  return list
    .map((entry) => {
      const evidenceType = normalizeEvidenceType((entry as any)?.evidenceType);
      const visibility = normalizeEvidenceVisibility((entry as any)?.visibility);
      const uploadedByActorRole = asString((entry as any)?.uploadedByActorRole, 40).toLowerCase();
      const uploadedAt = Number((entry as any)?.uploadedAt || 0);
      const uploadedByActorId = asString((entry as any)?.uploadedByActorId, 120);
      if (
        !evidenceType ||
        !visibility ||
        !uploadedAt ||
        !uploadedByActorId ||
        (uploadedByActorRole !== "contractor" && uploadedByActorRole !== "landlord" && uploadedByActorRole !== "admin")
      ) {
        return null;
      }
      return {
        id: asString((entry as any)?.id, 120) || makeEvidenceId(),
        storagePath: asString((entry as any)?.storagePath, 500) || null,
        filename: asString((entry as any)?.filename, 180) || null,
        contentType: asString((entry as any)?.contentType, 120) || null,
        uploadedAt,
        uploadedByActorRole,
        uploadedByActorId,
        evidenceType,
        caption: asString((entry as any)?.caption, 500) || null,
        visibility,
      } as WorkOrderEvidenceItem;
    })
    .filter((entry): entry is WorkOrderEvidenceItem => Boolean(entry))
    .filter((entry) => {
      if (audience === "landlord") return true;
      if (audience === "contractor") return entry.visibility !== "internal";
      return entry.visibility === "tenant_safe";
    })
    .sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0));
}

export async function serializeEvidenceForAudience(
  items: unknown,
  audience: WorkOrderEvidenceAudience
): Promise<Array<Omit<WorkOrderEvidenceItem, "storagePath">>> {
  const bucket = asString(process.env.GCS_UPLOAD_BUCKET, 200);
  const filtered = filterEvidenceForAudience(items, audience);
  return await Promise.all(
    filtered.map(async (entry) => {
      let url: string | null = null;
      if (bucket && entry.storagePath) {
        try {
          url = await getSignedDownloadUrl({ bucket, path: entry.storagePath, expiresMinutes: 30 });
        } catch {
          url = null;
        }
      }
      return {
        id: entry.id,
        url,
        filename: entry.filename || null,
        contentType: entry.contentType || null,
        uploadedAt: entry.uploadedAt,
        uploadedByActorRole: entry.uploadedByActorRole,
        uploadedByActorId: entry.uploadedByActorId,
        evidenceType: entry.evidenceType,
        caption: entry.caption || null,
        visibility: entry.visibility,
      };
    })
  );
}
