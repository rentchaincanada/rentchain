import { describe, expect, it } from "vitest";
import { buildFollowUpResolutionState } from "./followUpResolutionState";
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

describe("buildFollowUpResolutionState", () => {
  it("returns follow-up needed when every category is still missing", () => {
    const result = buildFollowUpResolutionState(
      categories(["missing", "missing", "missing", "missing", "missing"])
    );

    expect(result.overallState).toBe("follow_up_needed");
    expect(result.openFollowUpCategories).toHaveLength(5);
    expect(result.addressedCategories).toEqual([]);
  });

  it("returns partly addressed when some categories are updated but open items remain", () => {
    const result = buildFollowUpResolutionState(
      categories(["ready", "missing", "partial", "missing", "partial"])
    );

    expect(result.overallState).toBe("partly_addressed");
    expect(result.remainingCategoriesNeedingAttention).toEqual([
      "Rental history",
      "Consent / identity status",
    ]);
    expect(result.addressedCategories.map((item) => item.label)).toEqual([
      "Profile details",
      "Documents & records",
      "Application readiness",
    ]);
  });

  it("returns ready for rereview when no categories are still missing", () => {
    const result = buildFollowUpResolutionState(
      categories(["ready", "partial", "ready", "partial", "ready"])
    );

    expect(result.overallState).toBe("ready_for_rereview");
    expect(result.openFollowUpCategories).toEqual([]);
    expect(result.addressedCategories).toHaveLength(5);
  });
});
