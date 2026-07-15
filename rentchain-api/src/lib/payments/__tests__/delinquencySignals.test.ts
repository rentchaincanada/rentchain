import { describe, expect, it } from "vitest";
import {
  deriveDelinquencySignals,
  summarizeDelinquencySignals,
} from "../delinquencySignals";
import type { PaymentObligationLedgerRow } from "../paymentObligationLedger";

function row(overrides: Partial<PaymentObligationLedgerRow> = {}): PaymentObligationLedgerRow {
  return {
    rowId: "obligation-1",
    leaseId: "lease-1",
    paymentIntentId: "pi-1",
    rentPaymentId: "rp-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    dueDate: "2026-04-10",
    expectedAmountCents: 180000,
    paidAmountCents: 0,
    currency: "cad",
    obligationStatus: "pending",
    paymentIntentStatus: "pending_settlement",
    rentPaymentStatus: "payment_pending",
    reconciliationStatus: null,
    evidenceStatus: "pending",
    source: "payment_intent",
    reasons: [],
    ...overrides,
  };
}

describe("delinquencySignals", () => {
  it("derives rent_due for expected or pending obligations that are not past due", () => {
    const signals = deriveDelinquencySignals(
      [
        row({
          obligationStatus: "expected",
          rentPaymentId: null,
          dueDate: "2026-04-10",
        }),
      ],
      "2026-04-09T12:00:00.000Z"
    );

    expect(signals).toEqual([
      expect.objectContaining({
        signalType: "rent_due",
        severity: "info",
        outstandingAmountCents: 180000,
        detectedAt: "2026-04-09T12:00:00.000Z",
      }),
    ]);
  });

  it("derives overdue for past-due pending obligations with outstanding amount", () => {
    const signals = deriveDelinquencySignals(
      [
        row({
          obligationStatus: "pending",
          dueDate: "2026-04-01",
          expectedAmountCents: 180000,
          paidAmountCents: 0,
        }),
      ],
      "2026-04-15T00:00:00.000Z"
    );

    expect(signals[0]).toEqual(
      expect.objectContaining({
        signalType: "overdue",
        severity: "critical",
        outstandingAmountCents: 180000,
        reasons: ["obligation_pending_after_due_date"],
      })
    );
  });

  it("does not derive active overdue signals when credit allocation fully covers the obligation", () => {
    const signals = deriveDelinquencySignals(
      [
        row({
          obligationStatus: "missing",
          rentPaymentId: null,
          paymentIntentId: null,
          dueDate: "2026-04-01",
          allocatedFromCreditCents: 180000,
          outstandingAfterAllocationCents: 0,
          allocationStatus: "fully_allocated",
          allocationAdjustedFinancialSignal: "credit_allocation_recorded",
        }),
      ],
      "2026-04-15T00:00:00.000Z"
    );

    expect(signals).toEqual([]);
  });

  it("uses remaining outstanding after partial credit allocation for delinquency exposure", () => {
    const signals = deriveDelinquencySignals(
      [
        row({
          obligationStatus: "missing",
          rentPaymentId: null,
          paymentIntentId: null,
          dueDate: "2026-04-01",
          allocatedFromCreditCents: 75000,
          outstandingAfterAllocationCents: 105000,
          allocationStatus: "partially_allocated",
          allocationAdjustedFinancialSignal: "allocation_review",
        }),
      ],
      "2026-04-15T00:00:00.000Z"
    );

    expect(signals).toEqual([
      expect.objectContaining({
        signalType: "overdue",
        outstandingAmountCents: 105000,
        reasons: expect.arrayContaining(["credit_allocation_applied_to_obligation"]),
      }),
      expect.objectContaining({
        signalType: "missing_payment",
        outstandingAmountCents: 105000,
        reasons: expect.arrayContaining(["credit_allocation_applied_to_obligation"]),
      }),
    ]);
  });

  it("summarizes delinquency exposure after allocation-adjusted outstanding", () => {
    const signals = deriveDelinquencySignals(
      [
        row({
          rowId: "partial",
          paymentIntentId: null,
          rentPaymentId: null,
          obligationStatus: "missing",
          dueDate: "2026-04-01",
          allocatedFromCreditCents: 100000,
          outstandingAfterAllocationCents: 80000,
          allocationStatus: "partially_allocated",
        }),
      ],
      "2026-04-15T00:00:00.000Z"
    );

    expect(summarizeDelinquencySignals(signals)).toEqual(
      expect.objectContaining({
        overdueCount: 1,
        missingCount: 1,
        totalOutstandingCents: 80000,
      })
    );
  });

  it("derives partially_paid for underpaid obligations and calculates outstanding amount", () => {
    const signals = deriveDelinquencySignals(
      [
        row({
          obligationStatus: "underpaid",
          expectedAmountCents: 180000,
          paidAmountCents: 100000,
        }),
      ],
      "2026-04-15T00:00:00.000Z"
    );

    expect(signals[0]).toEqual(
      expect.objectContaining({
        signalType: "partially_paid",
        severity: "warning",
        paidAmountCents: 100000,
        outstandingAmountCents: 80000,
      })
    );
  });

  it("derives failed_payment for failed obligations", () => {
    const signals = deriveDelinquencySignals(
      [
        row({
          obligationStatus: "failed",
          rentPaymentStatus: "failed",
          evidenceStatus: "failed",
        }),
      ],
      "2026-04-15T00:00:00.000Z"
    );

    expect(signals[0]).toEqual(
      expect.objectContaining({
        signalType: "failed_payment",
        severity: "critical",
        reasons: ["obligation_payment_failed"],
      })
    );
  });

  it("derives missing_payment when no rentPayment exists after the due date", () => {
    const signals = deriveDelinquencySignals(
      [
        row({
          obligationStatus: "missing",
          rentPaymentId: null,
          paymentIntentId: null,
          dueDate: "2026-04-01",
        }),
      ],
      "2026-04-15T00:00:00.000Z"
    );

    expect(signals).toEqual([
      expect.objectContaining({
        signalType: "overdue",
        severity: "critical",
        outstandingAmountCents: 180000,
      }),
      expect.objectContaining({
        signalType: "missing_payment",
        severity: "warning",
        outstandingAmountCents: 180000,
        reasons: ["missing_rent_payment_after_due_date"],
      }),
    ]);
  });

  it("does not derive missing payment when canonical payment evidence clears outstanding amount", () => {
    const signals = deriveDelinquencySignals(
      [
        row({
          rowId: "canonical-paid",
          paymentIntentId: null,
          rentPaymentId: null,
          paymentDocumentId: "payment-1",
          obligationStatus: "overpaid",
          expectedAmountCents: 164000,
          paidAmountCents: 492000,
          evidenceStatus: "reconciled",
          source: "canonical_payment",
          dueDate: "2026-05-05",
        }),
      ],
      "2026-05-17T00:00:00.000Z"
    );

    expect(signals).toEqual([]);
  });

  it("derives manual_review_required for manual review and unknown obligation states", () => {
    const signals = deriveDelinquencySignals(
      [
        row({
          rowId: "manual-review",
          obligationStatus: "manual_review_required",
          evidenceStatus: "manual_review_required",
        }),
        row({
          rowId: "unknown",
          obligationStatus: "unknown",
          expectedAmountCents: 0,
          paidAmountCents: 0,
        }),
      ],
      "2026-04-15T00:00:00.000Z"
    );

    expect(signals.map((signal) => signal.signalType)).toEqual([
      "manual_review_required",
      "manual_review_required",
    ]);
    expect(signals[0].reasons).toEqual(["obligation_requires_manual_review"]);
    expect(signals[1].reasons).toEqual(["obligation_status_unknown"]);
  });

  it("carries normalized due date into manual review signals for canonical payment rows", () => {
    const signals = deriveDelinquencySignals(
      [
        row({
          rowId: "canonical-review",
          paymentIntentId: null,
          rentPaymentId: null,
          paymentDocumentId: "payment-1",
          obligationStatus: "manual_review_required",
          evidenceStatus: "manual_review_required",
          source: "canonical_payment",
          dueDate: "2026-07-01",
        }),
      ],
      "2026-07-15T00:00:00.000Z"
    );

    expect(signals[0]).toEqual(
      expect.objectContaining({
        signalType: "manual_review_required",
        dueDate: "2026-07-01T00:00:00.000Z",
      })
    );
  });

  it("summarizes signal counts and outstanding rent", () => {
    const signals = deriveDelinquencySignals(
      [
        row({ rowId: "due", paymentIntentId: "pi-due", obligationStatus: "expected", rentPaymentId: null, dueDate: "2026-04-20" }),
        row({ rowId: "overdue", paymentIntentId: "pi-overdue", rentPaymentId: "rp-overdue", obligationStatus: "pending", dueDate: "2026-04-01" }),
        row({ rowId: "partial", paymentIntentId: "pi-partial", rentPaymentId: "rp-partial", obligationStatus: "underpaid", paidAmountCents: 100000 }),
        row({ rowId: "failed", paymentIntentId: "pi-failed", rentPaymentId: "rp-failed", obligationStatus: "failed", rentPaymentStatus: "failed" }),
        row({ rowId: "missing", paymentIntentId: null, rentPaymentId: null, obligationStatus: "missing", dueDate: "2026-04-01" }),
        row({ rowId: "review", paymentIntentId: "pi-review", rentPaymentId: "rp-review", obligationStatus: "manual_review_required" }),
      ],
      "2026-04-15T00:00:00.000Z"
    );

    const summary = summarizeDelinquencySignals(signals);

    expect(summary).toEqual({
      totalSignals: 7,
      overdueCount: 2,
      partiallyPaidCount: 1,
      failedCount: 1,
      missingCount: 1,
      manualReviewCount: 1,
      totalOutstandingCents: 980000,
    });
  });
});
