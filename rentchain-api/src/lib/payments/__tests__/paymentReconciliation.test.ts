import { describe, expect, it } from "vitest";
import { normalizeProviderPaymentEvent } from "../paymentProviderAdapter";
import { derivePaymentReconciliation } from "../paymentReconciliation";
import type { PaymentIntentReference } from "../paymentTypes";

const rentIntent: PaymentIntentReference = {
  paymentIntentId: "rent-payment-1",
  landlordId: "landlord-1",
  tenantId: "tenant-1",
  leaseId: "lease-1",
  amount: 125000,
  currency: "CAD",
  purpose: "rent",
  provider: "stripe",
};

describe("paymentReconciliation", () => {
  it("reconciles confirmed provider evidence when amount and currency match", () => {
    const signal = normalizeProviderPaymentEvent({
      provider: "stripe",
      providerEventId: "evt_1",
      rawStatus: "paid",
      amount: 125000,
      currency: "cad",
      purpose: "rent",
    });

    expect(
      derivePaymentReconciliation({
        expectedIntent: rentIntent,
        providerSignal: signal,
      })
    ).toEqual({
      reconciliationStatus: "reconciled",
      reasons: ["provider_confirmed_amount_currency_match"],
      automationEligible: true,
      requiresManualReview: false,
    });
  });

  it("requires manual review for amount mismatch", () => {
    const signal = normalizeProviderPaymentEvent({
      provider: "stripe",
      providerEventId: "evt_1",
      rawStatus: "paid",
      amount: 120000,
      currency: "CAD",
    });

    expect(
      derivePaymentReconciliation({
        expectedIntent: rentIntent,
        providerSignal: signal,
      })
    ).toMatchObject({
      reconciliationStatus: "mismatch",
      reasons: ["amount_mismatch"],
      automationEligible: false,
      requiresManualReview: true,
    });
  });

  it("requires manual review for currency mismatch", () => {
    const signal = normalizeProviderPaymentEvent({
      provider: "stripe",
      providerEventId: "evt_1",
      rawStatus: "paid",
      amount: 125000,
      currency: "USD",
    });

    expect(
      derivePaymentReconciliation({
        expectedIntent: rentIntent,
        providerSignal: signal,
      })
    ).toMatchObject({
      reconciliationStatus: "mismatch",
      reasons: ["currency_mismatch"],
      requiresManualReview: true,
    });
  });

  it("marks duplicate provider events as duplicate risk", () => {
    const signal = normalizeProviderPaymentEvent({
      provider: "stripe",
      providerEventId: "evt_1",
      rawStatus: "paid",
      amount: 125000,
      currency: "CAD",
    });

    expect(
      derivePaymentReconciliation({
        expectedIntent: rentIntent,
        providerSignal: signal,
        existingState: { seenProviderEventIds: ["evt_1"] },
      })
    ).toEqual({
      reconciliationStatus: "duplicate_risk",
      reasons: ["duplicate_provider_event"],
      automationEligible: false,
      requiresManualReview: true,
    });
  });

  it("keeps pending provider evidence out of automation", () => {
    const signal = normalizeProviderPaymentEvent({
      provider: "trustly",
      providerEventId: "evt_1",
      rawStatus: "authorized",
      amount: 125000,
      currency: "CAD",
    });

    expect(
      derivePaymentReconciliation({
        expectedIntent: rentIntent,
        providerSignal: signal,
      })
    ).toEqual({
      reconciliationStatus: "pending_settlement",
      reasons: ["provider_signal_pending_settlement"],
      automationEligible: false,
      requiresManualReview: false,
    });
  });

  it("maps failed provider evidence to failed reconciliation", () => {
    const signal = normalizeProviderPaymentEvent({
      provider: "stripe",
      providerEventId: "evt_1",
      rawStatus: "failed",
      amount: 125000,
      currency: "CAD",
    });

    expect(
      derivePaymentReconciliation({
        expectedIntent: rentIntent,
        providerSignal: signal,
      })
    ).toMatchObject({
      reconciliationStatus: "failed",
      reasons: ["provider_signal_failed"],
      requiresManualReview: false,
    });
  });

  it("fails closed for unknown provider status", () => {
    const signal = normalizeProviderPaymentEvent({
      provider: "stripe",
      providerEventId: "evt_1",
      rawStatus: "unexpected",
      amount: 125000,
      currency: "CAD",
    });

    expect(
      derivePaymentReconciliation({
        expectedIntent: rentIntent,
        providerSignal: signal,
      })
    ).toEqual({
      reconciliationStatus: "manual_review_required",
      reasons: ["provider_status_unknown_or_manual_review"],
      automationEligible: false,
      requiresManualReview: true,
    });
  });

  it("requires manual review when internal subject reference is missing", () => {
    expect(
      derivePaymentReconciliation({
        expectedIntent: {
          ...rentIntent,
          leaseId: null,
          tenantId: null,
        },
        providerSignal: normalizeProviderPaymentEvent({
          provider: "stripe",
          providerEventId: "evt_1",
          rawStatus: "paid",
          amount: 125000,
          currency: "CAD",
        }),
      })
    ).toEqual({
      reconciliationStatus: "manual_review_required",
      reasons: ["missing_internal_subject_reference"],
      automationEligible: false,
      requiresManualReview: true,
    });
  });

  it("requires manual review when provider signal is missing", () => {
    expect(
      derivePaymentReconciliation({
        expectedIntent: rentIntent,
        providerSignal: null,
      })
    ).toEqual({
      reconciliationStatus: "manual_review_required",
      reasons: ["missing_provider_signal"],
      automationEligible: false,
      requiresManualReview: true,
    });
  });
});
