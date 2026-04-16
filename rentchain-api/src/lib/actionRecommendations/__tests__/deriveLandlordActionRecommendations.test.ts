import { describe, expect, it } from "vitest";
import { deriveLandlordActionRecommendations } from "../deriveLandlordActionRecommendations";

describe("deriveLandlordActionRecommendations", () => {
  it("returns low-priority stabilizing actions for a healthy portfolio", () => {
    const recommendations = deriveLandlordActionRecommendations({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "healthy",
          headline: "Healthy",
          summary: "Healthy",
        },
        trend: {
          direction: "improving",
          summary: "Improving",
        },
        dimensions: [
          { key: "screening_health", label: "Screening health", status: "healthy", summary: "Healthy" },
          { key: "maintenance_health", label: "Maintenance health", status: "healthy", summary: "Healthy" },
          { key: "workflow_health", label: "Workflow health", status: "healthy", summary: "Healthy" },
          { key: "response_health", label: "Response health", status: "healthy", summary: "Healthy" },
        ],
        nextFocus: [],
        metadata: {
          portfolioScoreGrade: "A",
          portfolioScoreAvailable: true,
          trendAvailable: true,
        },
      },
      portfolioScore: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        score: 92,
        grade: "A",
        summary: {
          headline: "Strong",
          explanation: "Recent portfolio activity has been consistent and well balanced.",
        },
        trend: {
          direction: "improving",
          summary: "Improving",
        },
        components: [],
        trust: {
          explanation: "Trust",
          methodologyNote: "Methodology",
        },
      },
    });

    expect(recommendations.length).toBeGreaterThanOrEqual(2);
    expect(recommendations.every((item) => item.priority === "low")).toBe(true);
  });

  it("returns high-priority recommendations for a declining portfolio", () => {
    const recommendations = deriveLandlordActionRecommendations({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "attention_needed",
          headline: "Attention needed",
          summary: "Attention needed",
        },
        trend: {
          direction: "declining",
          summary: "Declining",
        },
        dimensions: [
          { key: "screening_health", label: "Screening health", status: "watch", summary: "Watch" },
          { key: "maintenance_health", label: "Maintenance health", status: "attention_needed", summary: "Attention" },
          { key: "workflow_health", label: "Workflow health", status: "healthy", summary: "Healthy" },
          { key: "response_health", label: "Response health", status: "watch", summary: "Watch" },
        ],
        nextFocus: [],
        metadata: {
          portfolioScoreGrade: "D",
          portfolioScoreAvailable: true,
          trendAvailable: true,
        },
      },
      portfolioScore: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        score: 61,
        grade: "D",
        summary: {
          headline: "Needs attention",
          explanation: "Needs attention",
        },
        trend: {
          direction: "declining",
          summary: "Declining",
        },
        components: [],
        trust: {
          explanation: "Trust",
          methodologyNote: "Methodology",
        },
      },
    });

    expect(recommendations.some((item) => item.priority === "high")).toBe(true);
    expect(recommendations.some((item) => item.category === "portfolio_health")).toBe(true);
  });

  it("returns conservative recommendations for sparse data", () => {
    const recommendations = deriveLandlordActionRecommendations({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "watch",
          headline: "Developing",
          summary: "Developing",
        },
        trend: {
          direction: "insufficient_data",
          summary: "Developing",
        },
        dimensions: [],
        nextFocus: [],
        metadata: {
          portfolioScoreGrade: null,
          portfolioScoreAvailable: true,
          trendAvailable: false,
        },
      },
      portfolioScore: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        score: 75,
        grade: "C",
        summary: {
          headline: "Taking shape",
          explanation: "Your portfolio score will become more precise as more activity is recorded.",
        },
        trend: {
          direction: "insufficient_data",
          summary: "Developing",
        },
        components: [],
        trust: {
          explanation: "Trust",
          methodologyNote: "Methodology",
        },
      },
    });

    expect(recommendations).toHaveLength(2);
    expect(recommendations.every((item) => item.priority !== "high")).toBe(true);
  });

  it("does not emit duplicate recommendation categories", () => {
    const recommendations = deriveLandlordActionRecommendations({
      portfolioHealth: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        overall: {
          status: "watch",
          headline: "Watch",
          summary: "Watch",
        },
        trend: {
          direction: "stable",
          summary: "Stable",
        },
        dimensions: [
          { key: "screening_health", label: "Screening health", status: "watch", summary: "Watch" },
          { key: "screening_health", label: "Screening health", status: "watch", summary: "Watch" } as any,
        ],
        nextFocus: [],
        metadata: {
          portfolioScoreGrade: "C",
          portfolioScoreAvailable: true,
          trendAvailable: true,
        },
      },
      portfolioScore: {
        version: "v1",
        portfolioId: "landlord-1",
        generatedAt: "2026-04-16T12:00:00.000Z",
        score: 75,
        grade: "C",
        summary: {
          headline: "Stable",
          explanation: "Stable",
        },
        trend: {
          direction: "stable",
          summary: "Stable",
        },
        components: [],
        trust: {
          explanation: "Trust",
          methodologyNote: "Methodology",
        },
      },
    });

    const categories = recommendations.map((item) => item.category);
    expect(new Set(categories).size).toBe(categories.length);
  });
});
