import React from "react";
import type { LandlordAnalyticsSnapshot } from "../../api/landlordAnalyticsApi";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import ActionRecommendationsPage from "./ActionRecommendationsPage";

const showToast = vi.fn();

type EntitlementOverrides = Record<string, unknown>;

vi.mock("../../api/landlordAnalyticsApi", () => ({
  fetchLandlordAnalyticsSnapshot: vi.fn(),
  markLandlordDecisionReviewed: vi.fn(),
  snoozeLandlordDecision: vi.fn(),
  dismissLandlordDecision: vi.fn(),
  executeLandlordDecision: vi.fn(),
  logLandlordControlledAutomationAuditEvent: vi.fn(),
  fetchLandlordDecisionHistory: vi.fn(),
}));

vi.mock("@/hooks/useEntitlements", () => ({
  useEntitlements: vi.fn(),
}));

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../../components/ui/Ui", () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  Section: ({ children }: React.PropsWithChildren) => <section>{children}</section>,
}));

vi.mock("@/components/billing/LockedFeature", () => ({
  LockedFeature: ({ title, description, hint }: { title: string; description: string; hint?: string }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      {hint ? <div>{hint}</div> : null}
    </div>
  ),
}));

vi.mock("@/components/billing/FeatureTeaser", () => ({
  FeatureTeaser: ({ title, description }: { title: string; description: string }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
    </div>
  ),
}));

