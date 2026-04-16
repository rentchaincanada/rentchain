import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import PortfolioScorePage from "./PortfolioScorePage";

const showToast = vi.fn();

vi.mock("../../api/portfolioScoreApi", () => ({
  fetchPortfolioScore: vi.fn(),
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

function renderPage(initialEntry = "/admin/portfolio-score") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/admin/portfolio-score" element={<PortfolioScorePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("PortfolioScorePage", () => {
  it("renders score, grade, headline, component table, and metrics", async () => {
    const { fetchPortfolioScore } = await import("../../api/portfolioScoreApi");
    vi.mocked(fetchPortfolioScore).mockResolvedValue({
      portfolioScore: {
        version: "v1",
        portfolioId: "portfolio-1",
        generatedAt: "2026-04-15T12:00:00.000Z",
        score: 82,
        grade: "B",
        summary: {
          status: "watch",
          headline: "Portfolio is stable overall, but screening exceptions need attention.",
          notes: ["Critical triage burden is low."],
        },
        components: [
          {
            key: "workflow_completion",
            label: "Workflow completion",
            rawValue: 0.88,
            normalizedScore: 88,
            weight: 0.25,
            contribution: 22,
            reasons: ["Most reviewed workflows reached a healthy completed state."],
          },
        ],
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
    });

    renderPage("/admin/portfolio-score?portfolioId=portfolio-1");

    expect(await screen.findByText(/Portfolio is stable overall, but screening exceptions need attention/i)).toBeInTheDocument();
    expect(screen.getByText(/^B$/i)).toBeInTheDocument();
    expect(screen.getByText(/Workflow completion/i)).toBeInTheDocument();
    expect(screen.getByText(/Resources reviewed/i)).toBeInTheDocument();
    expect(screen.getByText(/^12$/)).toBeInTheDocument();
  });

  it("renders an empty state before lookup", () => {
    renderPage();
    expect(
      screen.getByText(/Enter a portfolio ID to inspect the score, component breakdown, and operational metrics/i)
    ).toBeInTheDocument();
  });

  it("renders an error state", async () => {
    const { fetchPortfolioScore } = await import("../../api/portfolioScoreApi");
    vi.mocked(fetchPortfolioScore).mockRejectedValue(new Error("Boom"));

    renderPage();
    fireEvent.change(screen.getByLabelText(/Portfolio ID/i), { target: { value: "portfolio-1" } });
    fireEvent.click(screen.getByRole("button", { name: /Load portfolio score/i }));

    expect(await screen.findByText(/Failed to load portfolio score: Boom/i)).toBeInTheDocument();
  });
});
