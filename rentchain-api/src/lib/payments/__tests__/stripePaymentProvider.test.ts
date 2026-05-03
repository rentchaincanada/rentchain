import { describe, expect, it, vi } from "vitest";
import { createStripePaymentProvider, stripePaymentProvider } from "../providers/stripePaymentProvider";

describe("stripePaymentProvider", () => {
  it("uses stripe as its provider key", () => {
    expect(stripePaymentProvider.provider).toBe("stripe");
  });

  it("maps known Stripe statuses to provider-neutral statuses", () => {
    expect(stripePaymentProvider.mapProviderStatus("open")).toBe("provider_session_created");
    expect(stripePaymentProvider.mapProviderStatus("processing")).toBe("pending_provider_confirmation");
    expect(stripePaymentProvider.mapProviderStatus("paid")).toBe("confirmed");
    expect(stripePaymentProvider.mapProviderStatus("canceled")).toBe("cancelled");
    expect(stripePaymentProvider.mapProviderStatus("expired")).toBe("expired");
  });

  it("maps unknown Stripe status to manual review", () => {
    expect(stripePaymentProvider.mapProviderStatus("not_a_real_status")).toBe("manual_review_required");
  });

  it("normalizes provider events without dropping event id or raw status", () => {
    expect(
      stripePaymentProvider.normalizeProviderEvent({
        provider: "stripe",
        providerEventId: "evt_123",
        providerSessionId: "cs_123",
        rawStatus: "paid",
        amount: 125000,
        currency: "cad",
      })
    ).toMatchObject({
      provider: "stripe",
      providerEventId: "evt_123",
      providerSessionId: "cs_123",
      rawStatus: "paid",
      normalizedStatus: "confirmed",
      amount: 125000,
      currency: "CAD",
    });
  });

  it("normalizes a minimal safe mocked event shape", () => {
    expect(
      stripePaymentProvider.normalizeProviderEvent({
        provider: "stripe",
      })
    ).toMatchObject({
      provider: "stripe",
      rawStatus: null,
      normalizedStatus: "manual_review_required",
    });
  });

  it("delegates session creation without changing rent payment metadata", async () => {
    const createCheckoutSession = vi.fn().mockResolvedValue({
      id: "cs_test_1",
      url: "https://checkout.stripe.test/session/cs_test_1",
      payment_intent: "pi_test_1",
    });
    const provider = createStripePaymentProvider({ createCheckoutSession });

    const result = await provider.createPaymentSession({
      intent: {
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
      },
      metadata: {
        leaseId: "lease-1",
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        rentPaymentId: "rent-payment-1",
      },
      successUrl: "https://app.test/tenant/lease?rentPaymentStatus=success",
      cancelUrl: "https://app.test/tenant/lease?rentPaymentStatus=canceled",
    });

    expect(createCheckoutSession).toHaveBeenCalledWith({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cad",
            product_data: {
              name: "Monthly rent payment",
            },
            unit_amount: 125000,
          },
          quantity: 1,
        },
      ],
      metadata: {
        leaseId: "lease-1",
        tenantId: "tenant-1",
        landlordId: "landlord-1",
        rentPaymentId: "rent-payment-1",
      },
      payment_intent_data: {
        metadata: {
          leaseId: "lease-1",
          tenantId: "tenant-1",
          landlordId: "landlord-1",
          rentPaymentId: "rent-payment-1",
        },
      },
      success_url: "https://app.test/tenant/lease?rentPaymentStatus=success",
      cancel_url: "https://app.test/tenant/lease?rentPaymentStatus=canceled",
    });
    expect(result).toEqual({
      provider: "stripe",
      status: "provider_session_created",
      redirectUrl: "https://checkout.stripe.test/session/cs_test_1",
      reference: {
        provider: "stripe",
        providerSessionId: "cs_test_1",
        providerPaymentId: "pi_test_1",
        rawStatus: "open",
        normalizedStatus: "provider_session_created",
      },
    });
  });
});
