import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PortfolioHealthSummaryPage from "./PortfolioHealthSummaryPage";

const showToast = vi.fn();

vi.mock("../../api/landlordPortfolioHealthApi", () => ({
  fetchLandlordPortfolioHealth: vi.fn(),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../components/ui/Ui", () => ({
  Card: ({ children, elevated: _elevated, ...props }: any) => <div {...props}>{children}</div>,
  Pill: ({ children }: any) => <span>{children}</span>,
  Section: ({ children }: any) => <section>{children}</section>,
}));

beforeEach(() => {
  showToast.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PortfolioHealthSummaryPage", () => {
  it("renders overall status, dimensions, and next-focus items", async () => {
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
    } as any);

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

  it("renders sparse-data messaging", async () => {
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
    } as any);

    render(
      <MemoryRouter>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/still developing as more activity is recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/Trend visibility will improve/i)).toBeInTheDocument();
  });

  it("renders an error state cleanly", async () => {
    const { fetchLandlordPortfolioHealth } = await import("../../api/landlordPortfolioHealthApi");
    vi.mocked(fetchLandlordPortfolioHealth).mockRejectedValue(new Error("Boom"));

    render(
      <MemoryRouter>
        <PortfolioHealthSummaryPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load portfolio health: Boom/i)).toBeInTheDocument();
  });
});
