import React from "react";
import { MemoryRouter } from "react-router-dom";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentSupervisionPage from "./AgentSupervisionPage";

const apiMocks = vi.hoisted(() => ({
  fetchAgentSupervisionSnapshot: vi.fn(),
  showToast: vi.fn(),
  macShellProps: vi.fn(),
}));

vi.mock("@/api/agentSupervisionApi", async () => {
  const actual = await vi.importActual<any>("@/api/agentSupervisionApi");
  return {
    ...actual,
    fetchAgentSupervisionSnapshot: apiMocks.fetchAgentSupervisionSnapshot,
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

function snapshot() {
  const item = {
    supervisionItemId: "agent-supervision-item-1",
    itemType: "agent_action",
    status: "suggested",
    severity: "critical",
    label: "suggest escalation",
    description: "Escalation review is recommended.",
    policyGuarded: true,
    manualReviewRequired: true,
    requiresHumanApproval: true,
    blockedReasons: [],
    relatedScope: { scope: "decision", scopeId: "decision-1" },
    destination: "/review-timeline?scope=decision&scopeId=decision-1",
    timestamp: "2026-05-06T12:00:00.000Z",
  };
  return {
    supervisionSnapshotId: "snapshot-1",
    generatedAt: "2026-05-06T12:00:00.000Z",
    manualReviewRequired: true,
    externalExecutionEnabled: false,
    autonomousExecutionEnabled: false,
    summary: {
      suggestedActions: 1,
      blockedActions: 0,
      pendingReviews: 2,
      escalations: 1,
      workflowSyncIssues: 0,
    },
    agentActions: [item],
    workflowStates: [],
    policyGuardResults: [],
    escalations: [{ ...item, supervisionItemId: "escalation-1", itemType: "escalation", label: "critical escalation" }],
    reviewReferences: [],
    evidenceReferences: [],
    timelineReferences: [],
  };
}

describe("AgentSupervisionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMocks.fetchAgentSupervisionSnapshot.mockResolvedValue(snapshot());
  });

  afterEach(() => {
    cleanup();
  });

  it("loads and renders the read-only agent supervision console", async () => {
    render(
      <MemoryRouter>
        <AgentSupervisionPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Agent supervision" })).toBeInTheDocument();
    expect(apiMocks.fetchAgentSupervisionSnapshot).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: "Decision inbox" })).toHaveAttribute("href", "/decision-inbox");
    expect(screen.getByText("Supervised operational intelligence only.")).toBeInTheDocument();
    expect(screen.getAllByText("Suggested actions").length).toBeGreaterThan(0);
    expect(screen.getByText("Critical Escalation")).toBeInTheDocument();
    expect(screen.getByText(/No tenant communication, payment action, legal enforcement, or external submission is automated/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /execute|auto|approve|submit/i })).not.toBeInTheDocument();
    expect(apiMocks.macShellProps).toHaveBeenCalledWith(expect.objectContaining({ showTopNav: false }));
  });
});
