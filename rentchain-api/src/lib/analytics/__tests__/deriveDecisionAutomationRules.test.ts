import { describe, expect, it } from "vitest";
import { applyDecisionAutomationRules, deriveDecisionAutomationRule } from "../deriveDecisionAutomationRules";
import type { LandlordAgentDecision } from "../analyticsTypes";

function baseDecision(overrides?: Partial<LandlordAgentDecision>): LandlordAgentDecision {
  return {
    id: "review_lease_renewals:prop-1",
    decisionType: "review_lease_renewals",
    priority: "high",
    explanation: "Review upcoming renewals.",
    supportingSignals: [],
    recommendedAction: "Review renewals",
    href: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
    state: "pending",
    reviewedAt: null,
    actionKey: "open_lease_renewals_flow",
    actionLabel: "Open renewals focus",
    destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
    workflowCategory: "lease_renewals",
    automationEligible: false,
    automationState: "manual_only",
    automationReason: null,
    executionMappingState: "none",
    executionMapping: null,
    executionInputState: "none",
    executionInputReason: null,
    executionInputMissingFields: [],
    executionInput: null,
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

describe("deriveDecisionAutomationRule", () => {
  it("blocks reviewed decisions even when they were otherwise executor-adjacent", () => {
    expect(
      deriveDecisionAutomationRule(
        baseDecision({
          state: "reviewed",
          automationEligible: true,
        })
      )
    ).toEqual(
      expect.objectContaining({
        automationEligible: false,
        automationState: "blocked",
      })
    );
  });

  it("marks workflow-adjacent decisions as blocked when they still lack execution-ready targeting", () => {
    expect(deriveDecisionAutomationRule(baseDecision())).toEqual(
      expect.objectContaining({
        automationEligible: false,
        automationState: "blocked",
      })
    );
  });

  it("keeps analytics-only guidance decisions manual when no automation family exists", () => {
    expect(
      deriveDecisionAutomationRule(
        baseDecision({
          id: "reduce_vacancy_risk:prop-2",
          decisionType: "reduce_vacancy_risk",
          actionKey: "open_vacancy_readiness_flow",
          actionLabel: "Open vacancy readiness",
          workflowCategory: "vacancy_readiness",
          recommendedAction: "View property analytics",
          destination: "/analytics?entry=vacancy-readiness&propertyId=prop-2",
          href: "/analytics?entry=vacancy-readiness&propertyId=prop-2",
        })
      )
    ).toEqual(
      expect.objectContaining({
        automationEligible: false,
        automationState: "manual_only",
      })
    );
  });

  it("marks screening checkout decisions ready once deterministic execution is enabled", () => {
    expect(
      deriveDecisionAutomationRule(
        baseDecision({
          id: "start_screening_checkout:app-1",
          decisionType: "start_screening_checkout",
          actionKey: "open_screening_checkout_flow",
          actionLabel: "Open screening checkout",
          workflowCategory: "screening_checkout",
          recommendedAction: "Start screening checkout",
          destination: "/applications?entry=screening-checkout&applicationId=app-1",
          href: "/applications?entry=screening-checkout&applicationId=app-1",
          automationEligible: true,
          executionMappingState: "mapped",
          executionMapping: {
            action: "screening.auto_start_checkout",
            resourceType: "rental_application",
            resourceId: "app-1",
            prerequisitesMet: true,
            prerequisiteReason: null,
          },
          executionInputState: "complete",
          executionInput: {
            applicationId: "app-1",
            propertyId: "prop-1",
            unitId: "unit-1",
            applicantEmail: "jane@example.com",
            applicationStatus: "SUBMITTED",
            eligibility: "eligible",
            eligibilityReasonCode: "ELIGIBLE",
            consentVersion: "v1.0",
            consentTimestamp: "2026-04-20T10:00:00.000Z",
            quoteId: "quote_app-1",
            quoteGeneratedAt: "2026-04-20T11:00:00.000Z",
            quoteExpiresAt: "2026-04-20T11:30:00.000Z",
            quoteStatus: "generated",
            paymentStatus: "pending_checkout",
            fulfillmentStatus: "ready",
            blockingReason: null,
            policyOutcome: "allow",
            canStartCheckout: true,
          } as any,
        })
      )
    ).toEqual(
      expect.objectContaining({
        automationEligible: true,
        automationState: "ready",
        automationReason: "This decision is active and already mapped to a deterministic automation path.",
      })
    );
  });

  it("supports a ready state when a future decision explicitly opts into a deterministic executor path", () => {
    expect(
      deriveDecisionAutomationRule(
        baseDecision({
          automationEligible: true,
        })
      )
    ).toEqual(
      expect.objectContaining({
        automationEligible: true,
        automationState: "ready",
      })
    );
  });

  it("applies rule output across the decision list", () => {
    const result = applyDecisionAutomationRules([
      baseDecision(),
      baseDecision({
        id: "approve_maintenance_cost:wo-1",
        decisionType: "approve_maintenance_cost",
        actionKey: "open_maintenance_cost_approval_flow",
        actionLabel: "Open cost approval",
        workflowCategory: "maintenance_cost_approval",
        recommendedAction: "Review work order approval",
        destination: "/work-orders?entry=maintenance-cost-approval&workOrderId=wo-1",
        href: "/work-orders?entry=maintenance-cost-approval&workOrderId=wo-1",
        automationEligible: true,
        executionMappingState: "mapped",
        executionInputState: "complete",
        executionInput: {
          actualCostCents: 32000,
          currency: "CAD",
          reviewStatus: "pending_review",
          linkedExpenseStatus: "not_linked",
          hasSupportingEvidence: true,
          thresholdCents: 100000,
          withinAutoApprovalThreshold: true,
        } as any,
      }),
      baseDecision({
        id: "focus_highest_risk_property:prop-2",
        decisionType: "focus_highest_risk_property",
        actionKey: "open_property_focus_flow",
        actionLabel: "Open property focus",
        workflowCategory: "property_focus",
        recommendedAction: "View property analytics",
        destination: "/analytics?entry=property-focus&propertyId=prop-2",
        href: "/analytics?entry=property-focus&propertyId=prop-2",
      }),
    ]);

    expect(result.map((decision) => decision.automationState)).toEqual(["blocked", "ready", "manual_only"]);
  });
});
