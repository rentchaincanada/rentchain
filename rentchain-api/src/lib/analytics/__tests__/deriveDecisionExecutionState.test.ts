import { describe, expect, it } from "vitest";
import type { LandlordAgentDecision } from "../analyticsTypes";
import { deriveDecisionExecutionState } from "../deriveDecisionExecutionState";

function baseDecision(overrides?: Partial<LandlordAgentDecision>): LandlordAgentDecision {
  return {
    id: "review_lease_renewals:lease-1",
    decisionType: "review_lease_renewals",
    priority: "high",
    explanation: "Review renewal notice.",
    supportingSignals: [],
    recommendedAction: "Review renewals",
    href: "/portfolio-health?entry=lease-renewals&leaseId=lease-1",
    state: "pending",
    reviewedAt: null,
    actionKey: "open_lease_renewals_flow",
    actionLabel: "Open renewals focus",
    destination: "/portfolio-health?entry=lease-renewals&leaseId=lease-1",
    workflowCategory: "lease_renewals",
    automationEligible: true,
    automationState: "ready",
    automationReason: "This decision is active and already mapped to a deterministic automation path.",
    executionMappingState: "mapped",
    executionMapping: {
      action: "lease.auto_send_notice",
      resourceType: "lease",
      resourceId: "lease-1",
      prerequisitesMet: true,
      prerequisiteReason: null,
    },
    executionInputState: "complete",
    executionInputReason: null,
    executionInputMissingFields: [],
    executionInput: {
      noticeType: "renewal_offer",
      legalTemplateKey: "ns.fixed_term.renewal_offer.v1",
      noticeRuleVersion: "ns-v1",
      province: "NS",
      leaseType: "fixed_term",
      currentRent: 1500,
      rentChangeMode: "no_change",
      proposedRent: 1500,
      newTermType: "fixed_term",
      newLeaseStartDate: "2026-06-01",
      newLeaseEndDate: "2027-05-31",
      responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
    },
    executionState: "blocked",
    blockedReason: "unknown_state_fail_closed",
    executionGuardKey: null,
    duplicateGuardActive: false,
    executionSummary: {
      lastExecutedAt: null,
      executionCount: 0,
      lastExecutionOutcome: "none",
      lastExecutionOutcomeAt: null,
    },
    executedAt: null,
    executionOutcomeStatus: "none",
    executionOutcomeAt: null,
    executionOutcomeReason: null,
    ...overrides,
  };
}

describe("deriveDecisionExecutionState", () => {
  it("marks fully ready decisions as executable", () => {
    expect(deriveDecisionExecutionState(baseDecision(), [])).toEqual(
      expect.objectContaining({
        executionState: "executable",
        blockedReason: null,
        executionGuardKey: "lease.auto_send_notice:lease:lease-1",
        duplicateGuardActive: false,
        executionSummary: {
          lastExecutedAt: null,
          executionCount: 0,
          lastExecutionOutcome: "none",
          lastExecutionOutcomeAt: null,
        },
      })
    );
  });

  it("marks incomplete decisions as blocked with missing input reason", () => {
    const result = deriveDecisionExecutionState(
      baseDecision({
        automationEligible: false,
        automationState: "blocked",
        executionInputState: "partial",
        executionInputReason: "Still missing landlord input.",
        executionInputMissingFields: ["newLeaseEndDate"],
      }),
      []
    );

    expect(result.executionState).toBe("blocked");
    expect(result.blockedReason).toBe("missing_required_inputs");
  });

  it("marks policy-blocked decisions with a policy blocked reason", () => {
    const result = deriveDecisionExecutionState(
      baseDecision({
        id: "start_screening_checkout:app-1",
        decisionType: "start_screening_checkout",
        actionKey: "open_screening_checkout_flow",
        actionLabel: "Open screening checkout",
        destination: "/applications?entry=screening-checkout&applicationId=app-1",
        href: "/applications?entry=screening-checkout&applicationId=app-1",
        workflowCategory: "screening_checkout",
        recommendedAction: "Start screening checkout",
        executionMapping: {
          action: "screening.auto_start_checkout",
          resourceType: "rental_application",
          resourceId: "app-1",
          prerequisitesMet: false,
          prerequisiteReason: "Policy blocked.",
        },
        executionInput: {
          applicationId: "app-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          applicantEmail: "alex@example.com",
          applicationStatus: "SUBMITTED",
          eligibility: "eligible",
          eligibilityReasonCode: "ELIGIBLE",
          consentVersion: "v1",
          consentTimestamp: "2026-04-22T10:00:00.000Z",
          quoteId: "quote-1",
          quoteGeneratedAt: "2026-04-22T10:30:00.000Z",
          quoteExpiresAt: "2026-04-22T11:00:00.000Z",
          quoteStatus: "generated",
          paymentStatus: "pending_checkout",
          fulfillmentStatus: "blocked",
          blockingReason: "provider_policy_denied",
          policyOutcome: "deny",
          canStartCheckout: false,
        } as any,
        automationEligible: false,
        automationState: "blocked",
      }),
      []
    );

    expect(result.executionState).toBe("blocked");
    expect(result.blockedReason).toBe("policy_blocked");
  });

  it("marks executed decisions as already executed", () => {
    const result = deriveDecisionExecutionState(
      baseDecision({
        state: "executed",
        executedAt: "2026-04-22T12:00:00.000Z",
        executionOutcomeStatus: "succeeded",
        executionOutcomeAt: "2026-04-22T12:00:00.000Z",
      }),
      []
    );

    expect(result.executionState).toBe("already_executed");
    expect(result.blockedReason).toBeNull();
    expect(result.executionSummary.executionCount).toBe(1);
  });

  it("marks successful prior terminal outcomes as unsafe duplicates when state was not resolved", () => {
    const result = deriveDecisionExecutionState(baseDecision(), [
      {
        id: "evt-1",
        type: "decision.executed",
        occurredAt: "2026-04-22T12:00:00.000Z",
        recordedAt: "2026-04-22T12:00:01.000Z",
        resource: {
          type: "analytics_decision",
          id: "review_lease_renewals:lease-1",
        },
        metadata: {
          decisionId: "review_lease_renewals:lease-1",
        },
      } as any,
    ]);

    expect(result.executionState).toBe("unsafe_duplicate");
    expect(result.blockedReason).toBe("duplicate_prevented");
    expect(result.duplicateGuardActive).toBe(true);
    expect(result.executionSummary.executionCount).toBe(1);
    expect(result.executionSummary.lastExecutionOutcome).toBe("succeeded");
  });
});
