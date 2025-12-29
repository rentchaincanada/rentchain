import { apiJson } from "../lib/apiClient";

export type TenantHistoryShareResponse = {
  ok: boolean;
  shareId: string;
  url: string;
  expiresAt: number;
};

export async function createTenantHistoryShare(tenantId: string, expiresInDays?: number) {
  return apiJson<TenantHistoryShareResponse>("/api/tenant-history/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tenantId, expiresInDays }),
  });
}

export async function revokeTenantHistoryShare(shareId: string) {
  return apiJson<{ ok: boolean; shareId: string; revoked: boolean }>(
    `/api/tenant-history/share/${encodeURIComponent(shareId)}/revoke`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }
  );
}
