import { describe, expect, it } from "vitest";
import { deriveDecisionWorkflowRouting } from "../deriveDecisionWorkflowRouting";

const baseInput = {
  id: "decision:review_missing_payment:lease-1",
  title: "Review Missing Payment",
  description: "Expected rent payment is missing.",
  severity: "critical" as const,
  status: "open" as const,
  type: "billing" as const,
  source: "lease_ledger" as const,
  decisionType: "review_missing_payment",
};

describe("deriveDecisionWorkflowRouting", () => {
  it("routes delinquency decisions to the delinquency review queue", () => {
    expect(deriveDecisionWorkflowRouting(baseInput)).toEqual({
      queue: "delinquency_review",
      workflowState: "escalated",
      ownershipType: "landlord",
      reviewPriority: "critical",
      escalationLevel: "critical",
      manualOnly: true,
    });
  });

  it("routes analytics workflow categories deterministically", () => {
    expect(
      deriveDecisionWorkflowRouting({
        ...baseInput,
        id: "approve_maintenance_cost:wo-1",
        title: "Open cost approval",
        description: "A maintenance cost needs review.",
        severity: "high",
        status: "open",
        type: "maintenance",
        source: "analytics",
        decisionType: "approve_maintenance_cost",
        workflowCategory: "maintenance_cost_approval",
      })
    ).toEqual(
      expect.objectContaining({
        queue: "maintenance_review",
        ownershipType: "landlord",
        reviewPriority: "high",
        escalationLevel: "urgent",
        workflowState: "escalated",
        manualOnly: true,
      })
    );
  });

  it("normalizes pending, resolved, and blocked workflow states without execution behavior", () => {
    expect(deriveDecisionWorkflowRouting({ ...baseInput, status: "pending", severity: "medium" }).workflowState).toBe(
      "under_review"
    );
    expect(deriveDecisionWorkflowRouting({ ...baseInput, status: "resolved" }).workflowState).toBe("resolved");
    expect(deriveDecisionWorkflowRouting({ ...baseInput, status: "blocked", severity: "low" })).toEqual(
      expect.objectContaining({ workflowState: "waiting_context", escalationLevel: "attention" })
    );
  });

  it("classifies compliance and admin decisions without leaking execution intent", () => {
    expect(deriveDecisionWorkflowRouting({ ...baseInput, type: "compliance" })).toEqual(
      expect.objectContaining({ queue: "compliance_review", ownershipType: "compliance", manualOnly: true })
    );
    expect(deriveDecisionWorkflowRouting({ ...baseInput, source: "admin_review", type: "admin" })).toEqual(
      expect.objectContaining({ queue: "admin_review", ownershipType: "admin", manualOnly: true })
    );
  });
});
