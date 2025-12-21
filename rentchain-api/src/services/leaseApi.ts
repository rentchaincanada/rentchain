// src/services/leaseApi.ts

import { API_BASE_URL } from "../config/api";

export interface Lease {
  id: string;
  tenantId: string;
  propertyId?: string;
  unitId?: string;
  monthlyRent: number;
  startDate: string;         // YYYY-MM-DD
  endDate: string | null;
  status: "active" | "ended" | "pending";
  nextChargeDay?: number;
  notes?: string;
}

// Payload shape for creating/updating a lease
export interface LeaseInput {
  id?: string;
  tenantId: string;
  propertyId?: string;
  unitId?: string;
  monthlyRent: number;
  startDate: string;        // YYYY-MM-DD
  endDate?: string | null;
  status?: "active" | "ended" | "pending";
  nextChargeDay?: number;
  notes?: string;
}

/**
 * Fetch all leases for a given tenant.
 */
export async function fetchLeasesForTenant(
  tenantId: string
): Promise<Lease[]> {
  const url = `${API_BASE_URL}/leases/tenant/${encodeURIComponent(tenantId)}`;
  console.log("[Lease] Fetch:", url);

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    console.error(
      "[Lease] API error",
      res.status,
      res.statusText,
      "Response:",
      text
    );
    throw new Error(`Failed to fetch leases: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as Lease[];
  return json;
}

/**
 * Create or update a lease using the backend /leases upsert endpoint.
 */
export async function saveLease(input: LeaseInput): Promise<Lease> {
  const url = `${API_BASE_URL}/leases`;
  console.log("[Lease] Save:", url, input);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(
      "[Lease] Save error",
      res.status,
      res.statusText,
      "Response:",
      text
    );
    throw new Error(`Failed to save lease: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as Lease;
  return json;
}
