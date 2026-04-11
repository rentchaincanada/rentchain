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
  it("returns ready to review when no package categories are missing", () => {
    const result = buildLandlordReviewGuidance(buildIntake());

    expect(result.state).toBe("ready_to_review");
    expect(result.summary).toBe("Ready to review");
    expect(result.missingCategories).toEqual([]);
    expect(result.nextSteps[0]).toMatch(/Review the categories already available now/i);
  });

  it("returns partly available when some categories are missing but some are still available", () => {
    const result = buildLandlordReviewGuidance(
      buildIntake({
        packageCategories: [
          { key: "profile_details", label: "Profile details", status: "ready", detail: "Available" },
          { key: "rental_history", label: "Rental history", status: "missing", detail: "Missing" },
          { key: "documents_records", label: "Documents & records", status: "partial", detail: "Partial" },
          { key: "consent_identity_status", label: "Consent / identity status", status: "missing", detail: "Missing" },
          { key: "application_readiness", label: "Application readiness", status: "partial", detail: "Partial" },
        ],
      })
    );

    expect(result.state).toBe("partly_available");
    expect(result.missingCategories).toEqual(["Rental history", "Consent / identity status"]);
    expect(result.nextSteps.some((step) => /Follow up on missing information/i.test(step))).toBe(true);
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

    expect(result.state).toBe("needs_follow_up");
    expect(result.summary).toBe("Needs follow-up");
    expect(result.nextSteps[0]).toMatch(/Follow up on missing information/i);
  });
});
