import { apiFetch } from "./apiFetch";
import type { WorkOrderRecord } from "./workOrdersApi";

export type ContractorServiceCategory =
  | "plumbing"
  | "electrical"
  | "hvac"
  | "general_maintenance"
  | "cleaning"
  | "painting"
  | "locksmith"
  | "appliance_repair";

export type ContractorAvailabilityStatus = "active" | "inactive" | "limited";

export type ContractorProfileV1 = {
  version: "v1";
  id: string;
  userId?: string | null;
  displayName: string;
  businessName?: string | null;
  serviceCategories: ContractorServiceCategory[];
  serviceAreas: string[];
  availabilityStatus: ContractorAvailabilityStatus;
  contact: {
    email?: string | null;
    phone?: string | null;
  };
  summary?: string | null;
  metadata?: {
    internalNotes?: string | null;
    landlordNetworkIds?: string[] | null;
    createdByLandlordId?: string | null;
  };
  createdAt: string;
  updatedAt: string;
};

export async function fetchContractors(params?: {
  serviceCategory?: string;
  serviceArea?: string;
  availabilityStatus?: string;
  limit?: number;
  cursor?: string;
}) {
  const query = new URLSearchParams();
  if (params?.serviceCategory) query.set("serviceCategory", params.serviceCategory);
  if (params?.serviceArea) query.set("serviceArea", params.serviceArea);
  if (params?.availabilityStatus) query.set("availabilityStatus", params.availabilityStatus);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.cursor) query.set("cursor", params.cursor);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await apiFetch<{ ok: boolean; items: ContractorProfileV1[]; nextCursor?: string | null }>(
    `/marketplace/contractors${suffix}`,
    { method: "GET" }
  );
  return {
    items: Array.isArray(res?.items) ? res.items : [],
    nextCursor: res?.nextCursor || null,
  };
}

export async function createContractorProfile(payload: Partial<ContractorProfileV1>) {
  const res = await apiFetch<{ ok: boolean; contractor: ContractorProfileV1 }>("/marketplace/contractors", {
    method: "POST",
    body: payload,
  });
  if (!res?.ok || !res.contractor) throw new Error("Failed to create contractor profile");
  return res.contractor;
}

export async function updateContractorProfile(contractorId: string, payload: Partial<ContractorProfileV1>) {
  const res = await apiFetch<{ ok: boolean; contractor: ContractorProfileV1 }>(
    `/marketplace/contractors/${encodeURIComponent(contractorId)}`,
    { method: "PATCH", body: payload }
  );
  if (!res?.ok || !res.contractor) throw new Error("Failed to update contractor profile");
  return res.contractor;
}

export async function assignContractorToWorkOrder(workOrderId: string, payload: { contractorId: string }) {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/marketplace/work-orders/${encodeURIComponent(workOrderId)}/assign-contractor`,
    { method: "POST", body: payload }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to assign contractor");
  return res.item;
}
