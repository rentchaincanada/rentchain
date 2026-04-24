import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentDecisionPanel from "./AgentDecisionPanel";
import type { LandlordDecisionMaintenanceApprovalExecutionInput } from "@/api/landlordAnalyticsApi";

const { markLandlordDecisionReviewed } = vi.hoisted(() => ({
  markLandlordDecisionReviewed: vi.fn(),
}));
const { snoozeLandlordDecision } = vi.hoisted(() => ({
  snoozeLandlordDecision: vi.fn(),
}));
const { dismissLandlordDecision } = vi.hoisted(() => ({
  dismissLandlordDecision: vi.fn(),
}));
const { executeLandlordDecision } = vi.hoisted(() => ({
  executeLandlordDecision: vi.fn(),
}));
const { fetchLandlordDecisionHistory } = vi.hoisted(() => ({
  fetchLandlordDecisionHistory: vi.fn(),
}));

vi.mock("@/api/landlordAnalyticsApi", async () => {
  const actual = await vi.importActual<typeof import("@/api/landlordAnalyticsApi")>("@/api/landlordAnalyticsApi");
  return {
    ...actual,
    markLandlordDecisionReviewed,
    snoozeLandlordDecision,
    dismissLandlordDecision,
    executeLandlordDecision,
    fetchLandlordDecisionHistory,
  };
});

