export const DELEGATED_ACCESS_ROLES = [
  "property_manager",
  "assistant_office_admin",
  "maintenance_coordinator",
  "contractor",
  "contractor_admin",
  "read_only_auditor",
] as const;

export type DelegatedAccessRole = (typeof DELEGATED_ACCESS_ROLES)[number];

export const DELEGATED_ACCESS_INVITATION_STATUSES = ["pending", "accepted", "expired", "cancelled"] as const;

export type DelegatedAccessInvitationStatus = (typeof DELEGATED_ACCESS_INVITATION_STATUSES)[number];

export const DELEGATED_ACCESS_GRANT_STATUSES = ["active", "revoked", "suspended", "expired"] as const;

export type DelegatedAccessGrantStatus = (typeof DELEGATED_ACCESS_GRANT_STATUSES)[number];

export const DELEGATED_ACCESS_WORKSPACE_SCOPES = [
  "dashboard",
  "operations",
  "properties",
  "tenants",
  "leases",
  "payments",
  "unified_inbox",
  "scheduling",
  "work_orders",
  "evidence_exports",
  "settings_billing",
] as const;

export type DelegatedAccessWorkspaceScope = (typeof DELEGATED_ACCESS_WORKSPACE_SCOPES)[number];

export const DELEGATED_ACCESS_PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "approve",
  "export",
  "assign",
  "message",
  "revoke",
  "billing_access",
] as const;

export type DelegatedAccessPermissionAction = (typeof DELEGATED_ACCESS_PERMISSION_ACTIONS)[number];

export const DELEGATED_ACCESS_PROPERTY_SCOPE_MODES = [
  "all_current_properties",
  "selected",
  "resource_only",
  "none",
] as const;

export type DelegatedAccessPropertyScopeMode = (typeof DELEGATED_ACCESS_PROPERTY_SCOPE_MODES)[number];

export const DELEGATED_ACCESS_TARGET_RESOURCE_TYPES = [
  "landlord_workspace",
  "dashboard",
  "operation",
  "property",
  "unit",
  "tenant",
  "lease",
  "payment",
  "message_thread",
  "inbox_record",
  "schedule_item",
  "schedule_note",
  "maintenance_request",
  "work_order",
  "contractor_job",
  "screening_activity",
  "evidence_item",
  "export_package",
  "delegate_invitation",
  "delegate_grant",
  "billing_settings",
] as const;

export type DelegatedAccessTargetResourceType = (typeof DELEGATED_ACCESS_TARGET_RESOURCE_TYPES)[number];

export const DELEGATED_ACCESS_AUDIT_EVENT_TYPES = [
  "delegated_invite_created",
  "delegated_invite_sent",
  "delegated_invite_accepted",
  "delegated_invite_expired",
  "delegated_invite_cancelled",
  "delegated_role_changed",
  "delegated_scope_changed",
  "delegated_access_revoked",
  "delegated_session_invalidated",
  "delegated_workspace_opened",
  "delegated_resource_viewed",
  "delegated_message_sent",
  "delegated_operation_assigned",
  "delegated_work_order_updated",
  "delegated_schedule_updated",
  "delegated_payment_viewed",
  "delegated_payment_action_attempted",
  "delegated_evidence_uploaded",
  "delegated_export_generated",
  "delegated_access_denied",
] as const;

export type DelegatedAccessAuditEventType = (typeof DELEGATED_ACCESS_AUDIT_EVENT_TYPES)[number];

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
  landlordId: string;
  inviteeEmail: string;
  role: DelegatedAccessRole;
  propertyScope: DelegatedAccessPropertyScope;
  workspaceScopes: DelegatedAccessWorkspaceScope[];
  resourceScope: DelegatedAccessResourceScope;
  permissionFlags: DelegatedAccessPermissionAction[];
  status: DelegatedAccessInvitationStatus;
  tokenHash: string;
  expiresAt: string;
  createdByUserId: string;
  createdAt: string;
  acceptedByUserId: string | null;
  acceptedAt: string | null;
  cancelledByUserId: string | null;
  cancelledAt: string | null;
  emailDispatch: DelegatedAccessEmailDispatchMetadata | null;
  auditEventIds: string[];
};

export type DelegatedAccessGrant = {
  grantId: string;
  landlordId: string;
  delegateUserId: string;
  delegateEmail: string | null;
  role: DelegatedAccessRole;
  status: DelegatedAccessGrantStatus;
  permissionScope: DelegatedAccessPermissionScope;
  createdByUserId: string;
  createdAt: string;
  acceptedAt: string | null;
  updatedAt: string;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revocationReason: string | null;
  auditEventIds: string[];
};

export type DelegatedAccessActorContext = {
  actorUserId: string | null;
  actingForLandlordId: string | null;
  isLandlordOwner: boolean;
};

export type DelegatedAccessEvaluationRequest = DelegatedAccessActorContext & {
  routeWorkspace: DelegatedAccessWorkspaceScope;
  action: DelegatedAccessPermissionAction;
  targetResourceType: DelegatedAccessTargetResourceType;
  targetResourceId?: string | null;
  propertyId?: string | null;
  resourceId?: string | null;
  grant?: DelegatedAccessGrant | null;
  explicitDenyReasons?: string[];
};

export type DelegatedAccessDecisionReason =
  | "allowed_owner"
  | "allowed_delegate"
  | "missing_actor"
  | "missing_landlord_scope"
  | "explicit_deny"
  | "missing_delegate_grant"
  | "grant_not_active"
  | "grant_landlord_mismatch"
  | "workspace_scope_denied"
  | "property_scope_denied"
  | "resource_scope_denied"
  | "permission_flag_denied"
  | "owner_only_action";

export type DelegatedAccessEvaluationDecision = {
  allowed: boolean;
  relationship: "owner" | "delegate" | "none";
  reason: DelegatedAccessDecisionReason;
  actorUserId: string | null;
  actingForLandlordId: string | null;
  delegatedRole: DelegatedAccessRole | null;
  permissionScope: DelegatedAccessPermissionScope | null;
  auditRequired: boolean;
};

export type DelegatedAccessAuditOutcome = "allowed" | "denied" | "revoked" | "expired" | "failed" | "blocked";

export type DelegatedAccessEmailDispatchStatus = "not_sent" | "sent" | "failed";

export type DelegatedAccessEmailDispatchMetadata = {
  status: DelegatedAccessEmailDispatchStatus;
  attemptCount: number;
  lastAttemptAt: string | null;
  lastSentAt: string | null;
  lastFailedAt: string | null;
  lastFailureReason: string | null;
};

export type DelegatedAccessAuditEvent = {
  eventId: string;
  eventType: DelegatedAccessAuditEventType;
  actorUserId: string;
  actingForLandlordId: string;
  delegatedRole: DelegatedAccessRole | "landlord_owner" | null;
  permissionScope: DelegatedAccessPermissionScope | null;
  sessionId: string | null;
  actionType: string;
  targetResourceType: DelegatedAccessTargetResourceType;
  targetResourceId: string | null;
  timestamp: string;
  ipAddress: string | null;
  deviceMetadata: Record<string, string> | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  outcome: DelegatedAccessAuditOutcome;
  reason: string | null;
  metadataOnly: true;
  appendOnly: true;
  immutable: true;
};
