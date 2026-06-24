import crypto from "crypto";
import {
  LANDLORD_COMPANY_RELATIONSHIP_STATUSES,
  PROPERTY_MANAGER_COMPANY_MEMBERSHIP_STATUSES,
  PROPERTY_MANAGER_COMPANY_PROPERTY_SCOPE_MODES,
  PROPERTY_MANAGER_COMPANY_ROLES,
  PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENT_ROLES,
  PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENT_STATUSES,
  PROPERTY_MANAGER_COMPANY_STATUSES,
  PROPERTY_MANAGER_COMPANY_WORKSPACE_SCOPES,
  type LandlordCompanyRelationship,
  type LandlordCompanyRelationshipStatus,
  type PropertyManagerCompany,
  type PropertyManagerCompanyMembership,
  type PropertyManagerCompanyMembershipStatus,
  type PropertyManagerCompanyPropertyScope,
  type PropertyManagerCompanyRelationshipScope,
  type PropertyManagerCompanyRole,
  type PropertyManagerCompanyStaffAssignment,
  type PropertyManagerCompanyStaffAssignmentRole,
  type PropertyManagerCompanyStaffAssignmentStatus,
  type PropertyManagerCompanyStatus,
  type PropertyManagerCompanyWorkspaceScope,
} from "./propertyManagerCompanyTypes";

type CompanyInput = {
  companyId?: string;
  companyName: string;
  status?: PropertyManagerCompanyStatus;
  createdByUserId: string;
  createdAt?: string;
};

type MembershipInput = {
  membershipId?: string;
  companyId: string;
  userId: string;
  role: string;
  status?: PropertyManagerCompanyMembershipStatus;
  invitedByUserId?: string | null;
  createdByUserId: string;
  createdAt?: string;
};

type RelationshipInput = {
  relationshipId?: string;
  landlordId: string;
  propertyManagerCompanyId: string;
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: string[];
  createdByLandlordOwnerUserId: string;
  acceptedByCompanyAdminUserId?: string | null;
  status?: LandlordCompanyRelationshipStatus;
  createdAt?: string;
  startedAt?: string | null;
};

type StaffAssignmentInput = {
  assignmentId?: string;
  relationship: LandlordCompanyRelationship;
  assignedByMembership: PropertyManagerCompanyMembership;
  staffMembership: PropertyManagerCompanyMembership;
  staffRole: string;
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: string[];
  createdAt?: string;
};

export class PropertyManagerCompanyValidationError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PropertyManagerCompanyValidationError";
  }
}

function cleanString(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function requireString(value: unknown, code: string, max = 500): string {
  const text = cleanString(value, max);
  if (!text) throw new PropertyManagerCompanyValidationError(code);
  return text;
}

function parseDate(value: unknown, code: string): string {
  const text = requireString(value, code, 120);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) throw new PropertyManagerCompanyValidationError(code);
  return new Date(parsed).toISOString();
}

function hashId(prefix: string, parts: readonly unknown[]): string {
  const digest = crypto.createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24);
  return `${prefix}_${digest}`;
}

function dedupeStrings<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function isPropertyManagerCompanyStatus(value: unknown): value is PropertyManagerCompanyStatus {
  return PROPERTY_MANAGER_COMPANY_STATUSES.includes(value as PropertyManagerCompanyStatus);
}

export function isPropertyManagerCompanyMembershipStatus(value: unknown): value is PropertyManagerCompanyMembershipStatus {
  return PROPERTY_MANAGER_COMPANY_MEMBERSHIP_STATUSES.includes(value as PropertyManagerCompanyMembershipStatus);
}

export function isPropertyManagerCompanyRole(value: unknown): value is PropertyManagerCompanyRole {
  return PROPERTY_MANAGER_COMPANY_ROLES.includes(value as PropertyManagerCompanyRole);
}

export function isPropertyManagerCompanyStaffAssignmentRole(value: unknown): value is PropertyManagerCompanyStaffAssignmentRole {
  return PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENT_ROLES.includes(value as PropertyManagerCompanyStaffAssignmentRole);
}

