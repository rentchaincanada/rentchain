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
          prerequisiteReason: expect.stringContaining("legal notice inputs"),
        },
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
});
