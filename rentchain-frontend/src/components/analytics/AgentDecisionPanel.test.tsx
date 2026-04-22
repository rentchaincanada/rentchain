import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentDecisionPanel from "./AgentDecisionPanel";

const { markLandlordDecisionReviewed } = vi.hoisted(() => ({
  markLandlordDecisionReviewed: vi.fn(),
}));
const { snoozeLandlordDecision } = vi.hoisted(() => ({
  snoozeLandlordDecision: vi.fn(),
}));
const { dismissLandlordDecision } = vi.hoisted(() => ({
  dismissLandlordDecision: vi.fn(),
}));

vi.mock("@/api/landlordAnalyticsApi", async () => {
  const actual = await vi.importActual<typeof import("@/api/landlordAnalyticsApi")>("@/api/landlordAnalyticsApi");
  return {
    ...actual,
    markLandlordDecisionReviewed,
    snoozeLandlordDecision,
    dismissLandlordDecision,
  };
});

vi.mock("../ui/Ui", () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  snoozeLandlordDecision.mockResolvedValue({
    state: {
      decisionId: "reduce_vacancy_risk:prop-2",
      state: "snoozed",
      snoozedAt: "2026-04-22T12:00:00.000Z",
      snoozedUntil: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-22T12:00:00.000Z",
    },
  });
  dismissLandlordDecision.mockResolvedValue({
    state: {
      decisionId: "reduce_vacancy_risk:prop-2",
      state: "dismissed",
      dismissedAt: "2026-04-22T12:00:00.000Z",
      updatedAt: "2026-04-22T12:00:00.000Z",
    },
  });
});

afterEach(() => {
  cleanup();
});

describe("AgentDecisionPanel", () => {
  it("renders deterministic decision cards with priority and links", () => {
    render(
      <MemoryRouter>
        <AgentDecisionPanel
          decisions={[
            {
              id: "reduce_vacancy_risk:prop-2",
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
              state: "pending",
              reviewedAt: null,
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
    expect(screen.getByRole("button", { name: /Snooze 1d/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dismiss/i })).toBeInTheDocument();
  });

  it("renders a clean empty state when no decisions are available", () => {
    render(
      <MemoryRouter>
        <AgentDecisionPanel decisions={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText(/No attention-worthy actions are surfaced for this view right now/i)).toBeInTheDocument();
  });

  it("marks a pending decision as reviewed and replaces the action with a reviewed state", async () => {
    markLandlordDecisionReviewed.mockResolvedValue({
      state: {
        decisionId: "review_lease_renewals",
        state: "reviewed",
        reviewedAt: "2026-04-21T12:00:00.000Z",
        updatedAt: "2026-04-21T12:00:00.000Z",
      },
    });

    render(
      <MemoryRouter>
        <AgentDecisionPanel
          period="90d"
          decisions={[
            {
              id: "review_lease_renewals",
              decisionType: "review_lease_renewals",
              priority: "medium",
              explanation: "Several leases are approaching renewal windows and need attention.",
              recommendedAction: "Review renewals",
              actionKey: "open_lease_renewals_flow",
              actionLabel: "Open lease renewals",
              destination: "/portfolio-health",
              workflowCategory: "lease_renewals",
              automationEligible: false,
              href: "/portfolio-health",
              state: "pending",
              reviewedAt: null,
              supportingSignals: [],
            },
          ]}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Mark Reviewed/i }));

    await waitFor(() => {
      expect(markLandlordDecisionReviewed).toHaveBeenCalledWith({
        decisionId: "review_lease_renewals",
        period: "90d",
        propertyId: null,
      });
    });
    expect(await screen.findByText("Reviewed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark Reviewed/i })).not.toBeInTheDocument();
  });

  it("snoozes a visible decision and removes it from the active list", async () => {
    render(
      <MemoryRouter>
        <AgentDecisionPanel
          period="90d"
          decisions={[
            {
              id: "reduce_vacancy_risk:prop-2",
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
              state: "pending",
              reviewedAt: null,
              supportingSignals: [],
            },
          ]}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Snooze 1d/i }));

    await waitFor(() => {
      expect(snoozeLandlordDecision).toHaveBeenCalledWith(
        expect.objectContaining({
          decisionId: "reduce_vacancy_risk:prop-2",
          period: "90d",
          propertyId: null,
        })
      );
    });
    expect(screen.queryByText(/Vacancy pressure is concentrated in Beta/i)).not.toBeInTheDocument();
  });

  it("dismisses a visible decision and removes it from the active list", async () => {
    render(
      <MemoryRouter>
        <AgentDecisionPanel
          period="90d"
          decisions={[
            {
              id: "reduce_vacancy_risk:prop-2",
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
              state: "reviewed",
              reviewedAt: "2026-04-22T12:00:00.000Z",
              supportingSignals: [],
            },
          ]}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));

    await waitFor(() => {
      expect(dismissLandlordDecision).toHaveBeenCalledWith({
        decisionId: "reduce_vacancy_risk:prop-2",
        period: "90d",
        propertyId: null,
      });
    });
    expect(screen.queryByText(/Vacancy pressure is concentrated in Beta/i)).not.toBeInTheDocument();
  });
});
