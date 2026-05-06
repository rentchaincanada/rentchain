import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentActionPanel } from "./AgentActionPanel";
import type { PolicyGatedAgentAction } from "@/api/decisionInboxApi";

function action(overrides: Partial<PolicyGatedAgentAction> = {}): PolicyGatedAgentAction {
  return {
    agentActionId: "policy_gated_agent_action:decision-1:suggest_escalation",
    actionType: "suggest_escalation",
    status: "suggested",
    manualReviewRequired: true,
    policyGuarded: true,
    externalExecutionEnabled: false,
    requiresHumanApproval: true,
    explanation: {
      summary: "Escalation review is recommended based on workflow severity.",
      reasons: ["Workflow escalation metadata indicates elevated review priority."],
      blockedReasons: [],
    },
    relatedScope: { scope: "decision", scopeId: "decision-1" },
    queue: "delinquency_review",
    escalationLevel: "critical",
    canonicalEvents: [],
    generatedAt: "2026-05-06T00:00:00.000Z",
    ...overrides,
  };
}

describe("AgentActionPanel", () => {
  it("renders suggested actions with safety copy and no forbidden controls", () => {
    render(<AgentActionPanel actions={[action()]} />);

    expect(screen.getByText("Suggested actions only.")).toBeInTheDocument();
    expect(screen.getByText(/Manual approval is required/i)).toBeInTheDocument();
    expect(screen.getByText("Suggest Escalation")).toBeInTheDocument();
    expect(screen.getByText("Review explanation")).toBeInTheDocument();
    expect(screen.getByText("External execution disabled")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /execute|auto|approve|submit/i })).not.toBeInTheDocument();
  });

  it("renders blocked reasons", () => {
    render(
      <AgentActionPanel
        actions={[
          action({
            actionType: "request_evidence",
            status: "blocked",
            explanation: {
              summary: "Request additional evidence before progressing this workflow.",
              reasons: ["Workflow context is blocked."],
              blockedReasons: ["Required workflow context is missing or incomplete."],
            },
          }),
        ]}
      />
    );

    expect(screen.getByText("Request Evidence")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("Required workflow context is missing or incomplete.")).toBeInTheDocument();
  });
});
