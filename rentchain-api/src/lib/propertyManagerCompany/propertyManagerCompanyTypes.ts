export const PROPERTY_MANAGER_COMPANY_STATUSES = ["active", "suspended", "archived"] as const;

export type PropertyManagerCompanyStatus = (typeof PROPERTY_MANAGER_COMPANY_STATUSES)[number];

export const PROPERTY_MANAGER_COMPANY_MEMBERSHIP_STATUSES = ["invited", "active", "suspended", "removed"] as const;

export type PropertyManagerCompanyMembershipStatus = (typeof PROPERTY_MANAGER_COMPANY_MEMBERSHIP_STATUSES)[number];

export const PROPERTY_MANAGER_COMPANY_ROLES = [
  "company_owner",
  "company_admin",
  "regional_manager",
  "property_manager",
  "leasing_agent",
  "office_administrator",
  "maintenance_coordinator",
  "read_only_staff",
] as const;

export type PropertyManagerCompanyRole = (typeof PROPERTY_MANAGER_COMPANY_ROLES)[number];

export const LANDLORD_COMPANY_RELATIONSHIP_STATUSES = ["pending", "active", "suspended", "terminated"] as const;

export type LandlordCompanyRelationshipStatus = (typeof LANDLORD_COMPANY_RELATIONSHIP_STATUSES)[number];

export const PROPERTY_MANAGER_COMPANY_PROPERTY_SCOPE_MODES = ["all_current_properties", "selected_properties"] as const;

export type PropertyManagerCompanyPropertyScopeMode = (typeof PROPERTY_MANAGER_COMPANY_PROPERTY_SCOPE_MODES)[number];

export const PROPERTY_MANAGER_COMPANY_WORKSPACE_SCOPES = [
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

export type PropertyManagerCompanyWorkspaceScope = (typeof PROPERTY_MANAGER_COMPANY_WORKSPACE_SCOPES)[number];

export const PROPERTY_MANAGER_COMPANY_PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "approve",
  "export",
  "assign",
  "message",
  "billing_access",
] as const;

export type PropertyManagerCompanyPermissionAction = (typeof PROPERTY_MANAGER_COMPANY_PERMISSION_ACTIONS)[number];

export const PROPERTY_MANAGER_COMPANY_AUDIT_EVENT_TYPES = [
  "property_manager_company_created",
  "property_manager_company_membership_created",
  "property_manager_company_membership_suspended",
  "property_manager_company_membership_removed",
  "landlord_company_relationship_created",
  "landlord_company_relationship_activated",
  "landlord_company_relationship_suspended",
  "landlord_company_relationship_reactivated",
  "landlord_company_relationship_terminated",
  "property_manager_company_staff_assignment_changed",
] as const;

export type PropertyManagerCompanyAuditEventType = (typeof PROPERTY_MANAGER_COMPANY_AUDIT_EVENT_TYPES)[number];

export const PROPERTY_MANAGER_COMPANY_AUDIT_TARGET_RESOURCE_TYPES = [
  "property_manager_company",
  "company_membership",
  "landlord_company_relationship",
  "staff_assignment",
  "landlord_workspace",
  "property",
  "workspace_scope",
  "billing_settings",
] as const;

export type PropertyManagerCompanyAuditTargetResourceType = (typeof PROPERTY_MANAGER_COMPANY_AUDIT_TARGET_RESOURCE_TYPES)[number];

export type PropertyManagerCompanyPropertyScope = {
  mode: PropertyManagerCompanyPropertyScopeMode;
  propertyIds: string[];
};

export type PropertyManagerCompanyRelationshipScope = {
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: PropertyManagerCompanyWorkspaceScope[];
};

export type PropertyManagerCompany = {
  companyId: string;
  companyName: string;
  safeDisplayLabel: string;
  status: PropertyManagerCompanyStatus;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type PropertyManagerCompanyMembership = {
  membershipId: string;
  companyId: string;
  userId: string;
  role: PropertyManagerCompanyRole;
  status: PropertyManagerCompanyMembershipStatus;
  invitedByUserId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  suspendedByUserId: string | null;
  removedAt: string | null;
  removedByUserId: string | null;
};

export type LandlordCompanyRelationship = {
  relationshipId: string;
  landlordId: string;
  propertyManagerCompanyId: string;
  status: LandlordCompanyRelationshipStatus;
  relationshipScope: PropertyManagerCompanyRelationshipScope;
  createdByLandlordOwnerUserId: string;
  acceptedByCompanyAdminUserId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  suspendedAt: string | null;
  suspendedByUserId: string | null;
  reactivatedAt: string | null;
  terminatedAt: string | null;
  terminatedByUserId: string | null;
  terminationReason: string | null;
  auditEventIds: string[];
};

export type PropertyManagerCompanyEvaluationRequest = {
  actorUserId: string | null;
  actingForLandlordId: string | null;
  routeWorkspace: PropertyManagerCompanyWorkspaceScope;
  action: PropertyManagerCompanyPermissionAction;
  targetResourceType: PropertyManagerCompanyAuditTargetResourceType;
  targetResourceId?: string | null;
  propertyId?: string | null;
  membership?: PropertyManagerCompanyMembership | null;
  relationship?: LandlordCompanyRelationship | null;
  explicitDenyReasons?: string[];
};

export type PropertyManagerCompanyEvaluationReason =
  | "allowed_company_staff"
  | "missing_actor"
  | "missing_landlord_scope"
  | "explicit_deny"
  | "missing_company_membership"
  | "membership_not_active"
  | "membership_actor_mismatch"
  | "invalid_membership_role"
  | "invalid_membership_status"
  | "missing_landlord_company_relationship"
  | "invalid_relationship_status"
  | "invalid_scope"
  | "relationship_not_active"
  | "relationship_landlord_mismatch"
  | "workspace_scope_denied"
  | "property_scope_denied"
  | "role_template_denied"
  | "owner_only_action";

export type PropertyManagerCompanyEvaluationDecision = {
  allowed: boolean;
  relationship: "company_staff" | "none";
  reason: PropertyManagerCompanyEvaluationReason;
  actorUserId: string | null;
  actorCompanyId: string | null;
  actingForLandlordId: string | null;
  relationshipId: string | null;
  role: PropertyManagerCompanyRole | null;
  scope: PropertyManagerCompanyRelationshipScope | null;
  auditRequired: boolean;
};

export type PropertyManagerCompanyAuditOutcome = "allowed" | "denied" | "created" | "suspended" | "removed" | "terminated" | "failed";

export type PropertyManagerCompanyAuditEvent = {
  eventId: string;
  eventType: PropertyManagerCompanyAuditEventType;
  actorUserId: string;
  actorCompanyId: string | null;
  actingForLandlordId: string | null;
  relationshipId: string | null;
  role: PropertyManagerCompanyRole | null;
  scope: PropertyManagerCompanyRelationshipScope | null;
  targetResourceType: PropertyManagerCompanyAuditTargetResourceType;
  targetResourceId: string | null;
  outcome: PropertyManagerCompanyAuditOutcome;
  timestamp: string;
  reason: string | null;
  metadataOnly: true;
  appendOnly: true;
  immutable: true;
};
