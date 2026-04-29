import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AdminObservabilityPage from "./AdminObservabilityPage";

const showToast = vi.fn();

vi.mock("../../api/adminObservabilityApi", () => ({
  fetchAdminObservabilitySummary: vi.fn(),
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

describe("AdminObservabilityPage", () => {
  it("renders totals, workflow health rows, and top issues", async () => {
    const { fetchAdminObservabilitySummary } = await import("../../api/adminObservabilityApi");
    vi.mocked(fetchAdminObservabilitySummary).mockResolvedValue({
      generatedAt: "2026-04-28T18:00:00.000Z",
      totals: {
        openCritical: 1,
        openWarnings: 2,
        resolvedLast7Days: 4,
      },
      workflows: [
        {
          workflow: "payment",
          openCritical: 0,
          openWarnings: 1,
          recentCompleted: 2,
          health: "watch",
        },
      ],
      topIssues: [
        {
          title: "Rent payment failed",
          workflow: "payment",
          severity: "warning",
          count: 2,
          lastSeenAt: "2026-04-28T17:00:00.000Z",
        },
      ],
    });

    render(
      <MemoryRouter>
        <AdminObservabilityPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Workflow health")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open critical").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open warnings").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recent completions").length).toBeGreaterThan(0);
    expect(screen.getByText("Payment")).toBeInTheDocument();
    expect(screen.getByText("Rent payment failed")).toBeInTheDocument();
    expect(screen.queryByText("resourceId")).not.toBeInTheDocument();
  });

  it("renders an empty state when no workflow data exists", async () => {
    const { fetchAdminObservabilitySummary } = await import("../../api/adminObservabilityApi");
    vi.mocked(fetchAdminObservabilitySummary).mockResolvedValue({
      generatedAt: "2026-04-28T18:00:00.000Z",
      totals: {
        openCritical: 0,
        openWarnings: 0,
        resolvedLast7Days: 0,
      },
      workflows: [],
      topIssues: [],
    });

    render(
      <MemoryRouter>
        <AdminObservabilityPage />
      </MemoryRouter>
    );

    expect(
      await screen.findByText("No workflow health issues or recent completions are available right now.")
    ).toBeInTheDocument();
  });

  it("renders an error state without leaking operational details", async () => {
    const { fetchAdminObservabilitySummary } = await import("../../api/adminObservabilityApi");
    vi.mocked(fetchAdminObservabilitySummary).mockRejectedValue(new Error("summary_failed"));

    render(
      <MemoryRouter>
        <AdminObservabilityPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Failed to load workflow health: summary_failed")).toBeInTheDocument();
    expect(showToast).toHaveBeenCalled();
  });
});
