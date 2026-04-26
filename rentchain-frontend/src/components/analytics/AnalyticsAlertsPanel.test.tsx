import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AnalyticsAlertsPanel from "./AnalyticsAlertsPanel";

describe("AnalyticsAlertsPanel", () => {
  it("renders alert severity and action links", () => {
    render(
      <MemoryRouter>
        <AnalyticsAlertsPanel
          summary={{ activeCount: 1, highSeverityCount: 1, mediumSeverityCount: 0, lowSeverityCount: 0 }}
          alerts={[
            {
              id: "alert-1",
              type: "high_vacancy",
              severity: "high",
              status: "active",
              title: "Vacancy is elevated",
              message: "Vacancy is 25% in the current view.",
              detectedAt: "2026-04-20T00:00:00.000Z",
              lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
              notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
              actions: [{ type: "view_analytics", label: "View analytics", href: "/analytics" }],
            },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Vacancy is elevated/i)).toBeInTheDocument();
    expect(screen.getByText(/1 active alerts/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View analytics/i })).toHaveAttribute("href", "/analytics");
  });

  it("renders a calm empty state", () => {
    render(
      <MemoryRouter>
        <AnalyticsAlertsPanel
          summary={{ activeCount: 0, highSeverityCount: 0, mediumSeverityCount: 0, lowSeverityCount: 0 }}
          alerts={[]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/No analytics alerts right now/i)).toBeInTheDocument();
  });
});
