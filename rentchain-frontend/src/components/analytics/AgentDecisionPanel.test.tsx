import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AgentDecisionPanel from "./AgentDecisionPanel";

vi.mock("../ui/Ui", () => ({
  Card: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}));

describe("AgentDecisionPanel", () => {
  it("renders deterministic decision cards with priority and links", () => {
    render(
      <MemoryRouter>
        <AgentDecisionPanel
          decisions={[
            {
              decisionType: "reduce_vacancy_risk",
              priority: "high",
              explanation: "Vacancy pressure is concentrated in Beta, so leasing attention should move there first.",
              recommendedAction: "View property analytics",
              actionKey: "open_vacancy_readiness_flow",
              actionLabel: "Open vacancy readiness",
              destination: "/analytics?propertyId=prop-2",
              workflowCategory: "vacancy_readiness",
              automationEligible: false,
              href: "/analytics?propertyId=prop-2",
              supportingSignals: [
                { source: "alert", key: "high_vacancy", label: "Vacancy is elevated", propertyId: "prop-2" },
                { source: "predictive_metric", key: "projected_vacancy_risk", label: "Projected vacancy risk" },
              ],
            },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Recommended next actions/i })).toBeInTheDocument();
    expect(screen.getByText(/Vacancy pressure is concentrated in Beta/i)).toBeInTheDocument();
    expect(screen.getByText(/high priority/i)).toBeInTheDocument();
    expect(screen.getByText(/Workflow: Vacancy readiness/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open vacancy readiness/i })).toHaveAttribute("href", "/analytics?propertyId=prop-2");
    expect(screen.getByText(/Vacancy is elevated/i)).toBeInTheDocument();
  });

  it("renders a clean empty state when no decisions are available", () => {
    render(
      <MemoryRouter>
        <AgentDecisionPanel decisions={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText(/No attention-worthy actions are surfaced for this view right now/i)).toBeInTheDocument();
  });
});
