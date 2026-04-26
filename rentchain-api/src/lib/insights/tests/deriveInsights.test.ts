import { describe, expect, it } from "vitest";
import { deriveInsightForResource } from "../deriveInsights";
import type { CanonicalEventV1 } from "../../events/eventTypes";

function canonicalEvent(overrides: Partial<CanonicalEventV1>): CanonicalEventV1 {
  return {
    id: overrides.id || "event-1",
    version: "v1",
    type: overrides.type || "application.created",
    domain: overrides.domain || "application",
    action: overrides.action || "created",
    status: overrides.status ?? null,
    actor: overrides.actor || { type: "system", role: "system", id: "system" },
    resource: overrides.resource || { type: "rental_application", id: "app-1" },
    occurredAt: overrides.occurredAt || "2026-04-01T10:00:00.000Z",
    recordedAt: overrides.recordedAt || "2026-04-01T10:00:00.000Z",
    visibility: overrides.visibility || "internal",
    summary: overrides.summary || "Application created",
    metadata: overrides.metadata,
    metrics: overrides.metrics,
    tags: overrides.tags,
  };
}

describe("deriveInsightForResource", () => {
  it("derives screening lifecycle correctly", () => {
    const insight = deriveInsightForResource([
      canonicalEvent({
        id: "event-1",
        type: "screening.quote_generated",
        domain: "screening",
        action: "quote_generated",
        resource: { type: "screening_order", id: "order-1" },
        occurredAt: "2026-04-01T10:00:00.000Z",
        summary: "Screening quote generated",
      }),
      canonicalEvent({
        id: "event-2",
        type: "screening.checkout_created",
        domain: "screening",
        action: "checkout_created",
        resource: { type: "screening_order", id: "order-1" },
        occurredAt: "2026-04-01T10:05:00.000Z",
        summary: "Screening checkout started",
      }),
      canonicalEvent({
        id: "event-3",
        type: "screening.paid",
        domain: "screening",
        action: "paid",
        resource: { type: "screening_order", id: "order-1" },
        occurredAt: "2026-04-01T10:10:00.000Z",
        summary: "Screening payment completed",
      }),
      canonicalEvent({
        id: "event-4",
        type: "screening.completed",
        domain: "screening",
        action: "completed",
        resource: { type: "screening_order", id: "order-1" },
        occurredAt: "2026-04-01T10:20:00.000Z",
        summary: "Screening completed",
      }),
    ]);

    expect(insight).toEqual(
      expect.objectContaining({
        domain: "screening",
        resourceType: "screening_order",
        resourceId: "order-1",
        summary: expect.objectContaining({
          lifecycleState: "completed",
          blockedCount: 0,
          eventCount: 4,
        }),
        metrics: expect.objectContaining({
          quoteGeneratedCount: 1,
          checkoutStartedCount: 1,
          paidCount: 1,
          completedCount: 1,
          timeQuoteToCheckoutMs: 5 * 60 * 1000,
          timeCheckoutToPaidMs: 5 * 60 * 1000,
          timePaidToCompletedMs: 10 * 60 * 1000,
        }),
      })
    );
  });

  it("derives maintenance reopen count correctly", () => {
    const insight = deriveInsightForResource([
      canonicalEvent({
        id: "event-1",
        type: "maintenance.request_created",
        domain: "maintenance",
        action: "request_created",
        resource: { type: "maintenance_request", id: "maint-1" },
        occurredAt: "2026-04-01T10:00:00.000Z",
        summary: "Maintenance request submitted",
      }),
      canonicalEvent({
        id: "event-2",
        type: "maintenance.completed",
        domain: "maintenance",
        action: "completed",
        resource: { type: "maintenance_request", id: "maint-1" },
        occurredAt: "2026-04-01T11:00:00.000Z",
        summary: "Maintenance completed",
      }),
      canonicalEvent({
        id: "event-3",
        type: "maintenance.assigned",
        domain: "maintenance",
        action: "assigned",
        resource: { type: "maintenance_request", id: "maint-1" },
        occurredAt: "2026-04-01T12:00:00.000Z",
        summary: "Maintenance assigned again",
      }),
      canonicalEvent({
        id: "event-4",
        type: "maintenance.completed",
        domain: "maintenance",
        action: "completed",
        resource: { type: "maintenance_request", id: "maint-1" },
        occurredAt: "2026-04-01T13:00:00.000Z",
        summary: "Maintenance completed again",
      }),
    ]);

    expect(insight?.summary.reopenCount).toBe(1);
    expect(insight?.summary.lifecycleState).toBe("completed");
    expect(insight?.metrics).toEqual(
      expect.objectContaining({
        requestCreatedCount: 1,
        assignedCount: 1,
        completedCount: 2,
        reopenCount: 1,
      })
    );
  });

  it("derives durations correctly when timestamps exist even if events arrive out of order", () => {
    const insight = deriveInsightForResource([
      canonicalEvent({
        id: "event-2",
        type: "application.submitted",
        domain: "application",
        action: "submitted",
        resource: { type: "rental_application", id: "app-1" },
        occurredAt: "2026-04-02T10:00:00.000Z",
        summary: "Application submitted",
      }),
      canonicalEvent({
        id: "event-1",
        type: "application.created",
        domain: "application",
        action: "created",
        resource: { type: "rental_application", id: "app-1" },
        occurredAt: "2026-04-01T10:00:00.000Z",
        summary: "Application created",
      }),
    ]);

    expect(insight?.summary.firstEventAt).toBe("2026-04-01T10:00:00.000Z");
    expect(insight?.summary.lastEventAt).toBe("2026-04-02T10:00:00.000Z");
    expect(insight?.metrics?.timeCreatedToSubmittedMs).toBe(24 * 60 * 60 * 1000);
  });

  it("safely handles missing or partial events", () => {
    const insight = deriveInsightForResource([
      canonicalEvent({
        id: "event-1",
        type: "application.created",
        domain: "application",
        action: "created",
        resource: { type: "rental_application", id: "app-1" },
        occurredAt: "not-a-date",
        recordedAt: "2026-04-01T10:00:00.000Z",
        summary: "Application created",
      }),
      canonicalEvent({
        id: "event-2",
        type: "application.submitted",
        domain: "application",
        action: "submitted",
        resource: { type: "", id: "" } as any,
        occurredAt: "2026-04-02T10:00:00.000Z",
        summary: "Broken event",
      }),
    ]);

    expect(insight).toEqual(
      expect.objectContaining({
        domain: "application",
        summary: expect.objectContaining({
          eventCount: 1,
          lifecycleState: "created",
        }),
      })
    );
  });

  it("increments blocked count only on explicit blocked events", () => {
    const insight = deriveInsightForResource([
      canonicalEvent({
        id: "event-1",
        type: "screening.quote_generated",
        domain: "screening",
        action: "quote_generated",
        resource: { type: "screening_order", id: "order-1" },
        occurredAt: "2026-04-01T10:00:00.000Z",
        summary: "Screening quote generated",
      }),
      canonicalEvent({
        id: "event-2",
        type: "screening.blocked",
        domain: "screening",
        action: "blocked",
        status: "blocked",
        resource: { type: "screening_order", id: "order-1" },
        occurredAt: "2026-04-01T10:05:00.000Z",
        summary: "Screening blocked",
      }),
      canonicalEvent({
        id: "event-3",
        type: "screening.completed",
        domain: "screening",
        action: "completed",
        resource: { type: "screening_order", id: "order-1" },
        occurredAt: "2026-04-01T10:10:00.000Z",
        summary: "Screening completed",
      }),
    ]);

    expect(insight?.summary.blockedCount).toBe(1);
    expect(insight?.metrics?.blockedCount).toBe(1);
  });

  it("normalizes chronological ordering before deriving lifecycle state", () => {
    const insight = deriveInsightForResource([
      canonicalEvent({
        id: "event-2",
        type: "lease.activated",
        domain: "lease",
        action: "activated",
        resource: { type: "lease", id: "lease-1" },
        occurredAt: "2026-04-02T10:00:00.000Z",
        summary: "Lease activated",
      }),
      canonicalEvent({
        id: "event-1",
        type: "lease.created",
        domain: "lease",
        action: "created",
        resource: { type: "lease", id: "lease-1" },
        occurredAt: "2026-04-01T10:00:00.000Z",
        summary: "Lease created",
      }),
    ]);

    expect(insight?.summary.lifecycleState).toBe("activated");
    expect(insight?.metrics?.timeCreatedToActivatedMs).toBe(24 * 60 * 60 * 1000);
  });
});
