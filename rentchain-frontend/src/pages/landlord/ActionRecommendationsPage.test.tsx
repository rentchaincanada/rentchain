import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ActionRecommendationsPage from "./ActionRecommendationsPage";

const showToast = vi.fn();

vi.mock("../../api/landlordActionRecommendationsApi", () => ({
  fetchLandlordActionRecommendations: vi.fn(),
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

beforeEach(() => {
  showToast.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ActionRecommendationsPage", () => {
  it("renders recommendation cards correctly", async () => {
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
    const { fetchLandlordActionRecommendations } = await import("../../api/landlordActionRecommendationsApi");
    vi.mocked(fetchLandlordActionRecommendations).mockRejectedValue(new Error("Boom"));

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load recommended actions: Boom/i)).toBeInTheDocument();
  });
});
