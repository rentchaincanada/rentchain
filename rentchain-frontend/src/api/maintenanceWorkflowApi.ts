import { apiFetch } from "./apiFetch";
import {
  createTenantWorkspaceMaintenance,
  getTenantWorkspaceMaintenance,
  listTenantWorkspaceMaintenance,
  updateTenantWorkspaceMaintenanceConfirmation,
} from "./tenantPortal";

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
  serviceWindowStartAt?: number | null;
  serviceWindowEndAt?: number | null;
  accessRequired?: boolean | null;
  tenantConfirmationStatus?: "confirmed" | "needs_schedule_change" | null;
  tenantConfirmationUpdatedAt?: number | null;
  accessAcknowledgedAt?: number | null;
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
  const data = await createTenantWorkspaceMaintenance({
    title: payload.title,
    description: payload.description,
    category: payload.category,
    priority: payload.priority.toUpperCase(),
  });
  return {
    ok: true,
    requestId: data?.requestId || data?.id || "",
    status: String(data?.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
    data: {
      id: data?.requestId || data?.id || "",
      tenantId: "",
      landlordId: "",
      propertyId: null,
      unitId: null,
      title: data?.title || payload.title,
      description: data?.summary || payload.description,
      category: String(data?.category || payload.category),
      priority: String(data?.priority || payload.priority).toLowerCase() as "low" | "normal" | "urgent",
      status: String(data?.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
      createdAt: data?.createdAt || Date.now(),
      updatedAt: data?.updatedAt || Date.now(),
    },
  };
}

export async function listTenantMaintenance() {
  const items = await listTenantWorkspaceMaintenance();
  const mapped: MaintenanceWorkflowItem[] = items.map((item) => ({
    id: item.requestId,
    tenantId: "",
    landlordId: "",
    propertyId: null,
    unitId: null,
    title: item.title || "Maintenance request",
    description: item.summary || "",
    category: String(item.category || "GENERAL"),
    priority: String(item.priority || "normal").toLowerCase() as "low" | "normal" | "urgent",
    status: String(item.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
    assignedContractorName: item.assignedContractorName || null,
    contractorStatus: item.contractorStatus || null,
    serviceWindowStartAt: typeof item.serviceWindowStartAt === "number" ? item.serviceWindowStartAt : null,
    serviceWindowEndAt: typeof item.serviceWindowEndAt === "number" ? item.serviceWindowEndAt : null,
    accessRequired: typeof item.accessRequired === "boolean" ? item.accessRequired : null,
    tenantConfirmationStatus:
      item.tenantConfirmationStatus === "confirmed" || item.tenantConfirmationStatus === "needs_schedule_change"
        ? item.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt:
      typeof item.tenantConfirmationUpdatedAt === "number" ? item.tenantConfirmationUpdatedAt : null,
    accessAcknowledgedAt: typeof item.accessAcknowledgedAt === "number" ? item.accessAcknowledgedAt : null,
    createdAt: item.createdAt || Date.now(),
    updatedAt: item.updatedAt || item.createdAt || Date.now(),
    statusHistory: Array.isArray(item.statusHistory)
      ? item.statusHistory.map((entry) => ({
          status: String(entry?.status || ""),
          actorRole: String(entry?.actorRole || ""),
          actorId: entry?.actorId ? String(entry.actorId) : null,
          message: entry?.message ? String(entry.message) : null,
          createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : undefined,
        }))
      : [],
  }));
  return { ok: true, items: mapped, data: mapped };
}

export async function getTenantMaintenance(id: string) {
  const item = await getTenantWorkspaceMaintenance(id);
  const mapped: MaintenanceWorkflowItem = {
    id: item?.requestId || id,
    tenantId: "",
    landlordId: "",
    propertyId: null,
    unitId: null,
    title: item?.title || "Maintenance request",
    description: item?.summary || "",
    category: String(item?.category || "GENERAL"),
    priority: String(item?.priority || "normal").toLowerCase() as "low" | "normal" | "urgent",
    status: String(item?.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
    assignedContractorName: item?.assignedContractorName || null,
    contractorStatus: item?.contractorStatus || null,
    serviceWindowStartAt: typeof item?.serviceWindowStartAt === "number" ? item.serviceWindowStartAt : null,
    serviceWindowEndAt: typeof item?.serviceWindowEndAt === "number" ? item.serviceWindowEndAt : null,
    accessRequired: typeof item?.accessRequired === "boolean" ? item.accessRequired : null,
    tenantConfirmationStatus:
      item?.tenantConfirmationStatus === "confirmed" || item?.tenantConfirmationStatus === "needs_schedule_change"
        ? item.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt:
      typeof item?.tenantConfirmationUpdatedAt === "number" ? item.tenantConfirmationUpdatedAt : null,
    accessAcknowledgedAt: typeof item?.accessAcknowledgedAt === "number" ? item.accessAcknowledgedAt : null,
    createdAt: item?.createdAt || Date.now(),
    updatedAt: item?.updatedAt || item?.createdAt || Date.now(),
    statusHistory: Array.isArray(item?.statusHistory)
      ? item.statusHistory.map((entry) => ({
          status: String(entry?.status || ""),
          actorRole: String(entry?.actorRole || ""),
          actorId: entry?.actorId ? String(entry.actorId) : null,
          message: entry?.message ? String(entry.message) : null,
          createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : undefined,
        }))
      : [],
  };
  return { ok: true, item: mapped, data: mapped };
}

export async function updateTenantMaintenanceConfirmation(
  id: string,
  payload: {
    confirmationStatus?: "confirmed" | "needs_schedule_change";
    acknowledgeAccess?: boolean;
  }
) {
  const item = await updateTenantWorkspaceMaintenanceConfirmation(id, payload);
  const mapped: MaintenanceWorkflowItem = {
    id: item?.requestId || id,
    tenantId: "",
    landlordId: "",
    propertyId: null,
    unitId: null,
    title: item?.title || "Maintenance request",
    description: item?.summary || "",
    category: String(item?.category || "GENERAL"),
    priority: String(item?.priority || "normal").toLowerCase() as "low" | "normal" | "urgent",
    status: String(item?.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
    assignedContractorName: item?.assignedContractorName || null,
    contractorStatus: item?.contractorStatus || null,
    serviceWindowStartAt: typeof item?.serviceWindowStartAt === "number" ? item.serviceWindowStartAt : null,
    serviceWindowEndAt: typeof item?.serviceWindowEndAt === "number" ? item.serviceWindowEndAt : null,
    accessRequired: typeof item?.accessRequired === "boolean" ? item.accessRequired : null,
    tenantConfirmationStatus:
      item?.tenantConfirmationStatus === "confirmed" || item?.tenantConfirmationStatus === "needs_schedule_change"
        ? item.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt:
      typeof item?.tenantConfirmationUpdatedAt === "number" ? item.tenantConfirmationUpdatedAt : null,
    accessAcknowledgedAt: typeof item?.accessAcknowledgedAt === "number" ? item.accessAcknowledgedAt : null,
    createdAt: item?.createdAt || Date.now(),
    updatedAt: item?.updatedAt || item?.createdAt || Date.now(),
    statusHistory: Array.isArray(item?.statusHistory)
      ? item.statusHistory.map((entry) => ({
          status: String(entry?.status || ""),
          actorRole: String(entry?.actorRole || ""),
          actorId: entry?.actorId ? String(entry.actorId) : null,
          message: entry?.message ? String(entry.message) : null,
          createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : undefined,
        }))
      : [],
  };
  return { ok: true, item: mapped, data: mapped };
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
    serviceWindowStartAt?: number | null;
    serviceWindowEndAt?: number | null;
    accessRequired?: boolean | null;
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
