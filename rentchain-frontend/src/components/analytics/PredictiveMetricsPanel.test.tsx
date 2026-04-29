import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PredictiveMetricsPanel from "./PredictiveMetricsPanel";

describe("PredictiveMetricsPanel", () => {
  it("renders landlord-readable support lines and hides raw support keys", () => {
    render(
      <PredictiveMetricsPanel
        metrics={[
          {
            key: "projected_vacancy_risk",
            label: "Projected vacancy risk",
            riskLevel: "medium",
            status: "supported",
            explanation: "Vacancy pressure is present in the current view, but it is not yet at the highest-risk threshold.",
            supportingValues: {
              vacancyRate: 0.2,
              topPropertyId: "prop-2",
              vacantUnits: 1,
            },
          },
        ]}
      />
    );

    expect(screen.getByText(/Current vacancy: 20%/i)).toBeInTheDocument();
    expect(screen.getByText(/Vacant units: 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/topPropertyId/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/prop-2/i)).not.toBeInTheDocument();
  });
});
