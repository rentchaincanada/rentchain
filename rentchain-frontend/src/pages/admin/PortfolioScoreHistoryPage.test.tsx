import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioScoreHistoryPage from "./PortfolioScoreHistoryPage";

const showToast = vi.fn();

vi.mock("../../api/portfolioScoreHistoryApi", () => ({
  fetchPortfolioScoreTrend: vi.fn(),
  createPortfolioScoreSnapshot: vi.fn(),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../components/ui/Ui", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
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

function renderPage(initialEntry = "/admin/portfolio-score/history") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/portfolio-score/history" element={<PortfolioScoreHistoryPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PortfolioScoreHistoryPage", () => {
  it("renders latest score, trend, movers, and history", async () => {
    const { fetchPortfolioScoreTrend } = await import("../../api/portfolioScoreHistoryApi");
    vi.mocked(fetchPortfolioScoreTrend).mockResolvedValue({
      trend: {
        version: "v1",
        portfolioId: "portfolio-1",
        generatedAt: "2026-04-15T12:00:00.000Z",
        latest: {
          version: "v1",
          portfolioId: "portfolio-1",
          snapshotAt: "2026-04-15T12:00:00.000Z",
          score: 82,
          grade: "B",
          status: "watch",
          headline: "Latest snapshot",
          componentScores: [],
          metrics: {
            totalResourcesReviewed: 12,
            triageItemCount: 2,
            criticalTriageCount: 0,
            reconciliationIssueCount: 1,
            automationSkipCount: 1,
            policyReviewCount: 1,
            blockedWorkflowCount: 0,
            maintenanceReopenCount: 0,
          },
        },
        previous: {
          version: "v1",
          portfolioId: "portfolio-1",
          snapshotAt: "2026-04-01T12:00:00.000Z",
          score: 78,
          grade: "C",
          status: "watch",
          headline: "Previous snapshot",
          componentScores: [],
          metrics: {
            totalResourcesReviewed: 10,
            triageItemCount: 3,
            criticalTriageCount: 1,
            reconciliationIssueCount: 2,
            automationSkipCount: 1,
            policyReviewCount: 1,
            blockedWorkflowCount: 0,
            maintenanceReopenCount: 0,
          },
        },
        direction: "up",
        deltaScore: 4,
        deltaGrade: "C -> B",
        summary: {
          headline: "Portfolio score improved versus the previous snapshot.",
          notes: ["Exception burden eased versus the previous snapshot."],
        },
        movers: [
          {
            key: "exception_burden",
            deltaNormalizedScore: 8,
            deltaContribution: 1.6,
            direction: "up",
            summary: "Exception burden eased versus the previous snapshot.",
          },
        ],
        history: [
          {
            version: "v1",
            portfolioId: "portfolio-1",
            snapshotAt: "2026-04-15T12:00:00.000Z",
            score: 82,
            grade: "B",
            status: "watch",
            headline: "Latest snapshot",
            componentScores: [],
            metrics: {
              totalResourcesReviewed: 12,
              triageItemCount: 2,
              criticalTriageCount: 0,
              reconciliationIssueCount: 1,
              automationSkipCount: 1,
              policyReviewCount: 1,
              blockedWorkflowCount: 0,
              maintenanceReopenCount: 0,
            },
          },
        ],
      },
    });

    renderPage("/admin/portfolio-score/history?portfolioId=portfolio-1");

    expect(await screen.findByText(/Portfolio score improved versus the previous snapshot/i)).toBeInTheDocument();
    expect(screen.getByText(/Grade change: C -> B/i)).toBeInTheDocument();
    expect(screen.getByText(/Top movers/i)).toBeInTheDocument();
    expect(screen.getByText(/exception_burden/i)).toBeInTheDocument();
    expect(screen.getByText(/Score history/i)).toBeInTheDocument();
  });

  it("renders the empty state before lookup", () => {
    renderPage();
    expect(
      screen.getByText(/Enter a portfolio ID to inspect score history, trend direction, and component movers/i)
    ).toBeInTheDocument();
  });

  it("renders insufficient-data history safely", async () => {
    const { fetchPortfolioScoreTrend } = await import("../../api/portfolioScoreHistoryApi");
    vi.mocked(fetchPortfolioScoreTrend).mockResolvedValue({
      trend: {
        version: "v1",
        portfolioId: "portfolio-1",
        generatedAt: "2026-04-15T12:00:00.000Z",
        latest: null,
        previous: null,
        direction: "insufficient_data",
        deltaScore: null,
        deltaGrade: null,
        summary: {
          headline: "No portfolio score history is available yet.",
          notes: ["Create the first snapshot to start tracking portfolio score movement over time."],
        },
        movers: [],
        history: [],
      },
    });

    renderPage("/admin/portfolio-score/history?portfolioId=portfolio-1");

    expect(await screen.findByText(/No score snapshots have been stored yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No material component movement is available yet/i)).toBeInTheDocument();
  });

  it("renders error state and snapshot button flow", async () => {
    const { fetchPortfolioScoreTrend, createPortfolioScoreSnapshot } = await import("../../api/portfolioScoreHistoryApi");
    vi.mocked(fetchPortfolioScoreTrend).mockRejectedValueOnce(new Error("Boom")).mockResolvedValueOnce({
      trend: {
        version: "v1",
        portfolioId: "portfolio-1",
        generatedAt: "2026-04-15T12:00:00.000Z",
        latest: null,
        previous: null,
        direction: "insufficient_data",
        deltaScore: null,
        deltaGrade: null,
        summary: {
          headline: "More score history is needed before a trend can be established.",
          notes: ["Create at least one more snapshot to compare score direction and component movement."],
        },
        movers: [],
        history: [],
      },
    });
    vi.mocked(createPortfolioScoreSnapshot).mockResolvedValue({
      snapshot: {
        version: "v1",
        portfolioId: "portfolio-1",
        snapshotAt: "2026-04-15T12:00:00.000Z",
        score: 82,
        grade: "B",
        status: "watch",
        headline: "Snapshot",
        componentScores: [],
        metrics: {
          totalResourcesReviewed: 1,
          triageItemCount: 0,
          criticalTriageCount: 0,
          reconciliationIssueCount: 0,
          automationSkipCount: 0,
          policyReviewCount: 0,
          blockedWorkflowCount: 0,
          maintenanceReopenCount: 0,
        },
      },
    });

    renderPage();
    fireEvent.change(screen.getByLabelText(/Portfolio ID/i), { target: { value: "portfolio-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Load history/i }));
    expect(await screen.findByText(/Failed to load portfolio score history: Boom/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create snapshot/i }));
    await waitFor(() => {
      expect(vi.mocked(createPortfolioScoreSnapshot)).toHaveBeenCalledWith("portfolio-1");
      expect(vi.mocked(fetchPortfolioScoreTrend)).toHaveBeenCalledTimes(2);
    });
    expect(await screen.findByText(/No score snapshots have been stored yet/i)).toBeInTheDocument();
  });
});
