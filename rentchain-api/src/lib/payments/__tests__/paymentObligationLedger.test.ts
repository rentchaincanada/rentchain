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
