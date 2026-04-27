import { describe, expect, it } from "vitest";
import { deriveApplyWithRentChainContext } from "../deriveApplyWithRentChainContext";

describe("deriveApplyWithRentChainContext", () => {
  it("maps approved identity and application scopes into safe prefill only", () => {
    const result = deriveApplyWithRentChainContext({
      approvedScopeKeys: [
        "identity_summary",
        "application_summary",
        "documents_summary",
        "lease_summary",
        "payment_readiness_summary",
      ],
      identityExchangeReference: {
        referenceType: "tenant_identity_reference",
        referenceStatus: "available",
        referenceLabel: "Identity exchange available",
        referenceDescription: "safe",
        portabilityStatus: "ready",
        exchangeReadiness: {
          identityReady: true,
          credibilityReady: true,
          sharingControlsReady: true,
          auditTimelineReady: true,
          paymentReadinessAvailable: true,
        },
      },
      applicationReuse: {
        applicant: {
          firstName: "Jordan",
          lastName: "Lee",
          email: "jordan@example.com",
          phone: "5551112222",
        },
        currentAddress: {
          line1: "123 King St",
          line2: null,
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
          monthsAtJob: 12,
        },
        workReference: {
          name: "Taylor Grant",
          phone: "5550001111",
        },
        nextOfKin: null,
      },
    });

    expect(result.scopesApproved).toEqual([
      "identity_summary",
      "application_summary",
      "documents_summary",
      "lease_summary",
      "payment_readiness_summary",
    ]);
    expect(result.applicationContext.prefill.applicant.firstName).toBe("Jordan");
    expect(result.applicationContext.prefill.currentAddress?.line1).toBe("123 King St");
    expect(result.applicationContext.prefill.employment?.employerName).toBe("Harbour Labs");
    expect(result.applicationContext.requiredRemaining).toContain("credit_consent");
  });

  it("does not derive document or lease details into application prefill", () => {
    const result = deriveApplyWithRentChainContext({
      approvedScopeKeys: ["documents_summary", "lease_summary", "payment_readiness_summary"],
      identityExchangeReference: {
        referenceType: "tenant_identity_reference",
        referenceStatus: "limited",
        referenceLabel: "Identity exchange limited",
        referenceDescription: "safe",
        portabilityStatus: "limited",
        exchangeReadiness: {
          identityReady: false,
          credibilityReady: true,
          sharingControlsReady: true,
          auditTimelineReady: false,
          paymentReadinessAvailable: true,
        },
      },
      applicationReuse: {
        applicant: {
          firstName: "Jordan",
          lastName: "Lee",
          email: "jordan@example.com",
          phone: "5551112222",
        },
        currentAddress: null,
        timeAtCurrentAddressMonths: null,
        currentRentAmountCents: null,
        employment: null,
        workReference: null,
        nextOfKin: null,
      },
    });

    expect(result.applicationContext.prefill.applicant.firstName).toBeUndefined();
    expect(result.applicationContext.prefill.currentAddress).toBeUndefined();
    expect(result.applicationContext.prefill.employment).toBeUndefined();
  });
});
