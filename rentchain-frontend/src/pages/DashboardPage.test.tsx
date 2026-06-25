import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import DashboardPage from "./DashboardPage";
import type { LandlordDecisionQueueResponse } from "@/api/landlordDecisionQueueApi";
import type { LandlordPortfolioStatusFinancialResponse } from "@/api/landlordPortfolioStatusFinancialApi";

const mocks = vi.hoisted(() => ({
  fetchLandlordDecisionQueueMock: vi.fn(),
  fetchLandlordPortfolioStatusFinancialMock: vi.fn(),
  fetchApplicationsMock: vi.fn(),
  fetchTenantsMock: vi.fn(),
  fetchUnifiedInboxMock: vi.fn(),
  listWorkOrdersMock: vi.fn(),
  listLandlordMaintenanceMock: vi.fn(),
}));

vi.mock("@/api/landlordDecisionQueueApi", () => ({
  fetchLandlordDecisionQueue: mocks.fetchLandlordDecisionQueueMock,
}));

vi.mock("@/api/landlordPortfolioStatusFinancialApi", () => ({
  fetchLandlordPortfolioStatusFinancial: mocks.fetchLandlordPortfolioStatusFinancialMock,
}));

vi.mock("@/api/applicationsApi", () => ({
  fetchApplications: mocks.fetchApplicationsMock,
}));

vi.mock("@/api/tenantsApi", () => ({
  fetchTenants: mocks.fetchTenantsMock,
}));

vi.mock("@/api/unifiedInboxApi", () => ({
  fetchUnifiedInbox: mocks.fetchUnifiedInboxMock,
}));

vi.mock("@/api/workOrdersApi", () => ({
  listWorkOrders: mocks.listWorkOrdersMock,
}));

vi.mock("@/api/maintenanceWorkflowApi", () => ({
  listLandlordMaintenance: mocks.listLandlordMaintenanceMock,
}));

const macShellProps = vi.hoisted(() => ({
  latest: vi.fn(),
}));

vi.mock("../components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    macShellProps.latest(props);
    return <div>{children}</div>;
  },
}));

function installMatchMedia(matches = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function portfolioResponse(
  overrides: Partial<LandlordPortfolioStatusFinancialResponse> = {}
): LandlordPortfolioStatusFinancialResponse {
  const base: LandlordPortfolioStatusFinancialResponse = {
    ok: true,
    version: "landlord_portfolio_status_financial_v1",
    landlordId: "landlord-1",
    generatedAt: "2026-06-19T12:00:00.000Z",
    confidence: {
      occupancy: "high",
      financial: "medium",
    },
    dataQualityFlags: ["missing_rent_terms"],
    portfolioStatus: {
      totalProperties: 2,
      totalUnits: 10,
      occupiedUnits: 8,
      vacantUnits: 2,
      upcomingUnits: 1,
      noticePeriodUnits: 1,
      reviewRequiredUnits: 1,
      occupancyRate: 0.8,
      activeLeaseCount: 8,
      currentLeaseCount: 8,
      signedFutureLeaseCount: 1,
      leasesRequiringReview: 1,
      criticalOpenIssues: null,
      openOperationalIssues: null,
      confidence: "high",
      dataQualityFlags: ["unit_lease_occupancy_conflict"],
    },
    financialSnapshot: {
      period: {
        month: "2026-06",
        startsAt: "2026-06-01T00:00:00.000Z",
        endsAt: "2026-06-30T23:59:59.999Z",
      },
      expectedMonthlyRentCents: 1200000,
      collectedCurrentMonthCents: 900000,
      outstandingCurrentMonthCents: 300000,
      rentCollectionRate: 0.75,
      rentRollCents: 1200000,
      vacancyImpactCents: null,
      activeLeaseRentTermsCount: 7,
      leasesMissingRentTermsCount: 1,
      paymentSourcesIncluded: ["ledgerEvents"],
      confidence: "medium",
      dataQualityFlags: ["missing_rent_terms"],
    },
  };
  return {
    ...base,
    ...overrides,
    confidence: {
      ...base.confidence,
      ...overrides.confidence,
    },
    portfolioStatus: {
      ...base.portfolioStatus,
      ...overrides.portfolioStatus,
    },
    financialSnapshot: {
      ...base.financialSnapshot,
      ...overrides.financialSnapshot,
      period: {
        ...base.financialSnapshot.period,
        ...overrides.financialSnapshot?.period,
      },
    },
  };
}

function queueResponse(overrides: Partial<LandlordDecisionQueueResponse> = {}): LandlordDecisionQueueResponse {
  const base: LandlordDecisionQueueResponse = {
    ok: true,
    version: "landlord_decision_queue_v1",
    landlordId: "landlord-1",
    generatedAt: "2026-06-19T12:01:00.000Z",
    total: 2,
    limit: 6,
    filters: {
      severity: null,
      workspace: null,
      status: "open_state",
    },
    summary: {
      total: 2,
      critical: 0,
      warning: 1,
      needsReview: 1,
      upcoming: 1,
      informational: 0,
      open: 2,
      blocked: 0,
    },
    items: [
      {
        id: "decision-1",
        sourceType: "lease",
        sourceId: "lease-1",
        workspace: "lease",
        severity: "needs_review",
        title: "Resolve lease renewal",
        description: "A lease needs a renewal decision before the notice window closes.",
        recommendedActionLabel: "Open lease workspace",
        recommendedActionHref: "/leases",
        dueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: "2026-06-18T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z",
        status: "open",
        dedupeKey: "lease-renewal",
        sortKey: "1",
        priorityRank: 10,
      },
      {
        id: "decision-2",
        sourceType: "payment",
        sourceId: "payment-1",
        workspace: "payments",
        severity: "upcoming",
        title: "Review outstanding rent",
        description: "A rent collection item is coming due.",
        recommendedActionLabel: "Open payments",
        recommendedActionHref: "/payments",
        dueAt: null,
        createdAt: "2026-06-18T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z",
        status: "pending",
        dedupeKey: "payment-review",
        sortKey: "2",
        priorityRank: 20,
      },
    ],
  };
  return {
    ...base,
    ...overrides,
    summary: {
      ...base.summary,
      ...overrides.summary,
    },
    filters: {
      ...base.filters,
      ...overrides.filters,
    },
    items: overrides.items ?? base.items,
  };
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
});

