import { describe, expect, it } from "vitest";
import { buildLandlordReviewGuidance } from "./landlordReviewGuidance";
import type { LandlordIntakeAlignmentView } from "./applicationReviewIntakeAlignment";

function buildIntake(
  overrides?: Partial<LandlordIntakeAlignmentView>
): LandlordIntakeAlignmentView {
  return {
    state: "ready_for_review",
    headline: "Ready for review",
    detail: "Summary",
    metrics: [],
    packageCategories: [
      { key: "profile_details", label: "Profile details", status: "ready", detail: "Available" },
      { key: "rental_history", label: "Rental history", status: "ready", detail: "Available" },
      { key: "documents_records", label: "Documents & records", status: "ready", detail: "Available" },
      { key: "consent_identity_status", label: "Consent / identity status", status: "ready", detail: "Available" },
      { key: "application_readiness", label: "Application readiness", status: "ready", detail: "Available" },
    ],
    missingItems: [],
    ...overrides,
  };
}

describe("buildLandlordReviewGuidance", () => {
  it("returns ready for rereview when no package categories are missing", () => {
    const result = buildLandlordReviewGuidance(buildIntake());

    expect(result.state).toBe("ready_for_rereview");
    expect(result.summary).toBe("Ready for re-review");
    expect(result.missingCategories).toEqual([]);
    expect(result.nextSteps[0]).toMatch(/Review again/i);
  });

  it("returns ready for rereview when the package only has partial categories left", () => {
    const result = buildLandlordReviewGuidance(
      buildIntake({
        packageCategories: [
          { key: "profile_details", label: "Profile details", status: "ready", detail: "Available" },
          { key: "rental_history", label: "Rental history", status: "partial", detail: "Partial" },
          { key: "documents_records", label: "Documents & records", status: "partial", detail: "Partial" },
          { key: "consent_identity_status", label: "Consent / identity status", status: "partial", detail: "Partial" },
          { key: "application_readiness", label: "Application readiness", status: "partial", detail: "Partial" },
        ],
      })
    );

    expect(result.state).toBe("ready_for_rereview");
    expect(result.summary).toBe("Ready for re-review");
    expect(result.missingCategories).toEqual([]);
    expect(result.nextSteps.some((step) => /Review again/i.test(step))).toBe(true);
  });

  it("returns partly addressed when some categories are addressed and some still need follow-up", () => {
    const result = buildLandlordReviewGuidance(
      buildIntake({
        packageCategories: [
          { key: "profile_details", label: "Profile details", status: "ready", detail: "Available" },
          { key: "rental_history", label: "Rental history", status: "missing", detail: "Missing" },
          { key: "documents_records", label: "Documents & records", status: "ready", detail: "Available" },
          { key: "consent_identity_status", label: "Consent / identity status", status: "missing", detail: "Missing" },
          { key: "application_readiness", label: "Application readiness", status: "partial", detail: "Partial" },
        ],
      })
    );

    expect(result.state).toBe("partly_addressed");
    expect(result.summary).toBe("Partly addressed");
    expect(result.missingCategories).toEqual([
      "Rental history",
      "Consent / identity status",
    ]);
    expect(result.nextSteps.some((step) => /Keep follow-up active/i.test(step))).toBe(true);
  });

  it("returns needs follow-up when nothing is available to review", () => {
    const result = buildLandlordReviewGuidance(
      buildIntake({
        packageCategories: [
          { key: "profile_details", label: "Profile details", status: "missing", detail: "Missing" },
          { key: "rental_history", label: "Rental history", status: "missing", detail: "Missing" },
          { key: "documents_records", label: "Documents & records", status: "missing", detail: "Missing" },
          { key: "consent_identity_status", label: "Consent / identity status", status: "missing", detail: "Missing" },
          { key: "application_readiness", label: "Application readiness", status: "missing", detail: "Missing" },
        ],
      })
    );

    expect(result.state).toBe("follow_up_needed");
    expect(result.summary).toBe("Follow-up needed");
    expect(result.nextSteps.some((step) => /Request follow-up/i.test(step))).toBe(true);
  });
});
