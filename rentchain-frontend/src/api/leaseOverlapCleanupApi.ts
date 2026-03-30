import { apiFetch } from "./apiFetch";

export type LeaseOverlapAuditGroup = {
  landlordId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitNumber: string | null;
  unitLabel: string | null;
  overlapType: string;
  severity: string;
  confidence: string;
  leaseIds: string[];
  tenantIds: string[];
  leaseStatuses: string[];
  startDates: Array<string | null>;
  endDates: Array<string | null>;
  currentLeaseHints: string[];
  riskNotes: string[];
  sourceHints: string[];
  recommendedReviewAction: string;
  generatedAt: string;
};

export async function getAdminLeaseOverlapGroups(params?: {
  landlordId?: string;
  propertyId?: string;
}): Promise<{ groups: LeaseOverlapAuditGroup[] }> {
  const query = new URLSearchParams();
  if (params?.landlordId) query.set("landlordId", params.landlordId);
  if (params?.propertyId) query.set("propertyId", params.propertyId);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await apiFetch<{ ok: boolean; report: { groups: LeaseOverlapAuditGroup[] } }>(`/admin/lease-overlaps${suffix}`);
  return { groups: res?.report?.groups || [] };
}

export async function previewAdminLeaseOverlapCleanup(payload: {
  landlordId: string;
  propertyId: string;
  canonicalLeaseId: string;
  overlapLeaseIds: string[];
  targetStatus?: "superseded" | "inactive";
}) {
  return apiFetch<{ ok: boolean; preview: any }>("/admin/lease-overlaps/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function applyAdminLeaseOverlapCleanup(payload: {
  landlordId: string;
  propertyId: string;
  canonicalLeaseId: string;
  overlapLeaseIds: string[];
  targetStatus?: "superseded" | "inactive";
}) {
  return apiFetch<{ ok: boolean; result: any }>("/admin/lease-overlaps/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
