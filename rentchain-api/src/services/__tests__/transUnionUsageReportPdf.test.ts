import { describe, expect, it } from "vitest";
import {
  buildTransUnionUsagePdfViewModel,
} from "../screening/transUnionUsageReportPdf";
import type { TransUnionUsageReport } from "../screening/transUnionUsageReportService";

function buildReport(): TransUnionUsageReport {
  return {
    ok: true,
    providerKey: "transunion",
    period: {
      label: "last_30_days",
      startDate: "2026-03-01T00:00:00.000Z",
      endDate: "2026-03-30T23:59:59.999Z",
    },
    funnel: {
      optionViewed: 10,
      getAccessClicks: 7,
      haveCredentialsClicks: 4,
      credentialSubmissions: 3,
      connectionSuccesses: 2,
      connectionFailures: 1,
      firstScreeningInitiated: 2,
      repeatScreeningUsers: 1,
    },
    usage: {
      activeConnectedLandlords: 2,
      totalScreeningRequests: 5,
      completedScreenings: 4,
      inProgressScreenings: 1,
      blockedScreenings: 1,
      manualReviewScreenings: 1,
      averageScreeningsPerConnectedLandlord: 2.5,
      repeatUsageRate: 0.5,
    },
    compliance: {
      tenantConsentCapturedRate: 1,
      permissiblePurposeConfirmedRate: 1,
      auditCoverageRate: 0.8,
      requestsBlockedForMissingConsent: 1,
      requestsBlockedForMissingProviderConnection: 0,
    },
    quality: {
      completionRate: 0.8,
      manualReviewRate: 0.2,
      failedOrBlockedRate: 0.2,
      credentialConnectionFailureRate: 0.33,
      averageTimeFromApplicationToScreeningRequestMinutes: 45,
    },
    report: {
      executiveSummary: {
        headline: "RentChain tracks usage.",
        confidentialityNote: "Aggregate only.",
        keyMetrics: {},
      },
      onboardingFunnel: {
        optionViewed: 10,
        getAccessClicks: 7,
        haveCredentialsClicks: 4,
        credentialSubmissions: 3,
        connectionSuccesses: 2,
        connectionFailures: 1,
        firstScreeningInitiated: 2,
        repeatScreeningUsers: 1,
      },
      screeningVolume: {
        activeConnectedLandlords: 2,
        totalScreeningRequests: 5,
        completedScreenings: 4,
        inProgressScreenings: 1,
        blockedScreenings: 1,
        manualReviewScreenings: 1,
        averageScreeningsPerConnectedLandlord: 2.5,
        repeatUsageRate: 0.5,
      },
      complianceControls: {
        tenantConsentCapturedRate: 1,
        permissiblePurposeConfirmedRate: 1,
        auditCoverageRate: 0.8,
        requestsBlockedForMissingConsent: 1,
        requestsBlockedForMissingProviderConnection: 0,
      },
      workflowDescription: {
        steps: ["Application", "Consent", "Request"],
      },
      landlordAdoptionInsights: {
        landlordCounts: {
          viewers: 10,
          connected: 2,
          repeatUsers: 1,
        },
        mostCommonBlockedReason: "missing_consent",
      },
      operationalQuality: {
        completionRate: 0.8,
        manualReviewRate: 0.2,
        failedOrBlockedRate: 0.2,
        credentialConnectionFailureRate: 0.33,
        averageTimeFromApplicationToScreeningRequestMinutes: 45,
      },
      partnershipReadiness: {
        notes: ["Workflow layer", "Aggregate only"],
      },
      appendix: {
        eventDefinitions: ["tu_option_viewed", "screening_request_created"],
        dataExclusions: [
          "No raw credit report contents",
          "No passcodes",
          "No member codes",
          "No tenant personal information",
          "No landlord customer list",
        ],
      },
    },
  };
}

describe("transUnionUsageReportPdf", () => {
  it("builds an aggregate-only PDF view model", () => {
    const viewModel = buildTransUnionUsagePdfViewModel(buildReport());
    const serialized = JSON.stringify(viewModel);

    expect(viewModel.cover.title).toContain("RentChain TransUnion Usage Summary");
    expect(viewModel.onboardingFunnel.rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: "Viewed TransUnion option", value: "10" })])
    );
    expect(serialized).not.toContain("PASS-1122");
    expect(serialized).not.toContain("MEMBER-7788");
    expect(serialized).not.toContain("tenant@example.com");
  });
});
