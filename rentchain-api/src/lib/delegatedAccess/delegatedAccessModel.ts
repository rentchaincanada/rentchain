import crypto from "crypto";
import {
  DELEGATED_ACCESS_GRANT_STATUSES,
  DELEGATED_ACCESS_INVITATION_STATUSES,
  DELEGATED_ACCESS_PERMISSION_ACTIONS,
  DELEGATED_ACCESS_PROPERTY_SCOPE_MODES,
  DELEGATED_ACCESS_ROLES,
  DELEGATED_ACCESS_WORKSPACE_SCOPES,
  type DelegatedAccessGrant,
  type DelegatedAccessGrantStatus,
  type DelegatedAccessInvitation,
  type DelegatedAccessInvitationStatus,
  type DelegatedAccessPermissionAction,
  type DelegatedAccessPermissionScope,
  type DelegatedAccessPropertyScope,
  type DelegatedAccessResourceScope,
  type DelegatedAccessRole,
  type DelegatedAccessWorkspaceScope,
} from "./delegatedAccessTypes";

type InvitationInput = {
  invitationId?: string;
  landlordId: string;
  inviteeEmail: string;
  role: string;
  propertyScope: DelegatedAccessPropertyScope;
  workspaceScopes: string[];
  resourceScope?: DelegatedAccessResourceScope;
  permissionFlags: string[];
  tokenHash: string;
  expiresAt: string;
  createdByUserId: string;
  createdAt?: string;
};

type GrantInput = {
  grantId?: string;
  landlordId: string;
  delegateUserId: string;
  delegateEmail?: string | null;
  role: string;
  propertyScope: DelegatedAccessPropertyScope;
  workspaceScopes: string[];
  resourceScope?: DelegatedAccessResourceScope;
  permissionFlags: string[];
  createdByUserId: string;
  createdAt?: string;
  acceptedAt?: string | null;
};

export class DelegatedAccessValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "DelegatedAccessValidationError";
  }
}

function cleanString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function requireString(value: unknown, code: string, max = 500): string {
  const text = cleanString(value, max);
  if (!text) throw new DelegatedAccessValidationError(code);
  return text;
}

function parseDate(value: unknown, code: string): string {
  const text = requireString(value, code, 120);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) throw new DelegatedAccessValidationError(code);
  return new Date(parsed).toISOString();
}

function hashId(prefix: string, parts: readonly unknown[]): string {
  const digest = crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
  return `${prefix}_${digest}`;
}

export function isDelegatedAccessRole(value: unknown): value is DelegatedAccessRole {
  return DELEGATED_ACCESS_ROLES.includes(value as DelegatedAccessRole);
}

export function assertDelegatedAccessRole(value: unknown): DelegatedAccessRole {
  if (!isDelegatedAccessRole(value)) throw new DelegatedAccessValidationError("invalid_delegated_role");
  return value;
}

export function isDelegatedAccessInvitationStatus(value: unknown): value is DelegatedAccessInvitationStatus {
  return DELEGATED_ACCESS_INVITATION_STATUSES.includes(value as DelegatedAccessInvitationStatus);
}

export function isDelegatedAccessGrantStatus(value: unknown): value is DelegatedAccessGrantStatus {
  return DELEGATED_ACCESS_GRANT_STATUSES.includes(value as DelegatedAccessGrantStatus);
}

export function assertDelegatedWorkspaceScope(value: unknown): DelegatedAccessWorkspaceScope {
  if (!DELEGATED_ACCESS_WORKSPACE_SCOPES.includes(value as DelegatedAccessWorkspaceScope)) {
    throw new DelegatedAccessValidationError("invalid_workspace_scope");
  }
  return value as DelegatedAccessWorkspaceScope;
}

export function assertDelegatedPermissionAction(value: unknown): DelegatedAccessPermissionAction {
  if (!DELEGATED_ACCESS_PERMISSION_ACTIONS.includes(value as DelegatedAccessPermissionAction)) {
    throw new DelegatedAccessValidationError("invalid_permission_action");
  }
  return value as DelegatedAccessPermissionAction;
}

function dedupeStrings<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function validateWorkspaceScopes(values: string[]): DelegatedAccessWorkspaceScope[] {
  const scopes = dedupeStrings(values.map(assertDelegatedWorkspaceScope));
  if (scopes.length === 0) throw new DelegatedAccessValidationError("missing_workspace_scope");
  if (scopes.includes("settings_billing")) {
    throw new DelegatedAccessValidationError("delegated_billing_scope_not_allowed");
  }
  return scopes;
}

