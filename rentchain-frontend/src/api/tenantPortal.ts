import { tenantApiFetch } from "./tenantApiFetch";

export type TenantWorkspaceContext = {
  ok?: boolean;
  authority: "applicant" | "active_tenant" | "invite" | null;
  propertyId: string | null;
  rc_prop_id: string | null;
  applicationId: string | null;
  leaseId: string | null;
  tenantId: string | null;
  unitId: string | null;
  invitedEmail: string | null;
};

export type TenantWorkspaceProperty = {
  propertyId: string;
  rc_prop_id: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  features: string[];
};

export type TenantWorkspaceApplication = {
  applicationId: string;
  status: string | null;
  missingSteps: string[];
  nextActions: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type TenantWorkspaceLease = {
  leaseId: string;
  startDate: string | null;
  endDate: string | null;
  monthlyRent: number | null;
  status: string | null;
  documentUrl: string | null;
  signatureStatus?: "not_started" | "awaiting_tenant_signature" | "awaiting_landlord_signature" | "signed" | "unavailable";
  signatureReadinessLabel?: string | null;
  signatureReadinessDescription?: string | null;
  tenantSignature?: {
    signedAt: string | null;
    signatureMethod: "typed" | "drawn" | null;
    signatureDisplayName: string | null;
  } | null;
  leasePdfStatus?: "available" | "pending" | "not_available";
  leasePdfLabel?: string | null;
  leasePdfDescription?: string | null;
  leaseExecution?: {
    executionStatus:
      | "draft"
      | "ready_for_tenant_signature"
      | "tenant_signed"
      | "ready_for_landlord_signature"
      | "landlord_signed"
      | "fully_executed"
      | "blocked";
    executionLabel: string;
    executionDescription: string;
    requiredNextAction:
      | "complete_lease_details"
      | "tenant_signature"
      | "landlord_signature"
      | "review_signed_lease"
      | "none";
    tenantSignatureStatus: "not_required" | "needed" | "completed" | "blocked";
    landlordSignatureStatus: "not_required" | "needed" | "completed" | "blocked";
    pdfStatus: "not_ready" | "ready" | "generated" | "blocked";
    completedAt: string | null;
  } | null;
  depositCents?: number | null;
  depositRequired?: boolean | null;
  depositReceived?: boolean | null;
  depositReceivedAt?: string | null;
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  paymentRequestedAt?: string | null;
  paymentCompletedAt?: string | null;
};

export type TenantWorkspaceMaintenance = {
  requestId: string;
  id?: string;
  status: string | null;
  category: string | null;
  priority: string | null;
  title: string | null;
  summary: string | null;
  assignedContractorName?: string | null;
  contractorStatus?: string | null;
  serviceStartedAt?: number | null;
  serviceCompletedAt?: number | null;
  lastExecutionUpdateAt?: number | null;
  completionSummary?: string | null;
  completionOutcome?: "completed" | "partially_completed" | "follow_up_required" | null;
  completionConfirmedByLandlordAt?: number | null;
  reopenedAt?: number | null;
  reopenedByActorId?: string | null;
  reopenedByActorRole?: "tenant" | "landlord" | "admin" | null;
  reopenReason?: string | null;
  serviceWindowStartAt?: number | null;
  serviceWindowEndAt?: number | null;
  accessRequired?: boolean | null;
  tenantConfirmationStatus?: "confirmed" | "needs_schedule_change" | null;
  tenantConfirmationUpdatedAt?: number | null;
  accessAcknowledgedAt?: number | null;
  resolutionStatus?: "completed_pending_review" | "landlord_approved" | "tenant_pending_signoff" | "resolved" | "follow_up_required" | null;
  landlordApprovedAt?: number | null;
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
    createdAt?: number | null;
    assignedAt?: number | null;
    startedAt?: number | null;
    completedAt?: number | null;
    completionSummary?: string | null;
    schedule?: {
      scheduledFor?: number | null;
      timeWindowStart?: number | null;
      timeWindowEnd?: number | null;
      status?: "not_scheduled" | "scheduled" | "contractor_confirmed" | "tenant_pending" | "confirmed" | "reschedule_requested" | "cancelled" | null;
      requiresTenantAccess?: boolean | null;
      tenantAccessStatus?: "pending" | "confirmed" | "denied" | "not_required" | null;
      tenantAccessNote?: string | null;
    } | null;
  } | null;
  reworkHistory?: Array<{
    cycleNumber: number;
    startedAt?: number | null;
    completedAt?: number | null;
    outcome?: "resolved" | "failed" | "partial" | null;
    notes?: string | null;
  }>;
  reworkReview?: {
    status?: "pending_review" | "landlord_approved" | "tenant_pending_signoff" | "closed" | "follow_up_required" | null;
    reviewedAt?: number | null;
    tenantSignoffStatus?: "pending" | "accepted" | "declined" | null;
    tenantSignedOffAt?: number | null;
    tenantDeclinedAt?: number | null;
    tenantDeclineReason?: string | null;
    closureOutcome?: "resolved" | "partial" | "needs_more_followup" | null;
    closedAt?: number | null;
  } | null;
  notifications?: {
    tenant: {
      requiresAccessConfirmation: boolean;
      requiresSignoff: boolean;
      requiresReworkAwareness: boolean;
    };
  };
  evidence?: Array<{
    id: string;
    url: string | null;
    filename?: string | null;
    contentType?: string | null;
    uploadedAt?: number | null;
    uploadedByActorRole?: string | null;
    evidenceType?: string | null;
    caption?: string | null;
    visibility?: "tenant_safe";
  }>;
  createdAt: number | null;
  updatedAt: number | null;
  statusHistory?: Array<{
    status: string | null;
    actorRole: string | null;
    actorId?: string | null;
    message: string | null;
    createdAt: number | null;
  }>;
};

