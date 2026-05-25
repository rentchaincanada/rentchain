import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DecisionInboxPage from "./DecisionInboxPage";

const apiMocks = vi.hoisted(() => ({
  fetchDecisionInbox: vi.fn(),
  fetchOperatorReviewSessions: vi.fn(),
  openOperatorReviewSession: vi.fn(),
  addOperatorReviewNote: vi.fn(),
  closeOperatorReviewSession: vi.fn(),
  showToast: vi.fn(),
  macShellProps: vi.fn(),
}));

vi.mock("@/api/decisionInboxApi", async () => {
  const actual = await vi.importActual<any>("@/api/decisionInboxApi");
  return {
    ...actual,
    fetchDecisionInbox: apiMocks.fetchDecisionInbox,
  };
});

vi.mock("@/api/operatorReviewApi", async () => {
  const actual = await vi.importActual<any>("@/api/operatorReviewApi");
  return {
    ...actual,
    fetchOperatorReviewSessions: apiMocks.fetchOperatorReviewSessions,
    openOperatorReviewSession: apiMocks.openOperatorReviewSession,
    addOperatorReviewNote: apiMocks.addOperatorReviewNote,
    closeOperatorReviewSession: apiMocks.closeOperatorReviewSession,
  };
});

vi.mock("@/components/ui/ToastProvider", () => ({
  useToast: () => ({
    showToast: apiMocks.showToast,
  }),
}));

vi.mock("@/components/layout/MacShell", () => ({
  MacShell: ({ children, ...props }: { children: React.ReactNode; showTopNav?: boolean }) => {
    apiMocks.macShellProps(props);
    return <div>{children}</div>;
  },
}));

