import { getSignedDownloadUrl } from "./gcsSignedUrl";
import { sanitizeFilename } from "./workOrderEvidence";

export const WORK_ORDER_COST_REVIEW_STATUSES = ["pending_review", "approved", "rejected", "revision_requested"] as const;
export const WORK_ORDER_COST_LINE_ITEM_CATEGORIES = ["labor", "materials", "inspection", "other"] as const;
export const WORK_ORDER_COST_ATTACHMENT_VISIBILITIES = ["internal", "landlord_only"] as const;
export const WORK_ORDER_COST_LINK_STATUSES = ["not_linked", "linked"] as const;

export type WorkOrderCostReviewStatus = (typeof WORK_ORDER_COST_REVIEW_STATUSES)[number];
export type WorkOrderCostLineItemCategory = (typeof WORK_ORDER_COST_LINE_ITEM_CATEGORIES)[number];
export type WorkOrderCostAttachmentVisibility = (typeof WORK_ORDER_COST_ATTACHMENT_VISIBILITIES)[number];
export type WorkOrderCostLinkStatus = (typeof WORK_ORDER_COST_LINK_STATUSES)[number];
export type WorkOrderCostAttachmentAudience = "landlord" | "contractor";

export type WorkOrderCost = {
  estimatedCostCents?: number | null;
  actualCostCents?: number | null;
  currency?: string | null;
  submittedByRole?: "contractor" | "landlord" | "admin" | null;
  submittedById?: string | null;
  submittedAt?: number | null;
  reviewedBy?: string | null;
  reviewedAt?: number | null;
  reviewStatus?: WorkOrderCostReviewStatus | null;
  reviewNote?: string | null;
  revisionRequestedAt?: number | null;
  revisionRequestedBy?: string | null;
  latestRevisionNumber?: number | null;
  linkedExpenseId?: string | null;
  linkedExpenseStatus?: WorkOrderCostLinkStatus | null;
};

export type WorkOrderCostReviewHistoryEntry = {
  id: string;
  revisionNumber: number;
  submittedAt: number;
  submittedByRole: "contractor" | "landlord" | "admin";
  submittedById: string;
  actualCostCents: number;
  currency?: string | null;
  reviewStatus: WorkOrderCostReviewStatus;
  reviewedAt?: number | null;
  reviewedBy?: string | null;
  reviewNote?: string | null;
  linkedExpenseId?: string | null;
};

export type WorkOrderExpenseLink = {
  expenseId?: string | null;
  linkedAt?: number | null;
  linkedBy?: string | null;
  status?: WorkOrderCostLinkStatus | null;
};

export type WorkOrderCostLineItem = {
  id: string;
  label: string;
  amountCents: number;
  category?: WorkOrderCostLineItemCategory;
};

export type WorkOrderCostAttachment = {
  id: string;
  storagePath?: string | null;
  url?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  uploadedAt: number;
  uploadedByRole: "contractor" | "landlord" | "admin";
  uploadedById: string;
  visibility: WorkOrderCostAttachmentVisibility;
};

function asString(value: unknown, max = 2000): string {
  return String(value || "").trim().slice(0, max);
}

function asOptionalString(value: unknown, max = 2000) {
  const next = asString(value, max);
  return next || null;
}

function asPositiveCents(value: unknown): number | null {
  if (value == null || value === "") return null;
  const next = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(next) || next <= 0) return null;
  return Math.round(next);
}

export function normalizeCostCurrency(value: unknown) {
  const next = asString(value, 8).toUpperCase();
  if (!next) return null;
  return /^[A-Z]{3}$/.test(next) ? next : null;
}

export function normalizeCostReviewStatus(value: unknown): WorkOrderCostReviewStatus | null {
  const next = asString(value, 40).toLowerCase();
  return (WORK_ORDER_COST_REVIEW_STATUSES as readonly string[]).includes(next)
    ? (next as WorkOrderCostReviewStatus)
    : null;
}

export function normalizeCostLineItemCategory(value: unknown): WorkOrderCostLineItemCategory | null {
  const next = asString(value, 40).toLowerCase();
  return (WORK_ORDER_COST_LINE_ITEM_CATEGORIES as readonly string[]).includes(next)
    ? (next as WorkOrderCostLineItemCategory)
    : null;
}

