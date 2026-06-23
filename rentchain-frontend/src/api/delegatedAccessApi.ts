import { apiFetch } from "./apiFetch";

export type DelegatedAccessRole =
  | "property_manager"
  | "assistant_office_admin"
  | "maintenance_coordinator"
  | "contractor"
  | "contractor_admin"
  | "read_only_auditor";

export type DelegatedAccessInvitationStatus = "pending" | "accepted" | "expired" | "cancelled";
export type DelegatedAccessGrantStatus = "active" | "revoked" | "suspended" | "expired";
export type DelegatedAccessWorkspaceScope =
  | "dashboard"
  | "operations"
  | "properties"
  | "tenants"
  | "leases"
  | "payments"
  | "unified_inbox"
  | "scheduling"
  | "work_orders"
  | "evidence_exports";
export type DelegatedAccessPermissionAction = "view" | "create" | "edit" | "approve" | "export" | "assign" | "message";
export type DelegatedAccessPropertyScopeMode = "all_current_properties" | "selected" | "resource_only" | "none";

export type DelegatedAccessPropertyScope = {
  mode: DelegatedAccessPropertyScopeMode;
  propertyIds: string[];
  unitIds?: string[];
};

export type DelegatedAccessResourceScope = {
  workOrderIds?: string[];
  maintenanceRequestIds?: string[];
  messageThreadIds?: string[];
  evidencePackageIds?: string[];
  exportPackageIds?: string[];
  contractorJobIds?: string[];
};

export type DelegatedAccessPermissionScope = {
  role: DelegatedAccessRole;
  workspaceScopes: DelegatedAccessWorkspaceScope[];
  propertyScope: DelegatedAccessPropertyScope;
  resourceScope: DelegatedAccessResourceScope;
  permissionFlags: DelegatedAccessPermissionAction[];
  billingAccess: false;
  exportAccess: boolean;
};

export type DelegatedAccessInvitation = {
  invitationId: string;
  inviteeEmail: string;
  role: DelegatedAccessRole;
  propertyScope: DelegatedAccessPropertyScope;
  workspaceScopes: DelegatedAccessWorkspaceScope[];
  resourceScope?: DelegatedAccessResourceScope;
  permissionFlags: DelegatedAccessPermissionAction[];
  status: DelegatedAccessInvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  emailDispatch?: {
    status: "sent" | "failed" | "not_sent";
    attemptCount?: number;
    lastAttemptAt?: string | null;
    lastSentAt?: string | null;
    lastFailedAt?: string | null;
    lastFailureReason?: string | null;
  };
};

export type DelegatedAccessGrant = {
  grantId: string;
  delegateUserId: string;
  delegateEmail: string | null;
  role: DelegatedAccessRole;
  status: DelegatedAccessGrantStatus;
  permissionScope: DelegatedAccessPermissionScope;
  createdAt: string;
  acceptedAt: string | null;
  updatedAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
};

export type DelegatedAccessActiveGrant = Omit<DelegatedAccessGrant, "grantId" | "delegateUserId"> & {
  landlordWorkspaceLabel: string;
  propertyScopeSummary: string;
};

export type DelegatedAccessDelegateSummary = {
  delegateUserId: string;
  delegateEmail: string | null;
  roles: DelegatedAccessRole[];
  activeGrantCount: number;
  revokedGrantCount: number;
  workspaceScopes: DelegatedAccessWorkspaceScope[];
  propertyScopeSummary: string;
  lastActiveAt: string | null;
};

export type CreateDelegatedAccessInvitationInput = {
  inviteeEmail: string;
  role: DelegatedAccessRole;
  propertyScope: DelegatedAccessPropertyScope;
  workspaceScopes: DelegatedAccessWorkspaceScope[];
  permissionFlags: DelegatedAccessPermissionAction[];
  expiresAt: string;
};

export async function fetchDelegatedAccessDelegates(): Promise<DelegatedAccessDelegateSummary[]> {
  const response = await apiFetch<{ ok: true; delegates: DelegatedAccessDelegateSummary[] }>(
    "/landlord/delegated-access/delegates"
  );
  return response.delegates || [];
}

export async function fetchDelegatedAccessGrants(): Promise<DelegatedAccessGrant[]> {
  const response = await apiFetch<{ ok: true; grants: DelegatedAccessGrant[] }>("/landlord/delegated-access/grants");
  return response.grants || [];
}

export async function fetchMyDelegatedAccessGrants(): Promise<DelegatedAccessActiveGrant[]> {
  const response = await apiFetch<{ ok: true; grants: DelegatedAccessActiveGrant[] }>(
    "/delegated-access/my-grants"
  );
  return response.grants || [];
}

export async function fetchDelegatedAccessInvitations(): Promise<DelegatedAccessInvitation[]> {
  const response = await apiFetch<{ ok: true; invitations: DelegatedAccessInvitation[] }>(
    "/landlord/delegated-access/invitations"
  );
  return response.invitations || [];
}

export async function createDelegatedAccessInvitation(input: CreateDelegatedAccessInvitationInput) {
  return apiFetch<{
    ok: true;
    invitation: DelegatedAccessInvitation;
    emailDispatch?: { status: "sent" | "failed" | "not_sent" };
  }>("/landlord/delegated-access/invitations", {
    method: "POST",
    body: input,
  });
}

export async function cancelDelegatedAccessInvitation(invitationId: string) {
  return apiFetch<{ ok: true; invitation: DelegatedAccessInvitation }>(
    `/landlord/delegated-access/invitations/${encodeURIComponent(invitationId)}/cancel`,
    {
      method: "POST",
    }
  );
}

export async function acceptDelegatedAccessInvitation(token: string) {
  return apiFetch<{ ok: true; invitation: DelegatedAccessInvitation; grant: DelegatedAccessGrant }>(
    "/landlord/delegated-access/invitations/accept",
    {
      method: "POST",
      body: { token },
      suppressToasts: true,
    }
  );
}

export async function revokeDelegatedAccessGrant(grantId: string, reason?: string) {
  return apiFetch<{ ok: true; grant: DelegatedAccessGrant }>(
    `/landlord/delegated-access/grants/${encodeURIComponent(grantId)}/revoke`,
    {
      method: "POST",
      body: { reason: String(reason || "").trim() || null },
    }
  );
}
