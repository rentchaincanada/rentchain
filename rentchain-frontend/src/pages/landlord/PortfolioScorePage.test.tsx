import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PortfolioScorePage from "./PortfolioScorePage";

const showToast = vi.fn();

vi.mock("../../api/landlordPortfolioScoreApi", () => ({
  fetchLandlordPortfolioScore: vi.fn(),
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

describe("PortfolioScorePage", () => {
  it("renders a high score safely", async () => {
    const { fetchLandlordPortfolioScore } = await import("../../api/landlordPortfolioScoreApi");
    vi.mocked(fetchLandlordPortfolioScore).mockResolvedValue({
      portfolioScore: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        score: 92,
        grade: "A",
        summary: {
          headline: "Your portfolio is operating at a high standard.",
          explanation: "Recent portfolio activity has been consistent and well balanced across key operational areas.",
        },
        trend: {
          direction: "improving",
          summary: "Your portfolio score has been improving in recent history.",
        },
        components: [
          {
            key: "workflow_completion",
            label: "Workflow completion",
            status: "strong",
            summary: "Core portfolio workflows are reaching healthy outcomes consistently.",
          },
        ],
        trust: {
          explanation: "Your score reflects how consistently your rental operations are performing over time.",
          methodologyNote: "Scores are based on activity patterns, workflow completion, and operational consistency over time.",
        },
      },
    } as any);

    render(
      <MemoryRouter>
        <PortfolioScorePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/operating at a high standard/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Grade A/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Workflow completion/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/How to read this score/i)).toBeInTheDocument();
  });

  it("renders sparse data safely", async () => {
    const { fetchLandlordPortfolioScore } = await import("../../api/landlordPortfolioScoreApi");
    vi.mocked(fetchLandlordPortfolioScore).mockResolvedValue({
      portfolioScore: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        score: 75,
        grade: "C",
        summary: {
          headline: "Your portfolio score is still taking shape.",
          explanation: "Your portfolio score will become more precise as more activity is recorded.",
        },
        trend: {
          direction: "insufficient_data",
          summary: "Your trend will become clearer as more portfolio activity is recorded over time.",
        },
        components: [],
        trust: {
          explanation: "Your score reflects early activity patterns and will become more informative as more portfolio activity is recorded.",
          methodologyNote: "Scores are based on activity patterns, workflow completion, and operational consistency over time.",
        },
      },
    } as any);

    render(
      <MemoryRouter>
        <PortfolioScorePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/still taking shape/i)).toBeInTheDocument();
    expect(screen.getByText(/become more precise as more activity is recorded/i)).toBeInTheDocument();
  });

  it("renders an error state cleanly", async () => {
    const { fetchLandlordPortfolioScore } = await import("../../api/landlordPortfolioScoreApi");
    vi.mocked(fetchLandlordPortfolioScore).mockRejectedValue(new Error("Boom"));

    render(
      <MemoryRouter>
        <PortfolioScorePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load portfolio score: Boom/i)).toBeInTheDocument();
  });
});
