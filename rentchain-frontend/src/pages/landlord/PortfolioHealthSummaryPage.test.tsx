import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { LandlordPortfolioHealthSummaryV1 } from "../../api/landlordPortfolioHealthApi";
import PortfolioHealthSummaryPage from "./PortfolioHealthSummaryPage";

const showToast = vi.fn();
const macShellProps = vi.fn();
const printSummaryDocumentMock = vi.fn();

vi.mock("../../api/landlordPortfolioHealthApi", () => ({
  fetchLandlordPortfolioHealth: vi.fn(),
}));

vi.mock("../../api/landlordLeaseRenewalApi", () => ({
  fetchExpiringLeaseRenewals: vi.fn(),
  saveLeaseRenewalInputs: vi.fn(),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: vi.fn(),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: { children: React.ReactNode; showTopNav?: boolean }) => {
    macShellProps(props);
    return <div>{children}</div>;
  },
}));

vi.mock("../../utils/printSummary", () => ({
  printSummaryDocument: (...args: unknown[]) => printSummaryDocumentMock(...args),
}));

vi.mock("../../components/ui/Ui", () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { elevated, ...rest } = props;
    void elevated;
    return <div {...rest}>{children}</div>;
  },
  Pill: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
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
  macShellProps.mockReset();
  printSummaryDocumentMock.mockReset();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PortfolioHealthSummaryPage", () => {
  function mockEntitlements(overrides?: Record<string, unknown>) {
    return import("@/hooks/useEntitlements").then(({ useEntitlements }) => {
      vi.mocked(useEntitlements).mockReturnValue({
        loading: false,
        canViewPortfolioHealthSummary: true,
        canViewPortfolioScore: true,
        canViewActionRecommendations: true,
        ...overrides,
      } as ReturnType<typeof useEntitlements>);
    });
  }

  it("renders overall status, dimensions, and next-focus items", async () => {
    await mockEntitlements();
    const { fetchLandlordPortfolioHealth } = await import("../../api/landlordPortfolioHealthApi");
    vi.mocked(fetchLandlordPortfolioHealth).mockResolvedValue({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "watch",
          headline: "Your portfolio health is stable overall, with a few areas to monitor.",
          summary: "Most portfolio activity is progressing normally, while a small number of areas may need closer follow-through.",
        },
        trend: {
          direction: "stable",
          summary: "Portfolio health has remained generally steady in recent history.",
        },
        dimensions: [
          {
            key: "screening_health",
            label: "Screening health",
            status: "watch",
            summary: "Application and screening follow-through may need closer attention.",
          },
        ],
        nextFocus: [
          {
            key: "workflow_follow_through",
            label: "Workflow follow-through",
            summary: "Review outstanding portfolio activity to keep progress steady.",
          },
        ],
        feedback: {
          summaries: ["Some tenants experienced slower maintenance follow-through."],
        },
        metadata: {
          portfolioScoreGrade: null,
          portfolioScoreAvailable: true,
          trendAvailable: true,
        },
      },
    } as { portfolioHealth: LandlordPortfolioHealthSummaryV1 });

    render(
      <MemoryRouter>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/stable overall, with a few areas to monitor/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeInTheDocument();
    expect(screen.getAllByText(/Screening health/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Resident feedback patterns/i)).toBeInTheDocument();
    expect(screen.getByText(/Workflow follow-through/i)).toBeInTheDocument();
    expect(macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));
  });

  it("routes print actions through the shared summary print helper", async () => {
    await mockEntitlements();
    const { fetchLandlordPortfolioHealth } = await import("../../api/landlordPortfolioHealthApi");
    vi.mocked(fetchLandlordPortfolioHealth).mockResolvedValue({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "watch",
          headline: "Your portfolio health is stable overall.",
          summary: "Most portfolio activity is progressing normally.",
        },
        trend: { direction: "stable", summary: "Stable." },
        dimensions: [],
        nextFocus: [],
        metadata: {
          portfolioScoreGrade: null,
          portfolioScoreAvailable: true,
          trendAvailable: true,
        },
      },
    } as { portfolioHealth: LandlordPortfolioHealthSummaryV1 });

    render(
      <MemoryRouter>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Print / Save PDF" }));
    expect(printSummaryDocumentMock).toHaveBeenCalledWith("summary");
  });

  it("shows a compact decision-entry hint for lease renewal destinations", async () => {
    await mockEntitlements();
    const { fetchLandlordPortfolioHealth } = await import("../../api/landlordPortfolioHealthApi");
    const { fetchExpiringLeaseRenewals } = await import("../../api/landlordLeaseRenewalApi");
    vi.mocked(fetchLandlordPortfolioHealth).mockResolvedValue({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "watch",
          headline: "Your portfolio health is stable overall, with a few areas to monitor.",
          summary: "Most portfolio activity is progressing normally, while a small number of areas may need closer follow-through.",
        },
        trend: {
          direction: "stable",
          summary: "Portfolio health has remained generally steady in recent history.",
        },
        dimensions: [],
        nextFocus: [],
        metadata: {
          portfolioScoreGrade: null,
          portfolioScoreAvailable: true,
          trendAvailable: true,
        },
      },
    } as { portfolioHealth: LandlordPortfolioHealthSummaryV1 });
    vi.mocked(fetchExpiringLeaseRenewals).mockResolvedValue({
      ok: true,
      items: [
        {
          id: "lease-1",
          tenantId: "tenant-1",
          propertyId: "prop-2",
          propertyAddress: "123 Harbour St",
          unitId: "unit-2",
          status: "active",
          leaseType: "fixed_term",
          province: "NS",
          leaseStartDate: "2025-07-01",
          leaseEndDate: "2026-06-30",
          currentRent: 1800,
          currency: "CAD",
          nextNoticeDueAt: Date.UTC(2026, 3, 1, 0, 0, 0, 0),
          latestNoticeId: null,
          tenantName: "Taylor Tenant",
          unitLabel: "Unit 2",
          propertyLabel: "Beta",
          renewalRentChangeMode: null,
          renewalOfferedRent: null,
          renewalDecisionDeadlineAt: null,
          renewalNewTermType: null,
          renewalNewLeaseStartDate: null,
          renewalNewLeaseEndDate: null,
          leaseLifecycleSummary: {
            lifecycleStatus: "expiring_soon",
            lifecycleLabel: "Expiring soon",
            lifecycleDescription: "This lease is approaching its notice timing and should be reviewed for renewal follow-through.",
            requiredNextAction: "prepare_renewal_notice",
            renewalOutcome: "not_started",
            daysUntilExpiry: 63,
            history: [{ type: "lease_started", label: "Lease started", occurredAt: "2025-07-01T00:00:00.000Z" }],
          },
        },
      ],
      data: [],
    });

    render(
      <MemoryRouter initialEntries={["/portfolio-health?entry=lease-renewals&propertyId=prop-2&status=expiring"]}>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Opened from decisions to review lease-renewal pressure/i)).toBeInTheDocument();
    expect((await screen.findAllByText(/Expiring soon leases/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Showing leases approaching notice timing/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Taylor Tenant/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("123 Harbour St • Unit 2")).length).toBeGreaterThan(0);
    expect(screen.getByText("Visible leases: 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print / Save renewal view" })).toBeInTheDocument();
    expect((await screen.findAllByText(/Lifecycle:/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Outcome:/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/Next step:/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/History:/i)).length).toBeGreaterThan(0);
    expect(fetchExpiringLeaseRenewals).toHaveBeenCalledWith({
      propertyId: "prop-2",
      status: "expiring",
    });
  });

  it("routes scoped renewal printing through the shared print helper", async () => {
    await mockEntitlements();
    const { fetchLandlordPortfolioHealth } = await import("../../api/landlordPortfolioHealthApi");
    const { fetchExpiringLeaseRenewals } = await import("../../api/landlordLeaseRenewalApi");
    vi.mocked(fetchLandlordPortfolioHealth).mockResolvedValue({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "watch",
          headline: "Your portfolio health is stable overall.",
          summary: "Most portfolio activity is progressing normally.",
        },
        trend: { direction: "stable", summary: "Stable." },
        dimensions: [],
        nextFocus: [],
        metadata: {
          portfolioScoreGrade: null,
          portfolioScoreAvailable: true,
          trendAvailable: true,
        },
      },
    } as { portfolioHealth: LandlordPortfolioHealthSummaryV1 });
    vi.mocked(fetchExpiringLeaseRenewals).mockResolvedValue({
      ok: true,
      items: [],
      data: [],
    });

    render(
      <MemoryRouter initialEntries={["/portfolio-health?entry=lease-renewals&status=expiring"]}>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole("button", { name: "Print / Save renewal view" }));
    expect(printSummaryDocumentMock).toHaveBeenCalledWith("lease-renewals");
  });

  it("saves lease renewal operator inputs from the decision-entry workflow surface", async () => {
    await mockEntitlements();
    const { fetchLandlordPortfolioHealth } = await import("../../api/landlordPortfolioHealthApi");
    const { fetchExpiringLeaseRenewals, saveLeaseRenewalInputs } = await import("../../api/landlordLeaseRenewalApi");
    vi.mocked(fetchLandlordPortfolioHealth).mockResolvedValue({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "watch",
          headline: "Your portfolio health is stable overall.",
          summary: "Most portfolio activity is progressing normally.",
        },
        trend: {
          direction: "stable",
          summary: "Portfolio health has remained generally steady in recent history.",
        },
        dimensions: [],
        nextFocus: [],
        metadata: {
          portfolioScoreGrade: null,
          portfolioScoreAvailable: true,
          trendAvailable: true,
        },
      },
    } as { portfolioHealth: LandlordPortfolioHealthSummaryV1 });
    vi.mocked(fetchExpiringLeaseRenewals).mockResolvedValue({
      ok: true,
      items: [
        {
          id: "lease-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          propertyAddress: "12 Main St",
          unitId: "unit-1",
          status: "active",
          leaseType: "fixed_term",
          province: "NS",
          leaseStartDate: "2025-07-01",
          leaseEndDate: "2026-06-30",
          currentRent: 1800,
          currency: "CAD",
          nextNoticeDueAt: Date.UTC(2026, 3, 1, 0, 0, 0, 0),
          latestNoticeId: null,
          tenantName: "Taylor Tenant",
          unitLabel: "Unit 1",
          propertyLabel: "Alpha",
          renewalRentChangeMode: null,
          renewalOfferedRent: null,
          renewalDecisionDeadlineAt: null,
          renewalNewTermType: null,
          renewalNewLeaseStartDate: null,
          renewalNewLeaseEndDate: null,
        },
      ],
      data: [],
    });
    vi.mocked(saveLeaseRenewalInputs).mockResolvedValue({
      ok: true,
      lease: {
        id: "lease-1",
        tenantId: "tenant-1",
        propertyId: "prop-1",
        propertyAddress: "12 Main St",
        unitId: "unit-1",
        status: "active",
        leaseType: "fixed_term",
        province: "NS",
        leaseStartDate: "2025-07-01",
        leaseEndDate: "2026-06-30",
        currentRent: 1800,
        currency: "CAD",
        nextNoticeDueAt: Date.UTC(2026, 3, 1, 0, 0, 0, 0),
        latestNoticeId: null,
        tenantName: "Taylor Tenant",
        unitLabel: "Unit 1",
        propertyLabel: "Alpha",
        renewalRentChangeMode: "no_change",
        renewalOfferedRent: null,
        renewalDecisionDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
        renewalNewTermType: "fixed_term",
        renewalNewLeaseStartDate: "2026-07-01",
        renewalNewLeaseEndDate: "2027-06-30",
      },
      renewalInputs: {
        rentChangeMode: "no_change",
        proposedRent: null,
        newTermType: "fixed_term",
        newLeaseStartDate: "2026-07-01",
        newLeaseEndDate: "2027-06-30",
        responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
      },
    });

    render(
      <MemoryRouter initialEntries={["/portfolio-health?entry=lease-renewals&propertyId=prop-1"]}>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Lease renewal operator inputs/i)).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText(/Rent change mode/i), { target: { value: "no_change" } });
    fireEvent.change(screen.getByLabelText(/New term type/i), { target: { value: "fixed_term" } });
    fireEvent.change(screen.getByLabelText(/New lease start date/i), { target: { value: "2026-07-01" } });
    fireEvent.change(screen.getByLabelText(/New lease end date/i), { target: { value: "2027-06-30" } });
    fireEvent.change(screen.getByLabelText(/Response deadline/i), { target: { value: "2026-05-01T08:00" } });
    fireEvent.click(screen.getByRole("button", { name: /Save renewal inputs/i }));

    await waitFor(() => {
      expect(saveLeaseRenewalInputs).toHaveBeenCalledWith(
        "lease-1",
        expect.objectContaining({
          rentChangeMode: "no_change",
          newTermType: "fixed_term",
          newLeaseStartDate: "2026-07-01",
          newLeaseEndDate: "2027-06-30",
        })
      );
    });
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Lease renewal inputs saved",
      })
    );
  });

  it("clears and blocks proposed rent when rent change mode does not allow it", async () => {
    await mockEntitlements();
    const { fetchLandlordPortfolioHealth } = await import("../../api/landlordPortfolioHealthApi");
    const { fetchExpiringLeaseRenewals, saveLeaseRenewalInputs } = await import("../../api/landlordLeaseRenewalApi");
    vi.mocked(fetchLandlordPortfolioHealth).mockResolvedValue({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "watch",
          headline: "Your portfolio health is stable overall.",
          summary: "Most portfolio activity is progressing normally.",
        },
        trend: { direction: "stable", summary: "Stable." },
        dimensions: [],
        nextFocus: [],
        metadata: {
          portfolioScoreGrade: null,
          portfolioScoreAvailable: true,
          trendAvailable: true,
        },
      },
    } as { portfolioHealth: LandlordPortfolioHealthSummaryV1 });
    vi.mocked(fetchExpiringLeaseRenewals).mockResolvedValue({
      ok: true,
      items: [
        {
          id: "lease-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          propertyAddress: "12 Main St",
          unitId: "unit-1",
          status: "active",
          leaseType: "fixed_term",
          province: "NS",
          leaseStartDate: "2025-07-01",
          leaseEndDate: "2026-06-30",
          currentRent: 1800,
          currency: "CAD",
          nextNoticeDueAt: Date.UTC(2026, 3, 1, 0, 0, 0, 0),
          latestNoticeId: null,
          tenantName: "Taylor Tenant",
          unitLabel: "Unit 1",
          propertyLabel: "Alpha",
          renewalRentChangeMode: null,
          renewalOfferedRent: null,
          renewalDecisionDeadlineAt: null,
          renewalNewTermType: null,
          renewalNewLeaseStartDate: null,
          renewalNewLeaseEndDate: null,
        },
      ],
      data: [],
    });

    render(
      <MemoryRouter initialEntries={["/portfolio-health?entry=lease-renewals&propertyId=prop-1"]}>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText(/Lease renewal operator inputs/i)).length).toBeGreaterThan(0);
    const proposedRentInput = screen.getByLabelText(/Proposed rent/i) as HTMLInputElement;

    expect(proposedRentInput).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Rent change mode/i), { target: { value: "increase" } });
    expect(proposedRentInput).not.toBeDisabled();
    fireEvent.change(proposedRentInput, { target: { value: "2000" } });
    fireEvent.change(screen.getByLabelText(/Rent change mode/i), { target: { value: "no_change" } });

    expect(proposedRentInput.value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: /Save renewal inputs/i }));

    await waitFor(() =>
      expect(saveLeaseRenewalInputs).toHaveBeenCalledWith(
        "lease-1",
        expect.objectContaining({
          rentChangeMode: "no_change",
          proposedRent: null,
        })
      )
    );
    expect(showToast).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Review renewal inputs",
      })
    );
  });

  it("renders sparse-data messaging", async () => {
    await mockEntitlements();
    const { fetchLandlordPortfolioHealth } = await import("../../api/landlordPortfolioHealthApi");
    vi.mocked(fetchLandlordPortfolioHealth).mockResolvedValue({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "watch",
          headline: "Your portfolio health is stable overall, with a few areas to monitor.",
          summary: "Portfolio health data is still developing as more activity is recorded.",
        },
        trend: {
          direction: "insufficient_data",
          summary: "Trend visibility will improve as more portfolio activity is tracked.",
        },
        dimensions: [],
        nextFocus: [],
        metadata: {
          portfolioScoreGrade: null,
          portfolioScoreAvailable: true,
          trendAvailable: false,
        },
      },
    } as { portfolioHealth: LandlordPortfolioHealthSummaryV1 });

    render(
      <MemoryRouter>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/still developing as more activity is recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/Trend visibility will improve/i)).toBeInTheDocument();
  });

  it("renders an error state cleanly", async () => {
    await mockEntitlements();
    const { fetchLandlordPortfolioHealth } = await import("../../api/landlordPortfolioHealthApi");
    vi.mocked(fetchLandlordPortfolioHealth).mockRejectedValue(new Error("Boom"));

    render(
      <MemoryRouter>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load portfolio health: Boom/i)).toBeInTheDocument();
  });

  it("shows upgrade teasers when higher intelligence tiers are unavailable", async () => {
    await mockEntitlements({
      canViewPortfolioScore: false,
      canViewActionRecommendations: false,
    });
    const { fetchLandlordPortfolioHealth } = await import("../../api/landlordPortfolioHealthApi");
    vi.mocked(fetchLandlordPortfolioHealth).mockResolvedValue({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "healthy",
          headline: "Your portfolio health is stable overall.",
          summary: "Most portfolio activity is progressing normally.",
        },
        trend: {
          direction: "stable",
          summary: "Portfolio health has remained generally steady in recent history.",
        },
        dimensions: [],
        nextFocus: [],
        metadata: {
          portfolioScoreGrade: null,
          portfolioScoreAvailable: false,
          trendAvailable: true,
        },
      },
    } as { portfolioHealth: LandlordPortfolioHealthSummaryV1 });

    render(
      <MemoryRouter>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Unlock Portfolio Score™ on Pro/i)).toBeInTheDocument();
  });
});
