import { describe, expect, it } from "vitest";
import {
  buildPaymentObligationLedgerRows,
  derivePaymentObligationStatus,
  summarizePaymentObligationLedger,
  type PaymentObligationLeaseInput,
} from "../paymentObligationLedger";
import type { PaymentIntentRecord } from "../paymentIntents";
import type { RentPaymentRecord } from "../../../services/rentPayments/rentPaymentService";

const lease: PaymentObligationLeaseInput = {
  id: "lease-1",
  landlordId: "landlord-1",
  propertyId: "prop-1",
  unitId: "unit-1",
  tenantId: "tenant-1",
  monthlyRent: 180000,
  currency: "cad",
  startDate: "2026-04-01",
  endDate: "2027-03-31",
  derivedLifecycleState: "active",
};

function intent(overrides: Partial<PaymentIntentRecord> = {}): PaymentIntentRecord {
  return {
    paymentIntentId: "pi-rent-1",
    landlordId: "landlord-1",
    tenantId: "tenant-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    leaseId: "lease-1",
    rentPaymentId: "rp-1",
    purpose: "rent",
    amountCents: 180000,
    currency: "cad",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    dueDate: "2026-04-01",
    status: "ready",
    provider: null,
    providerSessionId: null,
    providerPaymentId: null,
    source: "rent_payment_checkout",
    lifecycleState: "complete",
    requiresReview: false,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    metadataSummary: null,
    ...overrides,
  };
}

function rentPayment(overrides: Partial<RentPaymentRecord> = {}): RentPaymentRecord {
  return {
    id: "rp-1",
    leaseId: "lease-1",
    tenantId: "tenant-1",
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    paymentIntentId: "pi-rent-1",
    amountCents: 180000,
    currency: "cad",
    status: "paid",
    processor: "stripe",
    processorCheckoutSessionId: "cs-1",
    processorPaymentIntentId: "stripe-pi-1",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:01:00.000Z",
    paidAt: "2026-04-01T00:01:00.000Z",
    ...overrides,
  };
}

