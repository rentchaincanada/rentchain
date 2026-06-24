import type {
  LandlordCompanyRelationship,
  PropertyManagerCompanyEvaluationRequest,
  PropertyManagerCompanyEvaluationDecision,
  PropertyManagerCompanyEvaluationReason,
  PropertyManagerCompanyMembership,
  PropertyManagerCompanyRelationshipScope,
  PropertyManagerCompanyStaffAssignment,
  PropertyManagerCompanyStaffAssignmentRole,
} from "./propertyManagerCompanyTypes";
import {
  LANDLORD_COMPANY_RELATIONSHIP_STATUSES,
  PROPERTY_MANAGER_COMPANY_MEMBERSHIP_STATUSES,
  PROPERTY_MANAGER_COMPANY_PROPERTY_SCOPE_MODES,
  PROPERTY_MANAGER_COMPANY_ROLES,
  PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENT_ROLES,
  PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENT_STATUSES,
  PROPERTY_MANAGER_COMPANY_WORKSPACE_SCOPES,
} from "./propertyManagerCompanyTypes";
import { buildRelationshipScope, isAssignmentScopeWithinRelationshipScope } from "./propertyManagerCompanyModel";

const ROLE_ALLOWED_ACTIONS: Record<PropertyManagerCompanyStaffAssignmentRole, readonly string[]> = {
  regional_manager: ["view", "edit", "approve", "assign", "message", "export"],
  property_manager: ["view", "create", "edit", "approve", "assign", "message", "export"],
  leasing_agent: ["view", "create", "edit", "message"],
  office_administrator: ["view", "create", "edit", "message"],
  maintenance_coordinator: ["view", "create", "edit", "assign", "message"],
  read_only_staff: ["view"],
};

function denied(
  request: PropertyManagerCompanyEvaluationRequest,
  reason: PropertyManagerCompanyEvaluationReason,
  scope?: PropertyManagerCompanyRelationshipScope | null
): PropertyManagerCompanyEvaluationDecision {
  return {
    allowed: false,
    relationship: request.membership ? "company_staff" : "none",
    reason,
    actorUserId: request.actorUserId || null,
    actorCompanyId: request.membership?.companyId || request.relationship?.propertyManagerCompanyId || null,
    actingForLandlordId: request.actingForLandlordId || null,
    relationshipId: request.relationship?.relationshipId || null,
    role: request.assignment?.staffRole || request.membership?.role || null,
    scope: scope || request.relationship?.relationshipScope || null,
    auditRequired: true,
  };
}

function allowed(
  request: PropertyManagerCompanyEvaluationRequest,
  scope: PropertyManagerCompanyRelationshipScope
): PropertyManagerCompanyEvaluationDecision {
  return {
    allowed: true,
    relationship: "company_staff",
    reason: "allowed_company_staff",
    actorUserId: request.actorUserId || null,
    actorCompanyId: request.membership?.companyId || null,
    actingForLandlordId: request.actingForLandlordId || null,
    relationshipId: request.relationship?.relationshipId || null,
    role: request.assignment?.staffRole || null,
    scope,
    auditRequired:
      request.action !== "view" || request.routeWorkspace === "payments" || request.routeWorkspace === "evidence_exports",
  };
}

function isOwnerOnlyAction(request: PropertyManagerCompanyEvaluationRequest): boolean {
  return (
    request.action === "billing_access" ||
    request.routeWorkspace === "settings_billing" ||
    request.targetResourceType === "billing_settings"
  );
}

function hasPropertyAccess(scope: PropertyManagerCompanyRelationshipScope, propertyId?: string | null): boolean {
  if (scope.propertyScope.mode === "all_current_properties") return true;
  if (!propertyId) return false;
  return scope.propertyScope.propertyIds.includes(propertyId);
}

function assignmentScope(assignment: PropertyManagerCompanyStaffAssignment): PropertyManagerCompanyRelationshipScope {
  return {
    propertyScope: assignment.propertyScope,
    workspaceScopes: assignment.workspaceScopes,
  };
}

function hasValidMembershipShape(membership: PropertyManagerCompanyMembership): PropertyManagerCompanyEvaluationReason | null {
  if (!PROPERTY_MANAGER_COMPANY_ROLES.includes(membership.role)) return "invalid_membership_role";
  if (!PROPERTY_MANAGER_COMPANY_MEMBERSHIP_STATUSES.includes(membership.status)) return "invalid_membership_status";
  return null;
}

function hasValidRelationshipShape(relationship: LandlordCompanyRelationship): PropertyManagerCompanyEvaluationReason | null {
  if (!LANDLORD_COMPANY_RELATIONSHIP_STATUSES.includes(relationship.status)) return "invalid_relationship_status";
  const scope = relationship.relationshipScope;
  if (!PROPERTY_MANAGER_COMPANY_PROPERTY_SCOPE_MODES.includes(scope?.propertyScope?.mode)) return "invalid_scope";
  if (!Array.isArray(scope.propertyScope.propertyIds)) return "invalid_scope";
  if (!Array.isArray(scope.workspaceScopes)) return "invalid_scope";
  if (!scope.workspaceScopes.every((workspace) => PROPERTY_MANAGER_COMPANY_WORKSPACE_SCOPES.includes(workspace))) {
    return "invalid_scope";
  }
  return null;
}

