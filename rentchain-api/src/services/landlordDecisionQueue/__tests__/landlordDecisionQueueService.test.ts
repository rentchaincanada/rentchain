import { describe, expect, it } from "vitest";
import type { DecisionInboxItem } from "../../../lib/decisions/decisionInboxTypes";
import type { UnifiedInboxPublicRecord } from "../../unifiedInbox/types";
import { deriveLandlordDecisionQueue } from "../landlordDecisionQueueService";

function decisionInboxItem(overrides: Partial<DecisionInboxItem> = {}): DecisionInboxItem {
  return {
    id: "decision-1",
    title: "Payment review",
    description: "Rent payment requires review.",
    severity: "critical",
    status: "open",
    type: "billing",
    source: "lease_ledger",
    relatedEntity: { kind: "lease", id: "lease-1", label: "Lease 1" },
    destination: "/leases/lease-1/ledger",
    automationEligible: false,
    dueAt: null,
    workflow: {
      queue: "delinquency_review",
      workflowState: "new",
      ownershipType: "landlord",
      reviewPriority: "critical",
      escalationLevel: "critical",
      manualOnly: true,
    },
    createdAt: "2026-06-18T10:00:00.000Z",
    updatedAt: "2026-06-18T11:00:00.000Z",
    ...overrides,
  };
}

function inboxRecord(overrides: Partial<UnifiedInboxPublicRecord> = {}): UnifiedInboxPublicRecord {
  return {
    id: "message-1",
    sourceKind: "landlord.message",
    audienceRole: "landlord",
    title: "Tenant awaiting reply",
    body: "A tenant asked for a response.",
    priority: "high",
    status: "unread",
    occurredAt: "2026-06-18T09:00:00.000Z",
    readAt: null,
    ...overrides,
  };
}

