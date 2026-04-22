import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import type { LandlordPortfolioHealthSummaryV1 } from "../../api/landlordPortfolioHealthApi";
import PortfolioHealthSummaryPage from "./PortfolioHealthSummaryPage";

const showToast = vi.fn();

vi.mock("../../api/landlordPortfolioHealthApi", () => ({
  fetchLandlordPortfolioHealth: vi.fn(),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: vi.fn(),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

    expect(await screen.findByText(/stable overall, with a few areas to monitor/i)).toBeInTheDocument();
    expect(screen.getByText(/Screening health/i)).toBeInTheDocument();
    expect(screen.getByText(/Resident feedback patterns/i)).toBeInTheDocument();
    expect(screen.getByText(/Workflow follow-through/i)).toBeInTheDocument();
  });

  it("shows a compact decision-entry hint for lease renewal destinations", async () => {
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
      <MemoryRouter initialEntries={["/portfolio-health?entry=lease-renewals&propertyId=prop-2"]}>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Opened from decisions to review lease-renewal pressure/i)).toBeInTheDocument();
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
