import { apiFetch } from "./apiFetch";

export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";
export type WorkOrderStatus =
  | "open"
  | "invited"
  | "assigned"
  | "accepted"
  | "scheduled"
  | "blocked"
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
  scheduledFor?: number | null;
  serviceStartedAt?: number | null;
  serviceCompletedAt?: number | null;
  lastExecutionUpdateAt?: number | null;
  executionBlockedReason?: string | null;
  completionSummary?: string | null;
  completionOutcome?: "completed" | "partially_completed" | "follow_up_required" | null;
  completedByActorRole?: "contractor" | "landlord" | "admin" | null;
  completedByActorId?: string | null;
  completionConfirmedByLandlordAt?: number | null;
  completionConfirmedByLandlordBy?: string | null;
  resolutionStatus?: "completed_pending_review" | "landlord_approved" | "tenant_pending_signoff" | "resolved" | "follow_up_required" | null;
  landlordApprovedAt?: number | null;
  landlordApprovedBy?: string | null;
  tenantSignoffStatus?: "pending" | "accepted" | "declined" | null;
  tenantSignedOffAt?: number | null;
  tenantDeclinedAt?: number | null;
  tenantDeclineReason?: string | null;
  followUpRequired?: boolean | null;
  followUpReason?: string | null;
  finalResolvedAt?: number | null;
  reworkCycle?: {
    cycleNumber: number;
    status: "not_started" | "assigned" | "in_progress" | "completed" | "cancelled";
    createdAt: number;
    createdBy: string;
    assignedContractorId?: string | null;
    assignedAt?: number | null;
    startedAt?: number | null;
    completedAt?: number | null;
    completionSummary?: string | null;
    evidenceSnapshot?: string[] | null;
  } | null;
  reworkHistory?: Array<{
    cycleNumber: number;
    startedAt?: number | null;
    completedAt?: number | null;
    outcome?: "resolved" | "failed" | "partial" | null;
    notes?: string | null;
  }> | null;
  reopenedAt?: number | null;
  reopenedByActorId?: string | null;
  reopenedByActorRole?: "landlord" | "admin" | null;
  reopenReason?: string | null;
  evidence?: WorkOrderEvidenceItem[];
  notesInternal: string;
  linkedExpenseId: string | null;
  createdAtMs: number;
  updatedAtMs: number;
};

export type WorkOrderEvidenceType = "before" | "during" | "after" | "completion" | "inspection" | "damage" | "other";
export type WorkOrderEvidenceVisibility = "internal" | "landlord_contractor" | "tenant_safe";

export type WorkOrderEvidenceItem = {
  id: string;
  url?: string | null;
  filename?: string | null;
  contentType?: string | null;
  uploadedAt: number;
  uploadedByActorRole: "contractor" | "landlord" | "admin";
  uploadedByActorId: string;
  evidenceType: WorkOrderEvidenceType;
  caption?: string | null;
  visibility: WorkOrderEvidenceVisibility;
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
    | "scheduled"
    | "started"
    | "blocked"
    | "note"
    | "photo"
    | "invoice"
    | "completed"
    | "confirmed"
    | "reopened";
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
  patch: Partial<CreateWorkOrderInput> & {
    status?: WorkOrderStatus;
    linkedExpenseId?: string | null;
    scheduledFor?: number | null;
    blockedReason?: string;
    completionSummary?: string;
    completionOutcome?: "completed" | "partially_completed" | "follow_up_required";
  }
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

export async function confirmWorkOrderCompletion(workOrderId: string): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/landlord/work-orders/${encodeURIComponent(workOrderId)}/confirm-completion`,
    { method: "POST" }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to confirm work order completion");
  return res.item;
}

export async function approveWorkOrderResolution(workOrderId: string): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/landlord/work-orders/${encodeURIComponent(workOrderId)}/approve-resolution`,
    { method: "POST" }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to approve work order resolution");
  return res.item;
}

