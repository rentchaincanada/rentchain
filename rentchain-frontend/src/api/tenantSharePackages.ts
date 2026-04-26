import { tenantApiFetch } from "./tenantApiFetch";

export type TenantSharePackageLink = {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: "active";
};

export type TenantSharePackageCreated = TenantSharePackageLink & {
  shareUrl: string;
};

export async function createTenantSharePackage(expiresInDays = 7): Promise<TenantSharePackageCreated> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantSharePackageCreated }>("/tenant/share-packages", {
    method: "POST",
    body: { expiresInDays },
  });
  return res.data;
}

export async function listTenantSharePackages(): Promise<TenantSharePackageLink[]> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantSharePackageLink[] }>("/tenant/share-packages");
  return Array.isArray(res?.data) ? res.data : [];
}

export async function revokeTenantSharePackage(id: string): Promise<void> {
  await tenantApiFetch(`/tenant/share-packages/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
