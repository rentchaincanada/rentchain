import { describe, expect, it } from "vitest";
import { derivePolicyGatedAgentActions } from "../derivePolicyGatedAgentActions";
import type { DecisionInboxItem } from "../../decisions/decisionInboxTypes";

function decision(overrides: Partial<DecisionInboxItem> = {}): DecisionInboxItem {
  return {
    id: "decision-1",
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
    automatedWorkflow: {
      automationId: "automated_workflow:decision-1:delinquency_review",
      decisionId: "decision-1",
      workflowType: "delinquency",
      status: "pending",
      queue: "delinquency_review",
      escalationLevel: "critical",
      manualReviewRequired: true,
      policyGuarded: true,
      externalExecutionEnabled: false,
      requiresHumanAcknowledgement: true,
      transition: { fromState: "escalated", toState: "escalated" },
      reasons: ["Manual review remains required."],
      blockedReasons: [],
      canonicalEvents: [],
      generatedAt: "2026-05-06T00:00:00.000Z",
    },
    createdAt: "2026-05-05T12:00:00.000Z",
    updatedAt: "2026-05-05T12:00:00.000Z",
    ...overrides,
    workflow: {
      queue: "delinquency_review",
      workflowState: "escalated",
      ownershipType: "landlord",
      reviewPriority: "critical",
      escalationLevel: "critical",
      manualOnly: true,
      ...overrides.workflow,
    },
  };
}

describe("derivePolicyGatedAgentActions", () => {
  it("derives deterministic escalation suggestions with required safety flags", () => {
    const result = derivePolicyGatedAgentActions({
      generatedAt: "2026-05-06T00:00:00.000Z",
      decisions: [decision()],
    });

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toEqual(expect.objectContaining({
      agentActionId: "policy_gated_agent_action:decision-1:suggest_escalation",
      actionType: "suggest_escalation",
      status: "suggested",
      manualReviewRequired: true,
      policyGuarded: true,
      externalExecutionEnabled: false,
      requiresHumanApproval: true,
      relatedScope: { scope: "decision", scopeId: "decision-1" },
      generatedAt: "2026-05-06T00:00:00.000Z",
    }));
    expect(result.actions[0].explanation.reasons).toEqual(expect.arrayContaining([
      "Workflow escalation metadata indicates elevated review priority.",
      "Operator review and human approval remain required.",
    ]));
    expect(result.actions[0].canonicalEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "policy_gated_agent_action_suggested" }),
      expect.objectContaining({ eventType: "policy_gated_agent_action_review_required" }),
    ]));
    expect(result.summary).toEqual(expect.objectContaining({ total: 1, suggested: 1, reviewRequired: 1, escalationSuggested: 1 }));
  });

  it("derives request-evidence suggestions when workflow context is blocked", () => {
    const result = derivePolicyGatedAgentActions({
      decisions: [
        decision({
          id: "decision-2",
          type: "maintenance",
          severity: "high",
          workflow: {
            queue: "maintenance_review",
            workflowState: "waiting_context",
            ownershipType: "landlord",
            reviewPriority: "high",
            escalationLevel: "urgent",
            manualOnly: true,
          },
          automatedWorkflow: {
            ...decision().automatedWorkflow!,
            decisionId: "decision-2",
            status: "blocked",
            queue: "maintenance_review",
            workflowType: "maintenance",
            blockedReasons: ["Required workflow context is missing or incomplete."],
          },
        }),
      ],
    });

    expect(result.actions[0]).toEqual(expect.objectContaining({
      actionType: "request_evidence",
      status: "blocked",
      relatedScope: { scope: "evidence_pack", scopeId: "decision-2" },
    }));
    expect(result.actions[0].explanation.blockedReasons).toContain("Required workflow context is missing or incomplete.");
    expect(result.actions[0].canonicalEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "policy_gated_agent_action_blocked" }),
    ]));
  });

  it("blocks admin-owned suggestions from landlord-safe output", () => {
    const result = derivePolicyGatedAgentActions({
      decisions: [
        decision({
          id: "admin-decision",
          workflow: {
            queue: "admin_review",
            workflowState: "new",
            ownershipType: "admin",
            reviewPriority: "high",
            escalationLevel: "urgent",
            manualOnly: true,
          },
        }),
      ],
    });

    expect(result.actions[0].status).toBe("blocked");
    expect(result.actions[0].explanation.blockedReasons).toContain(
      "Admin-owned decisions are not exposed through landlord agent-action suggestions."
    );
  });

  it("filters suggestions by type, status, queue, and escalation", () => {
    const result = derivePolicyGatedAgentActions({
      decisions: [
        decision(),
        decision({
          id: "decision-2",
          type: "maintenance",
          severity: "high",
          workflow: {
            queue: "maintenance_review",
            workflowState: "waiting_context",
            ownershipType: "landlord",
            reviewPriority: "high",
            escalationLevel: "urgent",
            manualOnly: true,
          },
          automatedWorkflow: {
            ...decision().automatedWorkflow!,
            decisionId: "decision-2",
            status: "blocked",
            queue: "maintenance_review",
            workflowType: "maintenance",
            blockedReasons: ["Required workflow context is missing or incomplete."],
          },
        }),
      ],
      filters: {
        actionType: "request_evidence",
        status: "blocked",
        queue: "maintenance_review",
        escalationLevel: "urgent",
      },
    });

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].agentActionId).toBe("policy_gated_agent_action:decision-2:request_evidence");
  });

  it("does not mutate source decisions", () => {
    const source = decision();
    const before = structuredClone(source);

    derivePolicyGatedAgentActions({ decisions: [source] });

    expect(source).toEqual(before);
  });
});