function hasValidAssignmentShape(assignment: PropertyManagerCompanyStaffAssignment): PropertyManagerCompanyEvaluationReason | null {
  if (!PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENT_ROLES.includes(assignment.staffRole)) return "invalid_assignment_role";
  if (!PROPERTY_MANAGER_COMPANY_STAFF_ASSIGNMENT_STATUSES.includes(assignment.status)) return "invalid_assignment_status";
  const scope = assignmentScope(assignment);
  if (!PROPERTY_MANAGER_COMPANY_PROPERTY_SCOPE_MODES.includes(scope.propertyScope?.mode)) return "invalid_assignment_scope";
  if (!Array.isArray(scope.propertyScope.propertyIds)) return "invalid_assignment_scope";
  if (!Array.isArray(scope.workspaceScopes)) return "invalid_assignment_scope";
  if (!scope.workspaceScopes.every((workspace) => PROPERTY_MANAGER_COMPANY_WORKSPACE_SCOPES.includes(workspace))) {
    return "invalid_assignment_scope";
  }
  try {
    buildRelationshipScope({
      propertyScope: scope.propertyScope,
      workspaceScopes: scope.workspaceScopes,
    });
  } catch {
    return "invalid_assignment_scope";
  }
  return null;
}

export function evaluatePropertyManagerCompanyAccess(
  request: PropertyManagerCompanyEvaluationRequest
): PropertyManagerCompanyEvaluationDecision {
  if (!request.actorUserId) return denied(request, "missing_actor");
  if (!request.actingForLandlordId) return denied(request, "missing_landlord_scope");
  if (request.explicitDenyReasons?.length) return denied(request, "explicit_deny");
  if (isOwnerOnlyAction(request)) return denied(request, "owner_only_action");

  const membership = request.membership;
  if (!membership) return denied(request, "missing_company_membership");
  const invalidMembershipReason = hasValidMembershipShape(membership);
  if (invalidMembershipReason) return denied(request, invalidMembershipReason);
  if (membership.status !== "active") return denied(request, "membership_not_active");
  if (membership.userId !== request.actorUserId) return denied(request, "membership_actor_mismatch");

  const relationship = request.relationship;
  if (!relationship) return denied(request, "missing_landlord_company_relationship");
  const invalidRelationshipReason = hasValidRelationshipShape(relationship);
  if (invalidRelationshipReason) return denied(request, invalidRelationshipReason, relationship.relationshipScope);
  if (relationship.status !== "active") return denied(request, "relationship_not_active", relationship.relationshipScope);
  if (relationship.landlordId !== request.actingForLandlordId) {
    return denied(request, "relationship_landlord_mismatch", relationship.relationshipScope);
  }
  if (relationship.propertyManagerCompanyId !== membership.companyId) {
    return denied(request, "relationship_landlord_mismatch", relationship.relationshipScope);
  }

  const assignment = request.assignment;
  if (!assignment) return denied(request, "missing_staff_assignment", relationship.relationshipScope);
  const invalidAssignmentReason = hasValidAssignmentShape(assignment);
  const assignmentResolvedScope = assignmentScope(assignment);
  if (invalidAssignmentReason) return denied(request, invalidAssignmentReason, assignmentResolvedScope);
  if (assignment.propertyManagerCompanyId !== membership.companyId) {
    return denied(request, "assignment_company_mismatch", assignmentResolvedScope);
  }
  if (assignment.relationshipId !== relationship.relationshipId) {
    return denied(request, "assignment_relationship_mismatch", assignmentResolvedScope);
  }
  if (assignment.staffUserId !== request.actorUserId) {
    return denied(request, "assignment_actor_mismatch", assignmentResolvedScope);
  }
  if (assignment.status !== "active") return denied(request, "assignment_not_active", assignmentResolvedScope);
  if (!isAssignmentScopeWithinRelationshipScope(assignmentResolvedScope, relationship.relationshipScope)) {
    return denied(request, "assignment_scope_exceeds_relationship", assignmentResolvedScope);
  }

  const scope = assignmentResolvedScope;
  if (!scope.workspaceScopes.includes(request.routeWorkspace)) return denied(request, "workspace_scope_denied", scope);
  if (!hasPropertyAccess(scope, request.propertyId)) return denied(request, "property_scope_denied", scope);
  if (!ROLE_ALLOWED_ACTIONS[assignment.staffRole].includes(request.action)) return denied(request, "role_template_denied", scope);

  return allowed(request, scope);
}
