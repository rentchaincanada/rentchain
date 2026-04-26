import { tenantApiFetch } from "./tenantApiFetch";

export type TenantSharePackageLink = {
  id: string;
  createdAt: number;
  expiresAt: number;
  status: "active";
  permissions: {
    identitySummary: boolean;
    credibilitySummary: boolean;
    applicationSummary: boolean;
    documents: "none" | "summary" | "approved_only";
  };
  requestedItems: Array<
    "identity_summary" | "credibility_summary" | "application_summary" | "documents_summary"
  >;
  approvedItems: Array<
    "identity_summary" | "credibility_summary" | "application_summary" | "documents_summary"
  >;
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

export async function respondToTenantSharePackage(
  id: string,
  approvedItems: Array<"identity_summary" | "credibility_summary" | "application_summary" | "documents_summary">
): Promise<TenantSharePackageLink> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantSharePackageLink }>(
    `/tenant/share-packages/${encodeURIComponent(id)}/respond`,
    {
      method: "POST",
      body: { approvedItems },
    }
  );
  return res.data;
}
