import { apiFetch } from "./apiFetch";
import type { ActionRequestStatus, PropertyActionRequest } from "../types/models";

export type ActionRequest = {
  id: string;
  landlordId?: string;
  propertyId: string;
  unitId?: string;
  tenantId?: string;
  ruleKey?: string;
  source?: "system" | "tenant" | "landlord" | string;
  title?: string;
  description?: string;
  issueType?: string;
  severity?: "low" | "medium" | "high" | string;
  location?: "building" | "unit" | string;
  status?: "new" | "acknowledged" | "resolved" | string;
  priority?: string;
  createdAt?: any;
  updatedAt?: any;
  resolvedAt?: any;
  meta?: Record<string, any>;
};

export async function listActionRequests(params: {
  propertyId?: string;
  status?: ActionRequestStatus;
}): Promise<PropertyActionRequest[]> {
  const qs = new URLSearchParams();
  if (params.propertyId) qs.set("propertyId", params.propertyId);
  if (params.status) qs.set("status", params.status);
  return apiFetch<PropertyActionRequest[]>(
    `/action-requests${qs.toString() ? `?${qs.toString()}` : ""}`
  );
}

export async function acknowledgeActionRequest(
  id: string,
  note?: string
): Promise<PropertyActionRequest> {
  return apiFetch<PropertyActionRequest>(
    `/action-requests/${encodeURIComponent(id)}/acknowledge`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }
  );
}

export async function resolveActionRequest(
  id: string,
  note?: string
): Promise<PropertyActionRequest> {
  return apiFetch<PropertyActionRequest>(
    `/action-requests/${encodeURIComponent(id)}/resolve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    }
  );
}

export async function fetchActionRequests(
  propertyId: string
): Promise<{ actionRequests: ActionRequest[] }> {
  const q = encodeURIComponent(propertyId);
  return apiFetch<{ actionRequests: ActionRequest[] }>(
    `/action-requests?propertyId=${q}`
  );
}

export async function recomputeActionRequests(propertyId: string) {
  const q = encodeURIComponent(propertyId);
  return apiFetch<{ ok: boolean; result: any }>(
    `/action-requests/recompute?propertyId=${q}`,
    { method: "POST" }
  );
}
