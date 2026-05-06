import { describe, expect, it } from "vitest";
import { deriveAgentSupervisionSnapshot } from "../deriveAgentSupervisionSnapshot";

function decision(overrides: Record<string, any> = {}) {
  return {
    id: "decision-1",
    title: "Review Missing Payment",
    description: "Expected rent payment is missing.",
    severity: "critical",
    destination: "/leases/lease-1/ledger",
    workflow: {
      queue: "delinquency_review",
      workflowState: "escalated",
      escalationLevel: "critical",
      reviewPriority: "critical",
      manualOnly: true,
    },
    automatedWorkflow: {
      automationId: "automated-workflow-1",
      status: "pending",
      transition: { fromState: "escalated", toState: "escalated" },
      blockedReasons: [],
      reasons: ["Decision is routed to delinquency review."],
      canonicalEvents: [
        {
          eventType: "automated_workflow_review_required",
          action: "review_required",
          status: "pending",
          resourceType: "decision",
          resourceId: "decision-1",
          summary: "Human acknowledgement remains required.",
        },
      ],
      generatedAt: "2026-05-06T12:00:00.000Z",
    },
    agentActions: [
      {
        agentActionId: "agent-action-1",
        actionType: "suggest_escalation",
        status: "suggested",
        manualReviewRequired: true,
        policyGuarded: true,
        externalExecutionEnabled: false,
        requiresHumanApproval: true,
        explanation: {
          summary: "Escalation review is recommended.",
          reasons: ["Escalation metadata indicates elevated priority."],
          blockedReasons: [],
        },
        relatedScope: { scope: "decision", scopeId: "decision-1" },
        canonicalEvents: [
          {
            eventType: "policy_gated_agent_action_suggested",
            action: "suggest_escalation",
            status: "suggested",
            resourceType: "decision",
            resourceId: "decision-1",
            summary: "Suggestion is available.",
          },
        ],
        generatedAt: "2026-05-06T12:00:00.000Z",
      },
    ],
    createdAt: "2026-05-06T12:00:00.000Z",
    updatedAt: "2026-05-06T12:00:00.000Z",
    ...overrides,
  };
}

describe("deriveAgentSupervisionSnapshot", () => {
  it("derives deterministic supervision visibility from existing workflow and agent action metadata", () => {
    const snapshot = deriveAgentSupervisionSnapshot({
      generatedAt: "2026-05-06T12:00:00.000Z",
      decisions: [decision()],
    });

    expect(snapshot).toEqual(
      expect.objectContaining({
        manualReviewRequired: true,
        externalExecutionEnabled: false,
        autonomousExecutionEnabled: false,
      })
    );
    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        suggestedActions: 1,
        blockedActions: 0,
        escalations: 1,
        workflowSyncIssues: 0,
      })
    );
    expect(snapshot.agentActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "agent_action",
          status: "suggested",
          policyGuarded: true,
          manualReviewRequired: true,
          requiresHumanApproval: true,
          destination: "/leases/lease-1/ledger",
        }),
      ])
    );
    expect(snapshot.workflowStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "workflow_transition",
          status: "pending_review",
          relatedScope: { scope: "workflow", scopeId: "decision-1" },
        }),
      ])
    );
    expect(snapshot.escalations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "escalation",
          severity: "critical",
          status: "pending_review",
        }),
      ])
    );
    expect(snapshot.canonicalEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "agent_supervision_snapshot_generated" }),
        expect.objectContaining({ eventType: "agent_supervision_escalation_visible" }),
      ])
    );
    expect(JSON.stringify(snapshot)).not.toMatch(/externalExecutionEnabled":true|autonomousExecutionEnabled":true|executed":true/i);
  });

  it("surfaces blocked policy guards and workflow synchronization issues", () => {
    const snapshot = deriveAgentSupervisionSnapshot({
      generatedAt: "2026-05-06T12:00:00.000Z",
      decisions: [
        decision({
          severity: "high",
          workflow: {
            queue: "maintenance_review",
            workflowState: "waiting_context",
            escalationLevel: "urgent",
            reviewPriority: "high",
            manualOnly: true,
          },
          automatedWorkflow: {
            automationId: "automated-workflow-2",
            status: "blocked",
            transition: { fromState: "waiting_context", toState: "waiting_context" },
            blockedReasons: ["Required workflow context is missing or incomplete."],
            reasons: ["Decision is waiting for context."],
            canonicalEvents: [],
            generatedAt: "2026-05-06T12:00:00.000Z",
          },
          agentActions: [
            {
              agentActionId: "agent-action-2",
              actionType: "request_evidence",
              status: "blocked",
              manualReviewRequired: true,
              policyGuarded: true,
              externalExecutionEnabled: false,
              requiresHumanApproval: true,
              explanation: {
                summary: "Request additional evidence.",
                reasons: ["Workflow context is blocked."],
                blockedReasons: ["Required workflow context is missing or incomplete."],
              },
              relatedScope: { scope: "evidence_pack", scopeId: "decision-1" },
              canonicalEvents: [],
              generatedAt: "2026-05-06T12:00:00.000Z",
            },
          ],
        }),
      ],
    });

    expect(snapshot.summary).toEqual(
      expect.objectContaining({
        blockedActions: 1,
        escalations: 1,
        workflowSyncIssues: 1,
      })
    );
    expect(snapshot.policyGuardResults).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "blocked",
          blockedReasons: ["Required workflow context is missing or incomplete."],
        }),
      ])
    );
    expect(snapshot.workflowStates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemType: "synchronization_issue",
          status: "blocked",
          blockedReasons: ["Required workflow context is missing or incomplete."],
        }),
      ])
    );
  });
});