export function normalizeCostAttachmentVisibility(value: unknown): WorkOrderCostAttachmentVisibility | null {
  const next = asString(value, 40).toLowerCase();
  return (WORK_ORDER_COST_ATTACHMENT_VISIBILITIES as readonly string[]).includes(next)
    ? (next as WorkOrderCostAttachmentVisibility)
    : null;
}

export function normalizeCostLinkStatus(value: unknown): WorkOrderCostLinkStatus | null {
  const next = asString(value, 40).toLowerCase();
  return (WORK_ORDER_COST_LINK_STATUSES as readonly string[]).includes(next) ? (next as WorkOrderCostLinkStatus) : null;
}

export function normalizeCostLineItems(value: unknown): WorkOrderCostLineItem[] {
  if (!Array.isArray(value)) return [];
  const normalized: WorkOrderCostLineItem[] = [];
  value.forEach((entry, index) => {
    const label = asString((entry as any)?.label, 160);
    const amountCents = asPositiveCents((entry as any)?.amountCents);
    if (!label || !amountCents) return;
    normalized.push({
      id: asString((entry as any)?.id, 120) || `line_${index + 1}`,
      label,
      amountCents,
      category: normalizeCostLineItemCategory((entry as any)?.category) || "other",
    });
  });
  return normalized;
}

export function normalizeWorkOrderCost(value: unknown): WorkOrderCost | null {
  if (!value || typeof value !== "object") return null;
  const cost = value as any;
  return {
    estimatedCostCents: asPositiveCents(cost.estimatedCostCents),
    actualCostCents: asPositiveCents(cost.actualCostCents),
    currency: normalizeCostCurrency(cost.currency),
    submittedByRole:
      cost.submittedByRole === "contractor" || cost.submittedByRole === "landlord" || cost.submittedByRole === "admin"
        ? cost.submittedByRole
        : null,
    submittedById: asOptionalString(cost.submittedById, 120),
    submittedAt: typeof cost.submittedAt === "number" ? cost.submittedAt : null,
    reviewedBy: asOptionalString(cost.reviewedBy, 120),
    reviewedAt: typeof cost.reviewedAt === "number" ? cost.reviewedAt : null,
    reviewStatus: normalizeCostReviewStatus(cost.reviewStatus),
    reviewNote: asOptionalString(cost.reviewNote, 1000),
    revisionRequestedAt: typeof cost.revisionRequestedAt === "number" ? cost.revisionRequestedAt : null,
    revisionRequestedBy: asOptionalString(cost.revisionRequestedBy, 120),
    latestRevisionNumber:
      typeof cost.latestRevisionNumber === "number" && Number.isFinite(cost.latestRevisionNumber) && cost.latestRevisionNumber > 0
        ? Math.round(cost.latestRevisionNumber)
        : null,
    linkedExpenseId: asOptionalString(cost.linkedExpenseId, 120),
    linkedExpenseStatus: normalizeCostLinkStatus(cost.linkedExpenseStatus) || "not_linked",
  };
}

