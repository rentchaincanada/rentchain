import { tenantApiFetch } from "./tenantApiFetch";

export type TenantAttachment = {
  id: string;
  tenantId: string;
  ledgerItemId: string;
  title?: string | null;
  url: string;
  purpose?: string | null;
  purposeLabel?: string | null;
  fileName?: string | null;
  createdAt?: number | null;
};

export async function getTenantAttachments(): Promise<{ ok: boolean; data: TenantAttachment[] }> {
  return tenantApiFetch<{ ok: boolean; data: TenantAttachment[] }>("/tenant/attachments");
}
