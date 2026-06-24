import { describe, expect, it } from "vitest";
import {
  PropertyManagerCompanyValidationError,
  activateLandlordCompanyRelationship,
  createLandlordCompanyRelationship,
  createPropertyManagerCompany,
  createPropertyManagerCompanyMembership,
  createPropertyManagerCompanyStaffAssignment,
  removePropertyManagerCompanyMembership,
  removePropertyManagerCompanyStaffAssignment,
  reactivatePropertyManagerCompanyStaffAssignment,
  suspendLandlordCompanyRelationship,
  suspendPropertyManagerCompanyMembership,
  suspendPropertyManagerCompanyStaffAssignment,
  terminateLandlordCompanyRelationship,
} from "../propertyManagerCompanyModel";

describe("property manager company model foundations", () => {
  it("creates company identity with safe display label and no branding profile", () => {
    const company = createPropertyManagerCompany({
      companyName: "  Elite   Property Management  ",
      createdByUserId: "owner-user-1",
      createdAt: "2026-06-24T00:00:00.000Z",
    });

    expect(company).toMatchObject({
      companyName: "Elite Property Management",
      safeDisplayLabel: "Elite Property Management",
      status: "active",
      createdByUserId: "owner-user-1",
      createdAt: "2026-06-24T00:00:00.000Z",
      updatedAt: "2026-06-24T00:00:00.000Z",
    });
    expect(company.companyId).toMatch(/^pm_company_/);
    expect(JSON.stringify(company)).not.toContain("logo");
    expect(JSON.stringify(company)).not.toContain("publicProfile");
  });

  it("validates company membership roles and lifecycle statuses", () => {
    const membership = createPropertyManagerCompanyMembership({
      companyId: "pm-company-1",
      userId: "staff-user-1",
      role: "regional_manager",
      invitedByUserId: "admin-user-1",
      createdByUserId: "admin-user-1",
      createdAt: "2026-06-24T01:00:00.000Z",
    });

    expect(membership).toMatchObject({
      companyId: "pm-company-1",
      userId: "staff-user-1",
      role: "regional_manager",
      status: "active",
      invitedByUserId: "admin-user-1",
      createdByUserId: "admin-user-1",
      suspendedAt: null,
      removedAt: null,
    });

    const suspended = suspendPropertyManagerCompanyMembership(membership, {
      suspendedByUserId: "admin-user-1",
      suspendedAt: "2026-06-25T00:00:00.000Z",
    });
    expect(suspended).toMatchObject({
      status: "suspended",
      suspendedByUserId: "admin-user-1",
      suspendedAt: "2026-06-25T00:00:00.000Z",
    });

    const removed = removePropertyManagerCompanyMembership(suspended, {
      removedByUserId: "admin-user-1",
      removedAt: "2026-06-26T00:00:00.000Z",
    });
    expect(removed).toMatchObject({
      status: "removed",
      removedByUserId: "admin-user-1",
      removedAt: "2026-06-26T00:00:00.000Z",
    });

    expect(() =>
      createPropertyManagerCompanyMembership({
        companyId: "pm-company-1",
        userId: "staff-user-2",
        role: "custom_supervisor",
        createdByUserId: "admin-user-1",
      })
    ).toThrow(new PropertyManagerCompanyValidationError("invalid_company_role"));
  });

  it("creates landlord-company relationships with explicit selected-property scope", () => {
    const relationship = createLandlordCompanyRelationship({
      landlordId: "landlord-1",
      propertyManagerCompanyId: "pm-company-1",
      propertyScope: {
        mode: "selected_properties",
        propertyIds: ["property-1", "property-1", "property-2"],
      },
      workspaceScopes: ["dashboard", "operations", "properties"],
      createdByLandlordOwnerUserId: "landlord-owner-1",
      createdAt: "2026-06-24T02:00:00.000Z",
    });

    expect(relationship).toMatchObject({
      landlordId: "landlord-1",
      propertyManagerCompanyId: "pm-company-1",
      status: "pending",
      createdByLandlordOwnerUserId: "landlord-owner-1",
      startedAt: null,
      terminatedAt: null,
    });
    expect(relationship.relationshipScope.propertyScope).toEqual({
      mode: "selected_properties",
      propertyIds: ["property-1", "property-2"],
    });
    expect(relationship.relationshipId).toMatch(/^landlord_pm_relationship_/);
  });

  it("does not allow relationship creation to bypass company-admin acceptance", () => {
    expect(() =>
      createLandlordCompanyRelationship({
        landlordId: "landlord-1",
        propertyManagerCompanyId: "pm-company-1",
        propertyScope: {
          mode: "all_current_properties",
          propertyIds: [],
        },
        workspaceScopes: ["dashboard"],
        createdByLandlordOwnerUserId: "landlord-owner-1",
        status: "active",
      })
    ).toThrow(new PropertyManagerCompanyValidationError("relationship_activation_requires_company_acceptance"));

    expect(() =>
      createLandlordCompanyRelationship({
        landlordId: "landlord-1",
        propertyManagerCompanyId: "pm-company-1",
        propertyScope: {
          mode: "all_current_properties",
          propertyIds: [],
        },
        workspaceScopes: ["dashboard"],
        createdByLandlordOwnerUserId: "landlord-owner-1",
        acceptedByCompanyAdminUserId: "company-admin-1",
      })
    ).toThrow(new PropertyManagerCompanyValidationError("relationship_activation_requires_company_acceptance"));
  });

  it("supports active, suspended, reactivated, and terminated relationship transitions", () => {
    const pending = createLandlordCompanyRelationship({
      landlordId: "landlord-1",
      propertyManagerCompanyId: "pm-company-1",
      propertyScope: {
        mode: "all_current_properties",
        propertyIds: [],
      },
      workspaceScopes: ["dashboard", "operations"],
      createdByLandlordOwnerUserId: "landlord-owner-1",
      createdAt: "2026-06-24T02:00:00.000Z",
    });

    const active = activateLandlordCompanyRelationship(pending, {
      acceptedByCompanyAdminUserId: "company-admin-1",
      startedAt: "2026-06-24T03:00:00.000Z",
    });
    expect(active).toMatchObject({
      status: "active",
      acceptedByCompanyAdminUserId: "company-admin-1",
      startedAt: "2026-06-24T03:00:00.000Z",
    });

    const suspended = suspendLandlordCompanyRelationship(active, {
      suspendedByUserId: "landlord-owner-1",
      suspendedAt: "2026-06-25T00:00:00.000Z",
    });
    expect(suspended).toMatchObject({
      status: "suspended",
      suspendedByUserId: "landlord-owner-1",
      suspendedAt: "2026-06-25T00:00:00.000Z",
    });

    const terminated = terminateLandlordCompanyRelationship(suspended, {
      terminatedByUserId: "landlord-owner-1",
      terminatedAt: "2026-06-26T00:00:00.000Z",
      reason: "Contract ended",
    });
    expect(terminated).toMatchObject({
      status: "terminated",
      terminatedByUserId: "landlord-owner-1",
      terminatedAt: "2026-06-26T00:00:00.000Z",
      terminationReason: "Contract ended",
    });
    expect(terminated.relationshipScope).toEqual(active.relationshipScope);
  });

  it("rejects billing workspace and malformed property scopes", () => {
    expect(() =>
      createLandlordCompanyRelationship({
        landlordId: "landlord-1",
        propertyManagerCompanyId: "pm-company-1",
        propertyScope: {
          mode: "selected_properties",
          propertyIds: [],
        },
        workspaceScopes: ["dashboard"],
        createdByLandlordOwnerUserId: "landlord-owner-1",
      })
    ).toThrow(new PropertyManagerCompanyValidationError("missing_selected_property_scope"));

    expect(() =>
      createLandlordCompanyRelationship({
        landlordId: "landlord-1",
        propertyManagerCompanyId: "pm-company-1",
        propertyScope: {
          mode: "all_current_properties",
          propertyIds: [],
        },
        workspaceScopes: ["settings_billing"],
        createdByLandlordOwnerUserId: "landlord-owner-1",
      })
    ).toThrow(new PropertyManagerCompanyValidationError("company_billing_scope_not_allowed"));
  });

  it("creates staff assignments only under active membership and active relationship scope ceilings", () => {
    const pending = createLandlordCompanyRelationship({
      landlordId: "landlord-1",
      propertyManagerCompanyId: "pm-company-1",
      propertyScope: {
        mode: "selected_properties",
        propertyIds: ["property-a", "property-b"],
      },
      workspaceScopes: ["dashboard", "operations"],
      createdByLandlordOwnerUserId: "landlord-owner-1",
      createdAt: "2026-06-24T02:00:00.000Z",
    });
    const relationship = activateLandlordCompanyRelationship(pending, {
      acceptedByCompanyAdminUserId: "company-admin-1",
      startedAt: "2026-06-24T03:00:00.000Z",
    });
    const adminMembership = createPropertyManagerCompanyMembership({
      companyId: "pm-company-1",
      userId: "company-admin-1",
      role: "company_admin",
      createdByUserId: "company-owner-1",
    });
    const staffMembership = createPropertyManagerCompanyMembership({
      companyId: "pm-company-1",
      userId: "staff-user-1",
      role: "property_manager",
      createdByUserId: "company-admin-1",
    });

    const assignment = createPropertyManagerCompanyStaffAssignment({
      relationship,
      assignedByMembership: adminMembership,
      staffMembership,
      staffRole: "property_manager",
      propertyScope: { mode: "selected_properties", propertyIds: ["property-a"] },
      workspaceScopes: ["dashboard"],
      createdAt: "2026-06-24T04:00:00.000Z",
    });

    expect(assignment).toMatchObject({
      propertyManagerCompanyId: "pm-company-1",
      relationshipId: relationship.relationshipId,
      staffUserId: "staff-user-1",
      assignedByUserId: "company-admin-1",
      staffRole: "property_manager",
      status: "active",
      propertyScope: { mode: "selected_properties", propertyIds: ["property-a"] },
      workspaceScopes: ["dashboard"],
      createdAt: "2026-06-24T04:00:00.000Z",
      suspendedAt: null,
      removedAt: null,
    });
    expect(assignment.assignmentId).toMatch(/^pm_staff_assignment_/);

    expect(() =>
      createPropertyManagerCompanyStaffAssignment({
        relationship,
        assignedByMembership: adminMembership,
        staffMembership,
        staffRole: "property_manager",
        propertyScope: { mode: "selected_properties", propertyIds: ["property-a", "property-b", "property-c"] },
        workspaceScopes: ["dashboard"],
      })
    ).toThrow(new PropertyManagerCompanyValidationError("assignment_scope_exceeds_relationship_scope"));

    expect(() =>
      createPropertyManagerCompanyStaffAssignment({
        relationship,
        assignedByMembership: adminMembership,
        staffMembership,
        staffRole: "property_manager",
        propertyScope: { mode: "selected_properties", propertyIds: ["property-a"] },
        workspaceScopes: ["dashboard", "operations", "settings_billing"],
      })
    ).toThrow(new PropertyManagerCompanyValidationError("company_billing_scope_not_allowed"));

    expect(() =>
      createPropertyManagerCompanyStaffAssignment({
        relationship: pending,
        assignedByMembership: adminMembership,
        staffMembership,
        staffRole: "property_manager",
        propertyScope: { mode: "selected_properties", propertyIds: ["property-a"] },
        workspaceScopes: ["dashboard"],
      })
    ).toThrow(new PropertyManagerCompanyValidationError("relationship_not_active"));
  });

  it("requires Company Owner/Admin authority and predefined assignment roles", () => {
    const relationship = activateLandlordCompanyRelationship(
      createLandlordCompanyRelationship({
        landlordId: "landlord-1",
        propertyManagerCompanyId: "pm-company-1",
        propertyScope: { mode: "all_current_properties", propertyIds: [] },
        workspaceScopes: ["dashboard", "operations"],
        createdByLandlordOwnerUserId: "landlord-owner-1",
      }),
      { acceptedByCompanyAdminUserId: "company-admin-1" }
    );
    const propertyManagerMembership = createPropertyManagerCompanyMembership({
      companyId: "pm-company-1",
      userId: "property-manager-1",
      role: "property_manager",
      createdByUserId: "company-admin-1",
    });
    const staffMembership = createPropertyManagerCompanyMembership({
      companyId: "pm-company-1",
      userId: "staff-user-1",
      role: "leasing_agent",
      createdByUserId: "company-admin-1",
    });

    expect(() =>
      createPropertyManagerCompanyStaffAssignment({
        relationship,
        assignedByMembership: propertyManagerMembership,
        staffMembership,
        staffRole: "leasing_agent",
        propertyScope: { mode: "all_current_properties", propertyIds: [] },
        workspaceScopes: ["dashboard"],
      })
    ).toThrow(new PropertyManagerCompanyValidationError("company_assignment_manager_required"));

    const adminMembership = createPropertyManagerCompanyMembership({
      companyId: "pm-company-1",
      userId: "company-admin-1",
      role: "company_admin",
      createdByUserId: "company-owner-1",
    });
    expect(() =>
      createPropertyManagerCompanyStaffAssignment({
        relationship,
        assignedByMembership: adminMembership,
        staffMembership,
        staffRole: "company_admin",
        propertyScope: { mode: "all_current_properties", propertyIds: [] },
        workspaceScopes: ["dashboard"],
      })
    ).toThrow(new PropertyManagerCompanyValidationError("invalid_staff_assignment_role"));
  });

  it("supports staff assignment suspend, reactivate, and remove without hard delete", () => {
    const relationship = activateLandlordCompanyRelationship(
      createLandlordCompanyRelationship({
        landlordId: "landlord-1",
        propertyManagerCompanyId: "pm-company-1",
        propertyScope: { mode: "all_current_properties", propertyIds: [] },
        workspaceScopes: ["dashboard", "operations"],
        createdByLandlordOwnerUserId: "landlord-owner-1",
      }),
      { acceptedByCompanyAdminUserId: "company-admin-1" }
    );
    const adminMembership = createPropertyManagerCompanyMembership({
      companyId: "pm-company-1",
      userId: "company-admin-1",
      role: "company_admin",
      createdByUserId: "company-owner-1",
    });
    const staffMembership = createPropertyManagerCompanyMembership({
      companyId: "pm-company-1",
      userId: "staff-user-1",
      role: "maintenance_coordinator",
      createdByUserId: "company-admin-1",
    });
    const assignment = createPropertyManagerCompanyStaffAssignment({
      relationship,
      assignedByMembership: adminMembership,
      staffMembership,
      staffRole: "maintenance_coordinator",
      propertyScope: { mode: "all_current_properties", propertyIds: [] },
      workspaceScopes: ["operations"],
    });

    const suspended = suspendPropertyManagerCompanyStaffAssignment(assignment, {
      actorMembership: adminMembership,
      suspendedAt: "2026-06-25T00:00:00.000Z",
      reason: "Coverage pause",
    });
    expect(suspended).toMatchObject({
      status: "suspended",
      suspendedByUserId: "company-admin-1",
      suspendedReason: "Coverage pause",
    });

    const reactivated = reactivatePropertyManagerCompanyStaffAssignment(suspended, {
      actorMembership: adminMembership,
      staffMembership,
      relationship,
      reactivatedAt: "2026-06-26T00:00:00.000Z",
    });
    expect(reactivated).toMatchObject({
      status: "active",
      reactivatedByUserId: "company-admin-1",
      reactivatedAt: "2026-06-26T00:00:00.000Z",
    });

    const removed = removePropertyManagerCompanyStaffAssignment(reactivated, {
      actorMembership: adminMembership,
      removedAt: "2026-06-27T00:00:00.000Z",
      reason: "Staff changed",
    });
    expect(removed).toMatchObject({
      status: "removed",
      removedByUserId: "company-admin-1",
      removedReason: "Staff changed",
    });
    expect(removed.assignmentId).toBe(assignment.assignmentId);
  });
});
