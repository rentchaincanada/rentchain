import { apiFetch, apiJson } from "@/lib/apiClient";

export type TenancyMoveOutReason =
  | "LEASE_TERM_END"
  | "EARLY_LEASE_END"
  | "EVICTED"
  | "OTHER";

export interface TenancyApiModel {
  id: string;
  tenantId: string;
  propertyId?: string | null;
  unitId?: string | null;
  unitLabel?: string | null;
  status: "active" | "inactive";
  moveInAt?: string | null;
  moveOutAt?: string | null;
  moveOutReason?: TenancyMoveOutReason | null;
  moveOutReasonNote?: string | null;
}

export interface TenantApiModel {
  id: string;
  name?: string;
  fullName?: string;
  unit?: string;
  propertyName?: string;
  status?: string;
  balance?: number;
  tenancies?: TenancyApiModel[];
}

/**
 * GET /tenants
 */
export async function fetchTenants(): Promise<TenantApiModel[]> {
  try {
    const data = await apiJson<any>("/tenants");
    if (Array.isArray(data)) return data as TenantApiModel[];
    if (Array.isArray(data?.tenants)) return data.tenants as TenantApiModel[];
    return [];
  } catch (err: any) {
    const msg = String(err?.message || "");
    if (msg.includes("404")) {
      return [];
    }
    throw err;
  }
}

export async function downloadTenantReport(tenantId: string): Promise<any> {
  // Uses landlord-protected JSON endpoint; backend currently returns JSON report.
  return apiFetch(`/tenants/${tenantId}/report`, { method: "GET" });
}

export async function fetchTenantTenancies(tenantId: string): Promise<TenancyApiModel[]> {
  const data = await apiJson<any>(`/tenants/${encodeURIComponent(tenantId)}/tenancies`);
  if (Array.isArray(data)) return data as TenancyApiModel[];
  if (Array.isArray(data?.tenancies)) return data.tenancies as TenancyApiModel[];
  return [];
}

export async function updateTenancy(
  tenancyId: string,
  payload: Partial<{
    moveInAt: string | null;
    moveOutAt: string | null;
    moveOutReason: TenancyMoveOutReason | null;
    moveOutReasonNote: string | null;
    status: "active" | "inactive";
  }>
): Promise<TenancyApiModel> {
  const data = await apiJson<any>(`/tenancies/${encodeURIComponent(tenancyId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (data?.tenancy) return data.tenancy as TenancyApiModel;
  return data as TenancyApiModel;
}

export async function impersonateTenant(tenantId: string): Promise<{ ok: boolean; token: string; tenantId: string; exp?: number }> {
  const res = await apiFetch(`/landlord/tenants/${tenantId}/impersonate`, { method: "POST" });
  const data = await res.json();
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to impersonate tenant");
  return data;
}
