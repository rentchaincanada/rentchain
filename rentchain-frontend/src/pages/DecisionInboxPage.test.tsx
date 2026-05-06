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
    expect(screen.getByText("Summary")).toBeInTheDocument();
    expect(screen.getAllByText("Critical").length).toBeGreaterThan(0);
    expect(screen.getAllByText("High").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Open").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Blocked").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Escalated").length).toBeGreaterThan(0);
    expect(screen.getByText("Critical workflow")).toBeInTheDocument();
    expect(screen.getByText("Review Missing Payment")).toBeInTheDocument();
    expect(screen.getByText("Expected rent payment is missing.")).toBeInTheDocument();
    expect(screen.getAllByText("Delinquency Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Maintenance Review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Urgent").length).toBeGreaterThan(0);
    expect(screen.getByText("Manual review required")).toBeInTheDocument();
    expect(screen.getByText("No automated notice or payment action will be taken.")).toBeInTheDocument();
    expect(screen.getByText("Review context")).toBeInTheDocument();
    expect(screen.getByText("Prepare reminder")).toBeInTheDocument();
    expect(screen.getByText("Prepare notice")).toBeInTheDocument();
    expect(screen.getByText("Draft only. Review local legal requirements before use.")).toBeInTheDocument();
    expect(screen.getByText(/no tenant communication will be sent/i)).toBeInTheDocument();
    expect(screen.getByText("Source: Lease Ledger")).toBeInTheDocument();
    expect(screen.getByText("Related: Lease lease-1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View context" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByText("Open cost approval")).toBeInTheDocument();
    expect(screen.getByText("No context link available")).toBeInTheDocument();
    expect(screen.getAllByText("Operator review session").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/No automated approval or certification occurs/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /resolve|dismiss|snooze|approve|retry|execute/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/send notice|charge tenant|start eviction|auto-send|auto-charge/i)).not.toBeInTheDocument();
    expect(apiMocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));
  });

  it("updates visible decisions through deterministic filters", async () => {
    apiMocks.fetchDecisionInbox
      .mockResolvedValueOnce(inboxResponse())
      .mockResolvedValueOnce(
        inboxResponse({
          items: [inboxResponse().items[0]],
          summary: { total: 1, critical: 1, high: 0, open: 1, blocked: 0 },
          workflowSummary: { new: 0, underReview: 0, escalated: 1, critical: 1 },
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
