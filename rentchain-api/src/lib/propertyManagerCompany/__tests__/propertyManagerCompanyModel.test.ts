import { describe, expect, it } from "vitest";
import {
  PropertyManagerCompanyValidationError,
  activateLandlordCompanyRelationship,
  createLandlordCompanyRelationship,
  createPropertyManagerCompany,
  createPropertyManagerCompanyMembership,
  removePropertyManagerCompanyMembership,
  suspendLandlordCompanyRelationship,
  suspendPropertyManagerCompanyMembership,
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
});
