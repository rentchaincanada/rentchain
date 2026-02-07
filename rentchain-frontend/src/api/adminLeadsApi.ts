import { apiFetch } from "./apiFetch";

export type LandlordLead = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  portfolioSize?: string | null;
  note?: string | null;
  status?: string | null;
  createdAt?: number | null;
  invitedAt?: number | null;
  invitedBy?: string | null;
  rejectedAt?: number | null;
  rejectedBy?: string | null;
};

export async function fetchLandlordLeads(limit: number = 100): Promise<LandlordLead[]> {
  const res = await apiFetch<any>(`/admin/landlord-leads?limit=${limit}`, { method: "GET" });
  if (!res?.ok) return [];
  return Array.isArray(res.leads) ? (res.leads as LandlordLead[]) : [];
}

export async function approveLandlordLead(id: string) {
  return apiFetch<any>(`/admin/landlord-leads/${id}/approve`, { method: "POST" });
}

export async function rejectLandlordLead(id: string) {
  return apiFetch<any>(`/admin/landlord-leads/${id}/reject`, { method: "POST" });
}
