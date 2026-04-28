import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandlordInboxPage from "./LandlordInboxPage";

const apiMocks = vi.hoisted(() => ({
  fetchLandlordInbox: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../api/landlordAnalyticsApi", async () => {
  const actual = await vi.importActual<any>("../../api/landlordAnalyticsApi");
  return {
    ...actual,
    fetchLandlordInbox: apiMocks.fetchLandlordInbox,
  };
});

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({
    showToast: apiMocks.showToast,
  }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("LandlordInboxPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders grouped inbox items with safe links", async () => {
    apiMocks.fetchLandlordInbox.mockResolvedValue({
      items: [
        {
          id: "application:app-1",
          type: "application",
          subjectId: "app-1",
          applicationId: "app-1",
          leaseId: null,
          title: "Application ready for review",
          description: "Current application context is ready for landlord review.",
          priority: "medium",
          status: "action_required",
          nextAction: "review_application",
          nextActionHref: "/applications/app-1/review-summary",
          trustSummary: {
            readiness: "ready",
            verificationLevel: "partial",
          },
        credibilitySummary: {
          completenessLevel: "medium",
        },
        networkReuseSummary: {
          reusable: true,
          source: "apply_with_rentchain",
          reuseStatus: "available",
          consentRequired: true,
        },
        source: "review_summary",
      },
      ],
      summary: {
        actionRequired: 1,
        pending: 0,
        completed: 0,
      },
    });

    render(
      <MemoryRouter>
        <LandlordInboxPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Landlord inbox" })).toBeInTheDocument();
    expect(screen.getByText("Application ready for review")).toBeInTheDocument();
    expect(screen.getByText(/Credibility completeness: medium/i)).toBeInTheDocument();
    expect(screen.getByText(/Reuse available · Source: RentChain application/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review application" })).toHaveAttribute(
      "href",
      "/applications/app-1/review-summary"
    );
  });

  it("renders an empty state safely", async () => {
    apiMocks.fetchLandlordInbox.mockImplementation(async () => ({
      items: [],
      summary: {
        actionRequired: 0,
        pending: 0,
        completed: 0,
      },
    }));

    render(
      <MemoryRouter>
        <LandlordInboxPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Inbox summary/i, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(/No action required items are visible right now/i)).toBeInTheDocument();
    expect(screen.getByText(/No pending items are visible right now/i)).toBeInTheDocument();
    expect(screen.getByText(/No completed items are visible right now/i)).toBeInTheDocument();
  });
});