export function isPropertyManagerCompanyStaffAssignmentStatus(value: unknown): value is PropertyManagerCompanyStaffAssignmentStatus {
  return PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENT_STATUSES.includes(value as PropertyManagerCompanyStaffAssignmentStatus);
}

export function isLandlordCompanyRelationshipStatus(value: unknown): value is LandlordCompanyRelationshipStatus {
  return LANDLORD_COMPANY_RELATIONSHIP_STATUSES.includes(value as LandlordCompanyRelationshipStatus);
}

export function assertPropertyManagerCompanyRole(value: unknown): PropertyManagerCompanyRole {
  if (!isPropertyManagerCompanyRole(value)) throw new PropertyManagerCompanyValidationError("invalid_company_role");
  return value;
}

export function assertPropertyManagerCompanyStaffAssignmentRole(value: unknown): PropertyManagerCompanyStaffAssignmentRole {
  if (!isPropertyManagerCompanyStaffAssignmentRole(value)) {
    throw new PropertyManagerCompanyValidationError("invalid_staff_assignment_role");
  }
  return value;
}

function assertWorkspaceScope(value: unknown): PropertyManagerCompanyWorkspaceScope {
  if (!PROPERTY_MANAGER_COMPANY_WORKSPACE_SCOPES.includes(value as PropertyManagerCompanyWorkspaceScope)) {
    throw new PropertyManagerCompanyValidationError("invalid_workspace_scope");
  }
  return value as PropertyManagerCompanyWorkspaceScope;
}

function normalizeWorkspaceScopes(values: string[]): PropertyManagerCompanyWorkspaceScope[] {
  const scopes = dedupeStrings(values.map(assertWorkspaceScope));
  if (scopes.length === 0) throw new PropertyManagerCompanyValidationError("missing_workspace_scope");
  if (scopes.includes("settings_billing")) {
    throw new PropertyManagerCompanyValidationError("company_billing_scope_not_allowed");
  }
  return scopes;
}

export function normalizeCompanyDisplayLabel(companyName: unknown): string {
  return requireString(companyName, "missing_company_name", 160).replace(/\s+/g, " ");
}

export function normalizeCompanyPropertyScope(scope: PropertyManagerCompanyPropertyScope): PropertyManagerCompanyPropertyScope {
  if (!PROPERTY_MANAGER_COMPANY_PROPERTY_SCOPE_MODES.includes(scope?.mode)) {
    throw new PropertyManagerCompanyValidationError("invalid_property_scope_mode");
  }
  const propertyIds = dedupeStrings((scope.propertyIds || []).map((id) => requireString(id, "invalid_property_scope")));
  if (scope.mode === "selected_properties" && propertyIds.length === 0) {
    throw new PropertyManagerCompanyValidationError("missing_selected_property_scope");
  }
  if (scope.mode === "all_current_properties" && propertyIds.length > 0) {
    throw new PropertyManagerCompanyValidationError("property_scope_mode_mismatch");
  }
  return {
    mode: scope.mode,
    propertyIds,
  };
}

export function buildRelationshipScope(input: {
  propertyScope: PropertyManagerCompanyPropertyScope;
  workspaceScopes: string[];
}): PropertyManagerCompanyRelationshipScope {
  return {
    propertyScope: normalizeCompanyPropertyScope(input.propertyScope),
    workspaceScopes: normalizeWorkspaceScopes(input.workspaceScopes),
  };
}

function assignmentScope(assignment: Pick<PropertyManagerCompanyStaffAssignment, "propertyScope" | "workspaceScopes">): PropertyManagerCompanyRelationshipScope {
  return {
    propertyScope: assignment.propertyScope,
    workspaceScopes: assignment.workspaceScopes,
  };
}