vi.mock("../ui/Ui", () => ({
  Card: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
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
  executeLandlordDecision.mockResolvedValue({
    ok: true,
    execution: {
      decisionId: "review_lease_renewals:prop-1",
      action: "lease.auto_send_notice",
      resourceType: "lease",
      resourceId: "lease-1",
    },
    automationResult: {
      action: "lease.auto_send_notice",
      executed: true,
      skipped: false,
      timestamp: "2026-04-22T12:00:00.000Z",
    },
    state: {
      decisionId: "review_lease_renewals:prop-1",
      state: "executed",
      executedAt: "2026-04-22T12:00:00.000Z",
      executionOutcomeStatus: "succeeded",
      executionOutcomeAt: "2026-04-22T12:00:00.000Z",
      executionOutcomeReason: null,
      updatedAt: "2026-04-22T12:00:00.000Z",
    },
    noticeId: "notice-1",
  });
  fetchLandlordDecisionHistory.mockResolvedValue({
    ok: true,
    decisionId: "review_lease_renewals:prop-1",
    events: [
      {
        id: "event-1",
        title: "Appeared",
        description: "Analytics decision review_lease_renewals:prop-1 appeared.",
        timestamp: "2026-04-22T09:00:00.000Z",
        domain: "system",
        actor: "System",
      },
      {
        id: "event-2",
        title: "Reviewed",
        description: "Analytics decision review_lease_renewals:prop-1 reviewed.",
        timestamp: "2026-04-22T10:00:00.000Z",
        domain: "system",
        actor: "Landlord",
      },
    ],
  });
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
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
    expect(screen.getByRole("heading", { name: /Actions to review/i })).toBeInTheDocument();
    expect(screen.getByText(/Vacancy pressure is concentrated in Beta/i)).toBeInTheDocument();
    expect(screen.getByText(/high priority/i)).toBeInTheDocument();
    expect(screen.getByText(/Workflow: Vacancy readiness/i)).toBeInTheDocument();
    expect(screen.getByText(/Action required/i)).toBeInTheDocument();
    expect(screen.getByText(/Execution controls/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Automation preview/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Human confirmation required/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Execution disabled for this state/i)).toBeInTheDocument();
    expect(screen.getByText(/This decision is in a lifecycle state that does not allow execution/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open vacancy readiness/i })).toHaveAttribute("href", "/analytics?propertyId=prop-2");
    expect(screen.getByText(/Vacancy is elevated/i)).toBeInTheDocument();
    expect(screen.queryByText(/Automation blocked/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Snooze 1d/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dismiss/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View history/i })).toBeInTheDocument();
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
    expect(screen.getByText(/Automation blocked/i)).toBeInTheDocument();
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

  it("requires explicit human confirmation before executing a ready decision", async () => {
    render(
      <MemoryRouter>
        <AgentDecisionPanel
          period="90d"
          decisions={[
            {
              id: "review_lease_renewals:prop-1",
              decisionType: "review_lease_renewals",
              priority: "high",
              explanation: "Review upcoming renewals.",
              recommendedAction: "Review renewals",
              actionKey: "open_lease_renewals_flow",
              actionLabel: "Open renewals focus",
              destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
              workflowCategory: "lease_renewals",
              automationEligible: true,
              automationState: "ready",
              automationReason: "This decision is active and already mapped to a deterministic automation path.",
              executionMappingState: "mapped",
              executionMapping: {
                action: "lease.auto_send_notice",
                resourceType: "lease",
                resourceId: "lease-1",
                prerequisitesMet: true,
                prerequisiteReason: null,
              },
              executionInputState: "complete",
              executionInputReason: null,
              executionInputMissingFields: [],
              executionInput: {
                noticeType: "renewal_offer",
                legalTemplateKey: "ns.fixed_term.renewal_offer.v1",
                noticeRuleVersion: "ns-v1",
                province: "NS",
                leaseType: "fixed_term",
                currentRent: 1650,
                noticeDueAt: Date.UTC(2026, 1, 10, 0, 0, 0, 0),
                rentChangeMode: "no_change",
                proposedRent: null,
                newTermType: "fixed_term",
                newLeaseStartDate: "2026-05-11",
                newLeaseEndDate: "2027-05-10",
                responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
              },
              executedAt: null,
              executionOutcomeStatus: "none",
              executionOutcomeAt: null,
              executionOutcomeReason: null,
              href: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
              state: "pending",
              reviewedAt: null,
              supportingSignals: [],
            },
          ]}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Review action/i }));

    expect(screen.getByLabelText(/Execution confirmation/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Confirm action$/i })).toBeInTheDocument();
    expect(screen.getByText(/This action will use the existing guarded execution path only after you confirm it/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Confirm action$/i }));

    await waitFor(() => {
      expect(executeLandlordDecision).toHaveBeenCalledWith({
        decisionId: "review_lease_renewals:prop-1",
        period: "90d",
        propertyId: null,
      });
    });
    expect(await screen.findByRole("heading", { name: /Recently executed \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show executed/i })).toBeInTheDocument();
    expect(screen.queryByText(/Notice sent/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Review action/i })).not.toBeInTheDocument();
  });

  it("keeps failed execution feedback in the active section", async () => {
    executeLandlordDecision.mockResolvedValueOnce({
      ok: false,
      error: "DECISION_EXECUTION_FAILED",
      state: {
        decisionId: "review_lease_renewals:prop-1",
        state: "pending",
        executedAt: null,
        executionOutcomeStatus: "failed",
        executionOutcomeAt: "2026-04-22T12:00:00.000Z",
        executionOutcomeReason: "AUTOMATION_EXECUTION_FAILED",
        updatedAt: "2026-04-22T12:00:00.000Z",
      },
      automationResult: {
        action: "lease.auto_send_notice",
        executed: false,
        skipped: true,
        reason: "AUTOMATION_EXECUTION_FAILED",
        timestamp: "2026-04-22T12:00:00.000Z",
      },
    });

    render(
      <MemoryRouter>
        <AgentDecisionPanel
          period="90d"
          decisions={[
            {
              id: "review_lease_renewals:prop-1",
              decisionType: "review_lease_renewals",
              priority: "high",
              explanation: "Review upcoming renewals.",
              recommendedAction: "Review renewals",
              actionKey: "open_lease_renewals_flow",
              actionLabel: "Open renewals focus",
              destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
              workflowCategory: "lease_renewals",
              automationEligible: true,
              automationState: "ready",
              automationReason: "This decision is active and already mapped to a deterministic automation path.",
              executionMappingState: "mapped",
              executionMapping: {
                action: "lease.auto_send_notice",
                resourceType: "lease",
                resourceId: "lease-1",
                prerequisitesMet: true,
                prerequisiteReason: null,
              },
              executionInputState: "complete",
              executionInputReason: null,
              executionInputMissingFields: [],
              executionInput: {
                noticeType: "renewal_offer",
                legalTemplateKey: "ns.fixed_term.renewal_offer.v1",
                noticeRuleVersion: "ns-v1",
                province: "NS",
                leaseType: "fixed_term",
                currentRent: 1650,
                noticeDueAt: Date.UTC(2026, 1, 10, 0, 0, 0, 0),
                rentChangeMode: "no_change",
                proposedRent: null,
                newTermType: "fixed_term",
                newLeaseStartDate: "2026-05-11",
                newLeaseEndDate: "2027-05-10",
                responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
              },
              executedAt: null,
              executionOutcomeStatus: "none",
              executionOutcomeAt: null,
              executionOutcomeReason: null,
              href: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
              state: "pending",
              reviewedAt: null,
              supportingSignals: [],
            },
          ]}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Review action/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Confirm action$/i }));

    await waitFor(() => {
      expect(executeLandlordDecision).toHaveBeenCalledWith({
        decisionId: "review_lease_renewals:prop-1",
        period: "90d",
        propertyId: null,
      });
    });
    expect(screen.queryByRole("heading", { name: /Recently executed/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Execution failed/i)).toBeInTheDocument();
    expect(screen.getByText(/AUTOMATION_EXECUTION_FAILED/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review action/i })).toBeInTheDocument();
  });

  it("shows execution governance summary for duplicate-prevented decisions", () => {
    render(
      <MemoryRouter>
        <AgentDecisionPanel
          decisions={[
            {
              id: "approve_maintenance_cost:wo-1",
              decisionType: "approve_maintenance_cost",
              priority: "medium",
              explanation: "Approve this work order cost.",
              recommendedAction: "Review work order approval",
              actionKey: "open_maintenance_cost_approval_flow",
              actionLabel: "Open cost approval",
              destination: "/work-orders?entry=maintenance-cost-approval&workOrderId=wo-1",
              workflowCategory: "maintenance_cost_approval",
              automationEligible: true,
              automationState: "ready",
              automationReason: "This decision is active and already mapped to a deterministic automation path.",
              executionMappingState: "mapped",
              executionMapping: {
                action: "maintenance.auto_approve_cost",
                resourceType: "work_order",
                resourceId: "wo-1",
                prerequisitesMet: true,
                prerequisiteReason: null,
              },
              executionInputState: "complete",
              executionInputReason: null,
              executionInputMissingFields: [],
              executionInput: {
                actualCostCents: 32000,
                currency: "CAD",
                reviewStatus: "pending_review",
                linkedExpenseStatus: "not_linked",
                hasSupportingEvidence: true,
                thresholdCents: 100000,
                withinAutoApprovalThreshold: true,
              } satisfies LandlordDecisionMaintenanceApprovalExecutionInput,
              executionState: "unsafe_duplicate",
              blockedReason: "duplicate_prevented",
              executionGuardKey: "maintenance.auto_approve_cost:work_order:wo-1",
              duplicateGuardActive: true,
              executionSummary: {
                lastExecutedAt: "2026-04-22T12:00:00.000Z",
                executionCount: 1,
                lastExecutionOutcome: "succeeded",
                lastExecutionOutcomeAt: "2026-04-22T12:00:00.000Z",
              },
              executedAt: null,
              executionOutcomeStatus: "none",
              executionOutcomeAt: null,
              executionOutcomeReason: null,
              href: "/work-orders?entry=maintenance-cost-approval&workOrderId=wo-1",
              state: "pending",
              reviewedAt: null,
              supportingSignals: [],
            },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Already processed/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Duplicate safeguard active/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Duplicate protection active/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Duplicate execution prevented/i)).toBeInTheDocument();
    expect(screen.getByText(/Guard key: maintenance.auto_approve_cost:work_order:wo-1/i)).toBeInTheDocument();
    expect(screen.getByText(/Executed 1 time/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Review action/i })).not.toBeInTheDocument();
  });

  it("fails closed when confirmation context is incomplete even if the decision looks executable", () => {
    render(
      <MemoryRouter>
        <AgentDecisionPanel
          decisions={[
            {
              id: "review_lease_renewals:prop-1",
              decisionType: "review_lease_renewals",
              priority: "high",
              explanation: "Review upcoming renewals.",
              recommendedAction: "",
              actionKey: "",
              actionLabel: "",
              destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
              workflowCategory: "lease_renewals",
              automationEligible: true,
              automationState: "ready",
              automationReason: "This decision is active and already mapped to a deterministic automation path.",
              executionMappingState: "mapped",
              executionMapping: {
                action: "lease.auto_send_notice",
                resourceType: "lease",
                resourceId: "lease-1",
                prerequisitesMet: true,
                prerequisiteReason: null,
              },
              executionInputState: "complete",
              executionInputReason: null,
              executionInputMissingFields: [],
              executionInput: {
                noticeType: "renewal_offer",
                legalTemplateKey: "ns.fixed_term.renewal_offer.v1",
                noticeRuleVersion: "ns-v1",
                province: "NS",
                leaseType: "fixed_term",
                currentRent: 1650,
                noticeDueAt: Date.UTC(2026, 1, 10, 0, 0, 0, 0),
                rentChangeMode: "no_change",
                proposedRent: null,
                newTermType: "fixed_term",
                newLeaseStartDate: "2026-05-11",
                newLeaseEndDate: "2027-05-10",
                responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
              },
              executionState: "executable",
              blockedReason: null,
              executionGuardKey: "lease.auto_send_notice:lease:lease-1",
              duplicateGuardActive: false,
              executionSummary: undefined,
              executedAt: null,
              executionOutcomeStatus: "none",
              executionOutcomeAt: null,
              executionOutcomeReason: null,
              href: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
              state: "pending",
              reviewedAt: null,
              supportingSignals: [],
            },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.queryByRole("button", { name: /Review action/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Automation preview unavailable/i)).toBeInTheDocument();
  });

  it("renders executed decisions in a collapsible secondary section", () => {
    render(
      <MemoryRouter>
        <AgentDecisionPanel
          decisions={[
            {
              id: "review_lease_renewals:prop-1",
              decisionType: "review_lease_renewals",
              priority: "high",
              explanation: "Review upcoming renewals.",
              recommendedAction: "Review renewals",
              actionKey: "open_lease_renewals_flow",
              actionLabel: "Open renewals focus",
              destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
              workflowCategory: "lease_renewals",
              automationEligible: true,
              automationState: "ready",
              automationReason: "This decision is active and already mapped to a deterministic automation path.",
              executionMappingState: "mapped",
              executionMapping: {
                action: "lease.auto_send_notice",
                resourceType: "lease",
                resourceId: "lease-1",
                prerequisitesMet: true,
                prerequisiteReason: null,
              },
              executionInputState: "complete",
              executionInputReason: null,
              executionInputMissingFields: [],
              executionInput: {
                noticeType: "renewal_offer",
                legalTemplateKey: "ns.fixed_term.renewal_offer.v1",
                noticeRuleVersion: "ns-v1",
                province: "NS",
                leaseType: "fixed_term",
                currentRent: 1650,
                noticeDueAt: Date.UTC(2026, 1, 10, 0, 0, 0, 0),
                rentChangeMode: "no_change",
                proposedRent: null,
                newTermType: "fixed_term",
                newLeaseStartDate: "2026-05-11",
                newLeaseEndDate: "2027-05-10",
                responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
              },
              executedAt: "2026-04-22T12:00:00.000Z",
              executionOutcomeStatus: "succeeded",
              executionOutcomeAt: "2026-04-22T12:00:00.000Z",
              executionOutcomeReason: null,
              href: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
              state: "executed",
              reviewedAt: null,
              supportingSignals: [],
            },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Actions to review/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Recently executed \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show executed/i })).toBeInTheDocument();
    expect(screen.getByText(/No attention-worthy actions are surfaced/i)).toBeInTheDocument();
    expect(screen.queryByText(/Notice sent/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Show executed/i }));
    expect(screen.getByText(/Notice sent/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide executed/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dismiss/i })).not.toBeInTheDocument();
  });

  it("loads and renders canonical decision history inline on demand", async () => {
    render(
      <MemoryRouter>
        <AgentDecisionPanel
          period="90d"
          decisions={[
            {
              id: "review_lease_renewals:prop-1",
              decisionType: "review_lease_renewals",
              priority: "high",
              explanation: "Review upcoming renewals.",
              recommendedAction: "Review renewals",
              actionKey: "open_lease_renewals_flow",
              actionLabel: "Open renewals focus",
              destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
              workflowCategory: "lease_renewals",
              automationEligible: true,
              automationState: "ready",
              automationReason: "This decision is active and already mapped to a deterministic automation path.",
              executionMappingState: "mapped",
              executionMapping: {
                action: "lease.auto_send_notice",
                resourceType: "lease",
                resourceId: "lease-1",
                prerequisitesMet: true,
                prerequisiteReason: null,
              },
              executionInputState: "complete",
              executionInputReason: null,
              executionInputMissingFields: [],
              executionInput: {
                noticeType: "renewal_offer",
                legalTemplateKey: "ns.fixed_term.renewal_offer.v1",
                noticeRuleVersion: "ns-v1",
                province: "NS",
                leaseType: "fixed_term",
                currentRent: 1650,
                noticeDueAt: Date.UTC(2026, 1, 10, 0, 0, 0, 0),
                rentChangeMode: "no_change",
                proposedRent: null,
                newTermType: "fixed_term",
                newLeaseStartDate: "2026-05-11",
                newLeaseEndDate: "2027-05-10",
                responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
              },
              executedAt: null,
              executionOutcomeStatus: "none",
              executionOutcomeAt: null,
              executionOutcomeReason: null,
              href: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
              state: "pending",
              reviewedAt: null,
              supportingSignals: [],
            },
          ]}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /View history/i }));

    await waitFor(() => {
      expect(fetchLandlordDecisionHistory).toHaveBeenCalledWith({
        decisionId: "review_lease_renewals:prop-1",
        period: "90d",
        propertyId: null,
      });
    });
    expect(await screen.findByText("Appeared")).toBeInTheDocument();
    expect(screen.getByText("Reviewed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide history/i })).toBeInTheDocument();
  });

  it("persists per-decision history visibility across remounts", async () => {
    const decision = {
      id: "review_lease_renewals:prop-1",
      decisionType: "review_lease_renewals",
      priority: "high",
      explanation: "Review upcoming renewals.",
      recommendedAction: "Review renewals",
      actionKey: "open_lease_renewals_flow",
      actionLabel: "Open renewals focus",
      destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
      workflowCategory: "lease_renewals",
      automationEligible: true,
      automationState: "ready",
      automationReason: "This decision is active and already mapped to a deterministic automation path.",
      executionMappingState: "mapped",
      executionMapping: {
        action: "lease.auto_send_notice",
        resourceType: "lease",
        resourceId: "lease-1",
        prerequisitesMet: true,
        prerequisiteReason: null,
      },
      executionInputState: "complete",
      executionInputReason: null,
      executionInputMissingFields: [],
      executionInput: {
        noticeType: "renewal_offer",
        legalTemplateKey: "ns.fixed_term.renewal_offer.v1",
        noticeRuleVersion: "ns-v1",
        province: "NS",
        leaseType: "fixed_term",
        currentRent: 1650,
        noticeDueAt: Date.UTC(2026, 1, 10, 0, 0, 0, 0),
        rentChangeMode: "no_change",
        proposedRent: null,
        newTermType: "fixed_term",
        newLeaseStartDate: "2026-05-11",
        newLeaseEndDate: "2027-05-10",
        responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
      },
      executedAt: null,
      executionOutcomeStatus: "none",
      executionOutcomeAt: null,
      executionOutcomeReason: null,
      href: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
      state: "pending",
      reviewedAt: null,
      supportingSignals: [],
    } as const;

    const { unmount } = render(
      <MemoryRouter>
        <AgentDecisionPanel period="90d" decisions={[decision]} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /View history/i }));
    await screen.findByText("Appeared");
    unmount();

    render(
      <MemoryRouter>
        <AgentDecisionPanel period="90d" decisions={[decision]} />
      </MemoryRouter>
    );

    expect(await screen.findByRole("button", { name: /Hide history/i })).toBeInTheDocument();
    expect(await screen.findByText("Appeared")).toBeInTheDocument();
    expect(fetchLandlordDecisionHistory).toHaveBeenCalledTimes(2);
  });
});
