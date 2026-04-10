import { tenantApiFetch } from "./tenantApiFetch";

export type TenantAttachment = {
  id: string;
  tenantId?: string | null;
  ledgerItemId?: string | null;
  title?: string | null;
  url?: string | null;
  purpose?: string | null;
  purposeLabel?: string | null;
  fileName?: string | null;
  createdAt?: number | null;
  label?: string | null;
  category?: string | null;
  status?: "missing" | "uploaded" | "pending_review" | "verified" | "needs_attention" | "reupload_requested";
  uploadedAt?: number | null;
  nextAction?: string | null;
  actionAvailable?: boolean;
  actionLabel?: string | null;
  actionPath?: string | null;
  helpLabel?: string | null;
  helpPath?: string | null;
};

export type TenantAttachmentSummary = {
  total: number;
  missing: number;
  uploaded: number;
  pendingReview: number;
  verified: number;
  needsAttention: number;
};

export type TenantAttachmentGuidance = {
  headline: string;
  nextSteps: string[];
  uploadEntryAvailable: boolean;
  uploadEntryLabel: string | null;
  uploadEntryPath: string | null;
  supportPath: string | null;
  supportLabel: string | null;
};

export async function getTenantAttachments(): Promise<{
  ok: boolean;
  data: TenantAttachment[];
  summary?: TenantAttachmentSummary;
  guidance?: TenantAttachmentGuidance;
  updatedAt?: number | null;
}> {
  return tenantApiFetch<{
    ok: boolean;
    data: TenantAttachment[];
    summary?: TenantAttachmentSummary;
    guidance?: TenantAttachmentGuidance;
    updatedAt?: number | null;
  }>("/tenant/attachments");
}
