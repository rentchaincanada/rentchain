import { apiFetch } from "./apiFetch";

export type LandlordLead = {
  id: string;
  email?: string | null;
  firstName?: string | null;
  portfolioSize?: string | null;
  note?: string | null;
  status?: string | null;
  createdAt?: number | null;
  approvedAt?: number | null;
  approvedBy?: string | null;
  rejectedAt?: number | null;
  rejectedBy?: string | null;
};

export async function fetchLandlordLeads(
  status?: "pending" | "approved" | "rejected",
  limit: number = 100
): Promise<LandlordLead[]> {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  qs.set("limit", String(limit));
  const res = await apiFetch<any>(`/admin/landlord-leads?${qs.toString()}`, { method: "GET" });
  if (!res?.ok) return [];
  return Array.isArray(res.leads) ? (res.leads as LandlordLead[]) : [];
}

export async function approveLandlordLead(id: string) {
  return apiFetch<any>(`/admin/landlord-leads/${id}/approve`, { method: "POST" });
}

export async function rejectLandlordLead(id: string) {
  return apiFetch<any>(`/admin/landlord-leads/${id}/reject`, { method: "POST" });
}
