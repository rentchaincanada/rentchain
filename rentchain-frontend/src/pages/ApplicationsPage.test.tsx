import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ApplicationsPage from "./ApplicationsPage";

const mocks = vi.hoisted(() => ({
  fetchProperties: vi.fn(),
  fetchRentalApplications: vi.fn(),
  fetchRentalApplication: vi.fn(),
  fetchApplicationDecisionSummary: vi.fn(),
  evaluateApplicationRiskSnapshot: vi.fn(),
  submitRentalApplicationDecisionAction: vi.fn(),
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
  evaluateApplicationRiskSnapshot: mocks.evaluateApplicationRiskSnapshot,
  submitRentalApplicationDecisionAction: mocks.submitRentalApplicationDecisionAction,
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
  ApplicationDecisionSummaryCard: ({ onDecision, submittingDecision }: any) => (
    <div>
      <button type="button" onClick={() => onDecision?.("request_info", "Need paystub")} disabled={submittingDecision}>
        Trigger Request More Info
      </button>
      <button type="button" onClick={() => onDecision?.("approve", "Looks good")} disabled={submittingDecision}>
        Trigger Approve
      </button>
      <button type="button" onClick={() => onDecision?.("reject", "Not a fit")} disabled={submittingDecision}>
        Trigger Reject
      </button>
    </div>
  ),
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
    mocks.fetchRentalApplications.mockResolvedValue([
      {
        id: "app-1",
        applicantName: "Jamie Stone",
        email: "jamie@example.com",
        propertyId: "prop-1",
        unitId: "unit-1",
        status: "SUBMITTED",
        submittedAt: Date.now(),
      },
    ]);
    mocks.fetchRentalApplication.mockResolvedValue({
      id: "app-1",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      applicationLinkId: "link-1",
      createdAt: Date.now(),
      submittedAt: Date.now(),
      updatedAt: Date.now(),
      status: "SUBMITTED",
      applicant: { firstName: "Jamie", lastName: "Stone", email: "jamie@example.com" },
      residentialHistory: [],
      employment: { applicant: {} },
      consent: { creditConsent: true, referenceConsent: true, dataSharingConsent: true, acceptedAt: Date.now() },
      screening: { requested: false },
      landlordNote: null,
    });
    mocks.fetchApplicationDecisionSummary.mockResolvedValue(null);
    mocks.submitRentalApplicationDecisionAction.mockReset();
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
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(
      <MemoryRouter>
        <ApplicationsPage />
      </MemoryRouter>
    );

    const button = await screen.findByRole("button", { name: "Send screening invite" });
    button.click();

    expect(dispatchSpy).toHaveBeenCalled();
    const event = dispatchSpy.mock.calls.at(-1)?.[0] as CustomEvent;
    expect(event.type).toBe("upgrade:prompt");
    expect(event.detail).toMatchObject({
      featureKey: "screening_workflow",
      currentPlan: "free",
      requiredPlan: "starter",
      source: "applications_page_screening",
    });
  });

  it("opens a request-more-info modal and sends the actionable request", async () => {
    mocks.submitRentalApplicationDecisionAction.mockResolvedValue({
      application: {
        id: "app-1",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        applicationLinkId: "link-1",
        createdAt: Date.now(),
        submittedAt: Date.now(),
        updatedAt: Date.now(),
        status: "IN_REVIEW",
        applicant: { firstName: "Jamie", lastName: "Stone", email: "jamie@example.com" },
        residentialHistory: [],
        employment: { applicant: {} },
        consent: { creditConsent: true, referenceConsent: true, dataSharingConsent: true, acceptedAt: Date.now() },
        screening: { requested: false },
        landlordNote: "Need paystub",
      },
      action: { type: "request_info", status: "IN_REVIEW", emailSent: true },
    });

    render(
      <MemoryRouter>
        <ApplicationsPage />
      </MemoryRouter>
    );

    await screen.findAllByText("Jamie Stone");
    fireEvent.click(screen.getAllByText("Jamie Stone")[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Trigger Request More Info" }));

    expect(await screen.findByRole("dialog", { name: /request more information/i })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Upload ID"));
    fireEvent.click(screen.getByRole("button", { name: /send request/i }));

    await waitFor(() => {
      expect(mocks.submitRentalApplicationDecisionAction).toHaveBeenCalledWith("app-1", {
        action: "request_info",
        requestedItems: ["upload_id"],
        customMessage: "Need paystub",
      });
    });
  });

  it("sends approve and reject actions through the canonical action route", async () => {
    mocks.submitRentalApplicationDecisionAction.mockResolvedValue({
      application: {
        id: "app-1",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        applicationLinkId: "link-1",
        createdAt: Date.now(),
        submittedAt: Date.now(),
        updatedAt: Date.now(),
        status: "APPROVED",
        applicant: { firstName: "Jamie", lastName: "Stone", email: "jamie@example.com" },
        residentialHistory: [],
        employment: { applicant: {} },
        consent: { creditConsent: true, referenceConsent: true, dataSharingConsent: true, acceptedAt: Date.now() },
        screening: { requested: false },
        landlordNote: "Looks good",
      },
      action: { type: "approve", status: "APPROVED", emailSent: true, paymentEmail: "owner@example.com" },
    });

    render(
      <MemoryRouter>
        <ApplicationsPage />
      </MemoryRouter>
    );

    await screen.findAllByText("Jamie Stone");
    fireEvent.click(screen.getAllByText("Jamie Stone")[0]);
    fireEvent.click(await screen.findByRole("button", { name: "Trigger Approve" }));

    await waitFor(() => {
      expect(mocks.submitRentalApplicationDecisionAction).toHaveBeenCalledWith("app-1", {
        action: "approve",
        note: "Looks good",
      });
    });

    mocks.submitRentalApplicationDecisionAction.mockResolvedValueOnce({
      application: {
        id: "app-1",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        applicationLinkId: "link-1",
        createdAt: Date.now(),
        submittedAt: Date.now(),
        updatedAt: Date.now(),
        status: "DECLINED",
        applicant: { firstName: "Jamie", lastName: "Stone", email: "jamie@example.com" },
        residentialHistory: [],
        employment: { applicant: {} },
        consent: { creditConsent: true, referenceConsent: true, dataSharingConsent: true, acceptedAt: Date.now() },
        screening: { requested: false },
        landlordNote: "Not a fit",
      },
      action: { type: "reject", status: "DECLINED", emailSent: true },
    });

    fireEvent.click(screen.getByRole("button", { name: "Trigger Reject" }));

    await waitFor(() => {
      expect(mocks.submitRentalApplicationDecisionAction).toHaveBeenCalledWith("app-1", {
        action: "reject",
        note: "Not a fit",
      });
    });
  });
});
