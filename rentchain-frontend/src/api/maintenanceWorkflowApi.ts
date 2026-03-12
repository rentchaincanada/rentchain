import { apiFetch } from "./apiFetch";
import { tenantApiFetch } from "./tenantApiFetch";

export type MaintenanceWorkflowStatus =
  | "submitted"
  | "reviewed"
  | "assigned"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export type MaintenanceWorkflowItem = {
  id: string;
  tenantId: string;
  landlordId: string;
  propertyId: string | null;
  unitId: string | null;
  tenantName?: string | null;
  propertyLabel?: string | null;
  unitLabel?: string | null;
  title: string;
  description: string;
  notes?: string | null;
  category: string;
  priority: "low" | "normal" | "urgent";
  status: MaintenanceWorkflowStatus;
  assignedContractorId?: string | null;
  assignedContractorName?: string | null;
  contractorStatus?: string | null;
  contractorLastUpdate?: string | null;
  landlordNote?: string | null;
  createdAt: number;
  updatedAt: number;
  statusHistory?: Array<{
    status: string;
    actorRole: string;
    actorId?: string | null;
    message?: string | null;
    createdAt?: number;
  }>;
};

export type LandlordMaintenanceContractor = {
  id: string;
  businessName?: string | null;
  contactName?: string | null;
  email?: string | null;
};

export async function createTenantMaintenance(payload: {
  title: string;
  description: string;
  category: string;
  priority: "low" | "normal" | "urgent";
  notes?: string;
  photoUploadPending?: boolean;
}) {
  return tenantApiFetch<{ ok: boolean; requestId: string; status: MaintenanceWorkflowStatus; data: MaintenanceWorkflowItem }>(
    "/tenant/maintenance",
    {
      method: "POST",
      body: payload,
    }
  );
}

export async function listTenantMaintenance() {
  return tenantApiFetch<{ ok: boolean; items: MaintenanceWorkflowItem[]; data?: MaintenanceWorkflowItem[] }>(
    "/tenant/maintenance"
  );
}

export async function getTenantMaintenance(id: string) {
  return tenantApiFetch<{ ok: boolean; item: MaintenanceWorkflowItem; data?: MaintenanceWorkflowItem }>(
    `/tenant/maintenance/${encodeURIComponent(id)}`
  );
}

export async function listLandlordMaintenance(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<{ ok: boolean; items: MaintenanceWorkflowItem[]; data?: MaintenanceWorkflowItem[] }>(
    `/landlord/maintenance${query}`
  );
}

export async function listLandlordMaintenanceContractors() {
  return apiFetch<{ ok: boolean; items: LandlordMaintenanceContractor[]; data?: LandlordMaintenanceContractor[] }>(
    "/landlord/maintenance/contractors"
  );
}

export async function patchLandlordMaintenance(
  id: string,
  payload: {
    status?: MaintenanceWorkflowStatus;
    priority?: "low" | "normal" | "urgent";
    landlordNote?: string | null;
    message?: string;
  }
) {
  return apiFetch<{ ok: boolean; item: MaintenanceWorkflowItem; data?: MaintenanceWorkflowItem }>(
    `/landlord/maintenance/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: payload,
    }
  );
}

export async function assignLandlordMaintenance(id: string, contractorId: string) {
  return apiFetch<{ ok: boolean; item: MaintenanceWorkflowItem; data?: MaintenanceWorkflowItem }>(
    `/landlord/maintenance/${encodeURIComponent(id)}/assign`,
    {
      method: "POST",
      body: { contractorId },
    }
  );
}

export async function listContractorMaintenanceJobs(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<{ ok: boolean; items: MaintenanceWorkflowItem[]; data?: MaintenanceWorkflowItem[] }>(
    `/contractor/jobs${query}`
  );
}

export async function patchContractorMaintenanceJobStatus(
  id: string,
  payload: { status: "assigned" | "scheduled" | "in_progress" | "completed"; message?: string }
) {
  return apiFetch<{ ok: boolean; item: MaintenanceWorkflowItem; data?: MaintenanceWorkflowItem }>(
    `/contractor/jobs/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: payload,
    }
  );
}
