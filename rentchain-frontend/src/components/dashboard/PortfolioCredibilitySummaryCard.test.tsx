import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PortfolioCredibilitySummaryCard } from "./PortfolioCredibilitySummaryCard";

afterEach(() => {
  cleanup();
});

describe("PortfolioCredibilitySummaryCard", () => {
  it("renders the portfolio summary metrics when data is available", () => {
    render(
      <PortfolioCredibilitySummaryCard
        summary={{
          propertyCount: 3,
          activeLeaseCount: 5,
          tenantScoreAverage: 77,
          tenantScoreGradeAverage: "B",
          leaseRiskAverage: 69,
          leaseRiskGradeAverage: "C",
          tenantsWithScoreCount: 4,
          leasesWithRiskCount: 5,
          lowConfidenceCount: 2,
          missingCredibilityCount: 1,
          healthStatus: "watch",
        }}
      />
    );

    expect(screen.getByText("Portfolio credibility summary")).toBeInTheDocument();
    expect(screen.getByText("Watch")).toBeInTheDocument();
    expect(screen.getByText("Properties represented")).toBeInTheDocument();
    expect(screen.getByText("Missing credibility")).toBeInTheDocument();
  });

  it("renders the empty state when no summary data is available", () => {
    render(<PortfolioCredibilitySummaryCard summary={null} />);

    expect(
      screen.getByText("Portfolio credibility summary will appear as lease and tenant history becomes available.")
    ).toBeInTheDocument();
  });

  it("renders the empty state for unknown health status", () => {
    render(
      <PortfolioCredibilitySummaryCard
        summary={{
          propertyCount: 0,
          activeLeaseCount: 0,
          tenantScoreAverage: null,
          tenantScoreGradeAverage: null,
          leaseRiskAverage: null,
          leaseRiskGradeAverage: null,
          tenantsWithScoreCount: 0,
          leasesWithRiskCount: 0,
          lowConfidenceCount: 0,
          missingCredibilityCount: 0,
          healthStatus: "unknown",
        }}
      />
    );

    expect(
      screen.getByText("Portfolio credibility summary will appear as lease and tenant history becomes available.")
    ).toBeInTheDocument();
  });
});
