import { describe, expect, it } from "vitest";
import { deriveLandlordDecisionOutcomeAnalytics } from "../landlordDecisionOutcomeAnalytics";

describe("deriveLandlordDecisionOutcomeAnalytics", () => {
  it("derives all-time outcome metrics from landlord-scoped canonical decision events", () => {
    const result = deriveLandlordDecisionOutcomeAnalytics({
      landlordId: "landlord-1",
      canonicalEvents: [
        {
          id: "event-1",
          type: "decision.appeared",
          visibility: "landlord",
          resource: { type: "analytics_decision", id: "decision-1" },
          metadata: { landlordId: "landlord-1", decisionId: "decision-1" },
          occurredAt: "2026-04-01T00:00:00.000Z",
        } as any,
        {
          id: "event-2",
          type: "decision.reviewed",
          visibility: "landlord",
          resource: { type: "analytics_decision", id: "decision-1" },
          metadata: { landlordId: "landlord-1", decisionId: "decision-1" },
          occurredAt: "2026-04-03T00:00:00.000Z",
        } as any,
        {
          id: "event-3",
          type: "decision.appeared",
          visibility: "landlord",
          resource: { type: "analytics_decision", id: "decision-2" },
          metadata: { landlordId: "landlord-1", decisionId: "decision-2" },
          occurredAt: "2026-04-02T00:00:00.000Z",
        } as any,
        {
          id: "event-4",
          type: "decision.executed",
          visibility: "landlord",
          resource: { type: "analytics_decision", id: "decision-2" },
          metadata: { landlordId: "landlord-1", decisionId: "decision-2" },
          occurredAt: "2026-04-06T00:00:00.000Z",
        } as any,
        {
          id: "event-5",
          type: "decision.appeared",
          visibility: "landlord",
          resource: { type: "analytics_decision", id: "decision-3" },
          metadata: { landlordId: "landlord-1", decisionId: "decision-3" },
          occurredAt: "2026-04-04T00:00:00.000Z",
        } as any,
        {
          id: "event-6",
          type: "decision.execution_failed",
          visibility: "landlord",
          resource: { type: "analytics_decision", id: "decision-3" },
          metadata: { landlordId: "landlord-1", decisionId: "decision-3" },
          occurredAt: "2026-04-07T00:00:00.000Z",
        } as any,
        {
          id: "event-7",
          type: "decision.appeared",
          visibility: "landlord",
          resource: { type: "analytics_decision", id: "decision-4" },
          metadata: { landlordId: "landlord-1", decisionId: "decision-4" },
          occurredAt: "2026-04-05T00:00:00.000Z",
        } as any,
        {
          id: "event-8",
          type: "decision.dismissed",
          visibility: "landlord",
          resource: { type: "analytics_decision", id: "decision-4" },
          metadata: { landlordId: "landlord-1", decisionId: "decision-4" },
          occurredAt: "2026-04-08T00:00:00.000Z",
        } as any,
        {
          id: "event-9",
          type: "decision.appeared",
          visibility: "landlord",
          resource: { type: "analytics_decision", id: "decision-other" },
          metadata: { landlordId: "landlord-2", decisionId: "decision-other" },
          occurredAt: "2026-04-01T00:00:00.000Z",
        } as any,
      ],
    });

    expect(result).toEqual({
      scope: "landlord_all_time",
      appearedCount: 4,
      reviewedCount: 1,
      dismissedCount: 1,
      executedCount: 1,
      failedExecutionCount: 1,
      resolvedCount: 3,
      resolutionRate: 0.75,
      medianTimeToResolutionHours: 72,
      averageTimeToExecutionHours: 96,
    });
  });

  it("ignores malformed durations while still counting valid outcomes", () => {
    const result = deriveLandlordDecisionOutcomeAnalytics({
      landlordId: "landlord-1",
      canonicalEvents: [
        {
          id: "event-1",
          type: "decision.appeared",
          visibility: "landlord",
          resource: { type: "analytics_decision", id: "decision-1" },
          metadata: { landlordId: "landlord-1", decisionId: "decision-1" },
          occurredAt: "2026-04-05T00:00:00.000Z",
        } as any,
        {
          id: "event-2",
          type: "decision.reviewed",
          visibility: "landlord",
          resource: { type: "analytics_decision", id: "decision-1" },
          metadata: { landlordId: "landlord-1", decisionId: "decision-1" },
          occurredAt: "2026-04-04T00:00:00.000Z",
        } as any,
      ],
    });

    expect(result.appearedCount).toBe(1);
    expect(result.reviewedCount).toBe(1);
    expect(result.resolvedCount).toBe(1);
    expect(result.medianTimeToResolutionHours).toBeNull();
    expect(result.averageTimeToExecutionHours).toBeNull();
  });
});
