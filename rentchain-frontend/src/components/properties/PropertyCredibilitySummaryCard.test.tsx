import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PropertyCredibilitySummaryCard } from "./PropertyCredibilitySummaryCard";

afterEach(() => {
  cleanup();
});

describe("PropertyCredibilitySummaryCard", () => {
  it("renders the summary metrics when data is available", () => {
    render(
      <PropertyCredibilitySummaryCard
        summary={{
          propertyId: "prop-1",
          tenantScoreAverage: 79,
          tenantScoreGradeAverage: "B",
          leaseRiskAverage: 68,
          leaseRiskGradeAverage: "C",
          activeLeaseCount: 4,
          tenantsWithScoreCount: 3,
          leasesWithRiskCount: 4,
          lowConfidenceCount: 1,
          missingCredibilityCount: 1,
          healthStatus: "watch",
        }}
      />
    );

    expect(screen.getByText("Property credibility summary")).toBeInTheDocument();
    expect(screen.getByText("Watch")).toBeInTheDocument();
    expect(screen.getByText("Active leases")).toBeInTheDocument();
    expect(screen.getByText("Missing credibility")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("renders the empty state when no summary data is available", () => {
    render(<PropertyCredibilitySummaryCard summary={null} />);

    expect(
      screen.getByText("Credibility summary will appear as lease and tenant history becomes available.")
    ).toBeInTheDocument();
  });

  it("renders the empty state for unknown health status", () => {
    render(
      <PropertyCredibilitySummaryCard
        summary={{
          propertyId: "prop-1",
          tenantScoreAverage: null,
          tenantScoreGradeAverage: null,
          leaseRiskAverage: null,
          leaseRiskGradeAverage: null,
          activeLeaseCount: 0,
          tenantsWithScoreCount: 0,
          leasesWithRiskCount: 0,
          lowConfidenceCount: 0,
          missingCredibilityCount: 0,
          healthStatus: "unknown",
        }}
      />
    );

    expect(
      screen.getByText("Credibility summary will appear as lease and tenant history becomes available.")
    ).toBeInTheDocument();
  });
});
