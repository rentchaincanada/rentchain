// FRONTEND: rentchain-frontend/src/services/leaseApi.ts

import API_BASE from "../config/apiBase";

const API_BASE_URL = API_BASE.replace(/\/$/, "");

export type LeaseStatus = "active" | "ended" | "pending";

export interface Lease {
  id: string;
  tenantId: string;
  propertyId: string;
  unitId: string;
  startDate: string;
  endDate?: string | null;
  rent: number;
  status: LeaseStatus;
}

/**
 * Fetch leases for a tenant.
 * Now hits the real backend: GET /leases/tenant/:tenantId
 */
export async function fetchLeasesForTenant(
  tenantId: string
): Promise<Lease[]> {
  const url = `${API_BASE_URL}/leases/tenant/${tenantId}`;
  console.log("[Lease] Fetch:", url);

  const res = await fetch(url);

  if (res.status === 404) {
    console.log(
      "[Lease] No lease endpoint or no leases yet; returning empty list."
    );
    return [];
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("[Lease] API error", res.status, text);
    throw new Error(`Failed to fetch leases: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as Lease[];
  return data;
}

/**
 * Save a lease (create).
 * Hits: POST /leases
 */
export interface SaveLeasePayload {
  tenantId: string;
  propertyId: string;
  unitId: string;
  startDate: string;
  endDate?: string | null;
  rent: number;
  status?: LeaseStatus;
}

export async function saveLease(payload: SaveLeasePayload): Promise<Lease> {
  const url = `${API_BASE_URL}/leases`;
  console.log("[Lease] Save:", url, payload);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[Lease] Save error", res.status, text);
    throw new Error(`Failed to save lease: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as Lease;
  return data;
}
