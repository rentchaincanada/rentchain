import { describe, expect, it } from "vitest";
import { buildTenantLandlordInteractionLoop } from "./tenantLandlordInteractionLoop";
import type { SharePackageCategoryView } from "./sharePackageAlignment";

function categories(
  statuses: Array<SharePackageCategoryView["status"]>
): SharePackageCategoryView[] {
  return [
    {
      key: "profile_details",
      label: "Profile details",
      status: statuses[0],
      detail: "Profile details",
    },
    {
      key: "rental_history",
      label: "Rental history",
      status: statuses[1],
      detail: "Rental history",
    },
    {
      key: "documents_records",
      label: "Documents & records",
      status: statuses[2],
      detail: "Documents & records",
    },
    {
      key: "consent_identity_status",
      label: "Consent / identity status",
      status: statuses[3],
      detail: "Consent / identity status",
    },
    {
      key: "application_readiness",
      label: "Application readiness",
      status: statuses[4],
      detail: "Application readiness",
    },
  ];
}

describe("buildTenantLandlordInteractionLoop", () => {
  it("returns ready for review when every category is ready", () => {
    const result = buildTenantLandlordInteractionLoop({
      audience: "landlord",
      packageCategories: categories(["ready", "ready", "ready", "ready", "ready"]),
    });

    expect(result.state).toBe("ready_for_review");
    expect(result.followUpCategories).toEqual([]);
    expect(result.readyCategories).toHaveLength(5);
    expect(result.nextSteps[0]).toMatch(/Review the categories already available now/i);
  });

  it("returns ready for rereview when the package only has partial categories left", () => {
    const result = buildTenantLandlordInteractionLoop({
      audience: "tenant",
      packageCategories: categories(["ready", "partial", "ready", "partial", "partial"]),
    });

    expect(result.state).toBe("ready_for_rereview");
    expect(result.followUpCategories).toEqual([
      "Rental history",
      "Consent / identity status",
      "Application readiness",
    ]);
    expect(result.actions.map((item) => item.path)).toEqual([
      "/tenant/profile",
      "/tenant/access",
      "/tenant/application",
    ]);
  });

  it("returns follow up needed when any categories are missing", () => {
    const result = buildTenantLandlordInteractionLoop({
      audience: "tenant",
      packageCategories: categories(["missing", "ready", "missing", "partial", "partial"]),
    });

    expect(result.state).toBe("follow_up_needed");
    expect(result.followUpCategories).toEqual([
      "Profile details",
      "Documents & records",
      "Consent / identity status",
      "Application readiness",
    ]);
    expect(result.nextSteps[0]).toMatch(/Work through/i);
  });
});
