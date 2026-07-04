import { describe, expect, it } from "vitest";
import {
  buildReviewSummary,
  buildReviewSummaryPdfSections,
} from "../reviewSummary";

describe("review summary export contract", () => {
  it("builds landlord-safe PDF sections with application, household, risk, and notes context", () => {
    const summary = buildReviewSummary("raw-app-id-123", {
      status: "SUBMITTED",
      submittedAt: "2026-04-01T10:00:00.000Z",
      propertyName: "Harbour View",
      unitApplied: "Unit 203",
      requestedRent: 2100,
      leaseStartDate: "2026-05-01",
      applicant: {
        firstName: "Jamie",
        lastName: "Stone",
        email: "jamie@example.com",
      },
      applicantProfile: {
        currentAddress: {
          line1: "12 North Street",
          city: "Halifax",
          provinceState: "NS",
          postalCode: "B3H 1A1",
          country: "CA",
        },
        timeAtCurrentAddressMonths: 18,
        currentRentAmountCents: 180000,
        employment: {
          employerName: "Harbour Labs",
          jobTitle: "Designer",
          incomeAmountCents: 7800000,
          incomeFrequency: "annual",
          monthsAtJob: 24,
        },
        workReference: {
          name: "Taylor Grant",
          phone: "555-555-0100",
        },
        signature: {
          type: "typed",
          signedAt: "2026-03-31T18:00:00.000Z",
        },
        applicantNotes: "Prefers a September move if possible.",
      },
      applicationConsent: {
        version: "v1.0",
        acceptedAt: "2026-03-31T18:00:00.000Z",
      },
      coApplicant: {
        fullName: "Riley Stone",
        email: "riley@example.com",
        phone: "555-555-0199",
        monthlyIncome: 3200,
      },
      household: {
        otherOccupants: "One child",
        pets: "One cat",
        vehicles: "One vehicle",
        notes: "Needs parking.",
      },
      currentLeaseStatus: {
        hasActiveLease: true,
        leaseEndDate: "2026-04-30",
        landlordAware: "yes",
        reasonForMoving: "Moving closer to work.",
      },
      residentialHistory: [
        {
          address: "12 North Street",
          durationMonths: 18,
          rentAmountCents: 180000,
          landlordName: "Morgan Lee",
          landlordPhone: "555-555-0123",
          reasonForLeaving: "Larger unit needed",
        },
      ],
      screeningStatus: "complete",
      screeningProvider: "Provider A",
      screening: {
        orderId: "provider-order-raw-id",
      },
      flags: ["income_review"],
      notes: "Call reference before final approval.",
    });

    const sections = buildReviewSummaryPdfSections(summary, {
      decisionSummary: {
        riskInsights: {
          score: 74,
          grade: "B",
          confidence: 0.82,
          signals: ["Stable employment"],
          recommendations: ["Verify income documents"],
        },
        referenceQuestions: ["Would you rent to this applicant again?"],
        screeningRecommendation: {
          recommended: false,
          reason: "Screening is complete.",
        },
        screeningSummary: {
          available: true,
          highlights: ["Screening completed"],
        },
        decisionSupport: {
          summaryLine: "Application is ready for landlord review.",
          nextBestAction: "Call references before approval.",
        },
      },
    });

    const titles = sections.map((section) => section.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "Application Context",
        "Household & Co-applicant",
        "Current Housing & Lease Status",
        "Residential History",
        "Screening & Deterministic Signals",
        "Risk & Decision Guidance",
        "Notes & Flags",
      ])
    );

    const rendered = JSON.stringify(sections);
    expect(rendered).toContain("Harbour View");
    expect(rendered).toContain("Unit 203");
    expect(rendered).toContain("One child");
    expect(rendered).toContain("Stable employment");
    expect(rendered).toContain("Call references before approval.");
    expect(rendered).not.toContain("raw-app-id-123");
    expect(rendered).not.toContain("provider-order-raw-id");
    expect(rendered).not.toContain("Application ID");
    expect(rendered).not.toContain("Screening reference");
  });
});
