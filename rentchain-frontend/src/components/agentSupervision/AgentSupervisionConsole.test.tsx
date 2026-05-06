import React from "react";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentSupervisionConsole } from "./AgentSupervisionConsole";
import type { AgentSupervisionSnapshot } from "@/api/agentSupervisionApi";

function snapshot(): AgentSupervisionSnapshot {
  const item = {
    supervisionItemId: "agent-supervision-item-1",
    itemType: "agent_action" as const,
    status: "blocked" as const,
    severity: "critical" as const,
    label: "request evidence",
    description: "Additional evidence is required before progressing this workflow.",
    policyGuarded: true as const,
    manualReviewRequired: true as const,
    requiresHumanApproval: true as const,
    blockedReasons: ["Required workflow context is missing or incomplete."],
    relatedScope: { scope: "decision" as const, scopeId: "decision-1" },
    destination: "/decision-inbox",
    timestamp: "2026-05-06T12:00:00.000Z",
  };
  return {
    supervisionSnapshotId: "snapshot-1",
    generatedAt: "2026-05-06T12:00:00.000Z",
    manualReviewRequired: true,
    externalExecutionEnabled: false,
    autonomousExecutionEnabled: false,
    summary: {
      suggestedActions: 2,
      blockedActions: 1,
      pendingReviews: 3,
      escalations: 1,
      workflowSyncIssues: 1,
    },
    agentActions: [item],
    workflowStates: [{ ...item, supervisionItemId: "workflow-1", itemType: "synchronization_issue", label: "workflow sync issue" }],
    policyGuardResults: [{ ...item, supervisionItemId: "policy-1", itemType: "policy_guard", label: "policy guard" }],
    escalations: [{ ...item, supervisionItemId: "escalation-1", itemType: "escalation", label: "critical escalation" }],
    reviewReferences: [{ ...item, supervisionItemId: "review-1", itemType: "review_requirement", label: "review lineage" }],
    evidenceReferences: [{ ...item, supervisionItemId: "evidence-1", itemType: "review_requirement", label: "evidence pack" }],
    timelineReferences: [{ ...item, supervisionItemId: "timeline-1", itemType: "review_requirement", label: "timeline" }],
  };
}

describe("AgentSupervisionConsole", () => {
  it("renders summary, blocked reasons, links, and required safety copy without mutation controls", () => {
    render(
      <MemoryRouter>
        <AgentSupervisionConsole snapshot={snapshot()} />
      </MemoryRouter>
    );

    expect(screen.getByText("Supervised operational intelligence only.")).toBeInTheDocument();
    expect(screen.getByText(/Manual review and approval remain required/i)).toBeInTheDocument();
    expect(screen.getByText(/No tenant communication, payment action, legal enforcement, or external submission is automated/i)).toBeInTheDocument();
    expect(screen.getAllByText("Suggested actions").length).toBeGreaterThan(0);
    expect(screen.getByText("Blocked actions")).toBeInTheDocument();
    expect(screen.getByText("Pending reviews")).toBeInTheDocument();
    expect(screen.getAllByText("Escalations").length).toBeGreaterThan(0);
    expect(screen.getByText("Workflow sync issues")).toBeInTheDocument();
    expect(screen.getByText("Blocked policy guards")).toBeInTheDocument();
    expect(screen.getByText("Review lineage")).toBeInTheDocument();
    expect(screen.getByText("Evidence references")).toBeInTheDocument();
    expect(screen.getByText("Timeline references")).toBeInTheDocument();
    expect(screen.getAllByText("Required workflow context is missing or incomplete.").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "View supervision item" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Manual review required").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Policy guarded").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Human approval required").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /execute|auto|approve|submit/i })).not.toBeInTheDocument();
  });
});
