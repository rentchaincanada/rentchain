import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../components/ui/ToastProvider";
import DashboardPage from "./DashboardPage";

const mocks = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useCapabilitiesMock: vi.fn(),
  fetchDashboardSummaryMock: vi.fn(),
  useApplicationsMock: vi.fn(),
  useTenantsMock: vi.fn(),
  fetchPropertiesMock: vi.fn(),
  listTenantInvitesMock: vi.fn(),
  listReferralsMock: vi.fn(),
  getLandlordActivationMock: vi.fn(),
  fetchLandlordTransUnionOnboardingAnalyticsMock: vi.fn(),
  useOnboardingStateMock: vi.fn(),
  useUpgradeMock: vi.fn(),
  navigateMock: vi.fn(),
  patchDecisionActionMock: vi.fn(),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<any>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mocks.navigateMock,
  };
});

vi.mock("../context/useAuth", () => ({
  useAuth: mocks.useAuthMock,
}));

vi.mock("@/hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilitiesMock,
}));

vi.mock("../api/dashboard", () => ({
  fetchDashboardSummary: mocks.fetchDashboardSummaryMock,
}));

vi.mock("../hooks/useApplications", () => ({
  useApplications: mocks.useApplicationsMock,
}));

vi.mock("../hooks/useTenants", () => ({
  useTenants: mocks.useTenantsMock,
}));

vi.mock("../api/propertiesApi", () => ({
  fetchProperties: mocks.fetchPropertiesMock,
}));

vi.mock("../api/tenantInvites", () => ({
  listTenantInvites: mocks.listTenantInvitesMock,
}));

vi.mock("../api/referralsApi", () => ({
  listReferrals: mocks.listReferralsMock,
}));

vi.mock("@/api/activationApi", () => ({
  getLandlordActivation: mocks.getLandlordActivationMock,
}));

vi.mock("@/api/landlordAnalyticsApi", () => ({
  fetchLandlordTransUnionOnboardingAnalytics: mocks.fetchLandlordTransUnionOnboardingAnalyticsMock,
}));

vi.mock("../hooks/useOnboardingState", () => ({
  useOnboardingState: mocks.useOnboardingStateMock,
}));

vi.mock("../context/UpgradeContext", () => ({
  useUpgrade: mocks.useUpgradeMock,
}));

vi.mock("../config/screening", () => ({
  SCREENING_ENABLED: true,
  getUiLocale: () => "en",
  screeningComingSoonLabel: () => "Credit screening - coming soon.",
}));

vi.mock("@/api/decisionApi", () => ({
  patchDecisionAction: mocks.patchDecisionActionMock,
}));

afterEach(() => {
  cleanup();
});

