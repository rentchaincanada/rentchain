import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ActionRecommendationsPage from "./ActionRecommendationsPage";

const showToast = vi.fn();

vi.mock("../../api/landlordAnalyticsApi", () => ({
  fetchLandlordAnalyticsSnapshot: vi.fn(),
  markLandlordDecisionReviewed: vi.fn(),
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
  Card: ({ children, elevated: _elevated, ...props }: any) => <div {...props}>{children}</div>,
  Section: ({ children }: any) => <section>{children}</section>,
}));

vi.mock("@/components/billing/LockedFeature", () => ({
  LockedFeature: ({ title, description, hint }: { title: string; description: string; hint?: string }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      {hint ? <div>{hint}</div> : null}
    </div>
  ),
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

describe("ActionRecommendationsPage", () => {
  function mockEntitlements(overrides?: Record<string, any>) {
    return import("@/hooks/useEntitlements").then(({ useEntitlements }) => {
      vi.mocked(useEntitlements).mockReturnValue({
        loading: false,
        canViewPortfolioScore: true,
        canViewActionRecommendations: true,
        hasCapability: (key: string) => key === "portfolio_analytics",
        ...overrides,
      } as any);
    });
  }

  it("renders centralized inbox decisions from the analytics snapshot in server order", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockResolvedValue({
      decisions: {
        items: [
          {
            id: "review_lease_renewals",
            decisionType: "review_lease_renewals",
            priority: "medium",
            explanation: "Several leases are approaching renewal windows and need attention.",
            recommendedAction: "Review renewals",
            href: "/leases?status=expiring",
            state: "pending",
            reviewedAt: null,
            supportingSignals: [],
          },
          {
            id: "reduce_vacancy_risk:prop-2",
            decisionType: "reduce_vacancy_risk",
            priority: "high",
            explanation: "Vacancy pressure is concentrated in Beta and needs follow-through now.",
            recommendedAction: "Review vacancy plan",
            href: "/analytics?propertyId=prop-2",
            state: "pending",
            reviewedAt: null,
            supportingSignals: [],
          },
        ],
      },
    } as any);

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /Decision inbox/i })).toBeInTheDocument();
    expect(screen.getByText(/centralized decision inbox/i)).toBeInTheDocument();
    expect(fetchLandlordAnalyticsSnapshot).toHaveBeenCalledTimes(1);

    const actionLinks = screen.getAllByRole("link");
    expect(actionLinks.map((node) => node.textContent)).toEqual(["Review renewals", "Review vacancy plan"]);
  });

  it("renders a clean empty state when the snapshot has no decisions", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockResolvedValue({
      decisions: {
        items: [],
      },
    } as any);

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No prioritized landlord actions are surfaced for this view right now/i)).toBeInTheDocument();
  });

  it("renders an error state cleanly when the snapshot request fails", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockRejectedValue(new Error("Boom"));

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load recommended actions: Boom/i)).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to load recommended actions",
        description: "Boom",
      })
    );
  });

  it("shows an analytics upgrade teaser when action recommendations are enabled but analytics decisions are not", async () => {
    await mockEntitlements({
      canViewActionRecommendations: true,
      canViewPortfolioScore: true,
      hasCapability: () => false,
    });
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Unlock decision inbox on Elite/i)).toBeInTheDocument();
    expect(vi.mocked(fetchLandlordAnalyticsSnapshot)).not.toHaveBeenCalled();
  });

  it("shows a recommendations teaser when analytics is available but inbox access is not", async () => {
    await mockEntitlements({
      canViewActionRecommendations: false,
      canViewPortfolioScore: true,
    });
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Unlock recommended actions on Elite/i)).toBeInTheDocument();
    expect(vi.mocked(fetchLandlordAnalyticsSnapshot)).not.toHaveBeenCalled();
  });

  it("renders a locked state when portfolio score access is unavailable", async () => {
    await mockEntitlements({
      canViewPortfolioScore: false,
      canViewActionRecommendations: false,
      hasCapability: () => false,
    });
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Unlock recommended actions on Elite/i)).toBeInTheDocument();
    expect(screen.getByText(/portfolio score, analytics, and decision inbox access unlock/i)).toBeInTheDocument();
    expect(vi.mocked(fetchLandlordAnalyticsSnapshot)).not.toHaveBeenCalled();
  });
});
