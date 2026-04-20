import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import LandlordAnalyticsPage from "./LandlordAnalyticsPage";

const showToast = vi.fn();
const macShellSpy = vi.fn();

vi.mock("../../api/landlordAnalyticsApi", () => ({
  fetchLandlordAnalyticsSnapshot: vi.fn(),
}));

vi.mock("../../api/landlordAnalyticsAlertsApi", () => ({
  fetchLandlordAnalyticsAlerts: vi.fn(),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: vi.fn(),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: { children: React.ReactNode }) => {
    macShellSpy(props);
    return <div>{children}</div>;
  },
}));

vi.mock("../../components/ui/Ui", () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  Section: ({ children }: any) => <section>{children}</section>,
}));

vi.mock("@/components/billing/FeatureTeaser", () => ({
  FeatureTeaser: ({ title, description }: { title: string; description: string }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

beforeEach(() => {
  showToast.mockReset();
  macShellSpy.mockReset();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LandlordAnalyticsPage", () => {
  function mockEntitlements(overrides?: Record<string, any>) {
    return import("@/hooks/useEntitlements").then(({ useEntitlements }) => {
      vi.mocked(useEntitlements).mockReturnValue({
        loading: false,
        canViewPortfolioHealthSummary: true,
        canViewPortfolioScore: true,
        hasCapability: (key: string) => key === "portfolio_analytics",
        ...overrides,
      } as any);
    });
  }

  async function mockApiResolved() {
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    const { fetchLandlordAnalyticsAlerts } = await import("../../api/landlordAnalyticsAlertsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockResolvedValue({
      summary: {
        occupiedUnits: 4,
        vacancyRate: 0.2,
        activeApplications: 2,
        applicationConversionRate: 0.5,
        openWorkOrders: 1,
        maintenanceCostCents: 12500,
        estimatedScheduledRentCents: 660000,
        leasesEndingSoon: 1,
      },
      applications: {
        started: 4,
        submitted: 3,
        approved: 2,
        rejected: 0,
        declined: 0,
        pendingReviewCount: 2,
        conversionRate: 0.5,
      },
      leasing: {
        totalProperties: 2,
        totalUnits: 5,
        occupiedUnits: 4,
        vacantUnits: 1,
        occupancyRate: 0.8,
        leasesEndingIn30Days: 1,
        leasesEndingIn60Days: 1,
        leasesEndingIn90Days: 2,
        turnoverCount: 0,
      },
      maintenance: {
        openWorkOrders: 1,
        completedWorkOrders: 2,
        reopenedWorkOrders: 0,
        maintenanceCostCents: 12500,
        averageCostPerCompletedWorkOrderCents: 6250,
        costConcentrationByProperty: [],
      },
      revenue: {
        estimatedScheduledRentCents: 660000,
        averageRentPerOccupiedUnitCents: 165000,
      },
      insights: [{ type: "lease_expiry", severity: "medium", message: "1 lease ends within 30 days." }],
      comparisons: {
        previousPeriod: {
          vacancyRate: 0.1,
          applicationConversionRate: 0.4,
          applicationsStarted: 3,
          applicationsSubmitted: 3,
          maintenanceCostCents: 5000,
          openWorkOrders: 1,
        },
      },
      properties: [
        { id: "prop-1", name: "Alpha" },
        { id: "prop-2", name: "Beta" },
      ],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    } as any);
    vi.mocked(fetchLandlordAnalyticsAlerts).mockResolvedValue({
      summary: {
        activeCount: 2,
        highSeverityCount: 1,
        mediumSeverityCount: 1,
        lowSeverityCount: 0,
      },
      alerts: [
        {
          id: "alert-1",
          type: "lease_expiry",
          severity: "medium",
          status: "active",
          title: "Leases ending soon",
          message: "1 lease ends within 30 days.",
          detectedAt: "2026-04-20T00:00:00.000Z",
          lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
          notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
          actions: [{ type: "review_leases", label: "Review leases", href: "/portfolio-health" }],
        },
      ],
      filters: {
        period: "90d",
        propertyId: null,
        status: "active",
      },
    } as any);

    return fetchLandlordAnalyticsSnapshot;
  }

  it("renders summary KPIs and analytics sections", async () => {
    await mockEntitlements();
    await mockApiResolved();

    render(
      <MemoryRouter>
        <LandlordAnalyticsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Analytics alerts/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Applications/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Revenue signal/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review leases/i })).toHaveAttribute("href", "/portfolio-health");
    expect(macShellSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "Analytics", showTopNav: false }));
  });

  it("shows a loading state while analytics are being fetched", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    const { fetchLandlordAnalyticsAlerts } = await import("../../api/landlordAnalyticsAlertsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockReturnValue(new Promise(() => {}) as any);
    vi.mocked(fetchLandlordAnalyticsAlerts).mockReturnValue(new Promise(() => {}) as any);

    render(
      <MemoryRouter>
        <LandlordAnalyticsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Loading analytics/i)).toBeInTheDocument();
  });

  it("renders a useful empty-state message for sparse portfolios", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    const { fetchLandlordAnalyticsAlerts } = await import("../../api/landlordAnalyticsAlertsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockResolvedValue({
      summary: {
        occupiedUnits: 0,
        vacancyRate: null,
        activeApplications: 0,
        applicationConversionRate: null,
        openWorkOrders: 0,
        maintenanceCostCents: 0,
        estimatedScheduledRentCents: 0,
        leasesEndingSoon: 0,
      },
      applications: {
        started: 0,
        submitted: 0,
        approved: 0,
        rejected: 0,
        declined: 0,
        pendingReviewCount: 0,
        conversionRate: null,
      },
      leasing: {
        totalProperties: 0,
        totalUnits: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        occupancyRate: null,
        leasesEndingIn30Days: 0,
        leasesEndingIn60Days: 0,
        leasesEndingIn90Days: 0,
        turnoverCount: 0,
      },
      maintenance: {
        openWorkOrders: 0,
        completedWorkOrders: 0,
        reopenedWorkOrders: 0,
        maintenanceCostCents: 0,
        averageCostPerCompletedWorkOrderCents: null,
        costConcentrationByProperty: [],
      },
      revenue: {
        estimatedScheduledRentCents: 0,
        averageRentPerOccupiedUnitCents: null,
      },
      insights: [],
      comparisons: {
        previousPeriod: {
          vacancyRate: null,
          applicationConversionRate: null,
          applicationsStarted: 0,
          applicationsSubmitted: 0,
          maintenanceCostCents: 0,
          openWorkOrders: 0,
        },
      },
      properties: [],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    } as any);
    vi.mocked(fetchLandlordAnalyticsAlerts).mockResolvedValue({
      summary: {
        activeCount: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        lowSeverityCount: 0,
      },
      alerts: [],
      filters: {
        period: "90d",
        propertyId: null,
        status: "active",
      },
    } as any);

    render(
      <MemoryRouter>
        <LandlordAnalyticsPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText(/Analytics will become more useful as you add units, leases, applications, and maintenance activity/i)
    ).toBeInTheDocument();
  });

  it("renders an error state cleanly", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    const { fetchLandlordAnalyticsAlerts } = await import("../../api/landlordAnalyticsAlertsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockRejectedValue(new Error("Boom"));
    vi.mocked(fetchLandlordAnalyticsAlerts).mockResolvedValue({
      summary: {
        activeCount: 0,
        highSeverityCount: 0,
        mediumSeverityCount: 0,
        lowSeverityCount: 0,
      },
      alerts: [],
      filters: {
        period: "90d",
        propertyId: null,
        status: "active",
      },
    } as any);

    render(
      <MemoryRouter>
        <LandlordAnalyticsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load analytics: Boom/i)).toBeInTheDocument();
  });

  it("re-fetches when filters change", async () => {
    await mockEntitlements();
    const fetchLandlordAnalyticsSnapshot = await mockApiResolved();
    const { fetchLandlordAnalyticsAlerts } = await import("../../api/landlordAnalyticsAlertsApi");

    render(
      <MemoryRouter>
        <LandlordAnalyticsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Analytics alerts/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Analytics period/i), { target: { value: "30d" } });
    fireEvent.change(screen.getByLabelText(/Analytics property/i), { target: { value: "prop-2" } });

    expect(fetchLandlordAnalyticsSnapshot).toHaveBeenCalledWith({ period: "30d", propertyId: null });
    expect(fetchLandlordAnalyticsSnapshot).toHaveBeenLastCalledWith({ period: "30d", propertyId: "prop-2" });
    expect(vi.mocked(fetchLandlordAnalyticsAlerts)).toHaveBeenCalledWith({ period: "30d", propertyId: null, status: "active" });
    expect(vi.mocked(fetchLandlordAnalyticsAlerts)).toHaveBeenLastCalledWith({
      period: "30d",
      propertyId: "prop-2",
      status: "active",
    });
  });

  it("shows upgrade guidance when deeper analytics are unavailable", async () => {
    await mockEntitlements({
      canViewPortfolioScore: false,
      hasCapability: () => false,
    });
    await mockApiResolved();

    render(
      <MemoryRouter>
        <LandlordAnalyticsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Unlock deeper analytics on Pro/i)).toBeInTheDocument();
  });
});