export function normalizeCostReviewHistory(value: unknown): WorkOrderCostReviewHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  const normalized: WorkOrderCostReviewHistoryEntry[] = [];
  value.forEach((entry, index) => {
    const submittedAt = typeof (entry as any)?.submittedAt === "number" ? Math.round((entry as any).submittedAt) : 0;
    const actualCostCents = asPositiveCents((entry as any)?.actualCostCents);
    const submittedById = asOptionalString((entry as any)?.submittedById, 120);
    const submittedByRole = asString((entry as any)?.submittedByRole, 40).toLowerCase();
    const reviewStatus = normalizeCostReviewStatus((entry as any)?.reviewStatus);
    if (
      !submittedAt ||
      !actualCostCents ||
      !submittedById ||
      !reviewStatus ||
      (submittedByRole !== "contractor" && submittedByRole !== "landlord" && submittedByRole !== "admin")
    ) {
      return;
    }
    normalized.push({
      id: asString((entry as any)?.id, 120) || `cost_history_${index + 1}`,
      revisionNumber:
        typeof (entry as any)?.revisionNumber === "number" && Number.isFinite((entry as any).revisionNumber)
          ? Math.max(1, Math.round((entry as any).revisionNumber))
          : index + 1,
      submittedAt,
      submittedByRole: submittedByRole as "contractor" | "landlord" | "admin",
      submittedById,
      actualCostCents,
      currency: normalizeCostCurrency((entry as any)?.currency),
      reviewStatus,
      reviewedAt: typeof (entry as any)?.reviewedAt === "number" ? Math.round((entry as any).reviewedAt) : null,
      reviewedBy: asOptionalString((entry as any)?.reviewedBy, 120),
      reviewNote: asOptionalString((entry as any)?.reviewNote, 1000),
      linkedExpenseId: asOptionalString((entry as any)?.linkedExpenseId, 120),
    });
  });
  return normalized.sort((a, b) => b.revisionNumber - a.revisionNumber || b.submittedAt - a.submittedAt);
}

export function normalizeExpenseLink(value: unknown): WorkOrderExpenseLink | null {
  if (!value || typeof value !== "object") return null;
  const link = value as any;
  return {
    expenseId: asOptionalString(link.expenseId, 120),
    linkedAt: typeof link.linkedAt === "number" ? Math.round(link.linkedAt) : null,
    linkedBy: asOptionalString(link.linkedBy, 120),
    status: normalizeCostLinkStatus(link.status) || "not_linked",
  };
}

export function buildCostAttachmentStoragePath(params: { workOrderId: string; attachmentId: string; filename: string }) {
  const safeName = sanitizeFilename(params.filename || "invoice-upload");
  return `work-orders/cost-attachments/${params.workOrderId}/${params.attachmentId}_${safeName}`;
}

export function filterCostAttachmentsForAudience(
  items: unknown,
  audience: WorkOrderCostAttachmentAudience
): WorkOrderCostAttachment[] {
  const list = Array.isArray(items) ? items : [];
  const normalized: WorkOrderCostAttachment[] = [];
  list.forEach((entry) => {
    const uploadedAt = typeof (entry as any)?.uploadedAt === "number" ? (entry as any).uploadedAt : 0;
    const uploadedById = asOptionalString((entry as any)?.uploadedById, 120);
    const uploadedByRole = asString((entry as any)?.uploadedByRole, 40).toLowerCase();
    const visibility = normalizeCostAttachmentVisibility((entry as any)?.visibility);
    if (
      !uploadedAt ||
      !uploadedById ||
      !visibility ||
      (uploadedByRole !== "contractor" && uploadedByRole !== "landlord" && uploadedByRole !== "admin")
    ) {
      return;
    }
    normalized.push({
      id: asString((entry as any)?.id, 120),
      storagePath: asOptionalString((entry as any)?.storagePath, 500),
      fileName: asOptionalString((entry as any)?.fileName, 180),
      contentType: asOptionalString((entry as any)?.contentType, 120),
      uploadedAt,
      uploadedByRole: uploadedByRole as "contractor" | "landlord" | "admin",
      uploadedById,
      visibility,
    });
  });
  return normalized
    .filter((entry) => {
      if (audience === "landlord") return true;
      return entry.visibility === "landlord_only";
    })
    .sort((a, b) => Number(b.uploadedAt || 0) - Number(a.uploadedAt || 0));
}

export async function serializeCostAttachmentsForAudience(
  items: unknown,
  audience: WorkOrderCostAttachmentAudience
): Promise<Array<Omit<WorkOrderCostAttachment, "storagePath">>> {
  const bucket = asString(process.env.GCS_UPLOAD_BUCKET, 200);
  const filtered = filterCostAttachmentsForAudience(items, audience);
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
        fileName: entry.fileName || null,
        contentType: entry.contentType || null,
        uploadedAt: entry.uploadedAt,
        uploadedByRole: entry.uploadedByRole,
        uploadedById: entry.uploadedById,
        visibility: entry.visibility,
      };
    })
  );
}