describe("DashboardPage", () => {
  beforeEach(() => {
    macShellProps.latest.mockReset();
    installMatchMedia(false);
    mocks.fetchLandlordPortfolioStatusFinancialMock.mockResolvedValue(portfolioResponse());
    mocks.fetchLandlordDecisionQueueMock.mockResolvedValue(queueResponse());
    mocks.fetchApplicationsMock.mockResolvedValue([{ id: "app-1", status: "SUBMITTED" }, { id: "app-2", status: "APPROVED" }]);
    mocks.fetchTenantsMock.mockResolvedValue([{ id: "tenant-1" }, { id: "tenant-2" }, { id: "tenant-3" }]);
    mocks.listWorkOrdersMock.mockResolvedValue([{ id: "wo-1", status: "open" }, { id: "wo-2", status: "completed" }]);
    mocks.listLandlordMaintenanceMock.mockResolvedValue({
      ok: true,
      items: [
        { id: "maint-1", status: "submitted" },
        { id: "maint-2", status: "completed" },
        { id: "maint-3", status: "in_progress" },
      ],
    });
    mocks.fetchUnifiedInboxMock.mockResolvedValue({ ok: true, role: "landlord", items: [], records: [], total: 4, limit: 50, offset: 0 });
  });

  it("renders Dashboard 2.0 sections from the portfolio and decision queue contracts", async () => {
    renderDashboard();

    expect(await screen.findByTestId("portfolio-status-section")).toHaveTextContent("Portfolio Health");
    expect(macShellProps.latest).toHaveBeenCalledWith(expect.objectContaining({ maxWidth: 1320, showTopNav: false }));
    expect(screen.getByTestId("portfolio-status-section")).toHaveTextContent("Properties");
    expect(screen.getByText("Quick view of portfolio occupancy and health.")).toBeInTheDocument();
    expect(screen.getByTestId("portfolio-status-section")).toHaveTextContent("Units");
    expect(screen.getByTestId("portfolio-status-section")).toHaveTextContent("Occupied");
    expect(screen.getByTestId("portfolio-status-section")).toHaveTextContent("Vacant");
    expect(screen.getByTestId("portfolio-status-section")).toHaveTextContent("80%");
    expect(screen.getByTestId("portfolio-counts-row")).toHaveTextContent("Applications Pending");
    expect(screen.getByTestId("portfolio-counts-row")).toHaveTextContent("Tenants");
    expect(screen.getByRole("link", { name: /Maintenance Requests/i })).toHaveAttribute("href", "/maintenance");
    expect(screen.getByRole("link", { name: /Work Orders/i })).toHaveAttribute("href", "/work-orders");
    expect(screen.getByRole("link", { name: /Unified Messages/i })).toHaveAttribute("href", "/landlord/inbox");
    expect(screen.getByTestId("decision-queue-section")).toHaveTextContent("Decision Queue Preview");
    expect(screen.getByText("Highest-priority decisions needing attention.")).toBeInTheDocument();
    expect(screen.getByTestId("decision-queue-section")).toHaveTextContent("Resolve lease renewal");
    expect(screen.getByTestId("upcoming-actions-section")).toHaveTextContent("Upcoming Actions");
    expect(screen.getByTestId("calendar-preview-section")).toHaveTextContent("Calendar Preview");
    expect(screen.getByTestId("calendar-preview-section")).toHaveTextContent("Resolve lease renewal");
    expect(screen.getByRole("link", { name: /Open Full Schedule/i })).toHaveAttribute("href", "/scheduling");
    fireEvent.click(screen.getByRole("button", { name: "Month view" }));
    expect(screen.getByRole("button", { name: "7-day view" })).toBeInTheDocument();
    expect(screen.getByTestId("financial-snapshot-section")).toHaveTextContent("Financial Snapshot");
    expect(screen.getByText(/Current rent collection and outstanding balance overview/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Payments Workspace/i })).toHaveAttribute(
      "href",
      "/payments?context=current_month&period=2026-06&source=dashboard"
    );
    expect(screen.getByTestId("workspace-routing-section")).toHaveTextContent("Operations full queue");
    expect(screen.getByRole("link", { name: /Renewals/i })).toHaveAttribute("href", "/lease-renewal");

    expect(mocks.fetchLandlordPortfolioStatusFinancialMock).toHaveBeenCalledWith({ periodMonth: expect.stringMatching(/^\d{4}-\d{2}$/) });
    expect(mocks.fetchLandlordDecisionQueueMock).toHaveBeenCalledWith({ status: "open_state", limit: 6 });
    expect(mocks.fetchApplicationsMock).toHaveBeenCalled();
    expect(mocks.fetchTenantsMock).toHaveBeenCalled();
    expect(mocks.listWorkOrdersMock).toHaveBeenCalled();
    expect(mocks.listLandlordMaintenanceMock).toHaveBeenCalled();
    expect(mocks.fetchUnifiedInboxMock).toHaveBeenCalledWith("landlord");
    expect(screen.queryByText("lease-1")).not.toBeInTheDocument();
    expect(screen.queryByText("payment-1")).not.toBeInTheDocument();
    expect(screen.queryByText("A lease needs a renewal decision before the notice window closes.")).not.toBeInTheDocument();
  });

  it("keeps decision queue content visible when portfolio data fails", async () => {
    mocks.fetchLandlordPortfolioStatusFinancialMock.mockRejectedValue(new Error("Portfolio API unavailable"));

    renderDashboard();

    expect((await screen.findAllByText("Portfolio API unavailable")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Resolve lease renewal")).length).toBeGreaterThan(0);
    expect(screen.getByTestId("decision-queue-section")).toHaveTextContent("View Full Queue");
  });

  it("shows degraded and unavailable metric states with data-quality flags", async () => {
    mocks.fetchLandlordPortfolioStatusFinancialMock.mockResolvedValue(
      portfolioResponse({
        confidence: {
          occupancy: "low",
          financial: "unavailable",
        },
        portfolioStatus: {
          occupancyRate: null,
          dataQualityFlags: ["unit_lease_occupancy_conflict"],
        },
        financialSnapshot: {
          expectedMonthlyRentCents: null,
          collectedCurrentMonthCents: null,
          outstandingCurrentMonthCents: null,
          rentCollectionRate: null,
          dataQualityFlags: ["payment_source_unavailable"],
        },
      })
    );

    renderDashboard();

    expect((await screen.findAllByText("Unavailable")).length).toBeGreaterThan(0);
    expect(screen.getByText(/unit lease occupancy conflict/)).toBeInTheDocument();
    expect(screen.getByText(/payment source unavailable/)).toBeInTheDocument();
    expect(screen.getAllByText("Degraded").length).toBeGreaterThan(0);
  });

  it("uses intentional empty states when no decision items are returned", async () => {
    mocks.fetchLandlordDecisionQueueMock.mockResolvedValue(
      queueResponse({
        total: 0,
        summary: {
          total: 0,
          open: 0,
          needsReview: 0,
          blocked: 0,
        },
        items: [],
      })
    );

    renderDashboard();

    expect(await screen.findByText("No open decisions. New operational decisions will appear here before routing to their owning workspace.")).toBeInTheDocument();
    expect(screen.getByText("No dated actions are due right now. When lease, payment, notice, or maintenance decisions have dates, they appear here.")).toBeInTheDocument();
    expect(screen.getByText("No dated schedule items are visible for this week. Upcoming dated decisions will appear here.")).toBeInTheDocument();
  });

  it("collapses the primary dashboard grid on narrow viewports", async () => {
    installMatchMedia(true);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByTestId("dashboard-operational-grid")).toHaveStyle({ gridTemplateColumns: "1fr" });
    });
  });
});
