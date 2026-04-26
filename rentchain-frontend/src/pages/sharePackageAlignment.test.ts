import { describe, expect, it } from "vitest";
import {
  SHARE_PACKAGE_CATEGORY_LABELS,
  buildLandlordSharePackageCategories,
  buildTenantSharePackageCategories,
} from "./sharePackageAlignment";

describe("share package alignment helper", () => {
  it("uses the same package category labels across tenant and landlord surfaces", () => {
    expect(Object.values(SHARE_PACKAGE_CATEGORY_LABELS)).toEqual([
      "Profile details",
      "Rental history",
      "Documents & records",
      "Consent / identity status",
      "Application readiness",
    ]);
  });

  it("builds aligned tenant package categories", () => {
    const result = buildTenantSharePackageCategories({
      hasProfileBasics: true,
      rentalHistoryDetail: "123 Main St, Halifax, NS",
      hasRentalHistory: true,
      readyDocumentCount: 2,
      missingDocumentCount: 1,
      identityStatusLabel: "Identity is pending review.",
      identityVerified: false,
      activeGrantCount: 1,
      progressPercent: 62,
      missingCount: 2,
    });

    expect(result.map((item) => item.label)).toEqual(Object.values(SHARE_PACKAGE_CATEGORY_LABELS));
    expect(result[2]).toMatchObject({ label: "Documents & records", status: "partial" });
    expect(result[4]).toMatchObject({ label: "Application readiness", status: "partial" });
  });

  it("builds aligned landlord package categories", () => {
    const result = buildLandlordSharePackageCategories({
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
      reference: { name: "Jordan Ref", phone: "902-555-0100" },
      compliance: {
        applicationConsentAcceptedAt: "2026-04-01T00:00:00.000Z",
        applicationConsentVersion: "v1",
        signatureType: "typed",
        signedAt: "2026-04-01T00:00:00.000Z",
      },
      screening: { status: "complete", provider: "transunion", referenceId: "TU-1" },
      derived: { incomeToRentRatio: 4, completeness: { score: 0.94, label: "High" }, flags: [] },
      insights: [],
      decisionSummary: null,
      risk: null,
    });

    expect(result.map((item) => item.label)).toEqual(Object.values(SHARE_PACKAGE_CATEGORY_LABELS));
    expect(result.every((item) => item.status === "ready")).toBe(true);
  });
});
