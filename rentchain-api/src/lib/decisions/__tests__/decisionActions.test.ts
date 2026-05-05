import { describe, expect, it } from "vitest";
import type { Decision } from "../decisionEngine";
import {
  applyDecisionActions,
  buildDecisionAction,
  normalizeDecisionAction,
  parseDecisionActionPatch,
} from "../decisionActions";

function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    decisionId: "decision:review_overdue_rent:sig-1",
    leaseId: "lease-1",
    paymentIntentId: "pi-1",
    rentPaymentId: "rp-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    decisionType: "review_overdue_rent",
    severity: "critical",
    status: "detected",
    reason: "Rent obligation is overdue.",
    metadata: {},
    createdAt: "2026-05-01T10:00:00.000Z",
    updatedAt: "2026-05-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("decisionActions", () => {
  it("parses valid action patches and rejects incomplete action payloads", () => {
    expect(parseDecisionActionPatch({ actionType: "reviewed", note: "Checked" })).toEqual({
      actionType: "reviewed",
      note: "Checked",
    });
    expect(parseDecisionActionPatch({ actionType: "assigned" })).toBeNull();
    expect(parseDecisionActionPatch({ actionType: "snoozed", snoozedUntil: "not-a-date" })).toBeNull();
    expect(parseDecisionActionPatch({ actionType: "fixed" })).toBeNull();
  });

  it("creates action records without mutating the source decision", () => {
    const source = decision();
    const action = buildDecisionAction({
      decision: source,
      patch: { actionType: "reviewed", note: "Reviewed by ops" },
      landlordId: "landlord-1",
      actorId: "admin-1",
      actorEmail: "admin@example.com",
      now: "2026-05-05T12:00:00.000Z",
    });

    expect(action).toEqual(
      expect.objectContaining({
        decisionId: source.decisionId,
        leaseId: "lease-1",
        landlordId: "landlord-1",
        actionType: "reviewed",
        previousStatus: "detected",
        nextStatus: "reviewed",
        note: "Reviewed by ops",
        actorId: "admin-1",
        actorEmail: "admin@example.com",
        createdAt: "2026-05-05T12:00:00.000Z",
      })
    );
    expect(source.status).toBe("detected");
  });

  it("applies the latest action as a status overlay", () => {
    const source = decision();
    const reviewed = buildDecisionAction({
      decision: source,
      patch: { actionType: "reviewed" },
      now: "2026-05-05T12:00:00.000Z",
    });
    const dismissed = buildDecisionAction({
      decision: source,
      patch: { actionType: "dismissed" },
      existingActions: [reviewed],
      now: "2026-05-05T13:00:00.000Z",
    });

    const merged = applyDecisionActions([source], [dismissed, reviewed]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(
      expect.objectContaining({
        decisionId: source.decisionId,
        status: "dismissed",
        updatedAt: "2026-05-05T13:00:00.000Z",
        latestAction: expect.objectContaining({ actionType: "dismissed" }),
      })
    );
    expect(source.status).toBe("detected");
  });

  it("supports snoozed and assigned lifecycle statuses", () => {
    const source = decision();
    const snoozed = buildDecisionAction({
      decision: source,
      patch: { actionType: "snoozed", snoozedUntil: "2026-05-12" },
      now: "2026-05-05T12:00:00.000Z",
    });
    const assigned = buildDecisionAction({
      decision: source,
      patch: { actionType: "assigned", assignedTo: "ops@example.com" },
      existingActions: [snoozed],
      now: "2026-05-05T13:00:00.000Z",
    });

    expect(snoozed.nextStatus).toBe("snoozed");
    expect(snoozed.snoozedUntil).toBe("2026-05-12T00:00:00.000Z");
    expect(assigned.nextStatus).toBe("assigned");
    expect(assigned.assignedTo).toBe("ops@example.com");
    expect(assigned.previousStatus).toBe("snoozed");
  });

  it("normalizes persisted action records defensively", () => {
    expect(
      normalizeDecisionAction({
        actionId: "action-1",
        decisionId: "decision-1",
        leaseId: "lease-1",
        actionType: "resolved",
        previousStatus: "reviewed",
        nextStatus: "resolved",
        createdAt: "2026-05-05T12:00:00.000Z",
      })
    ).toEqual(expect.objectContaining({ actionType: "resolved", nextStatus: "resolved" }));
    expect(normalizeDecisionAction({ decisionId: "decision-1", actionType: "resolved" })).toBeNull();
  });
});
