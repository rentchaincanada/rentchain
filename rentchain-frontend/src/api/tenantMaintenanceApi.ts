import { tenantApiFetch } from "./tenantApiFetch";

export type MaintenanceRequest = {
  id: string;
  status: string;
  priority: string;
  category: string;
  title: string;
  description?: string;
  createdAt?: number | null;
  updatedAt?: number | null;
  tenantContact?: { phone?: string | null; preferredTimes?: string | null } | null;
};

export type MaintenanceRequestCreateResponse = {
  ok: boolean;
  data: MaintenanceRequest;
  emailed?: boolean;
  emailError?: string;
};

export function createTenantMaintenanceRequest(payload: {
  category: string;
  priority: string;
  title: string;
  description: string;
  tenantContact?: { phone?: string; preferredTimes?: string } | null;
}) {
  return tenantApiFetch<MaintenanceRequestCreateResponse>("/tenant/maintenance-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getTenantMaintenanceRequests() {
  return tenantApiFetch<{ ok: boolean; data: MaintenanceRequest[] }>("/tenant/maintenance-requests");
}

export function getTenantMaintenanceRequest(id: string) {
  return tenantApiFetch<{ ok: boolean; data: MaintenanceRequest }>(`/tenant/maintenance-requests/${id}`);
}