beforeEach(() => {
  showToast.mockReset();
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ActionRecommendationsPage", () => {
  function mockEntitlements(overrides?: EntitlementOverrides) {
    return import("@/hooks/useEntitlements").then(({ useEntitlements }) => {
      vi.mocked(useEntitlements).mockReturnValue({
        loading: false,
        canViewPortfolioScore: true,
        canViewActionRecommendations: true,
        hasCapability: (key: string) => key === "portfolio_analytics",
        ...overrides,
      } as ReturnType<typeof useEntitlements>);
    });
  }

  it("renders the decision inbox in deterministic operator priority order", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockResolvedValue({
      decisionOutcomeAnalytics: {
        scope: "landlord_all_time",
        appearedCount: 8,
        reviewedCount: 3,
        dismissedCount: 1,
        executedCount: 2,
        failedExecutionCount: 1,
        resolvedCount: 6,
        resolutionRate: 0.75,
        medianTimeToResolutionHours: 36,
        averageTimeToExecutionHours: 42,
      },
      decisions: {
        items: [
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
            automationState: "blocked",
            automationReason: "A lease automation path exists, but this decision still needs a specific lease target and notice inputs before execution.",
            executionMappingState: "none",
            executionMapping: null,
            executionInputState: "none",
            executionInputReason: null,
            executionInputMissingFields: [],
            executionInput: null,
            executedAt: null,
            executionOutcomeStatus: "none",
            executionOutcomeAt: null,
            executionOutcomeReason: null,
            href: "/leases?status=expiring",
            state: "pending",
            reviewedAt: null,
            supportingSignals: [],
          },
          {
            id: "reduce_vacancy_risk:prop-2",
            decisionType: "reduce_vacancy_risk",
            priority: "high",
            explanation: "Vacancy pressure is concentrated in Beta and needs follow-through now.",
            recommendedAction: "Review vacancy plan",
            actionKey: "open_vacancy_readiness_flow",
            actionLabel: "Open vacancy readiness",
            destination: "/analytics?propertyId=prop-2",
            workflowCategory: "vacancy_readiness",
            automationEligible: false,
            automationState: "manual_only",
            automationReason: "This decision is guidance-only in v1 and does not map to an execution rule.",
            executionMappingState: "none",
            executionMapping: null,
            executionInputState: "none",
            executionInputReason: null,
            executionInputMissingFields: [],
            executionInput: null,
            executedAt: null,
            executionOutcomeStatus: "none",
            executionOutcomeAt: null,
            executionOutcomeReason: null,
            href: "/analytics?propertyId=prop-2",
            state: "pending",
            reviewedAt: null,
            supportingSignals: [],
          },
        ],
      },
    } as LandlordAnalyticsSnapshot);

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /Decision inbox/i })).toBeInTheDocument();
    expect(screen.getByText(/centralized decision inbox/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Decision outcomes/i })).toBeInTheDocument();
    expect(screen.getByText(/all-time landlord decision outcomes from canonical decision events/i)).toBeInTheDocument();
    expect(screen.getByText(/resolution rate 75%/i)).toBeInTheDocument();
    expect(fetchLandlordAnalyticsSnapshot).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/Automation preview/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Human confirmation required/i).length).toBeGreaterThan(0);

    const actionLinks = screen.getAllByRole("link");
    expect(actionLinks.map((node) => node.textContent)).toEqual(["Open vacancy readiness", "Open lease renewals"]);
    expect(screen.getByText(/Workflow: Lease renewals/i)).toBeInTheDocument();
  });

  it("keeps safer operator states below ready and blocked decisions", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockResolvedValue({
      decisionOutcomeAnalytics: {
        scope: "landlord_all_time",
        appearedCount: 4,
        reviewedCount: 0,
        dismissedCount: 0,
        executedCount: 2,
        failedExecutionCount: 0,
        resolvedCount: 2,
        resolutionRate: 0.5,
        medianTimeToResolutionHours: 12,
        averageTimeToExecutionHours: 8,
      },
      decisions: {
        items: [
          {
            id: "executed",
            decisionType: "review_lease_renewals",
            priority: "high",
            explanation: "Already completed.",
            recommendedAction: "Completed decision",
            actionKey: "open_lease_renewals_flow",
            actionLabel: "Open completed decision",
            destination: "/leases/completed",
            workflowCategory: "lease_renewals",
            automationEligible: true,
            automationState: "ready",
            automationReason: null,
            executionMappingState: "mapped",
            executionMapping: null,
            executionInputState: "complete",
            executionInputReason: null,
            executionInputMissingFields: [],
            executionInput: null,
            executedAt: "2026-04-22T12:00:00.000Z",
            executionOutcomeStatus: "succeeded",
            executionOutcomeAt: "2026-04-22T12:00:00.000Z",
            executionOutcomeReason: null,
            href: "/leases/completed",
            state: "executed",
            reviewedAt: null,
            supportingSignals: [],
          },
          {
            id: "duplicate",
            decisionType: "approve_maintenance_cost",
            priority: "high",
            explanation: "Already processed once.",
            recommendedAction: "Duplicate guarded decision",
            actionKey: "open_maintenance_cost_approval_flow",
            actionLabel: "Open duplicate guard",
            destination: "/maintenance/duplicate",
            workflowCategory: "maintenance_cost_approval",
            automationEligible: true,
            automationState: "ready",
            automationReason: null,
            executionMappingState: "mapped",
            executionMapping: null,
            executionInputState: "complete",
            executionInputReason: null,
            executionInputMissingFields: [],
            executionInput: null,
            executionState: "unsafe_duplicate",
            executedAt: null,
            executionOutcomeStatus: "none",
            executionOutcomeAt: null,
            executionOutcomeReason: null,
            href: "/maintenance/duplicate",
            state: "pending",
            reviewedAt: null,
            supportingSignals: [],
          },
          {
            id: "blocked",
            decisionType: "review_lease_renewals",
            priority: "medium",
            explanation: "Still blocked.",
            recommendedAction: "Blocked decision",
            actionKey: "open_lease_renewals_flow",
            actionLabel: "Open blocked decision",
            destination: "/leases/blocked",
            workflowCategory: "lease_renewals",
            automationEligible: false,
            automationState: "blocked",
            automationReason: "Inputs missing",
            executionMappingState: "none",
            executionMapping: null,
            executionInputState: "none",
            executionInputReason: null,
            executionInputMissingFields: [],
            executionInput: null,
            executedAt: null,
            executionOutcomeStatus: "none",
            executionOutcomeAt: null,
            executionOutcomeReason: null,
            href: "/leases/blocked",
            state: "pending",
            reviewedAt: null,
            supportingSignals: [],
          },
          {
            id: "ready",
            decisionType: "start_screening_checkout",
            priority: "low",
            explanation: "Ready to run now.",
            recommendedAction: "Ready decision",
            actionKey: "open_screening_checkout_flow",
            actionLabel: "Open ready decision",
            destination: "/applications/ready",
            workflowCategory: "screening_checkout",
            automationEligible: true,
            automationState: "ready",
            automationReason: null,
            executionMappingState: "mapped",
            executionMapping: null,
            executionInputState: "complete",
            executionInputReason: null,
            executionInputMissingFields: [],
            executionInput: null,
            executedAt: null,
            executionOutcomeStatus: "none",
            executionOutcomeAt: null,
            executionOutcomeReason: null,
            href: "/applications/ready",
            state: "pending",
            reviewedAt: null,
            supportingSignals: [],
          },
        ],
      },
    } as LandlordAnalyticsSnapshot);

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: /Decision inbox/i })).toBeInTheDocument();

    const actionLinks = screen
      .getAllByRole("link")
      .map((node) => node.textContent)
      .filter((value) =>
        [
          "Open ready decision",
          "Open blocked decision",
          "Open duplicate guard",
          "Open completed decision",
        ].includes(value || "")
      );

    expect(actionLinks).toEqual([
      "Open ready decision",
      "Open blocked decision",
      "Open duplicate guard",
    ]);
  });

  it("shows an operator queue summary and filters the current inbox in memory", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockResolvedValue({
      decisionOutcomeAnalytics: {
        scope: "landlord_all_time",
        appearedCount: 4,
        reviewedCount: 1,
        dismissedCount: 0,
        executedCount: 1,
        failedExecutionCount: 0,
        resolvedCount: 2,
        resolutionRate: 0.5,
        medianTimeToResolutionHours: 12,
        averageTimeToExecutionHours: 8,
      },
      decisions: {
        items: [
          {
            id: "ready",
            decisionType: "start_screening_checkout",
            priority: "medium",
            explanation: "A screening checkout can start now.",
            recommendedAction: "Start screening checkout",
            actionKey: "open_screening_checkout_flow",
            actionLabel: "Open screening checkout",
            destination: "/applications/app-1",
            workflowCategory: "screening_checkout",
            automationEligible: true,
            automationState: "ready",
            automationReason: null,
            executionMappingState: "mapped",
            executionMapping: {
              action: "screening.auto_start_checkout",
              resourceType: "rental_application",
              resourceId: "app-1",
              prerequisitesMet: true,
              prerequisiteReason: null,
            },
            executionInputState: "complete",
            executionInputReason: null,
            executionInputMissingFields: [],
            executionInput: null,
            executedAt: null,
            executionOutcomeStatus: "none",
            executionOutcomeAt: null,
            executionOutcomeReason: null,
            href: "/applications/app-1",
            state: "pending",
            reviewedAt: null,
            supportingSignals: [],
          },
          {
            id: "blocked",
            decisionType: "review_lease_renewals",
            priority: "medium",
            explanation: "Renewal inputs are still incomplete.",
            recommendedAction: "Review renewals",
            actionKey: "open_lease_renewals_flow",
            actionLabel: "Open lease renewals",
            destination: "/leases",
            workflowCategory: "lease_renewals",
            automationEligible: false,
            automationState: "blocked",
            automationReason: "Inputs missing",
            executionMappingState: "none",
            executionMapping: null,
            executionInputState: "none",
            executionInputReason: null,
            executionInputMissingFields: [],
            executionInput: null,
            executedAt: null,
            executionOutcomeStatus: "none",
            executionOutcomeAt: null,
            executionOutcomeReason: null,
            href: "/leases",
            state: "pending",
            reviewedAt: null,
            supportingSignals: [],
          },
        ],
      },
    } as LandlordAnalyticsSnapshot);

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("region", { name: /Operator queue/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ready to run · 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Action required · 1/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Ready to run · 1/i }));

    expect(screen.getByText(/A screening checkout can start now/i)).toBeInTheDocument();
    expect(screen.queryByText(/Renewal inputs are still incomplete/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Review action/i }));
    expect(await screen.findByLabelText(/Execution confirmation/i)).toBeInTheDocument();
    expect(screen.getByText(/This action will use the existing guarded execution path only after you confirm it/i)).toBeInTheDocument();
  });

  it("renders a clean empty state when the snapshot has no decisions", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockResolvedValue({
      decisions: {
        items: [],
      },
    } as LandlordAnalyticsSnapshot);

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No prioritized landlord actions are surfaced for this view right now/i)).toBeInTheDocument();
  });

  it("renders an error state cleanly when the snapshot request fails", async () => {
    await mockEntitlements();
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");
    vi.mocked(fetchLandlordAnalyticsSnapshot).mockRejectedValue(new Error("Boom"));

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Failed to load recommended actions: Boom/i)).toBeInTheDocument();
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Failed to load recommended actions",
        description: "Boom",
      })
    );
  });

  it("shows an analytics upgrade teaser when action recommendations are enabled but analytics decisions are not", async () => {
    await mockEntitlements({
      canViewActionRecommendations: true,
      canViewPortfolioScore: true,
      hasCapability: () => false,
    });
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Unlock decision inbox on Elite/i)).toBeInTheDocument();
    expect(vi.mocked(fetchLandlordAnalyticsSnapshot)).not.toHaveBeenCalled();
  });

  it("shows a recommendations teaser when analytics is available but inbox access is not", async () => {
    await mockEntitlements({
      canViewActionRecommendations: false,
      canViewPortfolioScore: true,
    });
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Unlock recommended actions on Elite/i)).toBeInTheDocument();
    expect(vi.mocked(fetchLandlordAnalyticsSnapshot)).not.toHaveBeenCalled();
  });

  it("renders a locked state when portfolio score access is unavailable", async () => {
    await mockEntitlements({
      canViewPortfolioScore: false,
      canViewActionRecommendations: false,
      hasCapability: () => false,
    });
    const { fetchLandlordAnalyticsSnapshot } = await import("../../api/landlordAnalyticsApi");

    render(
      <MemoryRouter>
        <ActionRecommendationsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Unlock recommended actions on Elite/i)).toBeInTheDocument();
    expect(screen.getByText(/portfolio score, analytics, and decision inbox access unlock/i)).toBeInTheDocument();
    expect(vi.mocked(fetchLandlordAnalyticsSnapshot)).not.toHaveBeenCalled();
  });
});
