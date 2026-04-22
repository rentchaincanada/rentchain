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
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
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
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
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
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result[0]).toEqual(
      expect.objectContaining({
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
});
