import type {
  DelegatedAccessDecisionReason,
  DelegatedAccessEvaluationDecision,
  DelegatedAccessEvaluationRequest,
  DelegatedAccessGrant,
  DelegatedAccessPermissionScope,
} from "./delegatedAccessTypes";

function denied(
  request: DelegatedAccessEvaluationRequest,
  reason: DelegatedAccessDecisionReason,
  grant?: DelegatedAccessGrant | null
): DelegatedAccessEvaluationDecision {
  return {
    allowed: false,
    relationship: grant ? "delegate" : "none",
    reason,
    actorUserId: request.actorUserId || null,
    actingForLandlordId: request.actingForLandlordId || null,
    delegatedRole: grant?.role || null,
    permissionScope: grant?.permissionScope || null,
    auditRequired: true,
  };
}

function allowedOwner(request: DelegatedAccessEvaluationRequest): DelegatedAccessEvaluationDecision {
  return {
    allowed: true,
    relationship: "owner",
    reason: "allowed_owner",
    actorUserId: request.actorUserId || null,
    actingForLandlordId: request.actingForLandlordId || null,
    delegatedRole: null,
    permissionScope: null,
    auditRequired: false,
  };
}

function allowedDelegate(
  request: DelegatedAccessEvaluationRequest,
  permissionScope: DelegatedAccessPermissionScope
): DelegatedAccessEvaluationDecision {
  return {
    allowed: true,
    relationship: "delegate",
    reason: "allowed_delegate",
    actorUserId: request.actorUserId || null,
    actingForLandlordId: request.actingForLandlordId || null,
    delegatedRole: permissionScope.role,
    permissionScope,
    auditRequired: request.action !== "view" || request.routeWorkspace === "payments" || request.routeWorkspace === "evidence_exports",
  };
}

function resourceScopeValues(scope: DelegatedAccessPermissionScope): string[] {
  return [
    ...(scope.resourceScope.workOrderIds || []),
    ...(scope.resourceScope.maintenanceRequestIds || []),
    ...(scope.resourceScope.messageThreadIds || []),
    ...(scope.resourceScope.evidencePackageIds || []),
    ...(scope.resourceScope.exportPackageIds || []),
    ...(scope.resourceScope.contractorJobIds || []),
  ];
}

function hasPropertyAccess(scope: DelegatedAccessPermissionScope, propertyId?: string | null): boolean {
  if (scope.propertyScope.mode === "all_current_properties") return true;
  if (scope.propertyScope.mode === "none") return !propertyId;
  if (scope.propertyScope.mode === "resource_only") return !propertyId;
  if (!propertyId) return false;
  return scope.propertyScope.propertyIds.includes(propertyId);
}

function hasResourceAccess(scope: DelegatedAccessPermissionScope, resourceId?: string | null): boolean {
  if (!resourceId) return true;
  return resourceScopeValues(scope).includes(resourceId);
}

function isOwnerOnlyAction(request: DelegatedAccessEvaluationRequest): boolean {
  return (
    request.action === "billing_access" ||
    request.action === "revoke" ||
    request.routeWorkspace === "settings_billing" ||
    request.targetResourceType === "billing_settings"
  );
}

export function evaluateDelegatedAccessPermission(
  request: DelegatedAccessEvaluationRequest
): DelegatedAccessEvaluationDecision {
  if (!request.actorUserId) return denied(request, "missing_actor");
  if (!request.actingForLandlordId) return denied(request, "missing_landlord_scope");
  if (request.explicitDenyReasons?.length) return denied(request, "explicit_deny", request.grant);
  if (request.isLandlordOwner) return allowedOwner(request);

  const grant = request.grant;
  if (!grant) return denied(request, "missing_delegate_grant");
  if (grant.status !== "active") return denied(request, "grant_not_active", grant);
  if (grant.landlordId !== request.actingForLandlordId) return denied(request, "grant_landlord_mismatch", grant);
  if (isOwnerOnlyAction(request)) return denied(request, "owner_only_action", grant);

  const scope = grant.permissionScope;
  if (!scope.workspaceScopes.includes(request.routeWorkspace)) return denied(request, "workspace_scope_denied", grant);
  if (!hasPropertyAccess(scope, request.propertyId)) return denied(request, "property_scope_denied", grant);
  if (!hasResourceAccess(scope, request.resourceId)) {
    return denied(request, "resource_scope_denied", grant);
  }
  if (!scope.permissionFlags.includes(request.action)) return denied(request, "permission_flag_denied", grant);

  return allowedDelegate(request, scope);
}
