import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InsightCardsPanel from "./InsightCardsPanel";

describe("InsightCardsPanel", () => {
  it("suppresses duplicate operational insights already covered by alerts", () => {
    render(
      <InsightCardsPanel
        insights={[
          { type: "lease_expiry", severity: "medium", message: "1 lease ends within 30 days." },
          { type: "vacancy_leader", severity: "low", message: "Alpha currently has the lowest vacancy rate in your portfolio." },
        ]}
        alerts={[
          {
            id: "alert-1",
            type: "lease_expiry",
            severity: "medium",
            status: "active",
            title: "Leases ending soon",
            message: "1 lease ends within 30 days.",
            detectedAt: "2026-04-20T00:00:00.000Z",
            lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
            notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
          },
        ]}
        decisions={[]}
      />
    );

    expect(screen.getByText(/Alpha currently has the lowest vacancy rate/i)).toBeInTheDocument();
    expect(screen.queryByText(/^1 lease ends within 30 days\.$/i)).not.toBeInTheDocument();
  });

  it("renders an updated intro and empty state when only duplicates were filtered away", () => {
    render(
      <InsightCardsPanel
        insights={[{ type: "lease_expiry", severity: "medium", message: "1 lease ends within 30 days." }]}
        alerts={[
          {
            id: "alert-1",
            type: "lease_expiry",
            severity: "medium",
            status: "active",
            title: "Leases ending soon",
            message: "1 lease ends within 30 days.",
            detectedAt: "2026-04-20T00:00:00.000Z",
            lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
            notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
          },
        ]}
        decisions={[]}
      />
    );

    expect(screen.getAllByText(/Distinct portfolio patterns worth reviewing after alerts and next actions/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/No standout analytics signals in this view right now/i)).toBeInTheDocument();
  });
});