export function isAssignmentScopeWithinRelationshipScope(
  assignmentScopeInput: PropertyManagerCompanyRelationshipScope,
  relationshipScope: PropertyManagerCompanyRelationshipScope
): boolean {
  const normalizedAssignmentScope = buildRelationshipScope({
    propertyScope: assignmentScopeInput.propertyScope,
    workspaceScopes: assignmentScopeInput.workspaceScopes,
  });
  const normalizedRelationshipScope = buildRelationshipScope({
    propertyScope: relationshipScope.propertyScope,
    workspaceScopes: relationshipScope.workspaceScopes,
  });
  const workspaceAllowed = normalizedAssignmentScope.workspaceScopes.every((workspace) =>
    normalizedRelationshipScope.workspaceScopes.includes(workspace)
  );
  if (!workspaceAllowed) return false;

  if (normalizedRelationshipScope.propertyScope.mode === "all_current_properties") return true;
  if (normalizedAssignmentScope.propertyScope.mode === "all_current_properties") return false;
  return normalizedAssignmentScope.propertyScope.propertyIds.every((propertyId) =>
    normalizedRelationshipScope.propertyScope.propertyIds.includes(propertyId)
  );
}

function requireActiveMembershipForCompany(
  membership: PropertyManagerCompanyMembership,
  companyId: string,
  codePrefix: string
) {
  if (!isPropertyManagerCompanyRole(membership.role)) {
    throw new PropertyManagerCompanyValidationError("invalid_company_role");
  }
  if (!isPropertyManagerCompanyMembershipStatus(membership.status)) {
    throw new PropertyManagerCompanyValidationError("invalid_membership_status");
  }
  if (membership.companyId !== companyId) {
    throw new PropertyManagerCompanyValidationError(`${codePrefix}_membership_company_mismatch`);
  }
  if (membership.status !== "active") {
    throw new PropertyManagerCompanyValidationError("membership_not_active");
  }
}

function requireAssignmentManager(membership: PropertyManagerCompanyMembership, companyId: string) {
  requireActiveMembershipForCompany(membership, companyId, "assignment_manager");
  if (!["company_owner", "company_admin"].includes(membership.role)) {
    throw new PropertyManagerCompanyValidationError("company_assignment_manager_required");
  }
}

function requireStaffMembership(membership: PropertyManagerCompanyMembership, companyId: string) {
  requireActiveMembershipForCompany(membership, companyId, "staff_assignment");
}

function requireActiveRelationshipForAssignment(relationship: LandlordCompanyRelationship) {
  if (!isLandlordCompanyRelationshipStatus(relationship.status)) {
    throw new PropertyManagerCompanyValidationError("invalid_relationship_status");
  }
  if (relationship.status !== "active") {
    throw new PropertyManagerCompanyValidationError("relationship_not_active");
  }
  buildRelationshipScope({
    propertyScope: relationship.relationshipScope.propertyScope,
    workspaceScopes: relationship.relationshipScope.workspaceScopes,
  });
}

function validateAssignmentScopeWithinRelationship(
  assignmentScopeInput: PropertyManagerCompanyRelationshipScope,
  relationshipScope: PropertyManagerCompanyRelationshipScope
) {
  if (!isAssignmentScopeWithinRelationshipScope(assignmentScopeInput, relationshipScope)) {
    throw new PropertyManagerCompanyValidationError("assignment_scope_exceeds_relationship_scope");
  }
}

function cleanReason(value: string | null | undefined): string | null {
  const text = cleanString(value, 500);
  return text || null;
}

export function createPropertyManagerCompany(input: CompanyInput): PropertyManagerCompany {
  const companyName = normalizeCompanyDisplayLabel(input.companyName);
  const createdByUserId = requireString(input.createdByUserId, "missing_created_by_user_id");
  const createdAt = input.createdAt ? parseDate(input.createdAt, "invalid_created_at") : new Date().toISOString();
  const status = input.status || "active";
  if (!isPropertyManagerCompanyStatus(status)) throw new PropertyManagerCompanyValidationError("invalid_company_status");
  return {
    companyId: input.companyId || hashId("pm_company", [companyName, createdByUserId, createdAt]),
    companyName,
    safeDisplayLabel: companyName,
    status,
    createdByUserId,
    createdAt,
    updatedAt: createdAt,
  };
}

