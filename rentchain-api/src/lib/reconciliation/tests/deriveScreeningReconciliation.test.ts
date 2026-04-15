import { describe, expect, it } from "vitest";
import { deriveScreeningReconciliation } from "../deriveScreeningReconciliation";
import type { CanonicalEventV1 } from "../../events/eventTypes";

function canonicalEvent(overrides: Partial<CanonicalEventV1>): CanonicalEventV1 {
  return {
    id: overrides.id || "event-1",
    version: "v1",
    type: overrides.type || "screening.quote_generated",
    domain: overrides.domain || "screening",
    action: overrides.action || "quote_generated",
    status: overrides.status ?? null,
    actor: overrides.actor || { type: "system", role: "system", id: "system" },
    resource: overrides.resource || { type: "rental_application", id: "app-1" },
    occurredAt: overrides.occurredAt || "2026-04-01T10:00:00.000Z",
    recordedAt: overrides.recordedAt || "2026-04-01T10:00:00.000Z",
    visibility: overrides.visibility || "internal",
    summary: overrides.summary || "Screening quote generated",
    metadata: overrides.metadata,
    metrics: overrides.metrics,
    tags: overrides.tags,
  };
}

describe("deriveScreeningReconciliation", () => {
  it("derives quoted correctly", () => {
    const reconciliation = deriveScreeningReconciliation({
      applicationId: "app-1",
      application: {
        screeningMonetization: {
          quoteStatus: "generated",
          quoteId: "quote-1",
          quoteGeneratedAt: "2026-04-01T10:00:00.000Z",
        },
      },
      canonicalEvents: [
        canonicalEvent({
          type: "screening.quote_generated",
          action: "quote_generated",
        }),
      ],
      now: Date.parse("2026-04-01T10:10:00.000Z"),
    });

    expect(reconciliation.status).toBe("quoted");
    expect(reconciliation.reasons[0]?.code).toBe("RECON_QUOTE_ONLY");
  });

  it("derives checkout_created correctly", () => {
    const reconciliation = deriveScreeningReconciliation({
      applicationId: "app-1",
      application: {
        screeningMonetization: {
          quoteStatus: "generated",
          paymentStatus: "checkout_created",
          checkoutSessionId: "sess_1",
          checkoutCreatedAt: "2026-04-01T10:05:00.000Z",
        },
      },
      canonicalEvents: [
        canonicalEvent({ type: "screening.quote_generated", action: "quote_generated" }),
        canonicalEvent({
          id: "event-2",
          type: "screening.checkout_created",
          action: "checkout_created",
          resource: { type: "screening_order", id: "order-1", parentType: "rental_application", parentId: "app-1" },
          occurredAt: "2026-04-01T10:05:00.000Z",
          summary: "Screening checkout started",
        }),
      ],
      now: Date.parse("2026-04-01T10:10:00.000Z"),
    });

    expect(reconciliation.status).toBe("checkout_created");
    expect(reconciliation.reasons[0]?.code).toBe("RECON_ACTIVE_CHECKOUT");
  });

  it("derives paid_not_fulfilled correctly", () => {
    const reconciliation = deriveScreeningReconciliation({
      applicationId: "app-1",
      application: {
        screeningMonetization: {
          paymentStatus: "paid",
          fulfillmentStatus: "ordered",
          paidAt: "2026-04-01T10:10:00.000Z",
        },
      },
      canonicalEvents: [
        canonicalEvent({ type: "screening.quote_generated", action: "quote_generated" }),
        canonicalEvent({
          id: "event-2",
          type: "screening.paid",
          action: "paid",
          occurredAt: "2026-04-01T10:10:00.000Z",
          summary: "Screening payment confirmed",
        }),
      ],
      financialTransactions: [
        {
          type: "payment_succeeded",
          applicationId: "app-1",
          createdAt: Date.parse("2026-04-01T10:10:00.000Z"),
        },
      ],
    });

    expect(reconciliation.status).toBe("paid_not_fulfilled");
    expect(reconciliation.reasons[0]?.code).toBe("RECON_PAID_NOT_FULFILLED");
  });

  it("derives fulfilled correctly", () => {
    const reconciliation = deriveScreeningReconciliation({
      applicationId: "app-1",
      application: {
        screeningStatus: "complete",
        screeningCompletedAt: "2026-04-01T10:30:00.000Z",
        screeningMonetization: {
          paymentStatus: "paid",
          fulfillmentStatus: "completed",
          paidAt: "2026-04-01T10:10:00.000Z",
        },
      },
      canonicalEvents: [
        canonicalEvent({ type: "screening.quote_generated", action: "quote_generated" }),
        canonicalEvent({
          id: "event-2",
          type: "screening.paid",
          action: "paid",
          occurredAt: "2026-04-01T10:10:00.000Z",
          summary: "Screening payment confirmed",
        }),
        canonicalEvent({
          id: "event-3",
          type: "screening.completed",
          action: "completed",
          occurredAt: "2026-04-01T10:30:00.000Z",
          summary: "Screening completed",
        }),
      ],
    });

    expect(reconciliation.status).toBe("fulfilled");
    expect(reconciliation.reasons[0]?.code).toBe("RECON_FULFILLED");
  });

  it("derives blocked correctly", () => {
    const reconciliation = deriveScreeningReconciliation({
      applicationId: "app-1",
      application: {
        screeningMonetization: {
          fulfillmentStatus: "blocked",
          lastErrorCode: "SCREENING_PROVIDER_UNAVAILABLE",
        },
      },
      canonicalEvents: [
        canonicalEvent({
          type: "screening.blocked",
          action: "blocked",
          status: "provider_unavailable",
          summary: "Screening blocked",
        }),
      ],
    });

    expect(reconciliation.status).toBe("blocked");
    expect(reconciliation.reasons[0]?.code).toBe("RECON_BLOCKED");
  });

  it("derives expired correctly", () => {
    const reconciliation = deriveScreeningReconciliation({
      applicationId: "app-1",
      application: {
        screeningMonetization: {
          quoteStatus: "generated",
          quoteGeneratedAt: "2026-04-01T10:00:00.000Z",
        },
      },
      canonicalEvents: [canonicalEvent({ type: "screening.quote_generated", action: "quote_generated" })],
      now: Date.parse("2026-04-01T10:45:00.000Z"),
    });

    expect(reconciliation.status).toBe("expired");
    expect(reconciliation.reasons[0]?.code).toBe("RECON_QUOTE_EXPIRED");
  });

  it("derives abandoned correctly", () => {
    const reconciliation = deriveScreeningReconciliation({
      applicationId: "app-1",
      application: {
        screeningMonetization: {
          paymentStatus: "checkout_created",
          checkoutSessionId: "sess_1",
          checkoutCreatedAt: "2026-04-01T10:05:00.000Z",
        },
      },
      canonicalEvents: [
        canonicalEvent({ type: "screening.quote_generated", action: "quote_generated" }),
        canonicalEvent({
          id: "event-2",
          type: "screening.checkout_created",
          action: "checkout_created",
          occurredAt: "2026-04-01T10:05:00.000Z",
          resource: { type: "screening_order", id: "order-1", parentType: "rental_application", parentId: "app-1" },
          summary: "Screening checkout started",
        }),
      ],
      now: Date.parse("2026-04-02T12:05:00.000Z"),
    });

    expect(reconciliation.status).toBe("abandoned");
    expect(reconciliation.reasons[0]?.code).toBe("RECON_ABANDONED_CHECKOUT");
  });

  it("derives duplicate_risk correctly", () => {
    const reconciliation = deriveScreeningReconciliation({
      applicationId: "app-1",
      application: {
        screeningMonetization: {
          paymentStatus: "checkout_created",
          checkoutSessionId: "sess_2",
        },
      },
      latestOrder: {
        id: "order-2",
        applicationId: "app-1",
        stripeCheckoutSessionId: "sess_2",
      },
      canonicalEvents: [
        canonicalEvent({ type: "screening.quote_generated", action: "quote_generated" }),
        canonicalEvent({
          id: "event-2",
          type: "screening.checkout_created",
          action: "checkout_created",
          occurredAt: "2026-04-01T10:05:00.000Z",
          resource: { type: "screening_order", id: "order-1", parentType: "rental_application", parentId: "app-1" },
          metadata: { stripeCheckoutSessionId: "sess_1", applicationId: "app-1" },
          summary: "Screening checkout started",
        }),
        canonicalEvent({
          id: "event-3",
          type: "screening.checkout_created",
          action: "checkout_created",
          occurredAt: "2026-04-01T10:06:00.000Z",
          resource: { type: "screening_order", id: "order-2", parentType: "rental_application", parentId: "app-1" },
          metadata: { stripeCheckoutSessionId: "sess_2", applicationId: "app-1" },
          summary: "Screening checkout started again",
        }),
      ],
    });

    expect(reconciliation.status).toBe("duplicate_risk");
    expect(reconciliation.reasons[0]?.code).toBe("RECON_DUPLICATE_CHECKOUT_RISK");
  });

  it("derives mismatch correctly", () => {
    const reconciliation = deriveScreeningReconciliation({
      applicationId: "app-1",
      application: {
        screeningStatus: "complete",
        screeningMonetization: {
          paymentStatus: "paid",
          fulfillmentStatus: "completed",
        },
      },
      canonicalEvents: [
        canonicalEvent({
          type: "screening.completed",
          action: "completed",
          summary: "Screening completed",
        }),
      ],
      financialTransactions: [],
    });

    expect(reconciliation.status).toBe("mismatch");
    expect(reconciliation.reasons[0]?.code).toBe("RECON_STATE_MISMATCH");
  });

  it("safely handles partial or malformed event history", () => {
    const reconciliation = deriveScreeningReconciliation({
      applicationId: "app-1",
      application: {},
      canonicalEvents: [
        canonicalEvent({
          occurredAt: "not-a-date",
          recordedAt: "2026-04-01T10:00:00.000Z",
          summary: "Broken but recoverable event",
        }),
        {
          ...canonicalEvent({
            id: "broken-2",
            resource: { type: "", id: "" } as any,
          }),
        },
      ],
      now: Date.parse("2026-04-01T10:10:00.000Z"),
    });

    expect(reconciliation.applicationId).toBe("app-1");
    expect(reconciliation.status).toBe("quoted");
  });
});
