import { apiFetch } from "./apiFetch";

export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";
export type WorkOrderStatus =
  | "open"
  | "invited"
  | "assigned"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled";

export type WorkOrderRecord = {
  id: string;
  landlordId: string;
  propertyId: string;
  unitId: string | null;
  title: string;
  description: string;
  category: string;
  priority: WorkOrderPriority;
  status: WorkOrderStatus;
  visibility: "private" | "open_marketplace";
  budgetMinCents: number | null;
  budgetMaxCents: number | null;
  assignedContractorId: string | null;
  invitedContractorIds: string[];
  acceptedAtMs: number | null;
  startedAtMs: number | null;
  completedAtMs: number | null;
  notesInternal: string;
  linkedExpenseId: string | null;
  createdAtMs: number;
  updatedAtMs: number;
};

export type WorkOrderUpdateRecord = {
  id: string;
  workOrderId: string;
  actorRole: "landlord" | "contractor" | "admin";
  actorId: string;
  updateType:
    | "created"
    | "invited"
    | "accepted"
    | "declined"
    | "status_changed"
    | "note"
    | "photo"
    | "invoice"
    | "completed";
  message: string;
  attachmentUrl: string | null;
  createdAtMs: number;
};

export type CreateWorkOrderInput = {
  propertyId: string;
  unitId?: string | null;
  title: string;
  description?: string;
  category?: string;
  priority?: WorkOrderPriority;
  budgetMinCents?: number | null;
  budgetMaxCents?: number | null;
  assignedContractorId?: string | null;
  invitedContractorIds?: string[];
  notesInternal?: string;
};

export async function createWorkOrder(payload: CreateWorkOrderInput): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>("/work-orders", {
    method: "POST",
    body: payload,
  });
  if (!res?.ok || !res.item) throw new Error("Failed to create work order");
  return res.item;
}

export async function listWorkOrders(status?: string): Promise<WorkOrderRecord[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await apiFetch<{ ok: boolean; items: WorkOrderRecord[] }>(`/work-orders${query}`, {
    method: "GET",
  });
  return Array.isArray(res?.items) ? res.items : [];
}

export async function getWorkOrder(workOrderId: string): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/work-orders/${encodeURIComponent(workOrderId)}`,
    { method: "GET" }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to load work order");
  return res.item;
}

export async function patchWorkOrder(
  workOrderId: string,
  patch: Partial<CreateWorkOrderInput> & { status?: WorkOrderStatus; linkedExpenseId?: string | null }
): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/work-orders/${encodeURIComponent(workOrderId)}`,
    { method: "PATCH", body: patch }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to update work order");
  return res.item;
}

export async function acceptWorkOrder(workOrderId: string): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/work-orders/${encodeURIComponent(workOrderId)}/accept`,
    { method: "POST" }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to accept work order");
  return res.item;
}

export async function declineWorkOrder(workOrderId: string): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/work-orders/${encodeURIComponent(workOrderId)}/decline`,
    { method: "POST" }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to decline work order");
  return res.item;
}

export async function startWorkOrder(workOrderId: string): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/work-orders/${encodeURIComponent(workOrderId)}/start`,
    { method: "POST" }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to start work order");
  return res.item;
}

export async function completeWorkOrder(workOrderId: string): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/work-orders/${encodeURIComponent(workOrderId)}/complete`,
    { method: "POST" }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to complete work order");
  return res.item;
}

export async function listWorkOrderUpdates(workOrderId: string): Promise<WorkOrderUpdateRecord[]> {
  const res = await apiFetch<{ ok: boolean; items: WorkOrderUpdateRecord[] }>(
    `/work-orders/${encodeURIComponent(workOrderId)}/updates`,
    { method: "GET" }
  );
  return Array.isArray(res?.items) ? res.items : [];
}

export async function addWorkOrderUpdate(
  workOrderId: string,
  payload: { updateType?: string; message: string; attachmentUrl?: string | null }
) {
  const res = await apiFetch<{ ok: boolean }>(`/work-orders/${encodeURIComponent(workOrderId)}/updates`, {
    method: "POST",
    body: payload,
  });
  if (!res?.ok) throw new Error("Failed to add work order update");
  return res;
}

export type ContractorProfile = {
  id: string;
  userId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  serviceCategories: string[];
  serviceAreas: string[];
  bio: string;
  isActive: boolean;
  invitedByLandlordIds: string[];
  createdAtMs: number;
  updatedAtMs: number;
};

export type ContractorInvite = {
  id: string;
  landlordId: string;
  email: string;
  token: string;
  status: "pending" | "accepted" | "expired";
  createdAtMs: number;
  expiresAtMs?: number | null;
  acceptedAtMs: number | null;
  acceptedByUserId?: string;
  inviteLink?: string;
};

export async function getContractorProfile(): Promise<ContractorProfile | null> {
  const res = await apiFetch<{ ok: boolean; profile: ContractorProfile | null }>("/contractor/profile", {
    method: "GET",
  });
  return res?.profile || null;
}

export async function createContractorProfile(payload: Partial<ContractorProfile>) {
  const res = await apiFetch<{ ok: boolean; profile: ContractorProfile }>("/contractor/profile", {
    method: "POST",
    body: payload,
  });
  if (!res?.ok || !res.profile) throw new Error("Failed to save contractor profile");
  return res.profile;
}

export async function patchContractorProfile(payload: Partial<ContractorProfile>) {
  const res = await apiFetch<{ ok: boolean; profile: ContractorProfile }>("/contractor/profile", {
    method: "PATCH",
    body: payload,
  });
  if (!res?.ok || !res.profile) throw new Error("Failed to update contractor profile");
  return res.profile;
}

export async function listContractorInvites(): Promise<ContractorInvite[]> {
  const res = await apiFetch<{ ok: boolean; invites: ContractorInvite[] }>("/contractor/invites", {
    method: "GET",
  });
  return Array.isArray(res?.invites) ? res.invites : [];
}

export async function createContractorInvite(payload: { email: string; message?: string }) {
  const res = await apiFetch<{ ok: boolean; invite: ContractorInvite }>("/contractor/invites", {
    method: "POST",
    body: payload,
  });
  if (!res?.ok || !res.invite) throw new Error("Failed to create contractor invite");
  return res.invite;
}

export async function resendContractorInvite(inviteId: string) {
  const res = await apiFetch<{ ok: boolean; invite: ContractorInvite }>(
    `/contractor/invites/${encodeURIComponent(inviteId)}/resend`,
    { method: "POST" }
  );
  if (!res?.ok || !res.invite) throw new Error("Failed to resend contractor invite");
  return res.invite;
}

export async function acceptContractorInvite(token: string, payload?: Partial<ContractorProfile>) {
  const res = await apiFetch<{ ok: boolean }>(`/contractor/invites/${encodeURIComponent(token)}/accept`, {
    method: "POST",
    body: payload || {},
  });
  if (!res?.ok) throw new Error("Failed to accept contractor invite");
  return res;
}
