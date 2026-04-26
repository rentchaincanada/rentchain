import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TrendDeltaBadge from "./TrendDeltaBadge";

describe("TrendDeltaBadge", () => {
  it("renders plain-English comparison copy for meaningful deltas", () => {
    render(
      <TrendDeltaBadge
        delta={{
          current: 0.2,
          prior: 0.1,
          absoluteDelta: 0.1,
          relativeDelta: 1,
          direction: "worse",
        }}
        periodLabel="90 days"
        formatAbsoluteDelta={(value) => `${Math.round(value * 100)}%`}
      />
    );

    expect(screen.getByLabelText(/Trend delta: Worsened/i)).toBeInTheDocument();
    expect(screen.getByText(/vs prior 90 days/i)).toBeInTheDocument();
  });

  it("renders a calm fallback when no prior comparison is available", () => {
    render(
      <TrendDeltaBadge
        delta={{
          current: 2,
          prior: null,
          absoluteDelta: null,
          relativeDelta: null,
          direction: "insufficient_data",
        }}
        periodLabel="30 days"
      />
    );

    expect(screen.getByLabelText(/Trend delta: No comparison yet/i)).toBeInTheDocument();
    expect(screen.getByText(/No prior-period comparison available yet/i)).toBeInTheDocument();
  });
});
