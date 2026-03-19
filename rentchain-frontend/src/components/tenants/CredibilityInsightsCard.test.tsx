import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CredibilityInsightsCard } from "./CredibilityInsightsCard";

afterEach(() => {
  cleanup();
});

describe("CredibilityInsightsCard", () => {
  it("renders both tenant score and lease risk summaries", () => {
    render(
      <CredibilityInsightsCard
        insights={{
          tenantScore: {
            score: 78,
            grade: "B",
            confidence: 0.82,
            generatedAt: "2026-03-18T10:00:00.000Z",
            trend: "up",
            signals: ["Consistent lease history", "Improved recent risk"],
            recommendations: ["Review at renewal"],
          },
          leaseRisk: {
            score: 64,
            grade: "C",
            confidence: 0.74,
            generatedAt: "2026-03-18T10:00:00.000Z",
            flags: ["High rent-to-income"],
            recommendations: ["Verify income documents"],
          },
        }}
      />
    );

    expect(screen.getByText("Tenant credibility insights")).toBeInTheDocument();
    expect(screen.getByText("Tenant Score")).toBeInTheDocument();
    expect(screen.getByText("Lease Risk")).toBeInTheDocument();
    expect(screen.getByText("Trend: Improving")).toBeInTheDocument();
    expect(screen.getByText("Consistent lease history")).toBeInTheDocument();
    expect(screen.getByText("High rent-to-income")).toBeInTheDocument();
  });

  it("renders partial insight data safely", () => {
    render(
      <CredibilityInsightsCard
        insights={{
          tenantScore: null,
          leaseRisk: {
            score: 71,
            grade: "B",
            confidence: 0.8,
            generatedAt: null,
            flags: [],
            recommendations: [],
          },
        }}
      />
    );

    expect(screen.getByText("Lease Risk")).toBeInTheDocument();
    expect(screen.queryByText("Trend: Improving")).not.toBeInTheDocument();
    expect(screen.getByText("No notable signals yet.")).toBeInTheDocument();
  });

  it("renders the empty state when no credibility data exists", () => {
    render(<CredibilityInsightsCard insights={{ tenantScore: null, leaseRisk: null }} />);

    expect(
      screen.getByText("Credibility insights will appear as lease and tenant history becomes available.")
    ).toBeInTheDocument();
  });
});