export type TenantIdentityRecord = {
  identityStatus: "incomplete" | "ready" | "verified" | "limited";
  profile: {
    completionStatus: "complete" | "in_progress" | "missing" | "needs_attention";
  };
  application: {
    reusable: boolean;
    lastSubmittedAt: string | null;
  };
  documents: {
    completionStatus: "complete" | "in_progress" | "missing" | "needs_attention";
    missingCategories: string[];
  };
  screening: {
    status: "not_started" | "in_progress" | "completed" | "needs_attention" | "blocked";
    lastCompletedAt: string | null;
  };
  leases: {
    activeCount: number;
    historicalCount: number;
    lastSignedAt: string | null;
  };
  verification: {
    level: "none" | "partial" | "strong";
  };
  readinessLabel: string;
  readinessDescription: string;
};

export type TenantWorkspaceSummary = {
  context: TenantWorkspaceContext;
  property: TenantWorkspaceProperty | null;
  application: TenantWorkspaceApplication | null;
  lease: TenantWorkspaceLease | null;
  maintenance: TenantWorkspaceMaintenance[];
  tenantIdentityRecord?: TenantIdentityRecord | null;
};

export async function getTenantWorkspace(): Promise<TenantWorkspaceSummary> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceSummary }>("/tenant/workspace");
  return res?.data;
}

export async function getTenantApplicationStatus(): Promise<TenantWorkspaceApplication | null> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceApplication | null }>("/tenant/application-status");
  return res?.data ?? null;
}

export async function getTenantLeaseWorkspace(): Promise<TenantWorkspaceLease | null> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceLease | null }>("/tenant/lease");
  return res?.data ?? null;
}

export async function signTenantLease(leaseId: string): Promise<TenantWorkspaceLease | null> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceLease | null }>(
    `/tenant/leases/${encodeURIComponent(leaseId)}/sign`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }
  );
  return res?.data ?? null;
}

export async function listTenantWorkspaceMaintenance(): Promise<TenantWorkspaceMaintenance[]> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance[] }>("/tenant/maintenance-requests");
  return Array.isArray(res?.data) ? res.data : [];
}

export async function getTenantWorkspaceMaintenance(id: string): Promise<TenantWorkspaceMaintenance | null> {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance | null }>(
    `/tenant/maintenance-requests/${encodeURIComponent(id)}`
  );
  return res?.data ?? null;
}

export async function createTenantWorkspaceMaintenance(payload: {
  title: string;
  description: string;
  category: string;
  priority: string;
}) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    "/tenant/maintenance-requests",
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function updateTenantWorkspaceMaintenanceConfirmation(
  id: string,
  payload: {
    confirmationStatus?: "confirmed" | "needs_schedule_change";
    acknowledgeAccess?: boolean;
  }
) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    `/tenant/maintenance-requests/${encodeURIComponent(id)}/confirmation`,
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function updateTenantWorkspaceMaintenanceSignoff(
  id: string,
  payload: {
    decision: "resolved" | "not_resolved";
    reason?: string;
  }
) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    `/tenant/maintenance/${encodeURIComponent(id)}/signoff`,
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function updateTenantWorkspaceMaintenanceReopen(
  id: string,
  payload: {
    reason: string;
  }
) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    `/tenant/maintenance/${encodeURIComponent(id)}/reopen`,
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function updateTenantWorkspaceReworkAccess(
  id: string,
  payload: {
    decision: "confirm" | "deny";
    note?: string;
  }
) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    `/tenant/maintenance/${encodeURIComponent(id)}/confirm-rework-access`,
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function updateTenantWorkspaceReworkSignoff(
  id: string,
  payload: {
    decision: "resolved" | "not_resolved";
    reason?: string;
  }
) {
  const res = await tenantApiFetch<{ ok: boolean; data: TenantWorkspaceMaintenance }>(
    `/tenant/maintenance/${encodeURIComponent(id)}/rework-signoff`,
    {
      method: "POST",
      body: payload,
    }
  );
  return res?.data;
}

export async function redeemTenantWorkspaceInvite(token: string) {
  const res = await tenantApiFetch<{
    ok: boolean;
    data: {
      inviteId: string | null;
      propertyId: string | null;
      applicationId: string | null;
      rc_prop_id: string | null;
      status: string | null;
    };
  }>("/tenant/invite/redeem", {
    method: "POST",
    body: { token },
  });
  return res?.data;
}