function inboxResponse(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        id: "decision:review_missing_payment:lease-1",
        title: "Review Missing Payment",
        description: "Expected rent payment is missing.",
        severity: "critical",
        status: "open",
        type: "billing",
        source: "lease_ledger",
        relatedEntity: { kind: "lease", id: "lease-1", label: "Lease lease-1" },
        destination: "/leases/lease-1/ledger",
        automationEligible: false,
        automatedWorkflow: {
          automationId: "automated_workflow:decision_review_missing_payment_lease-1:delinquency_review",
          decisionId: "decision:review_missing_payment:lease-1",
          workflowType: "delinquency",
          status: "pending",
          queue: "delinquency_review",
          escalationLevel: "critical",
          manualReviewRequired: true,
          policyGuarded: true,
          externalExecutionEnabled: false,
          requiresHumanAcknowledgement: true,
          transition: { fromState: "escalated", toState: "escalated" },
          reasons: [
            "Decision decision:review_missing_payment:lease-1 is routed to delinquency_review.",
            "Current workflow state is escalated.",
            "Manual review remains required before any operational action.",
          ],
          blockedReasons: [],
          canonicalEvents: [
            {
              eventType: "automated_workflow_review_required",
              action: "review_required",
              status: "pending",
              resourceType: "decision",
              resourceId: "decision:review_missing_payment:lease-1",
              summary: "Human acknowledgement remains required; no external execution is enabled.",
            },
          ],
          generatedAt: "2026-05-05T12:00:00.000Z",
        },
        agentActions: [
          {
            agentActionId: "policy_gated_agent_action:decision_review_missing_payment_lease-1:suggest_escalation",
            actionType: "suggest_escalation",
            status: "suggested",
            manualReviewRequired: true,
            policyGuarded: true,
            externalExecutionEnabled: false,
            requiresHumanApproval: true,
            explanation: {
              summary: "Escalation review is recommended based on workflow severity.",
              reasons: [
                "Workflow escalation metadata indicates elevated review priority.",
                "Operator review and human approval remain required.",
              ],
              blockedReasons: [],
            },
            relatedScope: { scope: "decision", scopeId: "decision:review_missing_payment:lease-1" },
            queue: "delinquency_review",
            escalationLevel: "critical",
            canonicalEvents: [
              {
                eventType: "policy_gated_agent_action_review_required",
                action: "review_required",
                status: "suggested",
                resourceType: "workflow",
                resourceId: "decision:review_missing_payment:lease-1",
                summary: "Human approval remains required; no agent action will execute automatically.",
              },
            ],
            generatedAt: "2026-05-05T12:00:00.000Z",
          },
        ],
        workflow: {
          queue: "delinquency_review",
          workflowState: "escalated",
          ownershipType: "landlord",
          reviewPriority: "critical",
          escalationLevel: "critical",
          manualOnly: true,
        },
        delinquencyActions: [
          {
            actionKey: "review_context",
            label: "Review context",
            description: "Review lease and payment context before taking any manual follow-up.",
            manualOnly: true,
            requiresConfirmation: false,
            policyGuarded: true,
            destination: "/leases/lease-1/ledger",
            status: "available",
            blockedReason: null,
          },
          {
            actionKey: "view_ledger",
            label: "View ledger",
            description: "Open the existing lease ledger to compare expected rent, payments, and reconciliation evidence.",
            manualOnly: true,
            requiresConfirmation: false,
            policyGuarded: true,
            destination: "/leases/lease-1/ledger",
            status: "available",
            blockedReason: null,
          },
          {
            actionKey: "prepare_reminder",
            label: "Prepare reminder",
            description: "Scaffold a manual reminder review. No tenant message is generated or sent from this inbox.",
            manualOnly: true,
            requiresConfirmation: true,
            policyGuarded: true,
            destination: "/leases/lease-1/ledger",
            status: "blocked",
            blockedReason: "Reminder draft preview is not enabled in this scaffold; no tenant communication will be sent.",
          },
          {
            actionKey: "prepare_notice",
            label: "Prepare notice",
            description: "Scaffold a manual notice review. Draft only. Review local legal requirements before use.",
            manualOnly: true,
            requiresConfirmation: true,
            policyGuarded: true,
            destination: "/leases/lease-1/ledger",
            status: "blocked",
            blockedReason: "Notice draft preview is not enabled in this scaffold; no legal notice will be generated or sent.",
          },
        ],
        createdAt: "2026-05-05T12:00:00.000Z",
        updatedAt: "2026-05-05T12:00:00.000Z",
      },
      {
        id: "approve_maintenance_cost:wo-1",
        title: "Open cost approval",
        description: "A maintenance cost needs review.",
        severity: "high",
        status: "blocked",
        type: "maintenance",
        source: "analytics",
        relatedEntity: { kind: "maintenance_request", id: "wo-1", label: "Work order wo-1" },
        destination: null,
        automationEligible: false,
        automatedWorkflow: {
          automationId: "automated_workflow:approve_maintenance_cost_wo-1:maintenance_review",
          decisionId: "approve_maintenance_cost:wo-1",
          workflowType: "maintenance",
          status: "blocked",
          queue: "maintenance_review",
          escalationLevel: "urgent",
          manualReviewRequired: true,
          policyGuarded: true,
          externalExecutionEnabled: false,
          requiresHumanAcknowledgement: true,
          transition: { fromState: "waiting_context", toState: "waiting_context" },
          reasons: [
            "Decision approve_maintenance_cost:wo-1 is routed to maintenance_review.",
            "Current workflow state is waiting_context.",
          ],
          blockedReasons: ["Required workflow context is missing or incomplete."],
          canonicalEvents: [
            {
              eventType: "automated_workflow_blocked",
              action: "blocked",
              status: "blocked",
              resourceType: "workflow",
              resourceId: "approve_maintenance_cost:wo-1",
              summary: "Internal workflow orchestration is blocked pending manual context review.",
            },
          ],
          generatedAt: "2026-05-05T12:00:00.000Z",
        },
        agentActions: [
          {
            agentActionId: "policy_gated_agent_action:approve_maintenance_cost_wo-1:request_evidence",
            actionType: "request_evidence",
            status: "blocked",
            manualReviewRequired: true,
            policyGuarded: true,
            externalExecutionEnabled: false,
            requiresHumanApproval: true,
            explanation: {
              summary: "Request additional evidence before progressing this workflow.",
              reasons: ["Workflow context is blocked or waiting for additional evidence."],
              blockedReasons: ["Required workflow context is missing or incomplete."],
            },
            relatedScope: { scope: "evidence_pack", scopeId: "approve_maintenance_cost:wo-1" },
            queue: "maintenance_review",
            escalationLevel: "urgent",
            canonicalEvents: [
              {
                eventType: "policy_gated_agent_action_blocked",
                action: "request_evidence",
                status: "blocked",
                resourceType: "decision",
                resourceId: "approve_maintenance_cost:wo-1",
                summary: "Policy-gated agent suggestion is blocked pending manual review.",
              },
            ],
            generatedAt: "2026-05-05T12:00:00.000Z",
          },
        ],
        workflow: {
          queue: "maintenance_review",
          workflowState: "waiting_context",
          ownershipType: "landlord",
          reviewPriority: "high",
          escalationLevel: "urgent",
          manualOnly: true,
        },
        createdAt: null,
        updatedAt: null,
      },
    ],
    filters: {
      severity: ["critical", "high"],
      status: ["open", "blocked"],
      type: ["billing", "maintenance"],
      queue: ["delinquency_review", "maintenance_review"],
      workflowState: ["escalated", "waiting_context"],
      escalationLevel: ["critical", "urgent"],
    },
    summary: {
      total: 2,
      critical: 1,
      high: 1,
      open: 1,
      blocked: 1,
    },
    workflowSummary: {
      new: 0,
      underReview: 0,
      escalated: 1,
      critical: 1,
    },
    automationSummary: {
      total: 2,
      pending: 1,
      derived: 0,
      blocked: 1,
      completed: 0,
      escalationFlagged: 2,
      reviewRequired: 2,
    },
    agentActionSummary: {
      total: 2,
      suggested: 1,
      blocked: 1,
      unavailable: 0,
      acknowledged: 0,
      reviewRequired: 2,
      escalationSuggested: 1,
    },
    ...overrides,
  };
}

