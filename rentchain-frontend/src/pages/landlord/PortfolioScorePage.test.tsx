import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PortfolioScorePage from "./PortfolioScorePage";

const showToast = vi.fn();

vi.mock("../../api/landlordPortfolioScoreApi", () => ({
  fetchLandlordPortfolioScore: vi.fn(),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: vi.fn(),
}));

vi.mock("../../api/landlordPortfolioScoreSharingApi", () => ({
  fetchPortfolioScoreSharing: vi.fn(),
  updatePortfolioScoreSharing: vi.fn(),
  rotatePortfolioScoreSharingToken: vi.fn(),
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
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
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

describe("PortfolioScorePage", () => {
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

  it("renders a high score safely", async () => {
    await mockEntitlements();
    const { fetchLandlordPortfolioScore } = await import("../../api/landlordPortfolioScoreApi");
    const { fetchPortfolioScoreSharing } = await import("../../api/landlordPortfolioScoreSharingApi");
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
    vi.mocked(fetchPortfolioScoreSharing).mockResolvedValue({
      sharing: {
        version: "v1",
        portfolioId: "landlord-1",
        visibility: "private",
        shareToken: null,
        updatedAt: "2026-04-16T12:00:00.000Z",
      },
      shareUrl: null,
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
    expect(screen.getByText(/Sharing visibility/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Private/i).length).toBeGreaterThan(0);
  });

  it("renders sparse data safely", async () => {
    await mockEntitlements();
    const { fetchLandlordPortfolioScore } = await import("../../api/landlordPortfolioScoreApi");
    const { fetchPortfolioScoreSharing } = await import("../../api/landlordPortfolioScoreSharingApi");
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
    vi.mocked(fetchPortfolioScoreSharing).mockResolvedValue({
      sharing: {
        version: "v1",
        portfolioId: "landlord-1",
        visibility: "landlord_visible",
        shareToken: null,
        updatedAt: "2026-04-16T12:00:00.000Z",
      },
      shareUrl: null,
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
    await mockEntitlements();
    const { fetchLandlordPortfolioScore } = await import("../../api/landlordPortfolioScoreApi");
    const { fetchPortfolioScoreSharing } = await import("../../api/landlordPortfolioScoreSharingApi");
    vi.mocked(fetchLandlordPortfolioScore).mockRejectedValue(new Error("Boom"));
    vi.mocked(fetchPortfolioScoreSharing).mockResolvedValue({
      sharing: {
        version: "v1",
        portfolioId: "landlord-1",
        visibility: "private",
        shareToken: null,
        updatedAt: "2026-04-16T12:00:00.000Z",
      },
      shareUrl: null,
    } as any);

    render(
      <MemoryRouter>
        <PortfolioScorePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load portfolio score: Boom/i)).toBeInTheDocument();
  });

  it("shows share url controls when sharing is enabled", async () => {
    await mockEntitlements();
    const { fetchLandlordPortfolioScore } = await import("../../api/landlordPortfolioScoreApi");
    const { fetchPortfolioScoreSharing } = await import("../../api/landlordPortfolioScoreSharingApi");
    vi.mocked(fetchLandlordPortfolioScore).mockResolvedValue({
      portfolioScore: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        score: 84,
        grade: "B",
        summary: {
          headline: "Your portfolio is stable with some areas to monitor.",
          explanation: "Operations are generally steady overall.",
        },
        trend: {
          direction: "stable",
          summary: "Your portfolio score has remained generally steady.",
        },
        components: [],
        trust: {
          explanation: "Your score reflects how consistently your rental operations are performing over time.",
          methodologyNote: "Scores are based on activity patterns, workflow completion, and operational consistency over time.",
        },
      },
    } as any);
    vi.mocked(fetchPortfolioScoreSharing).mockResolvedValue({
      sharing: {
        version: "v1",
        portfolioId: "landlord-1",
        visibility: "shareable_link",
        shareToken: "token-1",
        shareEnabledAt: "2026-04-16T12:00:00.000Z",
        updatedAt: "2026-04-16T12:00:00.000Z",
      },
      shareUrl: "/portfolio-score/shared/token-1",
    } as any);

    render(
      <MemoryRouter>
        <PortfolioScorePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Share URL/i)).toBeInTheDocument();
    expect(screen.getByText(/token-1/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rotate link/i })).toBeInTheDocument();
  });

  it("renders a locked state when portfolio score is unavailable", async () => {
    await mockEntitlements({ canViewPortfolioScore: false });
    const { fetchLandlordPortfolioScore } = await import("../../api/landlordPortfolioScoreApi");
    const { fetchPortfolioScoreSharing } = await import("../../api/landlordPortfolioScoreSharingApi");

    render(
      <MemoryRouter>
        <PortfolioScorePage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Unlock Portfolio Score™ on Pro/i)).toBeInTheDocument();
    expect(vi.mocked(fetchLandlordPortfolioScore)).not.toHaveBeenCalled();
    expect(vi.mocked(fetchPortfolioScoreSharing)).not.toHaveBeenCalled();
  });

  it("shows a recommendations teaser when the score is unlocked but recommendations are not", async () => {
    await mockEntitlements({ canViewActionRecommendations: false });
    const { fetchLandlordPortfolioScore } = await import("../../api/landlordPortfolioScoreApi");
    const { fetchPortfolioScoreSharing } = await import("../../api/landlordPortfolioScoreSharingApi");
    vi.mocked(fetchLandlordPortfolioScore).mockResolvedValue({
      portfolioScore: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        score: 88,
        grade: "B",
        summary: {
          headline: "Your portfolio is steady overall.",
          explanation: "Operations are generally steady overall.",
        },
        trend: {
          direction: "stable",
          summary: "Your portfolio score has remained generally steady.",
        },
        components: [],
        trust: {
          explanation: "Your score reflects how consistently your rental operations are performing over time.",
          methodologyNote: "Scores are based on activity patterns, workflow completion, and operational consistency over time.",
        },
      },
    } as any);
    vi.mocked(fetchPortfolioScoreSharing).mockResolvedValue({
      sharing: {
        version: "v1",
        portfolioId: "landlord-1",
        visibility: "private",
        shareToken: null,
        updatedAt: "2026-04-16T12:00:00.000Z",
      },
      shareUrl: null,
    } as any);

    render(
      <MemoryRouter>
        <PortfolioScorePage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Unlock recommended actions on Elite/i)).toBeInTheDocument();
  });
});