function validatePermissionFlags(values: string[]): DelegatedAccessPermissionAction[] {
  const flags = dedupeStrings(values.map(assertDelegatedPermissionAction));
  if (flags.length === 0) throw new DelegatedAccessValidationError("missing_permission_flags");
  if (flags.includes("billing_access") || flags.includes("revoke")) {
    throw new DelegatedAccessValidationError("owner_only_permission_not_allowed");
  }
  return flags;
}

export function normalizeDelegatedPropertyScope(scope: DelegatedAccessPropertyScope): DelegatedAccessPropertyScope {
  if (!DELEGATED_ACCESS_PROPERTY_SCOPE_MODES.includes(scope?.mode)) {
    throw new DelegatedAccessValidationError("invalid_property_scope_mode");
  }
  const propertyIds = dedupeStrings((scope.propertyIds || []).map((id) => requireString(id, "invalid_property_scope")));
  const unitIds = dedupeStrings((scope.unitIds || []).map((id) => requireString(id, "invalid_unit_scope")));
  if (scope.mode === "selected" && propertyIds.length === 0) {
    throw new DelegatedAccessValidationError("missing_selected_property_scope");
  }
  if ((scope.mode === "none" || scope.mode === "resource_only") && propertyIds.length > 0) {
    throw new DelegatedAccessValidationError("property_scope_mode_mismatch");
  }
  return {
    mode: scope.mode,
    propertyIds,
    ...(unitIds.length ? { unitIds } : {}),
  };
}

function normalizeResourceScope(scope: DelegatedAccessResourceScope = {}): DelegatedAccessResourceScope {
  const normalize = (values: string[] | undefined, code: string) =>
    values?.map((value) => requireString(value, code)).filter(Boolean) || [];
  return {
    workOrderIds: dedupeStrings(normalize(scope.workOrderIds, "invalid_work_order_scope")),
    maintenanceRequestIds: dedupeStrings(normalize(scope.maintenanceRequestIds, "invalid_maintenance_scope")),
    messageThreadIds: dedupeStrings(normalize(scope.messageThreadIds, "invalid_message_scope")),
    evidencePackageIds: dedupeStrings(normalize(scope.evidencePackageIds, "invalid_evidence_scope")),
    exportPackageIds: dedupeStrings(normalize(scope.exportPackageIds, "invalid_export_scope")),
    contractorJobIds: dedupeStrings(normalize(scope.contractorJobIds, "invalid_contractor_job_scope")),
  };
}

export function buildDelegatedPermissionScope(input: {
  role: string;
  workspaceScopes: string[];
  propertyScope: DelegatedAccessPropertyScope;
  resourceScope?: DelegatedAccessResourceScope;
  permissionFlags: string[];
}): DelegatedAccessPermissionScope {
  const role = assertDelegatedAccessRole(input.role);
  const workspaceScopes = validateWorkspaceScopes(input.workspaceScopes);
  const permissionFlags = validatePermissionFlags(input.permissionFlags);
  return {
    role,
    workspaceScopes,
    propertyScope: normalizeDelegatedPropertyScope(input.propertyScope),
    resourceScope: normalizeResourceScope(input.resourceScope),
    permissionFlags,
    billingAccess: false,
    exportAccess: permissionFlags.includes("export"),
  };
}

export function createDelegatedAccessInvitation(input: InvitationInput): DelegatedAccessInvitation {
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const inviteeEmail = requireString(input.inviteeEmail, "missing_invitee_email").toLowerCase();
  const createdByUserId = requireString(input.createdByUserId, "missing_created_by_user_id");
  const tokenHash = requireString(input.tokenHash, "missing_token_hash");
  const expiresAt = parseDate(input.expiresAt, "invalid_expires_at");
  const createdAt = input.createdAt ? parseDate(input.createdAt, "invalid_created_at") : new Date().toISOString();
  const permissionScope = buildDelegatedPermissionScope(input);
  return {
    invitationId:
      input.invitationId ||
      hashId("delegated_invitation", [landlordId, inviteeEmail, permissionScope.role, tokenHash, createdAt]),
    landlordId,
    inviteeEmail,
    role: permissionScope.role,
    propertyScope: permissionScope.propertyScope,
    workspaceScopes: permissionScope.workspaceScopes,
    resourceScope: permissionScope.resourceScope,
    permissionFlags: permissionScope.permissionFlags,
    status: "pending",
    tokenHash,
    expiresAt,
    createdByUserId,
    createdAt,
    acceptedByUserId: null,
    acceptedAt: null,
    cancelledByUserId: null,
    cancelledAt: null,
    emailDispatch: {
      status: "not_sent",
      attemptCount: 0,
      lastAttemptAt: null,
      lastSentAt: null,
      lastFailedAt: null,
      lastFailureReason: null,
    },
    auditEventIds: [],
  };
}

