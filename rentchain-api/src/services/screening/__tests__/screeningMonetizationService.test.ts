import { describe, expect, it } from "vitest";

import {
  buildQuoteId,
  buildScreeningMonetizationPatch,
  buildScreeningMonetizationSummary,
  normalizeScreeningMonetizationState,
  SCREENING_QUOTE_TTL_MS,
} from "../screeningMonetizationService";

describe("screeningMonetizationService", () => {
  it("maps legacy missing fields into a stable default summary", () => {
    const state = normalizeScreeningMonetizationState({});
    expect(buildScreeningMonetizationSummary(state)).toEqual({
      eligibility: "eligible",
      quoteStatus: "none",
      paymentStatus: "none",
      fulfillmentStatus: "not_started",
      canGenerateQuote: true,
      canStartCheckout: true,
      canRetryCheckout: false,
      alreadyPaid: false,
      blockingReason: null,
      amount: null,
      currency: null,
    });
  });

  it("marks quotes as expired once the TTL has elapsed", () => {
    const now = Date.now();
    const state = normalizeScreeningMonetizationState({
      application: {
        screeningMonetization: {
          version: "v1",
          eligibility: "eligible",
          quoteStatus: "generated",
          quoteId: buildQuoteId({ applicationId: "app-1", now: now - SCREENING_QUOTE_TTL_MS - 1000 }),
          quoteGeneratedAt: new Date(now - SCREENING_QUOTE_TTL_MS - 1000).toISOString(),
        },
      },
      now,
    });

    const summary = buildScreeningMonetizationSummary(state);
    expect(state.quoteStatus).toBe("expired");
    expect(summary.blockingReason).toBe("SCREENING_QUOTE_EXPIRED");
    expect(summary.canRetryCheckout).toBe(true);
  });

  it("blocks duplicate checkout when an unpaid order already has a checkout session", () => {
    const state = normalizeScreeningMonetizationState({
      latestOrder: {
        status: "unpaid",
        paymentStatus: "unpaid",
        stripeCheckoutSessionId: "sess_1",
        amountTotalCents: 4900,
        currency: "cad",
      },
    });

    const summary = buildScreeningMonetizationSummary(state);
    expect(state.paymentStatus).toBe("checkout_created");
    expect(summary.blockingReason).toBe("SCREENING_CHECKOUT_ALREADY_EXISTS");
  });

  it("preserves paid/completed protection from current application state", () => {
    const state = normalizeScreeningMonetizationState({
      application: {
        screeningStatus: "complete",
        screeningPaidAt: Date.now(),
      },
    });

    const summary = buildScreeningMonetizationSummary(state);
    expect(summary.alreadyPaid).toBe(true);
    expect(summary.blockingReason).toBe("SCREENING_ALREADY_PAID");
  });

  it("builds additive patches without dropping existing values", () => {
    const patch = buildScreeningMonetizationPatch({
      current: {
        version: "v1",
        eligibility: "eligible",
        quoteStatus: "generated",
        quoteId: "quote_1",
        quoteGeneratedAt: "2026-01-01T00:00:00.000Z",
        amount: 4900,
        currency: "CAD",
        package: "standard",
        addons: ["income_verification"],
      },
      paymentStatus: "checkout_created",
      checkoutSessionId: "sess_1",
    });

    expect(patch.quoteId).toBe("quote_1");
    expect(patch.paymentStatus).toBe("checkout_created");
    expect(patch.checkoutSessionId).toBe("sess_1");
    expect(patch.package).toBe("standard");
    expect(patch.addons).toEqual(["income_verification"]);
  });
});