export function createPropertyManagerCompanyMembership(input: MembershipInput): PropertyManagerCompanyMembership {
  const companyId = requireString(input.companyId, "missing_company_id");
  const userId = requireString(input.userId, "missing_user_id");
  const createdByUserId = requireString(input.createdByUserId, "missing_created_by_user_id");
  const role = assertPropertyManagerCompanyRole(input.role);
  const createdAt = input.createdAt ? parseDate(input.createdAt, "invalid_created_at") : new Date().toISOString();
  const status = input.status || "active";
  if (!isPropertyManagerCompanyMembershipStatus(status)) {
    throw new PropertyManagerCompanyValidationError("invalid_membership_status");
  }
  return {
    membershipId: input.membershipId || hashId("pm_membership", [companyId, userId, role, createdAt]),
    companyId,
    userId,
    role,
    status,
    invitedByUserId: input.invitedByUserId ? cleanString(input.invitedByUserId, 200) : null,
    createdByUserId,
    createdAt,
    updatedAt: createdAt,
    suspendedAt: null,
    suspendedByUserId: null,
    removedAt: null,
    removedByUserId: null,
  };
}

export function suspendPropertyManagerCompanyMembership(
  membership: PropertyManagerCompanyMembership,
  context: { suspendedByUserId: string; suspendedAt?: string }
): PropertyManagerCompanyMembership {
  if (membership.status !== "active") throw new PropertyManagerCompanyValidationError("membership_not_active");
  const suspendedByUserId = requireString(context.suspendedByUserId, "missing_suspended_by_user_id");
  const suspendedAt = context.suspendedAt ? parseDate(context.suspendedAt, "invalid_suspended_at") : new Date().toISOString();
  return {
    ...membership,
    status: "suspended",
    suspendedAt,
    suspendedByUserId,
    updatedAt: suspendedAt,
  };
}

export function removePropertyManagerCompanyMembership(
  membership: PropertyManagerCompanyMembership,
  context: { removedByUserId: string; removedAt?: string }
): PropertyManagerCompanyMembership {
  if (membership.status === "removed") throw new PropertyManagerCompanyValidationError("membership_already_removed");
  const removedByUserId = requireString(context.removedByUserId, "missing_removed_by_user_id");
  const removedAt = context.removedAt ? parseDate(context.removedAt, "invalid_removed_at") : new Date().toISOString();
  return {
    ...membership,
    status: "removed",
    removedAt,
    removedByUserId,
    updatedAt: removedAt,
  };
}

export function createLandlordCompanyRelationship(input: RelationshipInput): LandlordCompanyRelationship {
  const landlordId = requireString(input.landlordId, "missing_landlord_id");
  const propertyManagerCompanyId = requireString(input.propertyManagerCompanyId, "missing_property_manager_company_id");
  const createdByLandlordOwnerUserId = requireString(input.createdByLandlordOwnerUserId, "missing_created_by_landlord_owner_user_id");
  const createdAt = input.createdAt ? parseDate(input.createdAt, "invalid_created_at") : new Date().toISOString();
  const status = input.status || "pending";
  if (!isLandlordCompanyRelationshipStatus(status)) {
    throw new PropertyManagerCompanyValidationError("invalid_relationship_status");
  }
  if (status !== "pending") {
    throw new PropertyManagerCompanyValidationError("relationship_activation_requires_company_acceptance");
  }
  const relationshipScope = buildRelationshipScope(input);
  if (input.acceptedByCompanyAdminUserId) {
    throw new PropertyManagerCompanyValidationError("relationship_activation_requires_company_acceptance");
  }
  if (input.startedAt) throw new PropertyManagerCompanyValidationError("relationship_activation_requires_company_acceptance");
  return {
    relationshipId: input.relationshipId || hashId("landlord_pm_relationship", [landlordId, propertyManagerCompanyId, createdAt]),
    landlordId,
    propertyManagerCompanyId,
    status,
    relationshipScope,
    createdByLandlordOwnerUserId,
    acceptedByCompanyAdminUserId: null,
    createdAt,
    updatedAt: createdAt,
    startedAt: null,
    suspendedAt: null,
    suspendedByUserId: null,
    reactivatedAt: null,
    terminatedAt: null,
    terminatedByUserId: null,
    terminationReason: null,
    auditEventIds: [],
  };
}

