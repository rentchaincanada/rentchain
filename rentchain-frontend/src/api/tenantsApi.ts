import { apiJson, getAuthToken, resolveApiUrl } from "@/lib/apiClient";
import { getFirebaseIdToken } from "@/lib/firebaseAuthToken";
import { apiFetch } from "./http";

type TenantListResponse = TenantApiModel[] | { tenants?: TenantApiModel[] };
type TenanciesResponse = TenancyApiModel[] | { tenancies?: TenancyApiModel[] };
type UpdateTenancyResponse = TenancyApiModel | { tenancy?: TenancyApiModel };
type UpdateTenantResponse = TenantApiModel | { tenant?: TenantApiModel };
type ApiErrorShape = Error & { payload?: unknown; status?: number };

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "");
}

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
  email?: string | null;
  phone?: string | null;
  unit?: string;
  unitId?: string | null;
  unitLabel?: string | null;
  propertyName?: string;
  propertyId?: string | null;
  currentLeaseId?: string | null;
  status?: string;
  balance?: number;
  hiddenFromActiveLists?: boolean;
  tenancies?: TenancyApiModel[];
}

/**
 * GET /tenants
 */
export async function fetchTenants(): Promise<TenantApiModel[]> {
  try {
    const data = await apiJson<TenantListResponse>("/tenants");
    if (Array.isArray(data)) return data as TenantApiModel[];
    if (Array.isArray(data?.tenants)) return data.tenants as TenantApiModel[];
    return [];
  } catch (err: unknown) {
    const msg = extractErrorMessage(err);
    if (msg.includes("404")) {
      return [];
    }
    throw err;
  }
}

export async function downloadTenantReport(tenantId: string): Promise<{ filename: string; blob: Blob }> {
  const path = `/tenants/${encodeURIComponent(tenantId)}/report`;
  const url = resolveApiUrl(path);
  const bearerToken = getAuthToken();
  const firebaseToken = !bearerToken ? await getFirebaseIdToken() : null;
  const token = bearerToken || firebaseToken;
  const headers = new Headers({
    Accept: "application/pdf,application/json",
    "x-api-client": "web",
    "x-rc-auth": bearerToken ? "bearer" : firebaseToken ? "firebase" : "missing",
  });

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(url, {
    method: "GET",
    headers,
    credentials: "include",
  });

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const payload: unknown = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");
    const payloadRecord =
      payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
    const message =
      payloadRecord?.message ||
      payloadRecord?.error ||
      payloadRecord?.code ||
      (typeof payload === "string" ? payload : "") ||
      `Tenant report download failed (${response.status})`;
    const err: ApiErrorShape = new Error(String(message));
    err.payload = payload;
    err.status = response.status;
    throw err;
  }

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] || `tenant-summary-${tenantId}.pdf`;

  return { filename, blob };
}

export async function fetchTenantTenancies(tenantId: string): Promise<TenancyApiModel[]> {
  const data = await apiJson<TenanciesResponse>(`/tenants/${encodeURIComponent(tenantId)}/tenancies`);
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
  const data = await apiJson<UpdateTenancyResponse>(`/tenancies/${encodeURIComponent(tenancyId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (data?.tenancy) return data.tenancy as TenancyApiModel;
  return data as TenancyApiModel;
}

export async function updateTenantRecord(
  tenantId: string,
  payload: Partial<{
    fullName: string;
    email: string | null;
    phone: string | null;
  }>
): Promise<TenantApiModel> {
  const data = await apiJson<UpdateTenantResponse>(`/tenants/${encodeURIComponent(tenantId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  if (data?.tenant) return data.tenant as TenantApiModel;
  return data as TenantApiModel;
}

export async function impersonateTenant(tenantId: string): Promise<{ ok: boolean; token: string; tenantId: string; exp?: number }> {
  const res = await apiFetch(`/landlord/tenants/${tenantId}/impersonate`, { method: "POST" });
  const data = await res.json();
  if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to impersonate tenant");
  return data;
}