export function transitionDelegatedInvitationStatus(
  invitation: DelegatedAccessInvitation,
  nextStatus: DelegatedAccessInvitationStatus,
  context: { actorUserId?: string | null; timestamp?: string; acceptedByUserId?: string | null } = {}
): DelegatedAccessInvitation {
  if (!isDelegatedAccessInvitationStatus(nextStatus)) {
    throw new DelegatedAccessValidationError("invalid_invitation_status");
  }
  if (invitation.status !== "pending") {
    throw new DelegatedAccessValidationError("invitation_not_pending");
  }
  const timestamp = context.timestamp ? parseDate(context.timestamp, "invalid_invitation_transition_timestamp") : new Date().toISOString();
  if (nextStatus === "accepted") {
    if (Date.parse(invitation.expiresAt) <= Date.parse(timestamp)) {
      throw new DelegatedAccessValidationError("invitation_expired");
    }
    const acceptedByUserId = requireString(context.acceptedByUserId, "missing_accepted_by_user_id");
    return { ...invitation, status: "accepted", acceptedByUserId, acceptedAt: timestamp };
  }
  if (nextStatus === "cancelled") {
    const cancelledByUserId = requireString(context.actorUserId, "missing_cancelled_by_user_id");
    return { ...invitation, status: "cancelled", cancelledByUserId, cancelledAt: timestamp };
  }
  if (nextStatus === "expired") {
    return { ...invitation, status: "expired" };
  }
  return invitation;
}

export function isDelegatedInvitationExpired(invitation: DelegatedAccessInvitation, now: string | Date = new Date()): boolean {
  const nowMs = typeof now === "string" ? Date.parse(now) : now.getTime();
  return invitation.status === "pending" && Number.isFinite(nowMs) && Date.parse(invitation.expiresAt) <= nowMs;
}

export function createDelegatedAccessGrant(input: GrantInput): DelegatedAccessGrant {
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const delegateUserId = requireString(input.delegateUserId, "missing_delegate_user_id");
  const createdByUserId = requireString(input.createdByUserId, "missing_created_by_user_id");
  const createdAt = input.createdAt ? parseDate(input.createdAt, "invalid_created_at") : new Date().toISOString();
  const permissionScope = buildDelegatedPermissionScope(input);
  return {
    grantId: input.grantId || hashId("delegated_grant", [landlordId, delegateUserId, permissionScope.role, createdAt]),
    landlordId,
    delegateUserId,
    delegateEmail: input.delegateEmail ? cleanString(input.delegateEmail, 320).toLowerCase() : null,
    role: permissionScope.role,
    status: "active",
    permissionScope,
    createdByUserId,
    createdAt,
    acceptedAt: input.acceptedAt ? parseDate(input.acceptedAt, "invalid_accepted_at") : null,
    updatedAt: createdAt,
    revokedAt: null,
    revokedByUserId: null,
    revocationReason: null,
    auditEventIds: [],
  };
}

export function revokeDelegatedAccessGrant(
  grant: DelegatedAccessGrant,
  context: { revokedByUserId: string; revokedAt?: string; reason?: string | null }
): DelegatedAccessGrant {
  if (grant.status !== "active") throw new DelegatedAccessValidationError("grant_not_active");
  const revokedByUserId = requireString(context.revokedByUserId, "missing_revoked_by_user_id");
  const revokedAt = context.revokedAt ? parseDate(context.revokedAt, "invalid_revoked_at") : new Date().toISOString();
  return {
    ...grant,
    status: "revoked",
    revokedAt,
    revokedByUserId,
    revocationReason: context.reason ? cleanString(context.reason, 500) : null,
    updatedAt: revokedAt,
  };
}