export function activateLandlordCompanyRelationship(
  relationship: LandlordCompanyRelationship,
  context: { acceptedByCompanyAdminUserId: string; startedAt?: string }
): LandlordCompanyRelationship {
  if (relationship.status !== "pending") throw new PropertyManagerCompanyValidationError("relationship_not_pending");
  const acceptedByCompanyAdminUserId = requireString(context.acceptedByCompanyAdminUserId, "missing_accepted_by_company_admin_user_id");
  const startedAt = context.startedAt ? parseDate(context.startedAt, "invalid_started_at") : new Date().toISOString();
  return {
    ...relationship,
    status: "active",
    acceptedByCompanyAdminUserId,
    startedAt,
    updatedAt: startedAt,
  };
}

export function suspendLandlordCompanyRelationship(
  relationship: LandlordCompanyRelationship,
  context: { suspendedByUserId: string; suspendedAt?: string }
): LandlordCompanyRelationship {
  if (relationship.status !== "active") throw new PropertyManagerCompanyValidationError("relationship_not_active");
  const suspendedByUserId = requireString(context.suspendedByUserId, "missing_suspended_by_user_id");
  const suspendedAt = context.suspendedAt ? parseDate(context.suspendedAt, "invalid_suspended_at") : new Date().toISOString();
  return {
    ...relationship,
    status: "suspended",
    suspendedAt,
    suspendedByUserId,
    updatedAt: suspendedAt,
  };
}

export function reactivateLandlordCompanyRelationship(
  relationship: LandlordCompanyRelationship,
  context: { reactivatedAt?: string }
): LandlordCompanyRelationship {
  if (relationship.status !== "suspended") throw new PropertyManagerCompanyValidationError("relationship_not_suspended");
  const reactivatedAt = context.reactivatedAt ? parseDate(context.reactivatedAt, "invalid_reactivated_at") : new Date().toISOString();
  return {
    ...relationship,
    status: "active",
    reactivatedAt,
    updatedAt: reactivatedAt,
  };
}

export function terminateLandlordCompanyRelationship(
  relationship: LandlordCompanyRelationship,
  context: { terminatedByUserId: string; terminatedAt?: string; reason?: string | null }
): LandlordCompanyRelationship {
  if (relationship.status === "terminated") throw new PropertyManagerCompanyValidationError("relationship_already_terminated");
  const terminatedByUserId = requireString(context.terminatedByUserId, "missing_terminated_by_user_id");
  const terminatedAt = context.terminatedAt ? parseDate(context.terminatedAt, "invalid_terminated_at") : new Date().toISOString();
  return {
    ...relationship,
    status: "terminated",
    terminatedAt,
    terminatedByUserId,
    terminationReason: context.reason ? cleanString(context.reason, 500) : null,
    updatedAt: terminatedAt,
  };
}

export function createPropertyManagerCompanyStaffAssignment(input: StaffAssignmentInput): PropertyManagerCompanyStaffAssignment {
  const relationship = input.relationship;
  requireActiveRelationshipForAssignment(relationship);
  requireAssignmentManager(input.assignedByMembership, relationship.propertyManagerCompanyId);
  requireStaffMembership(input.staffMembership, relationship.propertyManagerCompanyId);
  const staffRole = assertPropertyManagerCompanyStaffAssignmentRole(input.staffRole);
  const createdAt = input.createdAt ? parseDate(input.createdAt, "invalid_created_at") : new Date().toISOString();
  const scope = buildRelationshipScope({
    propertyScope: input.propertyScope,
    workspaceScopes: input.workspaceScopes,
  });
  validateAssignmentScopeWithinRelationship(scope, relationship.relationshipScope);

  return {
    assignmentId:
      input.assignmentId ||
      hashId("pm_staff_assignment", [relationship.relationshipId, input.staffMembership.userId, staffRole, createdAt]),
    propertyManagerCompanyId: relationship.propertyManagerCompanyId,
    relationshipId: relationship.relationshipId,
    staffUserId: input.staffMembership.userId,
    assignedByUserId: input.assignedByMembership.userId,
    staffRole,
    status: "active",
    propertyScope: scope.propertyScope,
    workspaceScopes: scope.workspaceScopes,
    createdAt,
    updatedAt: createdAt,
    suspendedAt: null,
    suspendedByUserId: null,
    suspendedReason: null,
    reactivatedAt: null,
    reactivatedByUserId: null,
    removedAt: null,
    removedByUserId: null,
    removedReason: null,
    auditEventIds: [],
  };
}

