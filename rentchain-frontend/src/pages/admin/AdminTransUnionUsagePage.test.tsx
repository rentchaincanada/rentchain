import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminTransUnionUsagePage from "./AdminTransUnionUsagePage";

const mocks = vi.hoisted(() => ({
  fetchAdminTransUnionUsageMock: vi.fn(),
  downloadAdminTransUnionUsagePdfMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../../api/adminScreeningUsageApi", () => ({
  downloadAdminTransUnionUsagePdf: mocks.downloadAdminTransUnionUsagePdfMock,
  fetchAdminTransUnionUsage: mocks.fetchAdminTransUnionUsageMock,
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToastMock }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/screening/transunion-usage"]}>
      <Routes>
        <Route path="/admin/screening/transunion-usage" element={<AdminTransUnionUsagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("AdminTransUnionUsagePage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.showToastMock.mockReset();
    mocks.downloadAdminTransUnionUsagePdfMock.mockReset();
    mocks.fetchAdminTransUnionUsageMock.mockReset();
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
    mocks.downloadAdminTransUnionUsagePdfMock.mockResolvedValue({
      blob: new Blob(["pdf-bytes"], { type: "application/pdf" }),
      filename: "rentchain-transunion-usage-summary-v1.pdf",
    });
    vi.spyOn(window.URL, "createObjectURL").mockReturnValue("blob:report");
    vi.spyOn(window.URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  it("renders KPI sections and compliance summary", async () => {
    renderPage();

    await waitFor(() => {
      expect(mocks.fetchAdminTransUnionUsageMock).toHaveBeenCalled();
    });

    expect(screen.getByText("TransUnion Usage Summary")).toBeInTheDocument();
    expect(screen.getByText("Connected landlords")).toBeInTheDocument();
    expect(screen.getByText("Compliance Controls")).toBeInTheDocument();
    expect(screen.getByText("Funnel Conversion")).toBeInTheDocument();
    expect(screen.getByText("Appendix")).toBeInTheDocument();
    expect(screen.getByText(/Tenant consent captured before screening: 100%/)).toBeInTheDocument();
    expect(screen.getByText(/Viewed option → Get Access/)).toBeInTheDocument();
    expect(screen.getByText(/Largest bottleneck:/)).toBeInTheDocument();
  });

  it("downloads the PDF report and shows loading state", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(HTMLElement.prototype, "remove").mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();

    const [button] = await screen.findAllByRole("button", { name: "Download PDF report" });
    fireEvent.click(button);

    expect(await screen.findByRole("button", { name: "Downloading PDF..." })).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.downloadAdminTransUnionUsagePdfMock).toHaveBeenCalledWith({ period: "last_30_days" });
    });
    expect(clickSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });

  it("shows an error toast when PDF download fails", async () => {
    mocks.downloadAdminTransUnionUsagePdfMock.mockRejectedValueOnce(new Error("export failed"));

    renderPage();

    const [button] = await screen.findAllByRole("button", { name: "Download PDF report" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mocks.showToastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Failed to download PDF report",
          variant: "error",
        })
      );
    });
  });
});
