import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SlaSummaryPanel from "./SlaSummaryPanel";

describe("SlaSummaryPanel", () => {
  it("renders an empty state without sla context", () => {
    render(<SlaSummaryPanel sla={null} />);
    expect(screen.getByText(/No SLA context is currently available/i)).toBeInTheDocument();
  });

  it("renders stage, escalation, and summary details", () => {
    render(
      <SlaSummaryPanel
        sla={{
          version: "v1",
          resource: { type: "application", id: "app-1" },
          context: {},
          age: {
            firstSeenAt: "2026-04-16T10:00:00.000Z",
            lastSeenAt: "2026-04-16T14:00:00.000Z",
            ageMs: 14_400_000,
            ageHours: 4,
          },
          sla: {
            stage: "fresh",
            escalationLevel: "none",
            thresholdHours: { aging: 6, dueSoon: 12, overdue: 24, escalated: 36 },
          },
          reason: {
            code: "SLA_FRESH",
            summary: "This issue is within the initial response window.",
          },
          evaluatedAt: "2026-04-16T14:00:00.000Z",
        }}
      />
    );

    expect(screen.getByText(/SLA fresh/i)).toBeInTheDocument();
    expect(screen.getByText(/Escalation none/i)).toBeInTheDocument();
    expect(screen.getByText(/Age/i)).toBeInTheDocument();
    expect(screen.getByText(/within the initial response window/i)).toBeInTheDocument();
  });
});
