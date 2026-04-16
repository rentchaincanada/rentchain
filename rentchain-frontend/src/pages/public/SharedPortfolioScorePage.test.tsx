import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SharedPortfolioScorePage from "./SharedPortfolioScorePage";

vi.mock("../../api/publicPortfolioScoreApi", () => ({
  fetchSharedPortfolioScore: vi.fn(),
}));

vi.mock("../../components/ui/Ui", () => ({
  Card: ({ children, elevated: _elevated, ...props }: any) => <div {...props}>{children}</div>,
  Pill: ({ children }: any) => <span>{children}</span>,
  Section: ({ children, ...props }: any) => <section {...props}>{children}</section>,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SharedPortfolioScorePage", () => {
  it("renders a safe shared score payload", async () => {
    const { fetchSharedPortfolioScore } = await import("../../api/publicPortfolioScoreApi");
    vi.mocked(fetchSharedPortfolioScore).mockResolvedValue({
      portfolioScore: {
        version: "v1",
        portfolioId: "portfolio-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        score: 90,
        grade: "A",
        summary: {
          headline: "Your portfolio is operating at a high standard.",
          explanation: "Recent portfolio activity has been consistent across key areas.",
        },
        trend: {
          direction: "improving",
          summary: "The score has been improving in recent history.",
        },
        components: [],
        trust: {
          explanation: "The score reflects operational consistency over time.",
          methodologyNote: "Scores are based on activity patterns and consistency.",
        },
      },
    } as any);

    render(
      <MemoryRouter initialEntries={["/portfolio-score/shared/token-1"]}>
        <Routes>
          <Route path="/portfolio-score/shared/:token" element={<SharedPortfolioScorePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Shared Portfolio Score™/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Grade A/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Share controls/i)).not.toBeInTheDocument();
  });

  it("renders a revoked or invalid token state cleanly", async () => {
    const { fetchSharedPortfolioScore } = await import("../../api/publicPortfolioScoreApi");
    vi.mocked(fetchSharedPortfolioScore).mockRejectedValue(new Error("NOT_FOUND"));

    render(
      <MemoryRouter initialEntries={["/portfolio-score/shared/missing-token"]}>
        <Routes>
          <Route path="/portfolio-score/shared/:token" element={<SharedPortfolioScorePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Shared score unavailable/i)).toBeInTheDocument();
  });
});
