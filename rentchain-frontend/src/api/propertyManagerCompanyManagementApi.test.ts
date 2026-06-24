import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptCompanyPropertyManagerRelationship,
  createLandlordPropertyManagerRelationship,
  createPropertyManagerCompanyStaffAssignment,
  fetchLandlordPropertyManagerRelationshipAssignments,
  fetchLandlordPropertyManagerRelationships,
  fetchMyPropertyManagerCompanies,
  fetchPropertyManagerCompanyMembers,
  fetchPropertyManagerCompanyStaffAssignments,
  searchPropertyManagerCompanies,
  suspendLandlordPropertyManagerRelationship,
  terminateLandlordPropertyManagerRelationship,
} from "./propertyManagerCompanyManagementApi";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("./apiFetch", () => ({
  apiFetch: mocks.apiFetch,
}));

describe("propertyManagerCompanyManagementApi", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue({ ok: true, companies: [], relationships: [], members: [], assignments: [] });
  });

  it("uses landlord-scoped discovery, relationship, and staff projection endpoints", async () => {
    await searchPropertyManagerCompanies("elite");
    await fetchLandlordPropertyManagerRelationships();
    await fetchLandlordPropertyManagerRelationshipAssignments("relationship-1");

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(1, "/landlord/property-manager-companies/search?q=elite");
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(2, "/landlord/property-manager-company-relationships");
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      3,
      "/landlord/property-manager-company-relationships/relationship-1/staff-assignments"
    );
  });

  it("creates pending landlord-company relationships with explicit scope", async () => {
    await createLandlordPropertyManagerRelationship({
      propertyManagerCompanyId: "pm-company-1",
      propertyScope: { mode: "all_current_properties", propertyIds: [] },
      workspaceScopes: ["dashboard", "operations"],
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith("/landlord/property-manager-company-relationships", {
      method: "POST",
      body: {
        propertyManagerCompanyId: "pm-company-1",
        propertyScope: { mode: "all_current_properties", propertyIds: [] },
        workspaceScopes: ["dashboard", "operations"],
      },
    });
  });

  it("uses landlord lifecycle endpoints with optional reasons", async () => {
    await suspendLandlordPropertyManagerRelationship("relationship-1", "pause");
    await terminateLandlordPropertyManagerRelationship("relationship-1", "done");

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      1,
      "/landlord/property-manager-company-relationships/relationship-1/suspend",
      { method: "POST", body: { reason: "pause" } }
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      2,
      "/landlord/property-manager-company-relationships/relationship-1/terminate",
      { method: "POST", body: { reason: "done" } }
    );
  });

  it("uses company-admin context, relationship, member, assignment, and accept endpoints", async () => {
    await fetchMyPropertyManagerCompanies();
    await fetchPropertyManagerCompanyMembers("pm-company-1");
    await fetchPropertyManagerCompanyStaffAssignments("pm-company-1", "relationship-1");
    await acceptCompanyPropertyManagerRelationship("pm-company-1", "relationship-1");

    expect(mocks.apiFetch).toHaveBeenNthCalledWith(1, "/property-manager-companies/my-companies");
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(2, "/property-manager-companies/pm-company-1/members");
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      3,
      "/property-manager-companies/pm-company-1/staff-assignments?relationshipId=relationship-1"
    );
    expect(mocks.apiFetch).toHaveBeenNthCalledWith(
      4,
      "/property-manager-companies/pm-company-1/relationships/relationship-1/accept",
      { method: "POST" }
    );
  });

  it("creates company staff assignments without custom permission payloads", async () => {
    await createPropertyManagerCompanyStaffAssignment("pm-company-1", {
      relationshipId: "relationship-1",
      staffUserId: "staff-1",
      staffRole: "property_manager",
      propertyScope: { mode: "all_current_properties", propertyIds: [] },
      workspaceScopes: ["dashboard"],
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith("/property-manager-companies/pm-company-1/staff-assignments", {
      method: "POST",
      body: {
        relationshipId: "relationship-1",
        staffUserId: "staff-1",
        staffRole: "property_manager",
        propertyScope: { mode: "all_current_properties", propertyIds: [] },
        workspaceScopes: ["dashboard"],
      },
    });
  });
});
