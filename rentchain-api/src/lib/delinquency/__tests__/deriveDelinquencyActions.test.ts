import { describe, expect, it } from "vitest";
import { deriveDelinquencyActions } from "../deriveDelinquencyActions";
import type { DecisionInboxItem } from "../../decisions/decisionInboxTypes";

function item(overrides: Partial<DecisionInboxItem> = {}): DecisionInboxItem {
  return {
    id: "decision:review_missing_payment:lease-1",
    title: "Review Missing Payment",
    description: "Expected rent payment is missing.",
    severity: "critical",
    status: "open",
    type: "billing",
    source: "lease_ledger",
    relatedEntity: { kind: "lease", id: "lease-1", label: "Lease lease-1" },
    destination: "/leases/lease-1/ledger",
    automationEligible: false,
    workflow: {
      queue: "delinquency_review",
      workflowState: "escalated",
      ownershipType: "landlord",
      reviewPriority: "critical",
      escalationLevel: "critical",
      manualOnly: true,
    },
    createdAt: "2026-05-05T12:00:00.000Z",
    updatedAt: "2026-05-05T12:00:00.000Z",
    ...overrides,
  };
}

describe("deriveDelinquencyActions", () => {
  it("derives guarded manual-only action descriptors for delinquency decisions", () => {
    const actions = deriveDelinquencyActions(item());

    expect(actions).toEqual([
      expect.objectContaining({
        actionKey: "review_context",
        status: "available",
        destination: "/leases/lease-1/ledger",
        manualOnly: true,
        policyGuarded: true,
      }),
      expect.objectContaining({
        actionKey: "view_ledger",
        status: "available",
        destination: "/leases/lease-1/ledger",
        manualOnly: true,
      }),
      expect.objectContaining({
        actionKey: "prepare_reminder",
        status: "blocked",
        requiresConfirmation: true,
        blockedReason: expect.stringMatching(/no tenant communication will be sent/i),
      }),
      expect.objectContaining({
        actionKey: "prepare_notice",
        status: "blocked",
        requiresConfirmation: true,
        blockedReason: expect.stringMatching(/no legal notice will be generated or sent/i),
      }),
    ]);
  });

  it("does not derive actions for non-delinquency decisions", () => {
    expect(
      deriveDelinquencyActions(
        item({
          id: "approve_maintenance_cost:wo-1",
          type: "maintenance",
          workflow: {
            queue: "maintenance_review",
            workflowState: "new",
            ownershipType: "landlord",
            reviewPriority: "high",
            escalationLevel: "urgent",
            manualOnly: true,
          },
        })
      )
    ).toEqual([]);
  });

  it("uses deterministic blocked reasons when context is missing", () => {
    const actions = deriveDelinquencyActions(item({ destination: null }));

    expect(actions.find((entry) => entry.actionKey === "review_context")).toEqual(
      expect.objectContaining({
        status: "blocked",
        destination: null,
        blockedReason: "Lease or ledger context is unavailable for this decision.",
      })
    );
    expect(actions.find((entry) => entry.actionKey === "view_ledger")).toEqual(
      expect.objectContaining({
        status: "blocked",
        destination: null,
        blockedReason: "A lease ledger destination is unavailable for this decision.",
      })
    );
  });
});
