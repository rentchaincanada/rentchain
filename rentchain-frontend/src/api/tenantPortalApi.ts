import type {
  IssueSeverity,
  MaintenanceIssueType,
  PropertyActionRequest,
} from "../types/models";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export type TenantIssuePayload = {
  tenantId?: string;
  propertyId: string;
  unitId?: string;
  issueType: MaintenanceIssueType;
  severity: IssueSeverity;
  location: "unit" | "building";
  description: string;
};

export async function submitTenantIssue(
  payload: TenantIssuePayload
): Promise<PropertyActionRequest> {
  const res = await fetch(`${API_BASE_URL}/api/action-requests`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-tenant-portal": "1",
    },
    body: JSON.stringify({
      ...payload,
      source: "tenant",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    const message = data?.error || data?.message || "Failed to submit issue";
    throw new Error(message);
  }
  return data as PropertyActionRequest;
}
