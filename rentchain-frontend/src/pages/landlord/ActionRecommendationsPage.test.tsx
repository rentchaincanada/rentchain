import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ActionRecommendationsPage from "./ActionRecommendationsPage";

const showToast = vi.fn();

vi.mock("../../api/landlordActionRecommendationsApi", () => ({
  fetchLandlordActionRecommendations: vi.fn(),
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
  Pill: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  Section: ({ children }: any) => <section>{children}</section>,
}));

vi.mock("@/components/billing/LockedFeature", () => ({
  LockedFeature: ({ title, description }: { title: string; description: string }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
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
        ...overrides,
      } as any);
    });
  }

  it("renders recommendation cards correctly", async () => {
    await mockEntitlements();
    const { fetchLandlordActionRecommendations } = await import("../../api/landlordActionRecommendationsApi");
    vi.mocked(fetchLandlordActionRecommendations).mockResolvedValue({
      recommendations: [
        {
          version: "v1",
          id: "screening-follow-through",
          category: "screening_follow_through",
          priority: "high",
          title: "Keep application follow-through moving",
          summary: "Application and screening activity may need steadier follow-through right now.",
          whyNow: "Recent portfolio direction suggests screening-related activity may be contributing to softer health.",
          suggestedAction: "Review current application activity and keep screening progress moving where possible.",
          relatedArea: "screening",
          navigation: {
            path: "/portfolio-health",
            label: "Review portfolio health",
          },
        },
      ],
    } as any);

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Keep application follow-through moving/i)).toBeInTheDocument();
    expect(screen.getByText(/High priority/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Review portfolio health/i })).toBeInTheDocument();
  });

  it("renders sparse-data recommendations safely", async () => {
    await mockEntitlements();
    const { fetchLandlordActionRecommendations } = await import("../../api/landlordActionRecommendationsApi");
    vi.mocked(fetchLandlordActionRecommendations).mockResolvedValue({
      recommendations: [
        {
          version: "v1",
          id: "workflow-completion",
          category: "workflow_completion",
          priority: "medium",
          title: "Keep portfolio activity moving steadily",
          summary: "Your portfolio visibility is still developing, so steady follow-through matters most right now.",
          whyNow: "More consistent portfolio activity will make health trends and recommendations more useful over time.",
          suggestedAction: "Review new portfolio activity regularly and keep next steps moving where possible.",
        },
      ],
    } as any);

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/visibility is still developing/i)).toBeInTheDocument();
  });

  it("renders an error state cleanly", async () => {
    await mockEntitlements();
    const { fetchLandlordActionRecommendations } = await import("../../api/landlordActionRecommendationsApi");
    vi.mocked(fetchLandlordActionRecommendations).mockRejectedValue(new Error("Boom"));

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load recommended actions: Boom/i)).toBeInTheDocument();
  });

  it("renders a teaser when score is available but recommendations are not", async () => {
    await mockEntitlements({ canViewActionRecommendations: false, canViewPortfolioScore: true });
    const { fetchLandlordActionRecommendations } = await import("../../api/landlordActionRecommendationsApi");

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Unlock recommended actions on Elite/i)).toBeInTheDocument();
    expect(vi.mocked(fetchLandlordActionRecommendations)).not.toHaveBeenCalled();
  });

  it("renders a locked state when higher-tier intelligence is unavailable", async () => {
    await mockEntitlements({ canViewActionRecommendations: false, canViewPortfolioScore: false });
    const { fetchLandlordActionRecommendations } = await import("../../api/landlordActionRecommendationsApi");

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Unlock recommended actions on Elite/i)).toBeInTheDocument();
    expect(vi.mocked(fetchLandlordActionRecommendations)).not.toHaveBeenCalled();
  });
});
