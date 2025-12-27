import { withAuthHeaders } from "./httpClient";
import { apiFetch } from "./apiFetch";
import type {
  ActionRequestStatus,
  PropertyActionRequest,
} from "../types/models";
import { API_BASE_URL } from "./config";

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
  const query: string[] = [];
  if (params.propertyId) query.push(`propertyId=${encodeURIComponent(params.propertyId)}`);
  if (params.status) query.push(`status=${encodeURIComponent(params.status)}`);
  const url =
    `${API_BASE_URL}/api/action-requests` +
    (query.length ? `?${query.join("&")}` : "");

  const res = await fetch(
    url,
    withAuthHeaders({
      method: "GET",
    })
  );

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Failed to load action requests");
  }
  return Array.isArray(data?.actionRequests) ? data.actionRequests : data || [];
}

export async function acknowledgeActionRequest(
  id: string,
  note?: string
): Promise<PropertyActionRequest> {
  const res = await fetch(
    `${API_BASE_URL}/api/action-requests/${encodeURIComponent(id)}/acknowledge`,
    withAuthHeaders({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    })
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Failed to acknowledge request");
  }
  return data as PropertyActionRequest;
}

export async function resolveActionRequest(
  id: string,
  note?: string
): Promise<PropertyActionRequest> {
  const res = await fetch(
    `${API_BASE_URL}/api/action-requests/${encodeURIComponent(id)}/resolve`,
    withAuthHeaders({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    })
  );
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Failed to resolve request");
  }
  return data as PropertyActionRequest;
}

export async function fetchActionRequests(
  propertyId: string
): Promise<{ actionRequests: ActionRequest[] }> {
  const q = encodeURIComponent(propertyId);
  return apiFetch<{ actionRequests: ActionRequest[] }>(
    `/api/action-requests?propertyId=${q}`
  );
}

export async function recomputeActionRequests(propertyId: string) {
  const q = encodeURIComponent(propertyId);
  return apiFetch<{ ok: boolean; result: any }>(
    `/api/action-requests/recompute?propertyId=${q}`,
    { method: "POST" }
  );
}
