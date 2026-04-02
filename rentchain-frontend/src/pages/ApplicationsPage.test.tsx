import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationsPage from "./ApplicationsPage";

const mocks = vi.hoisted(() => ({
  fetchProperties: vi.fn(),
  fetchRentalApplications: vi.fn(),
  fetchRentalApplication: vi.fn(),
  fetchApplicationDecisionSummary: vi.fn(),
  fetchScreeningQuote: vi.fn(),
  fetchScreeningResult: vi.fn(),
  fetchScreeningReceipt: vi.fn(),
  fetchScreeningEvents: vi.fn(),
  fetchViewingRequests: vi.fn(),
  getTransUnionIntegration: vi.fn(),
  showToast: vi.fn(),
  openUpgrade: vi.fn(),
  entitlementsMock: vi.fn(),
  authUserMock: vi.fn(),
}));

vi.mock("../api/propertiesApi", () => ({
  fetchProperties: mocks.fetchProperties,
}));

vi.mock("@/api/rentalApplicationsApi", () => ({
  fetchRentalApplications: mocks.fetchRentalApplications,
  fetchRentalApplication: mocks.fetchRentalApplication,
  fetchApplicationDecisionSummary: mocks.fetchApplicationDecisionSummary,
  updateRentalApplicationStatus: vi.fn(),
  fetchScreeningQuote: mocks.fetchScreeningQuote,
  createScreeningCheckout: vi.fn(),
  fetchScreening: vi.fn(),
  fetchScreeningResult: mocks.fetchScreeningResult,
  fetchScreeningReceipt: mocks.fetchScreeningReceipt,
  fetchScreeningEvents: mocks.fetchScreeningEvents,
  fetchScreeningOrderReport: vi.fn(),
  adminMarkScreeningComplete: vi.fn(),
  adminMarkScreeningFailed: vi.fn(),
  adminRecomputeScreening: vi.fn(),
  exportScreeningReport: vi.fn(),
}));

vi.mock("../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: () => mocks.entitlementsMock(),
}));

vi.mock("../context/useAuth", () => ({
  useAuth: () => ({
    user: mocks.authUserMock(),
  }),
}));

vi.mock("../context/UpgradeContext", () => ({
  useUpgrade: () => ({
    openUpgrade: mocks.openUpgrade,
  }),
}));

vi.mock("../hooks/useOnboardingState", () => ({
  useOnboardingState: () => ({
    markStepComplete: vi.fn(),
  }),
}));

