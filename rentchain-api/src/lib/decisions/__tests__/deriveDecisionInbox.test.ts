import { describe, expect, it } from "vitest";
import { deriveDecisionInbox } from "../deriveDecisionInbox";
import type { Decision } from "../decisionEngine";
import type { LandlordAgentDecision } from "../../analytics/analyticsTypes";

function leaseDecision(overrides: Partial<Decision> = {}): Decision {
  return {
    decisionId: "decision:review_missing_payment:lease-1",
    leaseId: "lease-1",
    paymentIntentId: "pi-1",
    rentPaymentId: null,
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    decisionType: "review_missing_payment",
    severity: "critical",
    status: "detected",
    reason: "Expected rent payment is missing.",
    metadata: { source: "delinquency_signal" },
    createdAt: "2026-05-05T12:00:00.000Z",
    updatedAt: "2026-05-05T12:00:00.000Z",
    ...overrides,
  };
}

function analyticsDecision(overrides: Partial<LandlordAgentDecision> = {}): LandlordAgentDecision {
  return {
    id: "approve_maintenance_cost:wo-1",
    decisionType: "approve_maintenance_cost",
    priority: "high",
    explanation: "A maintenance cost needs review.",
    supportingSignals: [],
    recommendedAction: "Open cost approval",
    state: "pending",
    actionKey: "open_maintenance_cost_approval_flow",
    actionLabel: "Open cost approval",
    destination: "/work-orders?workOrderId=wo-1",
    workflowCategory: "maintenance_cost_approval",
    automationEligible: true,
    automationState: "ready",
    automationReason: "Execution is available elsewhere but not from the inbox.",
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
    executionInput: null,
    executionState: "executable",
    blockedReason: null,
    executionGuardKey: "maintenance.auto_approve_cost:work_order:wo-1",
    duplicateGuardActive: false,
    executionSummary: {
      lastExecutedAt: null,
      executionCount: 0,
      lastExecutionOutcome: "none",
      lastExecutionOutcomeAt: null,
    },
    executionOutcomeStatus: "none",
    executionOutcomeAt: null,
    executionOutcomeReason: null,
    ...overrides,
  };
}

describe("deriveDecisionInbox", () => {
  it("normalizes existing lease and analytics decisions into a read-only inbox", () => {
    const result = deriveDecisionInbox({
      leaseDecisions: [leaseDecision()],
      analyticsDecisions: [analyticsDecision()],
    });

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "decision:review_missing_payment:lease-1",
          severity: "critical",
          status: "open",
          type: "billing",
          source: "lease_ledger",
          destination: "/leases/lease-1/ledger",
          automationEligible: false,
        }),
        expect.objectContaining({
          id: "approve_maintenance_cost:wo-1",
          severity: "high",
          status: "open",
          type: "maintenance",
          source: "analytics",
          destination: "/work-orders?workOrderId=wo-1",
          automationEligible: false,
        }),
      ])
    );
  });

  it("filters by severity, status, and type deterministically", () => {
    const result = deriveDecisionInbox({
      leaseDecisions: [
        leaseDecision(),
        leaseDecision({
          decisionId: "decision:review_underpaid_rent:lease-2",
          leaseId: "lease-2",
          decisionType: "review_underpaid_rent",
          severity: "warning",
          status: "reviewed",
        }),
      ],
      analyticsDecisions: [analyticsDecision()],
      filters: { severity: "medium", status: "pending", type: "billing" },
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: "decision:review_underpaid_rent:lease-2",
        severity: "medium",
        status: "pending",
        type: "billing",
      })
    );
  });

  it("returns summary counts for the filtered result", () => {
    const result = deriveDecisionInbox({
      leaseDecisions: [leaseDecision(), leaseDecision({ decisionId: "decision:resolved", status: "resolved" })],
      analyticsDecisions: [analyticsDecision({ id: "blocked-decision", executionState: "blocked" })],
    });

    expect(result.summary).toEqual({
      total: 3,
      critical: 2,
      high: 1,
      open: 1,
      blocked: 1,
    });
  });
});
