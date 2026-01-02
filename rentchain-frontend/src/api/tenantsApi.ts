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

export async function downloadTenantReport(tenantId: string): Promise<any> {
  // Uses landlord-protected JSON endpoint; backend currently returns JSON report.
  return apiFetch(`/api/tenants/${tenantId}/report`, { method: "GET" });
}

export async function impersonateTenant(tenantId: string): Promise<{ ok: boolean; token: string; tenantId: string; exp?: number }> {
  const res = await apiFetch(`/landlord/tenants/${tenantId}/impersonate`, { method: "POST" });
  const data = await res.json();
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to impersonate tenant");
  return data;
}