vi.mock("../hooks/useUnitsForProperty", () => ({
  useUnitsForProperty: () => ({
    units: [],
    loading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock("@/api/integrationsApi", () => ({
  connectTransUnion: vi.fn(),
  disconnectTransUnion: vi.fn(),
  getTransUnionIntegration: mocks.getTransUnionIntegration,
  requestTransUnionOnboarding: vi.fn(),
  updateTransUnionCredentials: vi.fn(),
}));

vi.mock("@/api/viewingsApi", () => ({
  cancelViewing: vi.fn(),
  completeViewing: vi.fn(),
  fetchViewingRequest: vi.fn(),
  fetchViewingRequests: mocks.fetchViewingRequests,
  proposeViewingSlots: vi.fn(),
  selectViewingSlot: vi.fn(),
}));

vi.mock("@/api/screeningOpsApi", () => ({
  getScreeningStatus: vi.fn().mockResolvedValue(null),
  requestManualScreening: vi.fn(),
}));

vi.mock("@/api/screeningApi", () => ({
  fetchScreeningHistory: vi.fn().mockResolvedValue({ items: [] }),
  fetchScreeningHistoryDetail: vi.fn(),
  fetchScreeningReportBlob: vi.fn(),
}));

vi.mock("../components/layout/ResponsiveMasterDetail", () => ({
  ResponsiveMasterDetail: ({ master, detail }: any) => (
    <div>
      <div>{master}</div>
      <div>{detail}</div>
    </div>
  ),
}));

vi.mock("../components/properties/SendApplicationModal", () => ({
  SendApplicationModal: () => null,
}));

vi.mock("../components/properties/CreatePropertyFirstModal", () => ({
  CreatePropertyFirstModal: () => null,
}));

vi.mock("../components/screening/SendScreeningInviteModal", () => ({
  SendScreeningInviteModal: ({ open }: any) => (open ? <div>Screening Invite Modal</div> : null),
}));

vi.mock("../components/screening/ScreeningStatusBadge", () => ({
  ScreeningStatusBadge: () => <div>Screening Badge</div>,
}));

vi.mock("@/components/screening/ScreeningStatusCard", () => ({
  ScreeningStatusCard: () => <div>Screening Status Card</div>,
}));

vi.mock("@/components/screening/ScreeningReportView", () => ({
  ScreeningReportView: () => <div>Screening Report View</div>,
}));

vi.mock("../components/billing/SamplePdfModal", () => ({
  SamplePdfModal: () => null,
}));

vi.mock("@/components/applications/ApplicationDecisionSummaryCard", () => ({
  ApplicationDecisionSummaryCard: () => <div>Decision Summary</div>,
}));

vi.mock("@/components/integrations/TransUnionConnectionCard", () => ({
  TransUnionConnectionCard: () => <div>TransUnion Connection</div>,
}));

vi.mock("@/components/integrations/GetTransUnionAccessModal", () => ({
  GetTransUnionAccessModal: () => null,
}));

vi.mock("@/components/integrations/ConnectTransUnionModal", () => ({
  ConnectTransUnionModal: () => null,
}));

vi.mock("@/components/integrations/UpdateTransUnionCredentialsModal", () => ({
  UpdateTransUnionCredentialsModal: () => null,
}));

vi.mock("@/components/viewings/ViewingRequestList", () => ({
  ViewingRequestList: () => <div>Viewing Request List</div>,
}));

vi.mock("@/components/viewings/ViewingRequestDetail", () => ({
  ViewingRequestDetail: () => <div>Viewing Request Detail</div>,
}));

vi.mock("@/components/screening/ScreeningHistoryTable", () => ({
  ScreeningHistoryTable: () => <div>Screening History Table</div>,
}));

vi.mock("@/components/screening/ScreeningDetailDrawer", () => ({
  ScreeningDetailDrawer: () => null,
}));

vi.mock("@/components/billing/FeatureGate", () => ({
  FeatureGate: ({ children, fallback }: any) => <>{children ?? fallback ?? null}</>,
}));

vi.mock("@/components/billing/FeatureTeaser", () => ({
  FeatureTeaser: ({ title, description }: any) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

vi.mock("@/components/billing/UpgradeCTA", () => ({
  UpgradeCTA: ({ label }: { label?: string }) => <button type="button">{label || "Upgrade"}</button>,
}));

vi.mock("../config/screening", () => ({
  SCREENING_ENABLED: true,
  getUiLocale: () => "en",
  screeningComingSoonLabel: () => "Credit screening - coming soon.",
  screeningUnavailableMessage: () => "Screening unavailable.",
}));

vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
}));

describe("ApplicationsPage", () => {
  beforeEach(() => {
    vi.spyOn(console, "debug").mockImplementation(() => {});
    mocks.entitlementsMock.mockReturnValue({
      loading: false,
      plan: "free",
      role: "landlord",
      isAdmin: false,
      capabilities: {},
      hasCapability: () => false,
      requiredPlanFor: () => "pro",
      canScreen: false,
      canViewScreeningHistory: false,
      canExportPdf: false,
      hasMoveInReadiness: false,
      canUseWorkOrders: false,
      canViewReviewSummary: false,
    });
    mocks.authUserMock.mockReturnValue({
      id: "user-1",
      role: "landlord",
      plan: "free",
    });
    mocks.fetchProperties.mockResolvedValue({
      items: [{ id: "prop-1", name: "Harbour View" }],
    });
    mocks.fetchRentalApplications.mockResolvedValue([]);
    mocks.fetchRentalApplication.mockResolvedValue(null);
    mocks.fetchApplicationDecisionSummary.mockResolvedValue(null);
    mocks.fetchScreeningQuote.mockResolvedValue({ ok: false, detail: "Screening not eligible." });
    mocks.fetchScreeningResult.mockResolvedValue({ ok: false });
    mocks.fetchScreeningReceipt.mockResolvedValue({ ok: false });
    mocks.fetchScreeningEvents.mockResolvedValue([]);
    mocks.fetchViewingRequests.mockResolvedValue([]);
    mocks.getTransUnionIntegration.mockResolvedValue({
      provider: "transunion",
      status: "not_connected",
      version: 1,
    });
    mocks.showToast.mockReset();
    mocks.openUpgrade.mockReset();
  });

  it("renders without crashing for a free-tier landlord", async () => {
    render(
      <MemoryRouter>
        <ApplicationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Applications" })).toBeInTheDocument();

    await waitFor(() => {
      expect(mocks.fetchRentalApplications).toHaveBeenCalled();
    });

    expect(screen.getByRole("button", { name: "Send screening invite" })).toBeInTheDocument();
    expect(screen.getByText("TransUnion Connection")).toBeInTheDocument();
  });

  it("shows Starter-aligned screening upgrade copy instead of the old Pro gate", async () => {
    render(
      <MemoryRouter>
        <ApplicationsPage />
      </MemoryRouter>
    );

    const button = await screen.findByRole("button", { name: "Send screening invite" });
    button.click();

    expect(mocks.openUpgrade).toHaveBeenCalledWith(
      expect.objectContaining({
        ctaLabel: "Upgrade to Starter",
        copy: expect.objectContaining({
          title: "Upgrade to Starter",
          body: "Starter includes applicant screening inside RentChain. Upgrade to continue.",
        }),
      })
    );
  });
});
