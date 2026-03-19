import { describe, expect, it } from "vitest";
import { buildReviewSummary } from "../../lib/reviewSummary";
import { buildApplicationDecisionSummary } from "../risk/applicationDecisionSummary";

function buildApplication(overrides: Record<string, any> = {}) {
  return {
    status: "IN_REVIEW",
    applicant: {
      firstName: "Jordan",
      lastName: "Lee",
      email: "jordan@example.com",
    },
    applicantProfile: {
      currentAddress: {
        line1: "123 King St",
        city: "Halifax",
        provinceState: "NS",
        postalCode: "B3H1A1",
        country: "CA",
      },
      timeAtCurrentAddressMonths: 18,
      currentRentAmountCents: 180000,
      employment: {
        employerName: "Harbour Labs",
        jobTitle: "Designer",
        incomeAmountCents: 720000,
        incomeFrequency: "monthly",
        monthsAtJob: 20,
      },
      workReference: {
        name: "Taylor Grant",
        phone: "555-555-0100",
      },
      signature: {
        type: "typed",
        signedAt: "2026-03-18T10:00:00.000Z",
      },
    },
    applicationConsent: {
      acceptedAt: "2026-03-18T10:00:00.000Z",
      version: "v1.0",
    },
    screeningStatus: "processing",
    screeningProvider: "TransUnion",
    screening: {
      requested: true,
      status: "PENDING",
    },
    ...overrides,
  };
}

describe("buildApplicationDecisionSummary", () => {
  it("builds a compact full summary from application and review data", () => {
    const application = buildApplication({
      screening: {
        requested: true,
        status: "PENDING",
        ai: {
          enabled: true,
          riskAssessment: "LOW",
          confidenceScore: 88,
          flags: ["INCOME_STRESS", "REFERENCE_WEAK"],
          recommendations: ["Verify income documents", "Call prior landlord"],
          summary: "Signals look stable overall.",
          generatedAt: 1710765600000,
        },
      },
    });

    const reviewSummary = buildReviewSummary("app-1", application);
    const result = buildApplicationDecisionSummary({
      applicationId: "app-1",
      application,
      reviewSummary,
    });

    expect(result.applicationId).toBe("app-1");
    expect(result.riskInsights?.grade).toBe("B");
    expect(result.riskInsights?.signals).toContain("Income Stress");
    expect(result.referenceQuestions?.length).toBeGreaterThanOrEqual(3);
    expect(result.screeningRecommendation?.recommended).toBe(false);
    expect(result.screeningRecommendation?.reason).toContain("in progress");
    expect(result.decisionSupport?.nextBestAction).toContain("Review references");
  });

  it("recommends screening when evidence is sparse and no screening is complete", () => {
    const application = buildApplication({
      screeningStatus: null,
      screeningProvider: null,
      screening: { requested: false, status: "NOT_REQUESTED" },
      applicantProfile: {
        currentAddress: { line1: "", city: "", provinceState: "", postalCode: "" },
        currentRentAmountCents: null,
        employment: {
          employerName: "",
          jobTitle: "",
          incomeAmountCents: null,
          incomeFrequency: null,
          monthsAtJob: null,
        },
        workReference: { name: "", phone: "" },
        signature: { signedAt: null },
      },
      applicationConsent: { acceptedAt: null, version: null },
    });

    const reviewSummary = buildReviewSummary("app-2", application);
    const result = buildApplicationDecisionSummary({
      applicationId: "app-2",
      application,
      reviewSummary,
    });

    expect(result.riskInsights?.grade).toBe("E");
    expect(result.screeningRecommendation?.recommended).toBe(true);
    expect(result.screeningRecommendation?.priority).toBe("high");
    expect(result.screeningSummary?.available).toBe(false);
    expect(result.decisionSupport?.nextBestAction).toBe("Complete screening before deciding.");
  });

  it("returns screening highlights when an existing screening result summary is available", () => {
    const application = buildApplication({
      screeningStatus: "complete",
      screeningCompletedAt: 1710765600000,
      screeningResultSummary: {
        overall: "review",
        scoreBand: "C",
        flags: ["Collections noted", "Identity recheck suggested"],
      },
    });

    const reviewSummary = buildReviewSummary("app-3", application);
    const result = buildApplicationDecisionSummary({
      applicationId: "app-3",
      application,
      reviewSummary,
    });

    expect(result.screeningSummary?.available).toBe(true);
    expect(result.screeningSummary?.highlights).toContain("Overall result: Review");
    expect(result.screeningRecommendation?.recommended).toBe(false);
    expect(result.decisionSupport?.summaryLine).toContain("Screening is available");
  });
});

