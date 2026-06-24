import { describe, expect, it } from "vitest";
import {
  buildPropertyManagerCompanyAuthProfile,
  buildPropertyManagerCompanyAuthProfileSafeSummary,
} from "../propertyManagerCompanyAuthProfilePlan";

describe("property manager company auth profile plan", () => {
  it("builds safe non-landlord users and accounts profiles", () => {
    const profile = buildPropertyManagerCompanyAuthProfile({
      userId: "pm-admin-user-1",
      userEmail: "ADMIN+PropertyManager@RentChain.ai",
      now: "2026-06-24T14:00:00.000Z",
    });

    expect(profile.userProfile).toMatchObject({
      id: "pm-admin-user-1",
      email: "admin+propertymanager@rentchain.ai",
      role: "property_manager_company",
      accountType: "property_manager_company",
      landlordId: null,
      status: "active",
      approved: true,
      approvedBy: "feat/property-manager-company-auth-profile-v1",
      permissions: [],
      revokedPermissions: [],
      qaProfile: true,
    });
    expect(profile.accountProfile).toEqual(profile.userProfile);
  });

  it("builds safe summaries without raw ids or landlord actions", () => {
    const profile = buildPropertyManagerCompanyAuthProfile({
      userId: "pm-admin-user-1",
      userEmail: "admin+propertymanager@rentchain.ai",
      now: "2026-06-24T14:00:00.000Z",
    });

    const summary = buildPropertyManagerCompanyAuthProfileSafeSummary({
      write: false,
      userProfileExists: false,
      accountProfileExists: true,
      userProfile: profile.userProfile,
      accountProfile: profile.accountProfile,
    });

    expect(summary).toMatchObject({
      mode: "dry-run",
      userProfile: {
        action: "create",
        email: "admin+propertymanager@rentchain.ai",
        role: "property_manager_company",
        accountType: "property_manager_company",
        landlordId: null,
      },
      accountProfile: {
        action: "update",
        email: "admin+propertymanager@rentchain.ai",
        role: "property_manager_company",
        accountType: "property_manager_company",
        landlordId: null,
      },
      landlordProfileAction: "none",
      rawIdsPrinted: false,
    });
    expect(JSON.stringify(summary)).not.toContain("pm-admin-user-1");
  });
});
