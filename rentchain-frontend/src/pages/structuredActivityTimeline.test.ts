import { describe, expect, it } from "vitest";
import {
  buildLandlordStructuredActivityTimeline,
  buildTenantStructuredActivityTimeline,
} from "./structuredActivityTimeline";

describe("structuredActivityTimeline", () => {
  it("normalizes tenant notifications into ordered timeline items", () => {
    const result = buildTenantStructuredActivityTimeline([
      {
        id: "application-1",
        type: "application",
        title: "Application status updated",
        summary: "Current application status: submitted.",
        createdAt: "2026-04-01T00:00:00.000Z",
        status: "info",
        relatedPath: "/tenant/application",
      },
      {
        id: "identity-1",
        type: "identity",
        title: "Identity verification needs attention",
        summary: "Verification is still in progress.",
        createdAt: "2026-04-02T00:00:00.000Z",
        status: "warning",
        relatedPath: "/tenant/profile",
      },
    ]);

    expect(result.map((item) => item.id)).toEqual(["identity-1", "application-1"]);
    expect(result[0]).toMatchObject({
      type: "identity_updated",
      actionRequired: true,
      actorLabel: "Tenant workspace",
    });
  });

  it("builds a landlord timeline from current authorized review-summary state", () => {
    const result = buildLandlordStructuredActivityTimeline({
      applicationId: "app-1",
      generatedAt: "2026-04-03T00:00:00.000Z",
      applicant: {
        name: "Jane Applicant",
        email: "jane@example.com",
        currentAddressLine: null,
        city: null,
        provinceState: null,
        postalCode: null,
        country: null,
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
      reference: { name: null, phone: null },
      compliance: {
        applicationConsentAcceptedAt: null,
        applicationConsentVersion: null,
        signatureType: null,
        signedAt: null,
      },
      screening: { status: "complete", provider: "transunion", referenceId: "TU-1" },
      derived: { incomeToRentRatio: null, completeness: { score: 0.8, label: "High" }, flags: ["MISSING_CURRENT_RENT"] },
      insights: [],
      decisionSummary: {
        applicationId: "app-1",
        riskSnapshot: {
          version: "risk-v1",
          status: "completed",
          score: 72,
          grade: "B",
          confidence: 0.84,
          factors: [],
          flags: [],
          recommendations: [],
          updatedAt: "2026-04-04T00:00:00.000Z",
        },
      },
      risk: null,
    } as any);

    expect(result[0]).toMatchObject({
      title: "Review state updated",
      actionRequired: false,
    });
    expect(
      result.some((item) => item.title === "Application placed on hold" && item.actionRequired)
    ).toBe(true);
    expect(result.some((item) => item.title === "Review follow-up remains active" && item.actionRequired)).toBe(true);
    expect(result.some((item) => item.title === "Follow-up requested")).toBe(true);
    expect(result.some((item) => item.title === "Consent / identity status pending")).toBe(true);
  });
});
