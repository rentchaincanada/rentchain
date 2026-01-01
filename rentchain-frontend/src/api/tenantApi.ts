import { getTenantToken } from "../lib/tenantAuth";

async function apiFetch(path: string, init?: RequestInit) {
  const token = getTenantToken();
  const headers: any = {
    ...(init?.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export async function tenantMe() {
  return apiFetch("/api/tenant/me");
}

export async function tenantLease() {
  return apiFetch("/api/tenant/lease");
}

export async function tenantPayments() {
  return apiFetch("/api/tenant/payments");
}

export async function tenantLedger() {
  return apiFetch("/api/tenant/ledger");
}
