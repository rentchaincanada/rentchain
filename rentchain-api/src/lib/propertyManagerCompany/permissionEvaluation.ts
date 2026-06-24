import type {
  PropertyManagerCompanyEvaluationDecision,
  PropertyManagerCompanyEvaluationReason,
  PropertyManagerCompanyEvaluationRequest,
  PropertyManagerCompanyMembership,
  PropertyManagerCompanyRelationshipScope,
} from "./propertyManagerCompanyTypes";

const ROLE_ALLOWED_ACTIONS: Record<PropertyManagerCompanyMembership["role"], readonly string[]> = {
  company_owner: ["view", "create", "edit", "approve", "export", "assign", "message"],
  company_admin: ["view", "create", "edit", "approve", "export", "assign", "message"],
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
    role: request.membership?.role || null,
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
    role: request.membership?.role || null,
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

export function evaluatePropertyManagerCompanyAccess(
  request: PropertyManagerCompanyEvaluationRequest
): PropertyManagerCompanyEvaluationDecision {
  if (!request.actorUserId) return denied(request, "missing_actor");
  if (!request.actingForLandlordId) return denied(request, "missing_landlord_scope");
  if (request.explicitDenyReasons?.length) return denied(request, "explicit_deny");
  if (isOwnerOnlyAction(request)) return denied(request, "owner_only_action");

  const membership = request.membership;
  if (!membership) return denied(request, "missing_company_membership");
  if (membership.status !== "active") return denied(request, "membership_not_active");
  if (membership.userId !== request.actorUserId) return denied(request, "membership_actor_mismatch");

  const relationship = request.relationship;
  if (!relationship) return denied(request, "missing_landlord_company_relationship");
  if (relationship.status !== "active") return denied(request, "relationship_not_active", relationship.relationshipScope);
  if (relationship.landlordId !== request.actingForLandlordId) {
    return denied(request, "relationship_landlord_mismatch", relationship.relationshipScope);
  }
  if (relationship.propertyManagerCompanyId !== membership.companyId) {
    return denied(request, "relationship_landlord_mismatch", relationship.relationshipScope);
  }

  const scope = relationship.relationshipScope;
  if (!scope.workspaceScopes.includes(request.routeWorkspace)) return denied(request, "workspace_scope_denied", scope);
  if (!hasPropertyAccess(scope, request.propertyId)) return denied(request, "property_scope_denied", scope);
  if (!ROLE_ALLOWED_ACTIONS[membership.role].includes(request.action)) return denied(request, "role_template_denied", scope);

  return allowed(request, scope);
}
