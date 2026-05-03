import { describe, expect, it } from "vitest";
import { mapProviderStatus, normalizeProviderPaymentEvent } from "../paymentProviderAdapter";

describe("paymentProviderAdapter", () => {
  it("maps Stripe statuses into provider-neutral execution statuses", () => {
    expect(mapProviderStatus("stripe", "open")).toBe("provider_session_created");
    expect(mapProviderStatus("stripe", "processing")).toBe("pending_provider_confirmation");
    expect(mapProviderStatus("stripe", "paid")).toBe("confirmed");
    expect(mapProviderStatus("stripe", "canceled")).toBe("cancelled");
    expect(mapProviderStatus("stripe", "expired")).toBe("expired");
  });

  it("maps Trustly statuses without implementing a Trustly provider", () => {
    expect(mapProviderStatus("trustly", "authorized")).toBe("pending_settlement");
    expect(mapProviderStatus("trustly", "settled")).toBe("confirmed");
    expect(mapProviderStatus("trustly", "denied")).toBe("failed");
  });

  it("fails closed for unknown provider statuses", () => {
    expect(mapProviderStatus("stripe", "surprise_status")).toBe("manual_review_required");
    expect(mapProviderStatus("trustly", "")).toBe("manual_review_required");
    expect(mapProviderStatus("manual", null)).toBe("manual_review_required");
  });

  it("normalizes provider events with safe amount and currency fields", () => {
    expect(
      normalizeProviderPaymentEvent({
        provider: "stripe",
        providerEventId: "evt_1",
        providerPaymentId: "pi_1",
        rawStatus: "paid",
        amount: 125000,
        currency: "cad",
        purpose: "rent",
      })
    ).toEqual({
      provider: "stripe",
      providerEventId: "evt_1",
      providerPaymentId: "pi_1",
      providerSessionId: null,
      providerCustomerId: null,
      rawStatus: "paid",
      normalizedStatus: "confirmed",
      purpose: "rent",
      amount: 125000,
      currency: "CAD",
      occurredAt: null,
    });
  });
});
