import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminTransUnionUsagePage from "./AdminTransUnionUsagePage";

const mocks = vi.hoisted(() => ({
  fetchAdminTransUnionUsageMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../../api/adminScreeningUsageApi", () => ({
  fetchAdminTransUnionUsage: mocks.fetchAdminTransUnionUsageMock,
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToastMock }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("AdminTransUnionUsagePage", () => {
  beforeEach(() => {
    mocks.showToastMock.mockReset();
    mocks.fetchAdminTransUnionUsageMock.mockResolvedValue({
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
          headline: "RentChain tracks TransUnion workflow usage internally.",
          confidentialityNote: "Aggregate only.",
          keyMetrics: {},
        },
        workflowDescription: {
          steps: ["Application", "Consent", "Connection", "Request", "Audit"],
        },
        landlordAdoptionInsights: {
          landlordCounts: {
            viewers: 10,
            connected: 2,
            repeatUsers: 1,
          },
          mostCommonBlockedReason: "missing_consent",
        },
        partnershipReadiness: {
          notes: ["Workflow layer", "Aggregate only"],
        },
        appendix: {
          eventDefinitions: ["tu_option_viewed", "screening_request_created"],
          dataExclusions: ["No passcodes", "No raw reports"],
        },
      },
    });
  });

  it("renders KPI sections and compliance summary", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/screening/transunion-usage"]}>
        <Routes>
          <Route path="/admin/screening/transunion-usage" element={<AdminTransUnionUsagePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchAdminTransUnionUsageMock).toHaveBeenCalled();
    });

    expect(screen.getByText("TransUnion Usage Summary")).toBeInTheDocument();
    expect(screen.getByText("Connected landlords")).toBeInTheDocument();
    expect(screen.getByText("Compliance Controls")).toBeInTheDocument();
    expect(screen.getByText("Appendix")).toBeInTheDocument();
    expect(screen.getByText(/Tenant consent captured before screening: 100%/)).toBeInTheDocument();
  });
});