describe("DecisionInboxPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchDecisionInbox.mockResolvedValue(inboxResponse());
    apiMocks.fetchOperatorReviewSessions.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders summary counts, badges, and safe context links", async () => {
    render(
      <MemoryRouter>
        <DecisionInboxPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Decision inbox" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Institution export preview" })).toHaveAttribute(
      "href",
      "/institution-exports"
    );
    expect(screen.getByRole("link", { name: "Agent supervision" })).toHaveAttribute("href", "/agent-supervision");
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Escalated").length).toBeGreaterThan(0);
    expect(screen.getByText("Critical workflow")).toBeInTheDocument();
    expect(screen.getByText("Workflow previews")).toBeInTheDocument();
    expect(screen.getByText("Review required")).toBeInTheDocument();
    expect(screen.getByText("Escalation flags")).toBeInTheDocument();
    expect(screen.getByText("Blocked orchestration")).toBeInTheDocument();
    expect(screen.getByText("Agent suggestions")).toBeInTheDocument();
    expect(screen.getByText("Suggested actions")).toBeInTheDocument();
    expect(screen.getByText("Blocked suggestions")).toBeInTheDocument();
    expect(screen.getByText("Suggestion review required")).toBeInTheDocument();
    expect(screen.getByText("Review Missing Payment")).toBeInTheDocument();
    expect(screen.getByText("Expected rent payment is missing.")).toBeInTheDocument();
    expect(screen.getAllByText("Delinquency Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Maintenance Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Urgent").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual review required").length).toBeGreaterThan(0);
    expect(screen.getByText("No automated notice or payment action will be taken.")).toBeInTheDocument();
    expect(screen.getAllByText("Deterministic workflow orchestration only.").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No tenant communication, payment action, or legal enforcement is automated/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Review automation reasoning").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Workflow type:").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/External execution:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Required workflow context is missing or incomplete.").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Suggested actions only.").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Manual approval is required/i).length).toBeGreaterThan(0);
    expect(screen.getByText("Suggest Escalation")).toBeInTheDocument();
    expect(screen.getByText("Request Evidence")).toBeInTheDocument();
    expect(screen.getAllByText("Review explanation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Human approval required").length).toBeGreaterThan(0);
    expect(screen.getByText("Review context")).toBeInTheDocument();
    expect(screen.getByText("Prepare reminder")).toBeInTheDocument();
    expect(screen.getByText("Prepare notice")).toBeInTheDocument();
    expect(screen.getByText("Draft only. Review local legal requirements before use.")).toBeInTheDocument();
    expect(screen.getByText(/no tenant communication will be sent/i)).toBeInTheDocument();
    expect(screen.getByText("Source: Lease Ledger")).toBeInTheDocument();
    expect(screen.getByText("Related: Lease context review")).toBeInTheDocument();
    expect(screen.getByText("Missing payment review is routed to delinquency review.")).toBeInTheDocument();
    expect(screen.queryByText(/Decision decision:review_missing_payment/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View context" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByText("Open cost approval")).toBeInTheDocument();
    expect(screen.getByText("No context link available")).toBeInTheDocument();
    expect(screen.getAllByText("Operator review session").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No automated approval or certification occurs/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /resolve|dismiss|snooze|approve|retry|execute/i })).not.toBeInTheDocument();
    const forbiddenCopy = [
      ["send", "notice"],
      ["charge", "tenant"],
      ["start", "eviction"],
      ["auto", "send"],
      ["auto", "charge"],
      ["auto", "approve"],
      ["file", "eviction"],
      ["submit", "export"],
      ["approve", "compliance"],
      ["autonomous", "mode"],
    ];
    for (const words of forbiddenCopy) {
      expect(screen.queryByText(new RegExp(words.join("[ -]"), "i"))).not.toBeInTheDocument();
    }
    expect(apiMocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));
  });

  it("marks the decision inbox with mobile-safe responsive layout classes", async () => {
    render(
      <MemoryRouter>
        <DecisionInboxPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Decision inbox" })).toBeInTheDocument();
    expect(document.querySelector(".rc-decision-inbox-page")).toBeInTheDocument();
    expect(document.querySelector(".rc-decision-inbox-header")).toBeInTheDocument();
    expect(document.querySelector(".rc-decision-inbox-context-links")).toBeInTheDocument();
    expect(document.querySelector(".rc-decision-inbox-filters")).toBeInTheDocument();
    expect(document.querySelector(".rc-decision-inbox-list")).toBeInTheDocument();
  });

  it("updates visible decisions through deterministic filters", async () => {
    apiMocks.fetchDecisionInbox
      .mockResolvedValueOnce(inboxResponse())
      .mockResolvedValueOnce(
        inboxResponse({
          items: [inboxResponse().items[0]],
          summary: { total: 1, critical: 1, high: 0, open: 1, blocked: 0 },
          workflowSummary: { new: 0, underReview: 0, escalated: 1, critical: 1 },
          automationSummary: { total: 1, pending: 1, derived: 0, blocked: 0, completed: 0, escalationFlagged: 1, reviewRequired: 1 },
          agentActionSummary: { total: 1, suggested: 1, blocked: 0, unavailable: 0, acknowledged: 0, reviewRequired: 1, escalationSuggested: 1 },
        })
      );

    render(
      <MemoryRouter>
        <DecisionInboxPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Review Missing Payment")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Severity"), { target: { value: "critical" } });

    await waitFor(() => {
      expect(apiMocks.fetchDecisionInbox).toHaveBeenLastCalledWith(
        expect.objectContaining({
          severity: "critical",
          status: "all",
          type: "all",
          queue: "all",
          workflowState: "all",
          escalationLevel: "all",
        })
      );
    });

    apiMocks.fetchDecisionInbox.mockResolvedValueOnce(
      inboxResponse({
        items: [inboxResponse().items[1]],
        summary: { total: 1, critical: 0, high: 1, open: 0, blocked: 1 },
        workflowSummary: { new: 0, underReview: 0, escalated: 0, critical: 0 },
        automationSummary: { total: 1, pending: 0, derived: 0, blocked: 1, completed: 0, escalationFlagged: 1, reviewRequired: 1 },
        agentActionSummary: { total: 1, suggested: 0, blocked: 1, unavailable: 0, acknowledged: 0, reviewRequired: 1, escalationSuggested: 0 },
      })
    );
    fireEvent.change(screen.getByLabelText("Queue"), { target: { value: "maintenance_review" } });

    await waitFor(() => {
      expect(apiMocks.fetchDecisionInbox).toHaveBeenLastCalledWith(
        expect.objectContaining({ severity: "critical", queue: "maintenance_review" })
      );
    });
  });

  it("renders an empty state when no decisions match filters", async () => {
    apiMocks.fetchDecisionInbox.mockResolvedValue(
      inboxResponse({
        items: [],
        summary: { total: 0, critical: 0, high: 0, open: 0, blocked: 0 },
        workflowSummary: { new: 0, underReview: 0, escalated: 0, critical: 0 },
        automationSummary: { total: 0, pending: 0, derived: 0, blocked: 0, completed: 0, escalationFlagged: 0, reviewRequired: 0 },
        agentActionSummary: { total: 0, suggested: 0, blocked: 0, unavailable: 0, acknowledged: 0, reviewRequired: 0, escalationSuggested: 0 },
      })
    );

    render(
      <MemoryRouter>
        <DecisionInboxPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("No decisions match the current filters.")).toBeInTheDocument();
  });
});
