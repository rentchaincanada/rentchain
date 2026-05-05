import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  });

  it("routes dashboard recent activity ledger actions to the valid leases page", async () => {
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
    screen.getByRole("button", { name: "Open ledger" }).click();
    expect(mocks.navigateMock).toHaveBeenCalledWith("/leases");
    expect(mocks.navigateMock).not.toHaveBeenCalledWith("/ledger");
  });

  it("routes the screening setup CTA to the applications TransUnion onboarding path", async () => {
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

    expect(await screen.findByText("TransUnion Setup Funnel")).toBeInTheDocument();
    screen.getAllByRole("button", { name: "Open" })[0].click();
    expect(assignMock).toHaveBeenCalledWith("/applications?openTransUnionAccess=1");
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

    expect(await screen.findAllByRole("button", { name: "Get TransUnion Access" })).not.toHaveLength(0);
    screen.getAllByRole("button", { name: "Get TransUnion Access" })[0].click();
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
