import React from "react";
import type { LandlordAnalyticsSnapshot } from "../../api/landlordAnalyticsApi";
import type { LandlordAnalyticsAlertsResponse } from "../../api/landlordAnalyticsAlertsApi";
import type { LandlordAnalyticsBenchmarkingResponse } from "../../api/landlordAnalyticsBenchmarkingApi";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import LandlordAnalyticsPage from "./LandlordAnalyticsPage";

const showToast = vi.fn();
const macShellSpy = vi.fn();
type EntitlementOverrides = Record<string, unknown>;
type PendingRequest = Promise<never>;

vi.mock("../../api/landlordAnalyticsApi", () => ({
  fetchLandlordAnalyticsSnapshot: vi.fn(),
  markLandlordDecisionReviewed: vi.fn(),
  snoozeLandlordDecision: vi.fn(),
  dismissLandlordDecision: vi.fn(),
}));

vi.mock("../../api/landlordAnalyticsAlertsApi", () => ({
  fetchLandlordAnalyticsAlerts: vi.fn(),
}));

vi.mock("../../api/landlordAnalyticsBenchmarkingApi", () => ({
  fetchLandlordAnalyticsBenchmarking: vi.fn(),
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
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  Section: ({ children }: React.PropsWithChildren) => <section>{children}</section>,
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
  function buildComparisons(overrides?: Record<string, unknown>) {
    return {
      previousPeriod: {
        summary: {
          occupiedUnits: 3,
          vacancyRate: 0.1,
          activeApplications: 1,
          applicationConversionRate: 0.4,
          openWorkOrders: 2,
          maintenanceCostCents: 5000,
          estimatedScheduledRentCents: 620000,
          leasesEndingSoon: 2,
        },
        applications: {
          started: 3,
          submitted: 3,
          approved: 1,
          rejected: 0,
          declined: 0,
          pendingReviewCount: 1,
          conversionRate: 0.4,
        },
        leasing: {
          totalProperties: 2,
          totalUnits: 5,
          occupiedUnits: 3,
          vacantUnits: 2,
          occupancyRate: 0.6,
          leasesEndingIn30Days: 2,
          leasesEndingIn60Days: 2,
          leasesEndingIn90Days: 2,
          turnoverCount: 0,
        },
        maintenance: {
          openWorkOrders: 2,
          completedWorkOrders: 1,
          reopenedWorkOrders: 0,
          maintenanceCostCents: 5000,
          averageCostPerCompletedWorkOrderCents: 5000,
          costConcentrationByProperty: [],
        },
        revenue: {
          estimatedScheduledRentCents: 620000,
          averageRentPerOccupiedUnitCents: 155000,
        },
      },
      deltas: {
        summary: {
          occupiedUnits: { current: 4, prior: 3, absoluteDelta: 1, relativeDelta: 0.3333, direction: "better" },
          vacancyRate: { current: 0.2, prior: 0.1, absoluteDelta: 0.1, relativeDelta: 1, direction: "worse" },
          activeApplications: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "better" },
          applicationConversionRate: {
            current: 0.5,
            prior: 0.4,
            absoluteDelta: 0.1,
            relativeDelta: 0.25,
            direction: "better",
          },
          openWorkOrders: { current: 1, prior: 2, absoluteDelta: -1, relativeDelta: -0.5, direction: "better" },
          maintenanceCostCents: {
            current: 12500,
            prior: 5000,
            absoluteDelta: 7500,
            relativeDelta: 1.5,
            direction: "worse",
          },
          estimatedScheduledRentCents: {
            current: 660000,
            prior: 620000,
            absoluteDelta: 40000,
            relativeDelta: 0.0645,
            direction: "better",
          },
          leasesEndingSoon: { current: 1, prior: 2, absoluteDelta: -1, relativeDelta: -0.5, direction: "better" },
        },
        applications: {
          started: { current: 4, prior: 3, absoluteDelta: 1, relativeDelta: 0.3333, direction: "better" },
          submitted: { current: 3, prior: 3, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          approved: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "better" },
          rejected: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
          declined: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
          pendingReviewCount: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "worse" },
          conversionRate: { current: 0.5, prior: 0.4, absoluteDelta: 0.1, relativeDelta: 0.25, direction: "better" },
        },
        leasing: {
          occupiedUnits: { current: 4, prior: 3, absoluteDelta: 1, relativeDelta: 0.3333, direction: "better" },
          vacantUnits: { current: 1, prior: 2, absoluteDelta: -1, relativeDelta: -0.5, direction: "better" },
          occupancyRate: { current: 0.8, prior: 0.6, absoluteDelta: 0.2, relativeDelta: 0.3333, direction: "better" },
          leasesEndingIn30Days: { current: 1, prior: 2, absoluteDelta: -1, relativeDelta: -0.5, direction: "better" },
          leasesEndingIn60Days: { current: 1, prior: 2, absoluteDelta: -1, relativeDelta: -0.5, direction: "better" },
          leasesEndingIn90Days: { current: 2, prior: 2, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
        },
        maintenance: {
          openWorkOrders: { current: 1, prior: 2, absoluteDelta: -1, relativeDelta: -0.5, direction: "better" },
          completedWorkOrders: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "better" },
          reopenedWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
          maintenanceCostCents: { current: 12500, prior: 5000, absoluteDelta: 7500, relativeDelta: 1.5, direction: "worse" },
          averageCostPerCompletedWorkOrderCents: {
            current: 6250,
            prior: 5000,
            absoluteDelta: 1250,
            relativeDelta: 0.25,
            direction: "worse",
          },
        },
        revenue: {
          estimatedScheduledRentCents: {
            current: 660000,
            prior: 620000,
            absoluteDelta: 40000,
            relativeDelta: 0.0645,
            direction: "better",
          },
          averageRentPerOccupiedUnitCents: {
            current: 165000,
            prior: 155000,
            absoluteDelta: 10000,
            relativeDelta: 0.0645,
            direction: "better",
          },
        },
      },
      ...overrides,
    };
  }

  function mockEntitlements(overrides?: EntitlementOverrides) {
    return import("@/hooks/useEntitlements").then(({ useEntitlements }) => {
      vi.mocked(useEntitlements).mockReturnValue({
        loading: false,
        canViewPortfolioHealthSummary: true,
        canViewPortfolioScore: true,
        hasCapability: (key: string) => key === "portfolio_analytics",
        ...overrides,
      } as ReturnType<typeof useEntitlements>);
    });
  }

  async function mockApiResolved() {
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    const { fetchLandlordAnalyticsAlerts } = await import("../../api/landlordAnalyticsAlertsApi");
    const { fetchLandlordAnalyticsBenchmarking } = await import("../../api/landlordAnalyticsBenchmarkingApi");
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
      decisions: {
        items: [
          {
            id: "reduce_vacancy_risk:prop-2",
            decisionType: "reduce_vacancy_risk",
            priority: "high",
            explanation: "Beta carries the strongest vacancy pressure in the current view, so leasing attention should move there first.",
            recommendedAction: "View property analytics",
            actionKey: "open_vacancy_readiness_flow",
            actionLabel: "Open vacancy readiness",
            destination: "/analytics?propertyId=prop-2",
            workflowCategory: "vacancy_readiness",
            automationEligible: false,
            automationState: "manual_only",
            automationReason: "This decision is guidance-only in v1 and does not map to an execution rule.",
            executionMappingState: "none",
            executionMapping: null,
            href: "/analytics?propertyId=prop-2",
            state: "pending",
            reviewedAt: null,
            supportingSignals: [
              { source: "alert", key: "high_vacancy", label: "Vacancy is elevated", propertyId: "prop-2" },
              {
                source: "predictive_metric",
                key: "projected_vacancy_risk",
                label: "Projected vacancy risk",
                propertyId: "prop-2",
              },
            ],
          },
        ],
      },
      predictive: {
        metrics: [
          {
            key: "projected_vacancy_risk",
            label: "Projected vacancy risk",
            riskLevel: "medium",
            status: "supported",
            explanation: "Vacancy pressure is present in the current view, but it is not yet at the highest-risk threshold.",
            supportingValues: { vacancyRate: 0.2, vacantUnits: 1 },
          },
          {
            key: "projected_revenue_pressure_signal",
            label: "Projected revenue pressure signal",
            riskLevel: "medium",
            status: "supported",
            explanation: "Revenue pressure is present, but the current portfolio signals do not yet indicate the highest-risk case.",
            supportingValues: { estimatedScheduledRentCents: 660000, leasesEndingSoon: 1 },
          },
        ],
      },
      insights: [{ type: "lease_expiry", severity: "medium", message: "1 lease ends within 30 days." }],
      comparisons: buildComparisons(),
      properties: [
        { id: "prop-1", name: "Alpha" },
        { id: "prop-2", name: "Beta" },
      ],
      propertyMetrics: [
        {
          propertyId: "prop-1",
          propertyName: "Alpha",
          metrics: {
            vacancyRate: 0,
            occupancyRate: 1,
            applicationVolume: 2,
            applicationConversionRate: 0.5,
            openWorkOrders: 0,
            maintenanceCostCents: 5000,
            maintenanceCostPerUnitCents: 2500,
            leasesEndingSoon: 0,
            estimatedScheduledRentCents: 320000,
            estimatedRentPerOccupiedUnitCents: 160000,
            totalUnits: 2,
            occupiedUnits: 2,
            vacantUnits: 0,
          },
        },
        {
          propertyId: "prop-2",
          propertyName: "Beta",
          metrics: {
            vacancyRate: 0.33,
            occupancyRate: 0.67,
            applicationVolume: 1,
            applicationConversionRate: null,
            openWorkOrders: 1,
            maintenanceCostCents: 7500,
            maintenanceCostPerUnitCents: 2500,
            leasesEndingSoon: 1,
            estimatedScheduledRentCents: 340000,
            estimatedRentPerOccupiedUnitCents: 170000,
            totalUnits: 3,
            occupiedUnits: 2,
            vacantUnits: 1,
          },
        },
      ],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    } as LandlordAnalyticsSnapshot);
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
    } as LandlordAnalyticsAlertsResponse);
    vi.mocked(fetchLandlordAnalyticsBenchmarking).mockResolvedValue({
      summary: {
        propertyCount: 2,
        comparedPropertyCount: 2,
        benchmarkDimensions: ["vacancyRate", "applicationConversionRate"],
      },
      comparisons: [
        {
          propertyId: "prop-1",
          propertyName: "Alpha",
          metrics: {
            vacancyRate: 0,
            occupancyRate: 1,
            applicationVolume: 2,
            applicationConversionRate: 0.5,
            openWorkOrders: 0,
            maintenanceCostCents: 5000,
            maintenanceCostPerUnitCents: 2500,
            leasesEndingSoon: 0,
            estimatedScheduledRentCents: 320000,
            estimatedRentPerOccupiedUnitCents: 160000,
            totalUnits: 2,
            occupiedUnits: 2,
            vacantUnits: 0,
          },
          benchmarks: {
            vacancyRate: {
              portfolioAverage: 0.17,
              rank: 1,
              direction: "better",
              deltaFromAverage: -0.17,
            },
          },
        },
      ],
      insights: [
        {
          type: "vacancy_leader",
          severity: "low",
          message: "Alpha currently has the lowest vacancy rate in your portfolio.",
        },
      ],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    } as LandlordAnalyticsBenchmarkingResponse);
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
    } as LandlordAnalyticsAlertsResponse);

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
    expect(screen.getByRole("heading", { name: /Recommended next actions/i })).toBeInTheDocument();
    expect(screen.getByText(/Beta carries the strongest vacancy pressure/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Predictive metrics/i })).toBeInTheDocument();
    expect(screen.getByText(/Vacancy pressure is present in the current view/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Portfolio benchmarking/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Applications/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Revenue signal/i })).toBeInTheDocument();
    expect(screen.getAllByText(/vs prior 90 days/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Review leases/i })).toHaveAttribute("href", "/portfolio-health");
    expect(macShellSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "Analytics", showTopNav: false }));
  });

  it("hydrates analytics focus from destination query params", async () => {
    await mockEntitlements();
    const fetchLandlordAnalyticsSnapshot = await mockApiResolved();

    render(
      <MemoryRouter initialEntries={["/analytics?entry=revenue-pressure&propertyId=prop-2"]}>
        <LandlordAnalyticsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Focused from decisions: Revenue pressure/i)).toBeInTheDocument();
    expect(fetchLandlordAnalyticsSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        period: "90d",
        propertyId: "prop-2",
      })
    );
  });

  it("shows a loading state while analytics are being fetched", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    const { fetchLandlordAnalyticsAlerts } = await import("../../api/landlordAnalyticsAlertsApi");
    const { fetchLandlordAnalyticsBenchmarking } = await import("../../api/landlordAnalyticsBenchmarkingApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockReturnValue(new Promise(() => {}) as PendingRequest);
    vi.mocked(fetchLandlordAnalyticsAlerts).mockReturnValue(new Promise(() => {}) as PendingRequest);
    vi.mocked(fetchLandlordAnalyticsBenchmarking).mockReturnValue(new Promise(() => {}) as PendingRequest);

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
    const { fetchLandlordAnalyticsBenchmarking } = await import("../../api/landlordAnalyticsBenchmarkingApi");
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
      decisions: {
        items: [],
      },
      predictive: {
        metrics: [
          {
            key: "projected_vacancy_risk",
            label: "Projected vacancy risk",
            riskLevel: null,
            status: "insufficient_data",
            explanation: "Not enough occupied or rentable unit data is available to project vacancy risk yet.",
          },
        ],
      },
      insights: [],
      propertyMetrics: [],
      comparisons: buildComparisons({
        previousPeriod: {
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
        },
        deltas: {
          summary: {
            occupiedUnits: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            vacancyRate: { current: null, prior: null, absoluteDelta: null, relativeDelta: null, direction: "insufficient_data" },
            activeApplications: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            applicationConversionRate: { current: null, prior: null, absoluteDelta: null, relativeDelta: null, direction: "insufficient_data" },
            openWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            maintenanceCostCents: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            estimatedScheduledRentCents: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            leasesEndingSoon: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
          },
          applications: {
            started: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            submitted: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            approved: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            rejected: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            declined: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            pendingReviewCount: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            conversionRate: { current: null, prior: null, absoluteDelta: null, relativeDelta: null, direction: "insufficient_data" },
          },
          leasing: {
            occupiedUnits: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            vacantUnits: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            occupancyRate: { current: null, prior: null, absoluteDelta: null, relativeDelta: null, direction: "insufficient_data" },
            leasesEndingIn30Days: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            leasesEndingIn60Days: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            leasesEndingIn90Days: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
          },
          maintenance: {
            openWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            completedWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            reopenedWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            maintenanceCostCents: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            averageCostPerCompletedWorkOrderCents: { current: null, prior: null, absoluteDelta: null, relativeDelta: null, direction: "insufficient_data" },
          },
          revenue: {
            estimatedScheduledRentCents: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            averageRentPerOccupiedUnitCents: { current: null, prior: null, absoluteDelta: null, relativeDelta: null, direction: "insufficient_data" },
          },
        },
      }),
      properties: [],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    } as LandlordAnalyticsSnapshot);
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
    } as LandlordAnalyticsAlertsResponse);
    vi.mocked(fetchLandlordAnalyticsBenchmarking).mockResolvedValue({
      summary: {
        propertyCount: 0,
        comparedPropertyCount: 0,
        benchmarkDimensions: ["vacancyRate"],
      },
      comparisons: [],
      insights: [],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    } as LandlordAnalyticsBenchmarkingResponse);

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
    const { fetchLandlordAnalyticsBenchmarking } = await import("../../api/landlordAnalyticsBenchmarkingApi");
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
    } as LandlordAnalyticsAlertsResponse);
    vi.mocked(fetchLandlordAnalyticsBenchmarking).mockResolvedValue({
      summary: {
        propertyCount: 0,
        comparedPropertyCount: 0,
        benchmarkDimensions: [],
      },
      comparisons: [],
      insights: [],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    } as LandlordAnalyticsBenchmarkingResponse);

    render(
      <MemoryRouter>
        <LandlordAnalyticsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load analytics: Boom/i)).toBeInTheDocument();
  });

  it("renders safely when delta fields are missing", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    const { fetchLandlordAnalyticsAlerts } = await import("../../api/landlordAnalyticsAlertsApi");
    const { fetchLandlordAnalyticsBenchmarking } = await import("../../api/landlordAnalyticsBenchmarkingApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockResolvedValue({
      summary: {
        occupiedUnits: 2,
        vacancyRate: 0.1,
        activeApplications: 1,
        applicationConversionRate: 0.5,
        openWorkOrders: 1,
        maintenanceCostCents: 4000,
        estimatedScheduledRentCents: 320000,
        leasesEndingSoon: 1,
      },
      applications: {
        started: 1,
        submitted: 1,
        approved: 1,
        rejected: 0,
        declined: 0,
        pendingReviewCount: 1,
        conversionRate: 0.5,
      },
      leasing: {
        totalProperties: 1,
        totalUnits: 2,
        occupiedUnits: 2,
        vacantUnits: 0,
        occupancyRate: 1,
        leasesEndingIn30Days: 1,
        leasesEndingIn60Days: 1,
        leasesEndingIn90Days: 1,
        turnoverCount: 0,
      },
      maintenance: {
        openWorkOrders: 1,
        completedWorkOrders: 1,
        reopenedWorkOrders: 0,
        maintenanceCostCents: 4000,
        averageCostPerCompletedWorkOrderCents: 4000,
        costConcentrationByProperty: [],
      },
      revenue: {
        estimatedScheduledRentCents: 320000,
        averageRentPerOccupiedUnitCents: 160000,
      },
      decisions: {
        items: [],
      },
      predictive: {
        metrics: [
          {
            key: "projected_vacancy_risk",
            label: "Projected vacancy risk",
            riskLevel: "low",
            status: "supported",
            explanation: "Current occupancy is stable and vacancy is not worsening materially versus the prior period.",
          },
        ],
      },
      insights: [],
      comparisons: {
        previousPeriod: buildComparisons().previousPeriod,
      },
      properties: [{ id: "prop-1", name: "Alpha" }],
      propertyMetrics: [],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    } as LandlordAnalyticsSnapshot);
    vi.mocked(fetchLandlordAnalyticsAlerts).mockResolvedValue({
      summary: { activeCount: 0, highSeverityCount: 0, mediumSeverityCount: 0, lowSeverityCount: 0 },
      alerts: [],
      filters: { period: "90d", propertyId: null, status: "active" },
    } as LandlordAnalyticsAlertsResponse);
    vi.mocked(fetchLandlordAnalyticsBenchmarking).mockResolvedValue({
      summary: { propertyCount: 1, comparedPropertyCount: 0, benchmarkDimensions: ["vacancyRate"] },
      comparisons: [],
      insights: [],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    } as LandlordAnalyticsBenchmarkingResponse);

    render(
      <MemoryRouter>
        <LandlordAnalyticsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /Applications/i })).toBeInTheDocument();
  });

  it("re-fetches when filters change", async () => {
    await mockEntitlements();
    const fetchLandlordAnalyticsSnapshot = await mockApiResolved();
    const { fetchLandlordAnalyticsAlerts } = await import("../../api/landlordAnalyticsAlertsApi");
    const { fetchLandlordAnalyticsBenchmarking } = await import("../../api/landlordAnalyticsBenchmarkingApi");

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
    expect(vi.mocked(fetchLandlordAnalyticsBenchmarking)).toHaveBeenCalledWith({ period: "30d", propertyId: null });
    expect(vi.mocked(fetchLandlordAnalyticsBenchmarking)).toHaveBeenLastCalledWith({
      period: "30d",
      propertyId: "prop-2",
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