describe("landlordDecisionQueueService", () => {
  it("normalizes decision inbox severity and workspace routing", () => {
    const queue = deriveLandlordDecisionQueue({
      landlordId: "landlord-1",
      generatedAt: "2026-06-18T12:00:00.000Z",
      decisionInboxItems: [
        decisionInboxItem({
          id: "lease-warning",
          severity: "medium",
          type: "lease",
          destination: "/leases/lease-1/summary",
          relatedEntity: { kind: "lease", id: "lease-readiness-1", label: "Lease readiness" },
        }),
        decisionInboxItem({
          id: "payment-critical",
          severity: "critical",
          type: "billing",
          destination: "/leases/lease-1/ledger",
          dueAt: "2026-05-01T00:00:00.000Z",
        }),
      ],
    });

    expect(queue.version).toBe("landlord_decision_queue_v1");
    expect(queue.summary).toEqual(
      expect.objectContaining({
        total: 2,
        critical: 1,
        warning: 1,
      })
    );
    expect(queue.items.map((item) => [item.id, item.severity, item.workspace])).toEqual([
      ["decision_queue:decision_inbox:payment-critical", "critical", "payments"],
      ["decision_queue:decision_inbox:lease-warning", "warning", "lease"],
    ]);
    expect(queue.items.find((item) => item.sourceId === "payment-critical")?.dueAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("includes messaging source types without importing the entire inbox as critical work", () => {
    const queue = deriveLandlordDecisionQueue({
      landlordId: "landlord-1",
      unifiedInboxRecords: [
        inboxRecord({ id: "normal-read", priority: "normal", status: "read" }),
        inboxRecord({ id: "urgent-message", priority: "high", status: "unread" }),
        inboxRecord({
          id: "notice-message",
          sourceKind: "landlord.notice",
          title: "Notice response due",
          body: "Notice response context is available.",
          priority: "normal",
          status: "unread",
        }),
      ],
      messageSignals: [
        {
          landlordId: "landlord-1",
          sourceType: "message_maintenance_follow_up",
          sourceId: "work-order-thread-1",
          title: "Contractor quote requires response",
          description: "A contractor quote is waiting for landlord review.",
          severity: "needs_review",
          workspace: "maintenance",
          maintenanceRequestId: "maintenance-1",
          recommendedActionHref: "/maintenance",
        },
      ],
    });

    expect(queue.items.map((item) => item.sourceType)).toEqual([
      "message_unread_priority",
      "message_notice_relevance",
      "message_maintenance_follow_up",
    ]);
    expect(queue.items.find((item) => item.sourceId === "normal-read")).toBeUndefined();
    expect(queue.items.find((item) => item.sourceId === "urgent-message")).toEqual(
      expect.objectContaining({
        workspace: "tenant",
        severity: "warning",
        recommendedActionHref: "/messages",
      })
    );
  });

  it("dedupes the same underlying issue across source surfaces using the highest priority item", () => {
    const queue = deriveLandlordDecisionQueue({
      landlordId: "landlord-1",
      leaseCoherenceSignals: [
        {
          landlordId: "landlord-1",
          sourceId: "coherence-1",
          leaseId: "lease-1",
          title: "Lease state conflict",
          description: "Lease state conflict requires review.",
          severity: "critical",
          dedupeKey: "lease-conflict:lease-1",
          updatedAt: "2026-06-18T08:00:00.000Z",
        },
      ],
      paymentReadinessSignals: [
        {
          landlordId: "landlord-1",
          sourceId: "payment-setup-1",
          leaseId: "lease-1",
          title: "Payment setup review",
          description: "Payment readiness repeats the same lease conflict.",
          severity: "warning",
          dedupeKey: "lease-conflict:lease-1",
          updatedAt: "2026-06-18T10:00:00.000Z",
        },
      ],
    });

    expect(queue.items).toHaveLength(1);
    expect(queue.items[0]).toEqual(
      expect.objectContaining({
        sourceType: "lease_state_coherence",
        severity: "critical",
        dedupeKey: "lease-conflict:lease-1",
      })
    );
  });

  it("sorts critical, warning, needs review, upcoming, and informational deterministically", () => {
    const queue = deriveLandlordDecisionQueue({
      landlordId: "landlord-1",
      leaseLifecycleSignals: [
        {
          landlordId: "landlord-1",
          sourceId: "upcoming-later",
          title: "Lease expiry later",
          dueAt: "2026-09-01T00:00:00.000Z",
        },
        {
          landlordId: "landlord-1",
          sourceId: "upcoming-sooner",
          title: "Lease expiry soon",
          dueAt: "2026-07-01T00:00:00.000Z",
        },
      ],
      maintenanceReadinessSignals: [
        {
          landlordId: "landlord-1",
          sourceId: "maintenance-review",
          title: "Maintenance review",
          severity: "needs_review",
        },
      ],
      propertyActionRequests: [
        {
          landlordId: "landlord-1",
          sourceId: "property-warning",
          title: "Property action",
          severity: "warning",
        },
      ],
      leaseCoherenceSignals: [
        {
          landlordId: "landlord-1",
          sourceId: "critical-conflict",
          title: "Critical conflict",
        },
      ],
    });

    expect(queue.items.map((item) => item.sourceId)).toEqual([
      "critical-conflict",
      "property-warning",
      "maintenance-review",
      "upcoming-sooner",
      "upcoming-later",
    ]);
  });

  it("keeps fallback values safe when optional source data is missing", () => {
    const queue = deriveLandlordDecisionQueue({
      landlordId: "landlord-1",
      paymentReadinessSignals: [
        {
          landlordId: "landlord-1",
          id: "payment-readiness-1",
          recommendedActionHref: "javascript:alert(1)",
        },
      ],
    });

    expect(queue.items[0]).toEqual(
      expect.objectContaining({
        title: "Review required",
        description: "Review this operational signal.",
        recommendedActionHref: "/leases",
        status: "open",
        workspace: "payments",
      })
    );
  });

  it("filters landlord-scoped source records and preserves caller-scoped decision inbox items", () => {
    const queue = deriveLandlordDecisionQueue({
      landlordId: "landlord-1",
      decisionInboxItems: [decisionInboxItem({ id: "caller-scoped-decision" })],
      propertyActionRequests: [
        {
          landlordId: "landlord-1",
          sourceId: "property-visible",
          title: "Visible property action",
        },
        {
          landlordId: "landlord-2",
          sourceId: "property-hidden",
          title: "Hidden property action",
        },
      ],
      messageSignals: [
        {
          landlordId: "landlord-2",
          sourceId: "other-message",
          title: "Other landlord message",
        },
      ],
    });

    expect(queue.items.map((item) => item.sourceId).sort()).toEqual(["caller-scoped-decision", "property-visible"]);
    expect(JSON.stringify(queue)).not.toContain("property-hidden");
    expect(JSON.stringify(queue)).not.toContain("other-message");
  });
});
