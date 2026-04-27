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

    expect(await screen.findByRole("link", { name: "3" })).toHaveAttribute("href", "/dashboard#open-actions");
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("href", "/applications?status=review");
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

    expect(await screen.findByText("Get TransUnion access")).toBeInTheDocument();
    screen.getAllByRole("button", { name: "Open" })[0].click();
    expect(assignMock).toHaveBeenCalledWith("/applications?openTransUnionAccess=1");
  });
});
