import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ReviewTimelinePage from "./ReviewTimelinePage";

const apiMocks = vi.hoisted(() => ({
  fetchReviewTimeline: vi.fn(),
  showToast: vi.fn(),
  macShellProps: vi.fn(),
}));

vi.mock("@/api/reviewTimelineApi", async () => {
  const actual = await vi.importActual<any>("@/api/reviewTimelineApi");
  return {
    ...actual,
    fetchReviewTimeline: apiMocks.fetchReviewTimeline,
  };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: apiMocks.showToast }),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: { children: React.ReactNode; showTopNav?: boolean }) => {
    apiMocks.macShellProps(props);
    return <div>{children}</div>;
  },
}));

function timeline() {
  return {
    timelineId: "canonical_review_timeline:decision:landlord-1:decision-1",
    scope: "decision",
    scopeId: "decision-1",
    generatedAt: "2026-05-05T12:00:00.000Z",
    manualReviewRequired: true,
    externalSharingEnabled: false,
    certificationIssued: false,
    summary: { total: 1, reviewRequired: 1, blocked: 0, completed: 0, redacted: 0 },
    filters: { entryType: ["decision"], status: ["review_required"], source: ["decision_inbox"] },
    entries: [{
      timelineEntryId: "entry-1",
      entryType: "decision",
      timestamp: "2026-05-05T12:00:00.000Z",
      label: "Review overdue rent",
      description: "Rent is overdue.",
      status: "review_required",
      actor: { type: "system", id: null },
      source: "decision_inbox",
      sourceId: "decision-1",
      destination: "/leases/lease-1/ledger",
      redacted: false,
      redactionReason: null,
      blockedReason: null,
      manualOnly: true,
    }],
  };
}

describe("ReviewTimelinePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchReviewTimeline.mockResolvedValue(timeline());
  });

  afterEach(() => cleanup());

  it("renders canonical review timeline from query params", async () => {
    render(
      <MemoryRouter initialEntries={["/review-timeline?scope=decision&scopeId=decision-1"]}>
        <ReviewTimelinePage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Canonical review timeline", level: 1 })).toBeInTheDocument();
    expect(apiMocks.fetchReviewTimeline).toHaveBeenCalledWith({
      scope: "decision",
      scopeId: "decision-1",
      entryType: "all",
      status: "all",
      source: "all",
    });
    expect(screen.getByText("Review overdue rent")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /approve|certify|auto-resolve|submit|file|legal approval|auto-report/i })).not.toBeInTheDocument();
    expect(apiMocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));
  });

  it("loads filtered timeline after filter selection", async () => {
    render(
      <MemoryRouter initialEntries={["/review-timeline?scope=decision&scopeId=decision-1"]}>
        <ReviewTimelinePage />
      </MemoryRouter>
    );

    await screen.findByText("Review overdue rent");
    fireEvent.change(screen.getByLabelText("Entry type"), { target: { value: "decision" } });
    fireEvent.click(screen.getByRole("button", { name: "Filter timeline" }));

    await waitFor(() => {
      expect(apiMocks.fetchReviewTimeline).toHaveBeenCalledWith({
        scope: "decision",
        scopeId: "decision-1",
        entryType: "decision",
        status: "all",
        source: "all",
      });
    });
  });
});
