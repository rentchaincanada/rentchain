import { apiJson } from "@/api/http";

export type LeaseStatus = "active" | "ended";

export interface Lease {
  id: string;
  tenantId: string;
  propertyId: string;
  unitNumber: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string;
  status: LeaseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeasePayload {
  tenantId: string;
  propertyId: string;
  unitNumber: string;
  monthlyRent: number;
  startDate: string;
  endDate?: string;
}

export interface UpdateLeasePayload {
  monthlyRent?: number;
  startDate?: string;
  endDate?: string;
  status?: LeaseStatus;
}

export async function getLeasesForTenant(
  tenantId: string
): Promise<{ leases: Lease[] }> {
  return apiJson<{ leases: Lease[] }>(
    `/leases/tenant/${encodeURIComponent(tenantId)}`
  );
}

export async function getLeasesForProperty(
  propertyId: string
): Promise<{ leases: Lease[] }> {
  return apiJson<{ leases: Lease[] }>(
    `/leases/property/${encodeURIComponent(propertyId)}`
  );
}

export async function createLease(
  payload: CreateLeasePayload
): Promise<{ lease: Lease }> {
  return apiJson<{ lease: Lease }>("/leases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateLease(
  id: string,
  payload: UpdateLeasePayload
): Promise<{ lease: Lease }> {
  return apiJson<{ lease: Lease }>(`/leases/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function endLease(
  id: string,
  endDate?: string
): Promise<{ lease: Lease }> {
  return apiJson<{ lease: Lease }>(
    `/leases/${encodeURIComponent(id)}/end`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endDate }),
    }
  );
}