export function suspendPropertyManagerCompanyStaffAssignment(
  assignment: PropertyManagerCompanyStaffAssignment,
  context: { actorMembership: PropertyManagerCompanyMembership; suspendedAt?: string; reason?: string | null }
): PropertyManagerCompanyStaffAssignment {
  requireAssignmentManager(context.actorMembership, assignment.propertyManagerCompanyId);
  if (assignment.status !== "active") throw new PropertyManagerCompanyValidationError("staff_assignment_not_active");
  const suspendedAt = context.suspendedAt ? parseDate(context.suspendedAt, "invalid_suspended_at") : new Date().toISOString();
  return {
    ...assignment,
    status: "suspended",
    suspendedAt,
    suspendedByUserId: context.actorMembership.userId,
    suspendedReason: cleanReason(context.reason),
    updatedAt: suspendedAt,
  };
}

export function reactivatePropertyManagerCompanyStaffAssignment(
  assignment: PropertyManagerCompanyStaffAssignment,
  context: {
    actorMembership: PropertyManagerCompanyMembership;
    staffMembership: PropertyManagerCompanyMembership;
    relationship: LandlordCompanyRelationship;
    reactivatedAt?: string;
  }
): PropertyManagerCompanyStaffAssignment {
  requireAssignmentManager(context.actorMembership, assignment.propertyManagerCompanyId);
  requireStaffMembership(context.staffMembership, assignment.propertyManagerCompanyId);
  if (context.staffMembership.userId !== assignment.staffUserId) {
    throw new PropertyManagerCompanyValidationError("staff_assignment_membership_mismatch");
  }
  if (context.relationship.relationshipId !== assignment.relationshipId) {
    throw new PropertyManagerCompanyValidationError("staff_assignment_relationship_mismatch");
  }
  requireActiveRelationshipForAssignment(context.relationship);
  if (assignment.status !== "suspended") throw new PropertyManagerCompanyValidationError("staff_assignment_not_suspended");
  validateAssignmentScopeWithinRelationship(assignmentScope(assignment), context.relationship.relationshipScope);
  const reactivatedAt = context.reactivatedAt ? parseDate(context.reactivatedAt, "invalid_reactivated_at") : new Date().toISOString();
  return {
    ...assignment,
    status: "active",
    reactivatedAt,
    reactivatedByUserId: context.actorMembership.userId,
    updatedAt: reactivatedAt,
  };
}

export function removePropertyManagerCompanyStaffAssignment(
  assignment: PropertyManagerCompanyStaffAssignment,
  context: { actorMembership: PropertyManagerCompanyMembership; removedAt?: string; reason?: string | null }
): PropertyManagerCompanyStaffAssignment {
  requireAssignmentManager(context.actorMembership, assignment.propertyManagerCompanyId);
  if (assignment.status === "removed") throw new PropertyManagerCompanyValidationError("staff_assignment_already_removed");
  if (!isPropertyManagerCompanyStaffAssignmentStatus(assignment.status)) {
    throw new PropertyManagerCompanyValidationError("invalid_staff_assignment_status");
  }
  const removedAt = context.removedAt ? parseDate(context.removedAt, "invalid_removed_at") : new Date().toISOString();
  return {
    ...assignment,
    status: "removed",
    removedAt,
    removedByUserId: context.actorMembership.userId,
    removedReason: cleanReason(context.reason),
    updatedAt: removedAt,
  };
}
