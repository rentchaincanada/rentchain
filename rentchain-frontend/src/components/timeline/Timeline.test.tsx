import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Timeline } from "./Timeline";

describe("Timeline", () => {
  it("renders grouped timeline items", () => {
    render(
      <Timeline
        items={[
          {
            id: "event-1",
            title: "Lease activated",
            description: "Lease activated for unit 4.",
            timestamp: "2026-04-03T10:15:00.000Z",
            domain: "lease",
            status: "active",
            actor: "Landlord",
          },
          {
            id: "event-2",
            title: "Screening payment completed",
            description: "Screening payment completed for the application.",
            timestamp: "2026-04-03T09:30:00.000Z",
            domain: "screening",
            actor: "System",
          },
        ]}
      />
    );

    expect(screen.getAllByText(/Lease activated/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Screening payment completed/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no items", () => {
    render(<Timeline items={[]} emptyMessage="Nothing to show yet." />);
    expect(screen.getByText(/Nothing to show yet/i)).toBeInTheDocument();
  });
});
