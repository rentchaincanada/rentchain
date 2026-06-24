import { describe, expect, it } from "vitest";
import {
  activateLandlordCompanyRelationship,
  createLandlordCompanyRelationship,
  createPropertyManagerCompanyMembership,
  suspendLandlordCompanyRelationship,
  terminateLandlordCompanyRelationship,
} from "../propertyManagerCompanyModel";
import { evaluatePropertyManagerCompanyAccess } from "../permissionEvaluation";

function activeMembership(role: Parameters<typeof createPropertyManagerCompanyMembership>[0]["role"] = "property_manager") {
  return createPropertyManagerCompanyMembership({
    companyId: "pm-company-1",
    userId: "staff-user-1",
    role,
    createdByUserId: "company-admin-1",
    createdAt: "2026-06-24T01:00:00.000Z",
  });
}

function pendingRelationship() {
  return createLandlordCompanyRelationship({
    landlordId: "landlord-1",
    propertyManagerCompanyId: "pm-company-1",
    propertyScope: {
      mode: "selected_properties",
      propertyIds: ["property-1"],
    },
    workspaceScopes: ["dashboard", "operations", "properties"],
    createdByLandlordOwnerUserId: "landlord-owner-1",
    createdAt: "2026-06-24T02:00:00.000Z",
  });
}

function activeRelationship() {
  return activateLandlordCompanyRelationship(pendingRelationship(), {
    acceptedByCompanyAdminUserId: "company-admin-1",
    startedAt: "2026-06-24T03:00:00.000Z",
  });
}

const baseRequest = {
  actorUserId: "staff-user-1",
  actingForLandlordId: "landlord-1",
  routeWorkspace: "properties" as const,
  action: "view" as const,
  targetResourceType: "property" as const,
  targetResourceId: "property-1",
  propertyId: "property-1",
};

describe("property manager company permission evaluation", () => {
  it("allows active company staff inside active relationship, property, workspace, and role scope", () => {
    const decision = evaluatePropertyManagerCompanyAccess({
      ...baseRequest,
      membership: activeMembership(),
      relationship: activeRelationship(),
    });

    expect(decision).toMatchObject({
      allowed: true,
      relationship: "company_staff",
      reason: "allowed_company_staff",
      actorCompanyId: "pm-company-1",
      actingForLandlordId: "landlord-1",
      role: "property_manager",
      auditRequired: false,
    });
  });

  it("fails closed when membership is missing, inactive, or mismatched to actor", () => {
    expect(
      evaluatePropertyManagerCompanyAccess({
        ...baseRequest,
        membership: null,
        relationship: activeRelationship(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "missing_company_membership",
    });

    const suspendedMembership = {
      ...activeMembership(),
      status: "suspended" as const,
    };
    expect(
      evaluatePropertyManagerCompanyAccess({
        ...baseRequest,
        membership: suspendedMembership,
        relationship: activeRelationship(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "membership_not_active",
    });

    expect(
      evaluatePropertyManagerCompanyAccess({
        ...baseRequest,
        membership: {
          ...activeMembership(),
          userId: "other-user",
        },
        relationship: activeRelationship(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "membership_actor_mismatch",
    });
  });

  it("does not grant access for pending, suspended, or terminated relationships", () => {
    expect(
      evaluatePropertyManagerCompanyAccess({
        ...baseRequest,
        membership: activeMembership(),
        relationship: pendingRelationship(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "relationship_not_active",
    });

    const suspended = suspendLandlordCompanyRelationship(activeRelationship(), {
      suspendedByUserId: "landlord-owner-1",
      suspendedAt: "2026-06-25T00:00:00.000Z",
    });
    expect(
      evaluatePropertyManagerCompanyAccess({
        ...baseRequest,
        membership: activeMembership(),
        relationship: suspended,
      })
    ).toMatchObject({
      allowed: false,
      reason: "relationship_not_active",
    });

    const terminated = terminateLandlordCompanyRelationship(activeRelationship(), {
      terminatedByUserId: "landlord-owner-1",
      terminatedAt: "2026-06-26T00:00:00.000Z",
    });
    expect(
      evaluatePropertyManagerCompanyAccess({
        ...baseRequest,
        membership: activeMembership(),
        relationship: terminated,
      })
    ).toMatchObject({
      allowed: false,
      reason: "relationship_not_active",
    });
  });

  it("prevents company staff from exceeding landlord relationship workspace and property scope", () => {
    expect(
      evaluatePropertyManagerCompanyAccess({
        ...baseRequest,
        routeWorkspace: "payments",
        targetResourceType: "landlord_workspace",
        membership: activeMembership(),
        relationship: activeRelationship(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "workspace_scope_denied",
    });

    expect(
      evaluatePropertyManagerCompanyAccess({
        ...baseRequest,
        propertyId: "property-2",
        targetResourceId: "property-2",
        membership: activeMembership(),
        relationship: activeRelationship(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "property_scope_denied",
    });
  });

  it("denies billing/settings owner-only access before role or scope widening", () => {
    expect(
      evaluatePropertyManagerCompanyAccess({
        ...baseRequest,
        routeWorkspace: "settings_billing",
        action: "billing_access",
        targetResourceType: "billing_settings",
        membership: activeMembership("company_owner"),
        relationship: activeRelationship(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "owner_only_action",
    });
  });

  it("uses predefined role templates instead of raw permission selection", () => {
    expect(
      evaluatePropertyManagerCompanyAccess({
        ...baseRequest,
        action: "edit",
        membership: activeMembership("read_only_staff"),
        relationship: activeRelationship(),
      })
    ).toMatchObject({
      allowed: false,
      reason: "role_template_denied",
    });

    expect(
      evaluatePropertyManagerCompanyAccess({
        ...baseRequest,
        action: "edit",
        membership: activeMembership("property_manager"),
        relationship: activeRelationship(),
      })
    ).toMatchObject({
      allowed: true,
      reason: "allowed_company_staff",
    });
  });
});
