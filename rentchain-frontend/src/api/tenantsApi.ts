import { apiFetch, apiJson } from "@/lib/apiClient";

export interface TenantApiModel {
  id: string;
  name?: string;
  fullName?: string;
  unit?: string;
  propertyName?: string;
  status?: string;
  balance?: number;
}

/**
 * GET /tenants
 */
export async function fetchTenants(): Promise<TenantApiModel[]> {
  const data = await apiJson<any>("/tenants");
  if (Array.isArray(data)) return data as TenantApiModel[];
  if (Array.isArray(data?.tenants)) return data.tenants as TenantApiModel[];
  return [];
}

export async function downloadTenantReport(tenantId: string): Promise<void> {
  const res = await apiFetch(`/tenants/${tenantId}/report`, { method: "GET" });
  if (!res.ok) throw new Error("Failed to download tenant report");

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tenant-report-${tenantId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
