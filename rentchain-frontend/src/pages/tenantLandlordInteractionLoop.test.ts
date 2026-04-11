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
  it("returns ready for rereview when every category is addressed", () => {
    const result = buildTenantLandlordInteractionLoop({
      audience: "landlord",
      packageCategories: categories(["ready", "ready", "ready", "ready", "ready"]),
    });

    expect(result.state).toBe("ready_for_rereview");
    expect(result.followUpCategories).toEqual([]);
    expect(result.readyCategories).toHaveLength(5);
    expect(result.nextSteps[0]).toMatch(/Review again/i);
  });

  it("returns ready for rereview when the package only has partial categories left", () => {
    const result = buildTenantLandlordInteractionLoop({
      audience: "tenant",
      packageCategories: categories(["ready", "partial", "ready", "partial", "partial"]),
    });

    expect(result.state).toBe("ready_for_rereview");
    expect(result.followUpCategories).toEqual([]);
    expect(result.readyCategories).toEqual([
      "Profile details",
      "Rental history",
      "Documents & records",
      "Consent / identity status",
      "Application readiness",
    ]);
    expect(result.actions.map((item) => item.path)).toEqual([
      "/tenant/application",
    ]);
    expect(result.headline).toBe("Ready for re-review");
  });

  it("returns partly addressed when open and addressed categories are mixed", () => {
    const result = buildTenantLandlordInteractionLoop({
      audience: "tenant",
      packageCategories: categories(["missing", "ready", "missing", "partial", "partial"]),
    });

    expect(result.state).toBe("partly_addressed");
    expect(result.followUpCategories).toEqual([
      "Profile details",
      "Documents & records",
    ]);
    expect(result.readyCategories).toEqual([
      "Rental history",
      "Consent / identity status",
      "Application readiness",
    ]);
    expect(result.nextSteps[0]).toMatch(/Keep Rental history/i);
  });

  it("returns follow up needed when every category is still open", () => {
    const result = buildTenantLandlordInteractionLoop({
      audience: "tenant",
      packageCategories: categories(["missing", "missing", "missing", "missing", "missing"]),
    });

    expect(result.state).toBe("follow_up_needed");
    expect(result.followUpCategories).toHaveLength(5);
    expect(result.readyCategories).toEqual([]);
    expect(result.nextSteps[0]).toMatch(/Work through/i);
  });
});