describe("paymentObligationLedger", () => {
  it("derives missing when a lease obligation has no payment evidence", () => {
    const rows = buildPaymentObligationLedgerRows({ leases: [lease] });

    expect(rows).toEqual([
      expect.objectContaining({
        leaseId: "lease-1",
        expectedAmountCents: 180000,
        paidAmountCents: 0,
        obligationStatus: "missing",
        source: "lease_lifecycle",
        reasons: ["expected_payment_missing"],
      }),
    ]);
  });

  it("derives monthly obligation due date from lease due day 1", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [{ ...lease, startDate: "2026-05-31", dueDay: 1, dueDate: "2026-05-31" }],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        periodStart: "2026-05-31T00:00:00.000Z",
        dueDate: "2026-06-01",
      })
    );
  });

  it("derives monthly obligation due date from a custom lease due day", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [{ ...lease, startDate: "2026-05-01", dueDay: 5, dueDate: "2026-05-01" }],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        dueDate: "2026-05-05",
      })
    );
  });

  it("falls back to the next first day when due day is missing", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [{ ...lease, startDate: "2026-06-15", dueDate: null }],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        dueDate: "2026-07-01",
      })
    );
  });

  it("derives paid when paid amount matches expected", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [lease],
      paymentIntents: [intent({ status: "confirmed" })],
      rentPayments: [rentPayment()],
      reconciliationRecords: [
        {
          reconciliationId: "rec-1",
          paymentIntentId: "pi-rent-1",
          rentPaymentId: "rp-1",
          reconciliationStatus: "reconciled",
          reasons: ["provider_confirmed_amount_currency_match"],
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        paymentIntentId: "pi-rent-1",
        rentPaymentId: "rp-1",
        expectedAmountCents: 180000,
        paidAmountCents: 180000,
        obligationStatus: "paid",
        reconciliationStatus: "reconciled",
        evidenceStatus: "reconciled",
      })
    );
  });

  it("reconciles imported canonical payments against matching lease obligations", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [{ ...lease, dueDay: 1 }],
      canonicalPayments: [
        {
          id: "payment-import-1",
          leaseId: "lease-1",
          landlordId: "landlord-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          amountCents: 180000,
          status: "recorded",
          effectiveDate: "2026-05-17",
          source: "payment_csv_import",
        },
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        leaseId: "lease-1",
        paymentDocumentId: "payment-import-1",
        dueDate: "2026-04-01",
        expectedAmountCents: 180000,
        paidAmountCents: 180000,
        obligationStatus: "paid",
        evidenceStatus: "reconciled",
        source: "canonical_payment",
        reasons: expect.arrayContaining(["paid_amount_matches_expected", "canonical_payment_recorded"]),
      })
    );
    expect(summarizePaymentObligationLedger(rows)).toEqual(
      expect.objectContaining({
        expectedAmountCents: 180000,
        paidAmountCents: 180000,
        outstandingAmountCents: 0,
      })
    );
  });

  it("keeps canonical payment evidence date separate from obligation due date", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [{ ...lease, startDate: "2026-05-01", dueDay: 5 }],
      canonicalPayments: [
        {
          id: "payment-import-late",
          leaseId: "lease-1",
          amountCents: 180000,
          status: "recorded",
          effectiveDate: "2026-05-17",
          paidAt: "2026-05-17",
          source: "payment_csv_import",
        },
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        dueDate: "2026-05-05",
        paidAmountCents: 180000,
        obligationStatus: "paid",
        evidenceStatus: "reconciled",
      })
    );
  });

  it("keeps manual rent payment evidence date separate from obligation due date", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [{ ...lease, startDate: "2026-05-01", dueDay: 5 }],
      rentPayments: [
        rentPayment({
          id: "rp-manual-1",
          paymentIntentId: null,
          paidAt: "2026-05-20T12:00:00.000Z",
        }),
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        dueDate: "2026-05-05",
        paidAmountCents: 180000,
        obligationStatus: "paid",
      })
    );
  });

  it("reconciles partial imported canonical payments without clearing the outstanding amount", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [lease],
      canonicalPayments: [
        {
          id: "payment-import-partial",
          leaseId: "lease-1",
          amountCents: 100000,
          status: "recorded",
          effectiveDate: "2026-05-17",
          source: "payment_csv_import",
        },
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        expectedAmountCents: 180000,
        paidAmountCents: 100000,
        obligationStatus: "underpaid",
        source: "canonical_payment",
      })
    );
    expect(summarizePaymentObligationLedger(rows)).toEqual(
      expect.objectContaining({
        paidAmountCents: 100000,
        outstandingAmountCents: 80000,
      })
    );
  });

  it("reconciles same-lease imported payments shortly before lease start as prepaid rent evidence", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [
        {
          ...lease,
          startDate: "2026-05-31",
          endDate: "2027-05-29",
          dueDay: 1,
          monthlyRent: 164000,
          amountCents: 164000,
        },
      ],
      canonicalPayments: [
        {
          id: "payment-import-prepaid-1",
          leaseId: "lease-1",
          amountCents: 164000,
          status: "recorded",
          effectiveDate: "2026-05-05",
          source: "payment_csv_import",
        },
        {
          id: "payment-import-prepaid-2",
          leaseId: "lease-1",
          amountCents: 164000,
          status: "recorded",
          effectiveDate: "2026-05-17",
          source: "payment_csv_import",
        },
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        expectedAmountCents: 164000,
        dueDate: "2026-06-01",
        paidAmountCents: 328000,
        obligationStatus: "overpaid",
        evidenceStatus: "reconciled",
        source: "canonical_payment",
        reasons: expect.arrayContaining(["paid_amount_above_expected", "canonical_payment_recorded"]),
      })
    );
    expect(summarizePaymentObligationLedger(rows)).toEqual(
      expect.objectContaining({
        expectedAmountCents: 164000,
        paidAmountCents: 328000,
        outstandingAmountCents: 0,
      })
    );
  });

  it("keeps imported canonical payments outside the prepayment and lease term window in manual review", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [lease],
      canonicalPayments: [
        {
          id: "payment-import-old",
          leaseId: "lease-1",
          amountCents: 180000,
          status: "recorded",
          effectiveDate: "2026-02-01",
          source: "payment_csv_import",
        },
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        paidAmountCents: 0,
        obligationStatus: "manual_review_required",
        evidenceStatus: "manual_review_required",
        reasons: expect.arrayContaining(["reconciliation_requires_manual_review", "canonical_payment_outside_lease_term"]),
      })
    );
  });

  it("derives underpaid and overpaid by comparing paid amount to expected amount", () => {
    expect(
      derivePaymentObligationStatus({
        expectedAmountCents: 180000,
        paidAmountCents: 100000,
        hasPaymentIntent: true,
      }).obligationStatus
    ).toBe("underpaid");

    expect(
      derivePaymentObligationStatus({
        expectedAmountCents: 180000,
        paidAmountCents: 200000,
        hasPaymentIntent: true,
      }).obligationStatus
    ).toBe("overpaid");
  });

  it("derives failed from failed rentPayment or PaymentIntent state", () => {
    expect(
      buildPaymentObligationLedgerRows({
        leases: [lease],
        paymentIntents: [intent({ status: "failed" })],
      })[0]?.obligationStatus
    ).toBe("failed");

    expect(
      buildPaymentObligationLedgerRows({
        leases: [lease],
        rentPayments: [rentPayment({ paymentIntentId: null, status: "failed", paidAt: null })],
      })[0]?.obligationStatus
    ).toBe("failed");
  });

  it("lets manual-review reconciliation take precedence over otherwise paid evidence", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [lease],
      paymentIntents: [intent({ status: "confirmed" })],
      rentPayments: [rentPayment()],
      reconciliationRecords: [
        {
          reconciliationId: "rec-1",
          paymentIntentId: "pi-rent-1",
          reconciliationStatus: "mismatch",
          requiresManualReview: true,
          reasons: ["amount_mismatch"],
        },
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        obligationStatus: "manual_review_required",
        evidenceStatus: "manual_review_required",
        reasons: expect.arrayContaining(["reconciliation_requires_manual_review", "amount_mismatch"]),
      })
    );
  });

  it("marks missing or contradictory critical data as unknown or manual review", () => {
    expect(
      derivePaymentObligationStatus({
        expectedAmountCents: 0,
        paidAmountCents: 0,
        hasPaymentIntent: true,
      })
    ).toEqual(
      expect.objectContaining({
        obligationStatus: "unknown",
        reasons: ["missing_expected_amount"],
      })
    );

    expect(
      buildPaymentObligationLedgerRows({
        paymentIntents: [intent({ amountCents: 0, status: "manual_review_required", requiresReview: true })],
      })[0]
    ).toEqual(
      expect.objectContaining({
        obligationStatus: "manual_review_required",
        evidenceStatus: "manual_review_required",
      })
    );
  });

  it("summarizes expected paid outstanding and status counts", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [
        lease,
        { ...lease, id: "lease-2", leaseId: "lease-2", propertyId: "prop-2", unitId: "unit-2" },
      ],
      paymentIntents: [intent({ status: "confirmed" })],
      rentPayments: [rentPayment()],
    });

    const summary = summarizePaymentObligationLedger(rows);

    expect(summary).toEqual(
      expect.objectContaining({
        totalRows: 2,
        expectedAmountCents: 360000,
        paidAmountCents: 180000,
        outstandingAmountCents: 180000,
      })
    );
    expect(summary.statusCounts.paid).toBe(1);
    expect(summary.statusCounts.missing).toBe(1);
  });
});
