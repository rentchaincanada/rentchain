import { describe, expect, it } from "vitest";
import { applyDecisionExecutionMappings } from "../deriveDecisionExecutionMappings";
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
    automationState: "blocked",
    automationReason:
      "A lease automation path exists, but this decision still needs a specific lease target and notice inputs before execution.",
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

describe("applyDecisionExecutionMappings", () => {
  it("maps a lease-renewal decision when one exact expiring lease is visible", () => {
    const result = applyDecisionExecutionMappings({
      decisions: [baseDecision()],
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-1",
          status: "active",
          endDate: "2026-05-10T00:00:00.000Z",
        },
      ],
      workOrders: [],
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        automationEligible: false,
        executionMappingState: "mapped",
        executionMapping: {
          action: "lease.auto_send_notice",
          resourceType: "lease",
          resourceId: "lease-1",
          prerequisitesMet: false,
          prerequisiteReason: expect.stringContaining("explicit landlord input"),
        },
        executionInputState: "partial",
        executionInputReason: expect.stringContaining("rentChangeMode"),
        executionInputMissingFields: [
          "rentChangeMode",
          "newTermType",
          "newLeaseStartDate",
          "newLeaseEndDate",
          "responseDeadlineAt",
        ],
        executionInput: expect.objectContaining({
          noticeType: "renewal_offer",
          legalTemplateKey: "ns.fixed_term.renewal_offer.v1",
          noticeRuleVersion: "ns-v1",
          province: "NS",
          leaseType: "fixed_term",
          currentRent: null,
          rentChangeMode: null,
          proposedRent: null,
          newTermType: null,
          newLeaseStartDate: null,
          newLeaseEndDate: null,
          responseDeadlineAt: null,
        }),
      })
    );
  });

  it("fails closed when more than one qualifying lease is visible", () => {
    const result = applyDecisionExecutionMappings({
      decisions: [baseDecision()],
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-1",
          status: "active",
          endDate: "2026-05-10T00:00:00.000Z",
        },
        {
          id: "lease-2",
          propertyId: "prop-1",
          status: "active",
          endDate: "2026-05-15T00:00:00.000Z",
        },
      ],
      workOrders: [],
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        executionMappingState: "none",
        executionMapping: null,
      })
    );
  });

  it("keeps non-adjacent decisions unmapped", () => {
    const result = applyDecisionExecutionMappings({
      decisions: [
        baseDecision({
          id: "reduce_vacancy_risk:prop-2",
          decisionType: "reduce_vacancy_risk",
          actionKey: "open_vacancy_readiness_flow",
          actionLabel: "Open vacancy readiness",
          destination: "/analytics?entry=vacancy-readiness&propertyId=prop-2",
          href: "/analytics?entry=vacancy-readiness&propertyId=prop-2",
          workflowCategory: "vacancy_readiness",
          recommendedAction: "View property analytics",
          automationState: "manual_only",
          automationReason: "This decision is guidance-only in v1 and does not map to an execution rule.",
        }),
      ],
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-1",
          status: "active",
          endDate: "2026-05-10T00:00:00.000Z",
        },
      ],
      workOrders: [],
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        executionMappingState: "none",
        executionMapping: null,
      })
    );
  });

  it("maps stored renewal offer fields deterministically but keeps operator-choice term fields partial", () => {
    const result = applyDecisionExecutionMappings({
      decisions: [baseDecision()],
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          province: "NS",
          leaseType: "fixed_term",
          currentRent: 1650,
          renewalOfferedRent: 1750,
          renewalDecisionDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
          leaseEndDate: "2026-05-10",
          status: "active",
        },
      ],
      workOrders: [],
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        automationEligible: false,
        executionMappingState: "mapped",
        executionInputState: "partial",
        executionInputReason: expect.stringContaining("newTermType"),
        executionInputMissingFields: ["newTermType", "newLeaseStartDate", "newLeaseEndDate"],
        executionInput: expect.objectContaining({
          rentChangeMode: "increase",
          proposedRent: 1750,
          responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
          newTermType: null,
          newLeaseStartDate: null,
          newLeaseEndDate: null,
        }),
      })
    );
  });

  it("promotes a lease-renewal decision to complete when canonical renewal inputs are fully stored", () => {
    const result = applyDecisionExecutionMappings({
      decisions: [baseDecision()],
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          province: "NS",
          leaseType: "fixed_term",
          currentRent: 1650,
          renewalRentChangeMode: "no_change",
          renewalDecisionDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
          renewalNewTermType: "fixed_term",
          renewalNewLeaseStartDate: "2026-05-11",
          renewalNewLeaseEndDate: "2027-05-10",
          leaseEndDate: "2026-05-10",
          status: "active",
        },
      ],
      workOrders: [],
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        automationEligible: true,
        executionMappingState: "mapped",
        executionMapping: expect.objectContaining({
          prerequisitesMet: true,
          prerequisiteReason: null,
        }),
        executionInputState: "complete",
        executionInputReason: null,
        executionInputMissingFields: [],
        executionInput: expect.objectContaining({
          rentChangeMode: "no_change",
          newTermType: "fixed_term",
          newLeaseStartDate: "2026-05-11",
          newLeaseEndDate: "2027-05-10",
          responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
        }),
      })
    );
  });

  it("maps a deterministic maintenance approval decision to one exact work order", () => {
    const result = applyDecisionExecutionMappings({
      decisions: [
        baseDecision({
          id: "approve_maintenance_cost:wo-1",
          decisionType: "approve_maintenance_cost",
          actionKey: "open_maintenance_cost_approval_flow",
          actionLabel: "Open cost approval",
          destination: "/work-orders?entry=maintenance-cost-approval&propertyId=prop-2&workOrderId=wo-1",
          href: "/work-orders?entry=maintenance-cost-approval&propertyId=prop-2&workOrderId=wo-1",
          workflowCategory: "maintenance_cost_approval",
          recommendedAction: "Review work order approval",
          automationState: "blocked",
          automationReason: "A deterministic maintenance approval target exists, but explicit maintenance execution is not enabled yet.",
        }),
      ],
      leases: [],
      workOrders: [
        {
          id: "wo-1",
          propertyId: "prop-2",
          cost: {
            actualCostCents: 32000,
            currency: "CAD",
            reviewStatus: "pending_review",
            linkedExpenseStatus: "not_linked",
          },
          costAttachments: [{ id: "attachment-1" }],
        },
      ],
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
        automationEligible: true,
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
        executionInput: expect.objectContaining({
          actualCostCents: 32000,
          currency: "CAD",
          reviewStatus: "pending_review",
          hasSupportingEvidence: true,
          thresholdCents: 100000,
          withinAutoApprovalThreshold: true,
        }),
      })
    );
  });

  it("maps a deterministic screening checkout decision to one exact application and marks it execution-ready", () => {
    const result = applyDecisionExecutionMappings({
      decisions: [
        baseDecision({
          id: "start_screening_checkout:app-1",
          decisionType: "start_screening_checkout",
          actionKey: "open_screening_checkout_flow",
          actionLabel: "Open screening checkout",
          destination: "/applications?entry=screening-checkout&propertyId=prop-3&applicationId=app-1",
          href: "/applications?entry=screening-checkout&propertyId=prop-3&applicationId=app-1",
          workflowCategory: "screening_checkout",
          recommendedAction: "Start screening checkout",
          automationState: "blocked",
          automationReason: "This screening checkout decision still needs one exact screening-ready application and complete checkout inputs before execution.",
        }),
      ],
      leases: [],
      workOrders: [],
      applications: [
        {
          id: "app-1",
          propertyId: "prop-3",
          unitId: "unit-7",
          status: "SUBMITTED",
          applicant: {
            firstName: "Jane",
            lastName: "Doe",
            email: "jane@example.com",
            dob: "1990-01-01",
          },
          consent: {
            creditConsent: true,
            referenceConsent: true,
            acceptedAt: "2026-04-20T10:00:00.000Z",
            version: "v1.0",
          },
          residentialHistory: [{ address: "123 Main St" }],
          screeningMonetization: {
            eligibility: "eligible",
            quoteStatus: "generated",
            paymentStatus: "pending_checkout",
            fulfillmentStatus: "ready",
            quoteId: "quote_app-1",
            quoteGeneratedAt: "2026-04-20T11:00:00.000Z",
            quoteExpiresAt: "2026-04-20T11:30:00.000Z",
          },
        },
      ],
      screeningOrders: [],
      now: Date.UTC(2026, 3, 20, 11, 5, 0, 0),
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
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
        executionInputReason: null,
        executionInputMissingFields: [],
        executionInput: expect.objectContaining({
          applicationId: "app-1",
          propertyId: "prop-3",
          unitId: "unit-7",
          applicantEmail: "jane@example.com",
          quoteId: "quote_app-1",
          quoteStatus: "generated",
          paymentStatus: "pending_checkout",
          fulfillmentStatus: "ready",
          canStartCheckout: true,
          policyOutcome: "allow",
        }),
      })
    );
  });
});