describe("DashboardPage", () => {
  const assignMock = vi.fn();

  beforeEach(() => {
    window.localStorage.removeItem("rentchain.landlordWelcome.pending.landlord-1");
    window.localStorage.removeItem("rentchain.landlordWelcome.seen.landlord-1");
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    mocks.useAuthMock.mockReturnValue({
      user: { id: "landlord-1", role: "", actorRole: "landlord", plan: "elite" },
      ready: true,
      isLoading: false,
      authStatus: "authed",
    });
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "elite" },
      features: {},
      loading: false,
    });
    mocks.fetchDashboardSummaryMock.mockResolvedValue({});
    mocks.patchDecisionActionMock.mockImplementation(async (_decisionId: string, payload: any) => ({
      ok: true,
      decision: {
        ...payload.decision,
        status: payload.actionType === "reviewed" ? "reviewed" : payload.actionType,
        latestAction: {
          actionId: "action-1",
          decisionId: payload.decision.decisionId,
          actionType: payload.actionType,
          nextStatus: payload.actionType === "reviewed" ? "reviewed" : payload.actionType,
          createdAt: "2026-05-05T12:00:00.000Z",
        },
      },
    }));
    mocks.useApplicationsMock.mockReturnValue({
      applications: [],
      loading: false,
    });
    mocks.useTenantsMock.mockReturnValue({
      tenants: [],
      loading: false,
    });
    mocks.fetchPropertiesMock.mockResolvedValue({ properties: [] });
    mocks.listTenantInvitesMock.mockResolvedValue({ items: [] });
    mocks.listReferralsMock.mockResolvedValue([]);
    mocks.getLandlordActivationMock.mockResolvedValue({
      completedCount: 0,
      totalCount: 7,
      nextStepKey: "property",
      steps: [
        {
          key: "property",
          title: "Add Property",
          status: "in_progress",
          description: "Add your first rental property to begin onboarding applicants.",
          actionLabel: "Add Property",
          actionPath: "/properties",
        },
      ],
    });
    mocks.fetchLandlordTransUnionOnboardingAnalyticsMock.mockResolvedValue({
      totals: {
        viewed: 3,
        started: 2,
        emailClicked: 1,
        phoneClicked: 0,
        alreadyCredentialedClicked: 0,
        connected: 1,
      },
      conversionRate: 0.5,
    });
    mocks.useOnboardingStateMock.mockReturnValue({
      loading: false,
      dismissed: false,
      steps: {
        propertyAdded: false,
        unitAdded: false,
        tenantInvited: false,
        applicationCreated: false,
        exportPreviewed: false,
      },
      lastSeenAt: null,
      allComplete: false,
      refresh: vi.fn(),
      markStepComplete: vi.fn(),
      dismissOnboarding: vi.fn(),
      showOnboarding: vi.fn(),
    });
    mocks.useUpgradeMock.mockReturnValue({
      openUpgrade: vi.fn(),
    });
    mocks.navigateMock.mockReset();
    assignMock.mockReset();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        assign: assignMock,
      },
    });
  });

  it("loads landlord activation when actorRole is landlord even if role is blank", async () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    await waitFor(() => {
      expect(mocks.getLandlordActivationMock).toHaveBeenCalled();
    });

    expect(screen.getByText("Get your first tenant screened")).toBeInTheDocument();
  });

  it("shows the landlord welcome modal when a fresh signup marker exists", async () => {
    window.localStorage.setItem("rentchain.landlordWelcome.pending.landlord-1", "1");

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Welcome to RentChain")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start setup" })).toBeInTheDocument();
  });

  it("links open actions and review items to the approved destinations", async () => {
    mocks.fetchDashboardSummaryMock.mockResolvedValue({
      kpis: {
        propertiesCount: 1,
        unitsCount: 2,
        tenantsCount: 1,
        openActionsCount: 3,
        delinquentCount: 0,
        screeningsCount: 0,
      },
      actions: [{ id: "a-1", title: "Invite a tenant", severity: "info", href: "/tenants" }],
      events: [],
      leaseNoticeSummary: {
        expiringSoon: 0,
        pendingResponse: 0,
        renewed: 0,
        quitting: 0,
        noResponse: 0,
      },
      portfolioCredibilitySummary: {
        propertyCount: 1,
        activeLeaseCount: 5,
        tenantScoreAverage: null,
        tenantScoreGradeAverage: null,
        leaseRiskAverage: null,
        leaseRiskGradeAverage: null,
        tenantsWithScoreCount: 0,
        leasesWithRiskCount: 0,
        lowConfidenceCount: 2,
        missingCredibilityCount: 1,
        healthStatus: "watch",
      },
      decisions: [
        {
          decisionId: "decision:review_overdue_rent:lease-1",
          leaseId: "lease-1",
          propertyId: "property-1",
          unitId: "unit-1",
          decisionType: "review_overdue_rent",
          severity: "critical",
          status: "detected",
          reason: "Rent past due date",
          metadata: {},
        },
        {
          decisionId: "decision:review_underpaid_rent:lease-2",
          leaseId: "lease-2",
          propertyId: "property-2",
          unitId: "unit-2",
          decisionType: "review_underpaid_rent",
          severity: "warning",
          status: "detected",
          reason: "Partial payment received",
          metadata: {},
        },
        {
          decisionId: "decision:review_manual_payment_issue:lease-3",
          leaseId: "lease-3",
          propertyId: "property-3",
          unitId: "unit-3",
          decisionType: "review_manual_payment_issue",
          severity: "warning",
          status: "detected",
          reason: "Payment mismatch detected",
          metadata: {},
        },
      ],
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByRole("link", { name: "Open Actions" })).toHaveAttribute("href", "/dashboard#open-actions");
    expect(screen.getByRole("link", { name: "Properties" })).toHaveAttribute("href", "/properties");
    expect(screen.getByRole("link", { name: "Tenants" })).toHaveAttribute("href", "/tenants");
    expect(screen.getByRole("link", { name: "Delinquencies" })).toHaveAttribute("href", "/payments?filter=delinquent");
    expect(screen.getAllByRole("link", { name: "2" }).some((link) => link.getAttribute("href") === "/applications?status=review")).toBe(true);
    expect(screen.getByText("Decision summary")).toBeInTheDocument();
    expect(screen.getByText("Read-only decisions from detected rent and lease signals.")).toBeInTheDocument();
    expect(screen.getByText("Overdue Rent")).toBeInTheDocument();
    expect(screen.getAllByText("Rent past due date").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Lease ledger" }).some((link) => link.getAttribute("href") === "/leases/lease-1/ledger")).toBe(true);
    expect(screen.getAllByRole("link", { name: "Property / unit" }).some((link) => link.getAttribute("href") === "/properties?propertyId=property-1&unitId=unit-1")).toBe(true);
    expect(screen.getByText("Underpaid Rent")).toBeInTheDocument();
    expect(screen.getAllByText("Partial payment received").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Payment mismatch detected").length).toBeGreaterThan(0);
    expect(screen.getByTestId("dashboard-kpi-decision-stack")).toHaveStyle({
      display: "grid",
      gap: "2rem",
      width: "100%",
      boxSizing: "border-box",
    });
  });

  it("updates dashboard decision status from human actions", async () => {
    mocks.fetchDashboardSummaryMock.mockResolvedValue({
      decisions: [
        {
          decisionId: "decision:review_overdue_rent:lease-1",
          leaseId: "lease-1",
          propertyId: "property-1",
          unitId: "unit-1",
          decisionType: "review_overdue_rent",
          severity: "critical",
          status: "detected",
          reason: "Rent past due date",
          metadata: {},
        },
      ],
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Overdue Rent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));

    await waitFor(() =>
      expect(mocks.patchDecisionActionMock).toHaveBeenCalledWith(
        "decision:review_overdue_rent:lease-1",
        expect.objectContaining({ actionType: "reviewed", leaseId: "lease-1" })
      )
    );
    expect(screen.getAllByText("Reviewed").length).toBeGreaterThan(0);
  });

  it("renders an empty dashboard decision state without adding actions", async () => {
    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Decision summary")).toBeInTheDocument();
    expect(screen.getByText("No issues detected. Everything is up to date.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /accept/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /dismiss/i })).not.toBeInTheDocument();
  });

  it("prioritizes the free-tier setup journey before review-heavy dashboard work", async () => {
    mocks.fetchDashboardSummaryMock.mockResolvedValue({
      kpis: {
        propertiesCount: 1,
        unitsCount: 0,
        tenantsCount: 0,
        openActionsCount: 0,
        delinquentCount: 0,
        screeningsCount: 0,
      },
      actions: [],
      events: [],
      decisions: [
        {
          decisionId: "decision:review_overdue_rent:lease-1",
          leaseId: "lease-1",
          propertyId: "property-1",
          unitId: "unit-1",
          decisionType: "review_overdue_rent",
          severity: "critical",
          status: "detected",
          reason: "Rent past due date",
          metadata: {},
        },
      ],
    });
    mocks.fetchPropertiesMock.mockResolvedValue({
      properties: [{ id: "property-1", name: "Main Street", units: [] }],
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByTestId("free-tier-journey-card")).toBeInTheDocument();
    expect(screen.getByText("Start in order")).toBeInTheDocument();
    expect(screen.getByText("Step 1")).toBeInTheDocument();
    expect(screen.getByText("Step 2")).toBeInTheDocument();
    expect(screen.getAllByText("Add unit").length).toBeGreaterThan(0);
    expect(screen.getByText("Decision inbox summary")).toBeInTheDocument();

    const actionRequired = screen.getByText("Action required").closest("div");
    expect(actionRequired).not.toBeNull();
    expect(screen.getAllByText("Add a unit").length).toBeGreaterThan(0);
    expect(screen.queryByText("Set up screening workflow")).not.toBeInTheDocument();
  });

  it("keeps dashboard recent activity ledger CTA label consistent when lease context is missing", async () => {
    mocks.fetchDashboardSummaryMock.mockResolvedValue({
      kpis: {
        propertiesCount: 1,
        unitsCount: 1,
        tenantsCount: 1,
        openActionsCount: 0,
        delinquentCount: 0,
        screeningsCount: 0,
      },
      actions: [],
      events: [{ id: "event-1", title: "Rent charge posted", createdAt: "2026-04-01T00:00:00.000Z" }],
      leaseNoticeSummary: {
        expiringSoon: 0,
        pendingResponse: 0,
        renewed: 0,
        quitting: 0,
        noResponse: 0,
      },
      portfolioCredibilitySummary: {
        propertyCount: 1,
        activeLeaseCount: 1,
        tenantScoreAverage: null,
        tenantScoreGradeAverage: null,
        leaseRiskAverage: null,
        leaseRiskGradeAverage: null,
        tenantsWithScoreCount: 0,
        leasesWithRiskCount: 0,
        lowConfidenceCount: 0,
        missingCredibilityCount: 0,
        healthStatus: "watch",
      },
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Rent charge posted")).toBeInTheDocument();
    screen.getByRole("button", { name: "View leases" }).click();
    expect(mocks.navigateMock).toHaveBeenCalledWith("/leases");
    expect(mocks.navigateMock).not.toHaveBeenCalledWith("/ledger");
    expect(screen.queryByRole("button", { name: "View ledger" })).not.toBeInTheDocument();
  });

  it("routes dashboard recent activity ledger CTA to a lease ledger when lease context exists", async () => {
    mocks.fetchDashboardSummaryMock.mockResolvedValue({
      kpis: {
        propertiesCount: 1,
        unitsCount: 1,
        tenantsCount: 1,
        openActionsCount: 0,
        delinquentCount: 0,
        screeningsCount: 0,
      },
      actions: [],
      events: [{ id: "event-1", title: "Rent charge posted", leaseId: "lease-42", createdAt: "2026-04-01T00:00:00.000Z" }],
      leaseNoticeSummary: {
        expiringSoon: 0,
        pendingResponse: 0,
        renewed: 0,
        quitting: 0,
        noResponse: 0,
      },
      portfolioCredibilitySummary: {
        propertyCount: 1,
        activeLeaseCount: 1,
        tenantScoreAverage: null,
        tenantScoreGradeAverage: null,
        leaseRiskAverage: null,
        leaseRiskGradeAverage: null,
        tenantsWithScoreCount: 0,
        leasesWithRiskCount: 0,
        lowConfidenceCount: 0,
        missingCredibilityCount: 0,
        healthStatus: "watch",
      },
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Rent charge posted")).toBeInTheDocument();
    screen.getByRole("button", { name: "View ledger" }).click();
    expect(mocks.navigateMock).toHaveBeenCalledWith("/leases/lease-42/ledger");
  });

  it("opens an explanation from the action required Info button", async () => {
    mocks.fetchDashboardSummaryMock.mockResolvedValue({
      kpis: {
        propertiesCount: 1,
        unitsCount: 1,
        tenantsCount: 1,
        openActionsCount: 1,
        delinquentCount: 0,
        screeningsCount: 0,
      },
      actions: [
        {
          id: "run-first-screening",
          title: "Run your first screening",
          severity: "info",
          href: "/applications?openTransUnionAccess=1",
        },
      ],
      events: [],
      leaseNoticeSummary: {
        expiringSoon: 0,
        pendingResponse: 0,
        renewed: 0,
        quitting: 0,
        noResponse: 0,
      },
      portfolioCredibilitySummary: {
        propertyCount: 1,
        activeLeaseCount: 1,
        tenantScoreAverage: null,
        tenantScoreGradeAverage: null,
        leaseRiskAverage: null,
        leaseRiskGradeAverage: null,
        tenantsWithScoreCount: 0,
        leasesWithRiskCount: 0,
        lowConfidenceCount: 0,
        missingCredibilityCount: 0,
        healthStatus: "watch",
      },
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Run your first screening")).toBeInTheDocument();
    expect(screen.getAllByText("Info")).toHaveLength(1);
    screen.getByRole("button", { name: "Info about Run your first screening" }).click();
    await waitFor(() => expect(screen.getByRole("dialog", { name: "Action information" })).toBeInTheDocument());
    expect(screen.getByText(/Open the screening workflow from Applications/i)).toBeInTheDocument();
    screen.getByRole("button", { name: "Open" }).click();
    expect(assignMock).toHaveBeenCalledWith("/applications?openTransUnionAccess=1");
  });

  it("routes the provider funnel CTA to applications once TransUnion is connected", async () => {
    mocks.fetchDashboardSummaryMock.mockResolvedValue({
      kpis: {
        propertiesCount: 1,
        unitsCount: 1,
        tenantsCount: 1,
        openActionsCount: 0,
        delinquentCount: 0,
        screeningsCount: 0,
      },
      actions: [],
      events: [],
      leaseNoticeSummary: {
        expiringSoon: 0,
        pendingResponse: 0,
        renewed: 0,
        quitting: 0,
        noResponse: 0,
      },
      portfolioCredibilitySummary: {
        propertyCount: 1,
        activeLeaseCount: 0,
        tenantScoreAverage: null,
        tenantScoreGradeAverage: null,
        leaseRiskAverage: null,
        leaseRiskGradeAverage: null,
        tenantsWithScoreCount: 0,
        leasesWithRiskCount: 0,
        lowConfidenceCount: 0,
        missingCredibilityCount: 0,
        healthStatus: "watch",
      },
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByText("Provider setup funnel")).toBeInTheDocument();
    screen.getAllByRole("button", { name: "Run screening" })[0].click();
    expect(mocks.navigateMock).toHaveBeenCalledWith("/applications");
    expect(screen.getByText("Started → Connected 50%")).toBeInTheDocument();
    expect(screen.getByText("1 onboarding start still need credential connection.")).toBeInTheDocument();
  });

  it("routes the quick screening CTA to setup until TransUnion is connected, then to applications", async () => {
    mocks.fetchDashboardSummaryMock.mockResolvedValue({
      kpis: {
        propertiesCount: 1,
        unitsCount: 1,
        tenantsCount: 1,
        openActionsCount: 0,
        delinquentCount: 0,
        screeningsCount: 0,
      },
      actions: [],
      events: [],
      leaseNoticeSummary: {
        expiringSoon: 0,
        pendingResponse: 0,
        renewed: 0,
        quitting: 0,
        noResponse: 0,
      },
      portfolioCredibilitySummary: {
        propertyCount: 1,
        activeLeaseCount: 0,
        tenantScoreAverage: null,
        tenantScoreGradeAverage: null,
        leaseRiskAverage: null,
        leaseRiskGradeAverage: null,
        tenantsWithScoreCount: 0,
        leasesWithRiskCount: 0,
        lowConfidenceCount: 0,
        missingCredibilityCount: 0,
        healthStatus: "watch",
      },
    });
    mocks.fetchLandlordTransUnionOnboardingAnalyticsMock.mockResolvedValueOnce({
      totals: {
        viewed: 3,
        started: 2,
        emailClicked: 1,
        phoneClicked: 0,
        alreadyCredentialedClicked: 0,
        connected: 0,
      },
      conversionRate: 0,
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findAllByRole("button", { name: "Set up screening workflow" })).not.toHaveLength(0);
    screen.getAllByRole("button", { name: "Set up screening workflow" })[0].click();
    expect(mocks.navigateMock).toHaveBeenCalledWith("/applications?openTransUnionAccess=1");

    mocks.navigateMock.mockReset();
    cleanup();
    mocks.fetchLandlordTransUnionOnboardingAnalyticsMock.mockResolvedValue({
      totals: {
        viewed: 3,
        started: 2,
        emailClicked: 1,
        phoneClicked: 0,
        alreadyCredentialedClicked: 0,
        connected: 1,
      },
      conversionRate: 0.5,
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findAllByRole("button", { name: "Run screening" })).not.toHaveLength(0);
    screen.getAllByRole("button", { name: "Run screening" })[0].click();
    expect(mocks.navigateMock).toHaveBeenCalledWith("/applications");
  });

  it("links lease notice status tiles to the approved follow-through destinations", async () => {
    mocks.fetchDashboardSummaryMock.mockResolvedValue({
      kpis: {
        propertiesCount: 1,
        unitsCount: 2,
        tenantsCount: 1,
        openActionsCount: 0,
        delinquentCount: 0,
        screeningsCount: 1,
      },
      actions: [],
      events: [],
      leaseNoticeSummary: {
        expiringSoon: 2,
        pendingResponse: 1,
        renewed: 3,
        quitting: 4,
        noResponse: 5,
      },
      portfolioCredibilitySummary: {
        propertyCount: 1,
        activeLeaseCount: 5,
        tenantScoreAverage: null,
        tenantScoreGradeAverage: null,
        leaseRiskAverage: null,
        leaseRiskGradeAverage: null,
        tenantsWithScoreCount: 0,
        leasesWithRiskCount: 0,
        lowConfidenceCount: 0,
        missingCredibilityCount: 0,
        healthStatus: "watch",
      },
    });

    render(
      <ToastProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    expect(await screen.findByRole("link", { name: /Expiring soon/i })).toHaveAttribute(
      "href",
      "/portfolio-health?entry=lease-renewals&status=expiring"
    );
    expect(screen.getByRole("link", { name: /Pending response/i })).toHaveAttribute(
      "href",
      "/portfolio-health?entry=lease-renewals&status=pending-response"
    );
    expect(screen.getByRole("link", { name: /No response/i })).toHaveAttribute(
      "href",
      "/portfolio-health?entry=lease-renewals&status=no-response"
    );
    expect(screen.getByRole("link", { name: /Renewed/i })).toHaveAttribute("href", "/leases?view=active");
    expect(screen.getByRole("link", { name: /Quitting/i })).toHaveAttribute("href", "/leases?view=active");
  });

  it("renders a stable open actions hash target when the dashboard hash is present", async () => {
    mocks.fetchDashboardSummaryMock.mockResolvedValue({
      kpis: {
        propertiesCount: 1,
        unitsCount: 2,
        tenantsCount: 1,
        openActionsCount: 1,
        delinquentCount: 0,
        screeningsCount: 0,
      },
      actions: [{ id: "a-1", title: "Invite a tenant", severity: "info", href: "/tenants" }],
      events: [],
      leaseNoticeSummary: {
        expiringSoon: 0,
        pendingResponse: 0,
        renewed: 0,
        quitting: 0,
        noResponse: 0,
      },
      portfolioCredibilitySummary: {
        propertyCount: 1,
        activeLeaseCount: 1,
        tenantScoreAverage: null,
        tenantScoreGradeAverage: null,
        leaseRiskAverage: null,
        leaseRiskGradeAverage: null,
        tenantsWithScoreCount: 0,
        leasesWithRiskCount: 0,
        lowConfidenceCount: 0,
        missingCredibilityCount: 0,
        healthStatus: "watch",
      },
    });

    render(
      <ToastProvider>
        <MemoryRouter initialEntries={[{ pathname: "/dashboard", hash: "#open-actions" }]}>
          <DashboardPage />
        </MemoryRouter>
      </ToastProvider>
    );

    await screen.findByText("Action required");
    const target = document.getElementById("open-actions");
    expect(target).not.toBeNull();
    expect(target).toHaveAttribute("tabindex", "-1");
  });
});
