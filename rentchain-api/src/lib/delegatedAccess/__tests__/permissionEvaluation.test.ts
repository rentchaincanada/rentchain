import { describe, expect, it } from "vitest";
import { createDelegatedAccessGrant, revokeDelegatedAccessGrant } from "../delegatedAccessModel";
import { evaluateDelegatedAccessPermission } from "../permissionEvaluation";

function grant() {
  return createDelegatedAccessGrant({
    landlordId: "landlord-1",
    delegateUserId: "delegate-1",
    role: "property_manager",
    propertyScope: {
      mode: "selected",
      propertyIds: ["property-1"],
    },
    workspaceScopes: ["dashboard", "operations", "properties"],
    permissionFlags: ["view", "edit", "message"],
    createdByUserId: "owner-1",
    createdAt: "2026-06-22T10:00:00.000Z",
  });
}

const baseRequest = {
  actorUserId: "delegate-1",
  actingForLandlordId: "landlord-1",
  isLandlordOwner: false,
  routeWorkspace: "properties" as const,
  action: "view" as const,
  targetResourceType: "property" as const,
  targetResourceId: "property-1",
  propertyId: "property-1",
};

describe("delegated access permission evaluation", () => {
  it("allows landlord owner override without a delegate grant", () => {
    const decision = evaluateDelegatedAccessPermission({
      ...baseRequest,
      actorUserId: "owner-1",
      isLandlordOwner: true,
      action: "billing_access",
      routeWorkspace: "settings_billing",
      targetResourceType: "billing_settings",
      grant: null,
    });

    expect(decision).toMatchObject({
      allowed: true,
      relationship: "owner",
      reason: "allowed_owner",
      delegatedRole: null,
      permissionScope: null,
    });
  });

  it("allows active delegate access inside workspace, property, and action scope", () => {
    const decision = evaluateDelegatedAccessPermission({
      ...baseRequest,
      grant: grant(),
    });

    expect(decision).toMatchObject({
      allowed: true,
      relationship: "delegate",
      reason: "allowed_delegate",
      delegatedRole: "property_manager",
      auditRequired: false,
    });
    expect(decision.permissionScope?.workspaceScopes).toContain("properties");
  });

  it("fails closed when grant is missing, revoked, mismatched, or explicitly denied", () => {
    expect(evaluateDelegatedAccessPermission({ ...baseRequest, grant: null })).toMatchObject({
      allowed: false,
      reason: "missing_delegate_grant",
    });

    const revokedGrant = revokeDelegatedAccessGrant(grant(), {
      revokedByUserId: "owner-1",
      revokedAt: "2026-06-23T00:00:00.000Z",
    });
    expect(evaluateDelegatedAccessPermission({ ...baseRequest, grant: revokedGrant })).toMatchObject({
      allowed: false,
      reason: "grant_not_active",
      delegatedRole: "property_manager",
    });

    expect(
      evaluateDelegatedAccessPermission({
        ...baseRequest,
        actingForLandlordId: "landlord-2",
        grant: grant(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "grant_landlord_mismatch",
    });

    expect(
      evaluateDelegatedAccessPermission({
        ...baseRequest,
        grant: grant(),
        explicitDenyReasons: ["manual_hold"],
      })
    ).toMatchObject({
      allowed: false,
      reason: "explicit_deny",
    });
  });

  it("denies out-of-scope workspace, property, action, and owner-only permissions", () => {
    expect(
      evaluateDelegatedAccessPermission({
        ...baseRequest,
        routeWorkspace: "payments",
        targetResourceType: "payment",
        grant: grant(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "workspace_scope_denied",
    });

    expect(
      evaluateDelegatedAccessPermission({
        ...baseRequest,
        propertyId: "property-2",
        grant: grant(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "property_scope_denied",
    });

    expect(
      evaluateDelegatedAccessPermission({
        ...baseRequest,
        action: "approve",
        grant: grant(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "permission_flag_denied",
    });

    expect(
      evaluateDelegatedAccessPermission({
        ...baseRequest,
        action: "billing_access",
        routeWorkspace: "settings_billing",
        targetResourceType: "billing_settings",
        grant: grant(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "owner_only_action",
    });
  });

  it("requires explicit resource scope for resource-only contractor access", () => {
    const contractorGrant = createDelegatedAccessGrant({
      landlordId: "landlord-1",
      delegateUserId: "contractor-1",
      role: "contractor",
      propertyScope: {
        mode: "resource_only",
        propertyIds: [],
      },
      resourceScope: {
        workOrderIds: ["work-order-1"],
      },
      workspaceScopes: ["work_orders"],
      permissionFlags: ["view", "edit", "message"],
      createdByUserId: "owner-1",
    });

    expect(
      evaluateDelegatedAccessPermission({
        actorUserId: "contractor-1",
        actingForLandlordId: "landlord-1",
        isLandlordOwner: false,
        routeWorkspace: "work_orders",
        action: "view",
        targetResourceType: "work_order",
        targetResourceId: "work-order-1",
        resourceId: "work-order-1",
        grant: contractorGrant,
      })
    ).toMatchObject({
      allowed: true,
      reason: "allowed_delegate",
    });

    expect(
      evaluateDelegatedAccessPermission({
        actorUserId: "contractor-1",
        actingForLandlordId: "landlord-1",
        isLandlordOwner: false,
        routeWorkspace: "work_orders",
        action: "view",
        targetResourceType: "work_order",
        targetResourceId: "work-order-2",
        resourceId: "work-order-2",
        grant: contractorGrant,
      })
    ).toMatchObject({
      allowed: false,
      reason: "resource_scope_denied",
    });
  });
});
