import { describe, expect, it } from "vitest";
import { deriveAutomatedWorkflowTransitions } from "../deriveAutomatedWorkflowTransitions";
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
      workflowState: "new",
      ownershipType: "landlord",
      reviewPriority: "critical",
      escalationLevel: "critical",
      manualOnly: true,
    },
    createdAt: "2026-05-05T12:00:00.000Z",
    updatedAt: "2026-05-05T12:00:00.000Z",
    ...overrides,
    workflow: {
      queue: "delinquency_review",
      workflowState: "new",
      ownershipType: "landlord",
      reviewPriority: "critical",
      escalationLevel: "critical",
      manualOnly: true,
      ...overrides.workflow,
    },
  };
}

describe("deriveAutomatedWorkflowTransitions", () => {
  it("derives deterministic internal transitions without enabling external execution", () => {
    const result = deriveAutomatedWorkflowTransitions({
      generatedAt: "2026-05-06T00:00:00.000Z",
      decisions: [decision()],
    });

    expect(result.workflows).toHaveLength(1);
    expect(result.workflows[0]).toEqual(expect.objectContaining({
      automationId: "automated_workflow:decision-1:delinquency_review",
      decisionId: "decision-1",
      workflowType: "delinquency",
      status: "derived",
      manualReviewRequired: true,
      policyGuarded: true,
      externalExecutionEnabled: false,
      requiresHumanAcknowledgement: true,
      transition: { fromState: "new", toState: "under_review" },
      generatedAt: "2026-05-06T00:00:00.000Z",
    }));
    expect(result.workflows[0].canonicalEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "automated_workflow_transition_derived" }),
      expect.objectContaining({ eventType: "automated_workflow_escalation_flagged" }),
      expect.objectContaining({ eventType: "automated_workflow_review_required" }),
    ]));
    expect(result.summary).toEqual(expect.objectContaining({ total: 1, derived: 1, escalationFlagged: 1, reviewRequired: 1 }));
  });

  it("blocks waiting-context workflow previews with explicit reasons", () => {
    const result = deriveAutomatedWorkflowTransitions({
      decisions: [
        decision({
          workflow: {
            queue: "maintenance_review",
            workflowState: "waiting_context",
            ownershipType: "landlord",
            reviewPriority: "high",
            escalationLevel: "urgent",
            manualOnly: true,
          },
          type: "maintenance",
          severity: "high",
        }),
      ],
    });

    expect(result.workflows[0]).toEqual(expect.objectContaining({
      workflowType: "maintenance",
      status: "blocked",
      transition: { fromState: "waiting_context", toState: "waiting_context" },
      blockedReasons: ["Required workflow context is missing or incomplete."],
    }));
    expect(result.workflows[0].canonicalEvents).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: "automated_workflow_blocked" }),
    ]));
  });

  it("marks resolved workflow previews completed", () => {
    const result = deriveAutomatedWorkflowTransitions({
      decisions: [
        decision({
          status: "resolved",
          workflow: {
            queue: "lease_review",
            workflowState: "resolved",
            ownershipType: "landlord",
            reviewPriority: "low",
            escalationLevel: "none",
            manualOnly: true,
          },
          type: "lease",
          severity: "low",
        }),
      ],
    });

    expect(result.workflows[0]).toEqual(expect.objectContaining({
      workflowType: "review",
      status: "completed",
      transition: { fromState: "resolved", toState: "resolved" },
    }));
  });

  it("filters by workflow type, status, queue, and escalation level", () => {
    const result = deriveAutomatedWorkflowTransitions({
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
        }),
      ],
      filters: {
        workflowType: "maintenance",
        status: "blocked",
        queue: "maintenance_review",
        escalationLevel: "urgent",
      },
    });

    expect(result.workflows).toHaveLength(1);
    expect(result.workflows[0].decisionId).toBe("decision-2");
    expect(result.summary).toEqual(expect.objectContaining({ total: 1, blocked: 1 }));
  });

  it("does not mutate source decisions", () => {
    const source = decision();
    const before = structuredClone(source);

    deriveAutomatedWorkflowTransitions({ decisions: [source] });

    expect(source).toEqual(before);
  });
});
