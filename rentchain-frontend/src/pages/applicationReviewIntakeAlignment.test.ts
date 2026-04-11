import { describe, expect, it } from "vitest";
import { buildLandlordIntakeAlignmentView } from "./applicationReviewIntakeAlignment";
import type { ApplicationReviewSummary } from "../api/reviewSummaryApi";

function buildSummary(overrides?: Partial<ApplicationReviewSummary>): ApplicationReviewSummary {
  return {
    applicationId: "app-1",
    generatedAt: "2026-04-01T00:00:00.000Z",
    applicant: {
      name: "Jane Applicant",
      email: "jane@example.com",
      currentAddressLine: "123 Main St",
      city: "Halifax",
      provinceState: "NS",
      postalCode: "B3H1A1",
      country: "CA",
      timeAtCurrentAddressMonths: 24,
      currentRentAmountCents: 180000,
    },
    employment: {
      employerName: "Harbor Co",
      jobTitle: "Manager",
      incomeAmountCents: 720000,
      incomeFrequency: "monthly",
      incomeMonthlyCents: 720000,
      monthsAtJob: 18,
    },
    reference: {
      name: "Jordan Ref",
      phone: "902-555-0100",
    },
    compliance: {
      applicationConsentAcceptedAt: "2026-04-01T00:00:00.000Z",
      applicationConsentVersion: "v1",
      signatureType: "typed",
      signedAt: "2026-04-01T00:00:00.000Z",
    },
    screening: {
      status: "complete",
      provider: "transunion",
      referenceId: "TU-1",
    },
    derived: {
      incomeToRentRatio: 4,
      completeness: { score: 1, label: "High" },
      flags: [],
    },
    insights: [],
    decisionSummary: null,
    risk: null,
    ...overrides,
  };
}

describe("buildLandlordIntakeAlignmentView", () => {
  it("marks a complete authorized review payload as ready for review", () => {
    const view = buildLandlordIntakeAlignmentView(buildSummary());

    expect(view.state).toBe("ready_for_review");
    expect(view.metrics[0]?.value).toBe("4/4");
    expect(view.metrics[1]?.value).toBe("3");
    expect(view.missingItems).toHaveLength(0);
  });

  it("groups missing review-summary flags into high-level follow-up categories", () => {
    const view = buildLandlordIntakeAlignmentView(
      buildSummary({
        applicant: {
          name: "Jane Applicant",
          email: "jane@example.com",
          currentAddressLine: null,
          city: null,
          provinceState: null,
          postalCode: null,
          country: "CA",
          timeAtCurrentAddressMonths: null,
          currentRentAmountCents: null,
        },
        employment: {
          employerName: null,
          jobTitle: null,
          incomeAmountCents: null,
          incomeFrequency: null,
          incomeMonthlyCents: null,
          monthsAtJob: null,
        },
        reference: {
          name: null,
          phone: null,
        },
        compliance: {
          applicationConsentAcceptedAt: null,
          applicationConsentVersion: null,
          signatureType: null,
          signedAt: null,
        },
        screening: {
          status: "not_run",
          provider: null,
          referenceId: null,
        },
        derived: {
          incomeToRentRatio: null,
          completeness: { score: 0.42, label: "Low" },
          flags: [
            "MISSING_CURRENT_ADDRESS_LINE1",
            "MISSING_CURRENT_ADDRESS_CITY",
            "MISSING_EMPLOYER_NAME",
            "MISSING_INCOME",
            "MISSING_WORK_REFERENCE_NAME",
            "MISSING_SIGNATURE",
            "MISSING_APPLICATION_CONSENT",
          ],
        },
      })
    );

    expect(view.state).toBe("needs_follow_up");
    expect(view.missingItems.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "Current address",
        "Employment & income",
        "Work reference",
        "Signature record",
        "Consent record",
      ])
    );
  });
});
