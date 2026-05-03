import { describe, expect, it, vi } from "vitest";
import { createPaymentExecutionService } from "../paymentExecutionService";
import type { PaymentProviderAdapter } from "../paymentProviderAdapter";
import type { PaymentIntentReference } from "../paymentTypes";

const rentIntent: PaymentIntentReference = {
  paymentIntentId: "rent-payment-1",
  landlordId: "landlord-1",
  tenantId: "tenant-1",
  leaseId: "lease-1",
  propertyId: "prop-1",
  unitId: "unit-1",
  amount: 125000,
  currency: "cad",
  purpose: "rent",
  provider: "stripe",
};

function buildStripeAdapter(): PaymentProviderAdapter {
  return {
    provider: "stripe",
    createPaymentSession: vi.fn().mockResolvedValue({
      provider: "stripe",
      status: "provider_session_created",
      redirectUrl: "https://checkout.stripe.test/session/cs_1",
      reference: {
        provider: "stripe",
        providerSessionId: "cs_1",
        providerPaymentId: "pi_1",
      },
    }),
    normalizeProviderEvent: vi.fn((input) => ({
      provider: "stripe",
      providerEventId: input.providerEventId || null,
      providerPaymentId: input.providerPaymentId || null,
      providerSessionId: input.providerSessionId || null,
      providerCustomerId: input.providerCustomerId || null,
      rawStatus: input.rawStatus || null,
      normalizedStatus: input.rawStatus === "paid" ? "confirmed" : "manual_review_required",
      purpose: input.purpose || null,
      amount: input.amount || null,
      currency: input.currency || null,
      occurredAt: input.occurredAt || null,
    })),
    mapProviderStatus: vi.fn((rawStatus) => (rawStatus === "paid" ? "confirmed" : "manual_review_required")),
  };
}

describe("paymentExecutionService", () => {
  it("rejects unknown provider for rent payment sessions", async () => {
    const service = createPaymentExecutionService({ stripe: buildStripeAdapter() });

    await expect(
      service.createRentPaymentSession({
        intent: { ...rentIntent, provider: "trustly" },
        successUrl: "https://app.test/success",
        cancelUrl: "https://app.test/cancel",
      })
    ).rejects.toThrow("payment_provider_unsupported");
  });

  it("routes Stripe rent payment sessions to the Stripe adapter", async () => {
    const adapter = buildStripeAdapter();
    const service = createPaymentExecutionService({ stripe: adapter });

    await service.createRentPaymentSession({
      intent: rentIntent,
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });

    expect(adapter.createPaymentSession).toHaveBeenCalledWith({
      intent: rentIntent,
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });
  });

  it("preserves amount, currency, purpose, and subject metadata", async () => {
    const adapter = buildStripeAdapter();
    const service = createPaymentExecutionService({ stripe: adapter });

    await service.createRentPaymentSession({
      intent: rentIntent,
      metadata: {
        leaseId: "lease-1",
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        rentPaymentId: "rent-payment-1",
      },
      successUrl: "https://app.test/success",
      cancelUrl: "https://app.test/cancel",
    });

    expect(adapter.createPaymentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: expect.objectContaining({
          amount: 125000,
          currency: "cad",
          purpose: "rent",
          leaseId: "lease-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
        }),
        metadata: {
          leaseId: "lease-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          rentPaymentId: "rent-payment-1",
        },
      })
    );
  });

  it("rejects unknown provider for rent payment provider event normalization", () => {
    const service = createPaymentExecutionService({ stripe: buildStripeAdapter() });

    expect(() =>
      service.normalizeRentPaymentProviderEvent({
        provider: "trustly",
        rawStatus: "paid",
      })
    ).toThrow("payment_provider_unsupported");
  });

  it("routes Stripe provider event normalization to the Stripe adapter", () => {
    const adapter = buildStripeAdapter();
    const service = createPaymentExecutionService({ stripe: adapter });

    const result = service.normalizeRentPaymentProviderEvent({
      provider: "stripe",
      providerEventId: "evt_1",
      rawStatus: "paid",
    });

    expect(adapter.normalizeProviderEvent).toHaveBeenCalledWith({
      provider: "stripe",
      providerEventId: "evt_1",
      rawStatus: "paid",
    });
    expect(result.normalizedStatus).toBe("confirmed");
  });

  it("derives reconciliation without mutating payment intent or provider signal", () => {
    const service = createPaymentExecutionService({ stripe: buildStripeAdapter() });
    const intent = { ...rentIntent };
    const signal = {
      provider: "stripe" as const,
      providerEventId: "evt_1",
      rawStatus: "paid",
      normalizedStatus: "confirmed" as const,
      amount: 125000,
      currency: "CAD",
    };

    const result = service.deriveRentPaymentReconciliation({
      expectedIntent: intent,
      providerSignal: signal,
    });

    expect(result.reconciliationStatus).toBe("reconciled");
    expect(intent).toEqual(rentIntent);
    expect(signal).toEqual({
      provider: "stripe",
      providerEventId: "evt_1",
      rawStatus: "paid",
      normalizedStatus: "confirmed",
      amount: 125000,
      currency: "CAD",
    });
  });
});