export async function markWorkOrderFollowUpRequired(
  workOrderId: string,
  payload: { reason: string }
): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/landlord/work-orders/${encodeURIComponent(workOrderId)}/mark-follow-up-required`,
    { method: "POST", body: payload }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to mark work order follow-up required");
  return res.item;
}

export async function startWorkOrderRework(workOrderId: string): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/landlord/work-orders/${encodeURIComponent(workOrderId)}/start-rework`,
    { method: "POST" }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to start rework cycle");
  return res.item;
}

export async function assignWorkOrderRework(
  workOrderId: string,
  payload: { contractorId: string }
): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/landlord/work-orders/${encodeURIComponent(workOrderId)}/assign-rework`,
    { method: "POST", body: payload }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to assign rework cycle");
  return res.item;
}

export async function completeWorkOrderRework(
  workOrderId: string,
  payload?: { outcome?: "resolved" | "partial"; notes?: string }
): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/landlord/work-orders/${encodeURIComponent(workOrderId)}/complete-rework`,
    { method: "POST", body: payload || {} }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to complete rework cycle");
  return res.item;
}

export async function reopenWorkOrder(
  workOrderId: string,
  payload: { reason: string; status?: "in_progress" | "blocked" }
): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/landlord/work-orders/${encodeURIComponent(workOrderId)}/reopen`,
    { method: "POST", body: payload }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to reopen work order");
  return res.item;
}

export async function uploadWorkOrderEvidence(
  workOrderId: string,
  payload: {
    file: File;
    evidenceType: WorkOrderEvidenceType;
    caption?: string;
    visibility: WorkOrderEvidenceVisibility;
  }
): Promise<WorkOrderRecord> {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("evidenceType", payload.evidenceType);
  form.append("visibility", payload.visibility);
  if (payload.caption) form.append("caption", payload.caption);
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/landlord/work-orders/${encodeURIComponent(workOrderId)}/evidence`,
    { method: "POST", body: form }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to upload work order evidence");
  return res.item;
}

export async function updateWorkOrderEvidence(
  workOrderId: string,
  evidenceId: string,
  payload: {
    caption?: string;
    visibility?: WorkOrderEvidenceVisibility;
    evidenceType?: WorkOrderEvidenceType;
  }
): Promise<WorkOrderRecord> {
  const res = await apiFetch<{ ok: boolean; item: WorkOrderRecord }>(
    `/landlord/work-orders/${encodeURIComponent(workOrderId)}/evidence/${encodeURIComponent(evidenceId)}`,
    { method: "PATCH", body: payload }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to update work order evidence");
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

export type PublicContractorInviteStatus = "valid" | "expired" | "accepted" | "not_found";

export type PublicContractorInvite = {
  id: string;
  landlordId: string | null;
  landlordName: string | null;
  emailMasked: string | null;
  expiresAtMs: number | null;
  createdAtMs: number | null;
};

export async function getContractorProfile(): Promise<ContractorProfile | null> {
  const res = await apiFetch<{ ok: boolean; profile: ContractorProfile | null }>("/contractor/profile", {
    method: "GET",
  });
  return res?.profile || null;
}

export async function getContractorProfileById(contractorId: string): Promise<ContractorProfile | null> {
  const res = await apiFetch<{ ok: boolean; profile: ContractorProfile | null }>(
    `/contractor/${encodeURIComponent(contractorId)}/profile`,
    { method: "GET", allowStatuses: [403, 404] }
  );
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
  const res = await apiFetch<{ ok: boolean }>(`/contractor/invites/${encodeURIComponent(token)}/redeem`, {
    method: "POST",
    body: payload || {},
  });
  if (!res?.ok) throw new Error("Failed to accept contractor invite");
  return res;
}

export async function getPublicContractorInvite(token: string): Promise<{
  status: PublicContractorInviteStatus;
  invite: PublicContractorInvite | null;
}> {
  const res = await apiFetch<{
    ok: boolean;
    status?: PublicContractorInviteStatus;
    invite?: PublicContractorInvite | null;
  }>(`/public/contractor-invites/${encodeURIComponent(token)}`, {
    method: "GET",
  });
  return {
    status: res?.status || "not_found",
    invite: res?.invite || null,
  };
}
