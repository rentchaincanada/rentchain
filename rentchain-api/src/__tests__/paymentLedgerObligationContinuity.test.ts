import { describe, expect, it } from "vitest";

import {
  buildPaymentObligationLedgerRows,
  summarizePaymentObligationLedger,
  type PaymentObligationCanonicalPaymentInput,
  type PaymentObligationLeaseInput,
} from "../lib/payments/paymentObligationLedger";
import {
  buildLifecycleContinuityDecision,
  buildLifecycleContinuityLedgerEntry,
  buildLifecycleContinuityLease,
  buildLifecycleContinuityPayment,
  buildLifecycleContinuityScenario,
  lifecycleContinuityDates,
  lifecycleContinuityIds,
} from "./fixtures/lifecycleContinuityFixtures";

function fixtureLease(
  kind: "active" | "upcoming" | "archived" = "active",
  overrides: Partial<PaymentObligationLeaseInput> = {},
): PaymentObligationLeaseInput {
  const lease = buildLifecycleContinuityLease(kind);
  return {
    id: String(lease.id),
    landlordId: String(lease.landlordId),
    tenantId: String(lease.tenantId),
    propertyId: String(lease.propertyId),
    unitId: String(lease.unitId),
    status: String(lease.status),
    startDate: String(lease.startDate),
    endDate: String(lease.endDate),
    amountCents: Number(lease.rentCents),
    dueDay: Number(lease.rentDueDay),
    paymentFrequency: String(lease.paymentFrequency),
    currency: "cad",
    ...overrides,
  };
}

function fixturePayment(
  overrides: Partial<PaymentObligationCanonicalPaymentInput> = {},
): PaymentObligationCanonicalPaymentInput {
  const payment = buildLifecycleContinuityPayment();
  return {
    id: String(payment.id),
    paymentDocumentId: String(payment.id),
    landlordId: String(payment.landlordId),
    tenantId: String(payment.tenantId),
    leaseId: String(payment.leaseId),
    propertyId: String(payment.propertyId),
    unitId: String(payment.unitId),
    amountCents: Number(payment.amountCents),
    status: String(payment.status),
    paidAt: String(payment.paidAt),
    effectiveDate: String(payment.effectiveDate),
    method: String(payment.method),
    reference: String(payment.reference),
    source: String(payment.source),
    ledgerEntryId: String(payment.ledgerEntryId),
    currency: "cad",
    ...overrides,
  };
}

describe("payment ledger obligation continuity", () => {
  it("keeps canonical imported payments linked to immutable ledger payment entries", () => {
    const scenario = buildLifecycleContinuityScenario();

    expect(scenario.payment).toEqual(
      expect.objectContaining({
        id: lifecycleContinuityIds.paymentId,
        ledgerEntryId: lifecycleContinuityIds.ledgerEntryId,
        source: "payment_csv_import",
        status: "recorded",
      }),
    );
    expect(scenario.ledgerEntry).toEqual(
      expect.objectContaining({
        id: lifecycleContinuityIds.ledgerEntryId,
        paymentDocumentId: lifecycleContinuityIds.paymentId,
        entryType: "payment",
        category: "payment",
        signedAmountCents: -164000,
        immutable: true,
      }),
    );
  });

  it("counts imported canonical payments as obligation evidence", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [fixtureLease()],
      canonicalPayments: [fixturePayment()],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        leaseId: lifecycleContinuityIds.activeLeaseId,
        paymentDocumentId: lifecycleContinuityIds.paymentId,
        expectedAmountCents: 164000,
        paidAmountCents: 164000,
        obligationStatus: "paid",
        evidenceStatus: "reconciled",
        source: "canonical_payment",
        reasons: expect.arrayContaining([
          "paid_amount_matches_expected",
          "canonical_payment_recorded",
        ]),
      }),
    );
  });

  it("keeps obligation due date lease-term based instead of payment-date based", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [fixtureLease("active", { startDate: "2026-06-01", dueDay: 1 })],
      canonicalPayments: [
        fixturePayment({
          paidAt: "2026-05-17",
          effectiveDate: "2026-05-17",
        }),
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        dueDate: "2026-06-01",
        paidAmountCents: 164000,
        obligationStatus: "paid",
      }),
    );
    expect(rows[0].dueDate).not.toBe("2026-05-17");
  });

  it("reconciles prepaid rent inside the allowed window without moving the due date", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [fixtureLease("active", { startDate: "2026-06-01", dueDay: 1 })],
      canonicalPayments: [
        fixturePayment({
          id: "lc_payment_prepaid_001",
          paymentDocumentId: "lc_payment_prepaid_001",
          paidAt: "2026-05-15",
          effectiveDate: "2026-05-15",
        }),
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        dueDate: "2026-06-01",
        paidAmountCents: 164000,
        obligationStatus: "paid",
        evidenceStatus: "reconciled",
      }),
    );
  });

  it("leaves outstanding balance for partial imported payments", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [fixtureLease()],
      canonicalPayments: [
        fixturePayment({
          id: "lc_payment_partial_001",
          paymentDocumentId: "lc_payment_partial_001",
          amountCents: 100000,
        }),
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        expectedAmountCents: 164000,
        paidAmountCents: 100000,
        obligationStatus: "underpaid",
      }),
    );
    expect(summarizePaymentObligationLedger(rows)).toEqual(
      expect.objectContaining({
        paidAmountCents: 100000,
        outstandingAmountCents: 64000,
      }),
    );
  });

  it("does not double-count duplicate import attempts that were not recorded as payments", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [fixtureLease()],
      canonicalPayments: [
        fixturePayment(),
        fixturePayment({
          id: "lc_payment_duplicate_skipped_001",
          paymentDocumentId: "lc_payment_duplicate_skipped_001",
          status: "duplicate",
        }),
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        expectedAmountCents: 164000,
        paidAmountCents: 164000,
        obligationStatus: "paid",
      }),
    );
    expect(summarizePaymentObligationLedger(rows)).toEqual(
      expect.objectContaining({
        paidAmountCents: 164000,
        outstandingAmountCents: 0,
      }),
    );
  });

  it("models payment edit adjustments as append-only without mutating the original ledger entry", () => {
    const originalEntry = buildLifecycleContinuityLedgerEntry();
    const adjustmentEntry = {
      id: "lc_ledger_adjustment_001",
      landlordId: lifecycleContinuityIds.landlordId,
      tenantId: lifecycleContinuityIds.activeTenantId,
      leaseId: lifecycleContinuityIds.activeLeaseId,
      propertyId: lifecycleContinuityIds.propertyId,
      unitId: lifecycleContinuityIds.unit101Id,
      entryType: "adjustment",
      category: "payment_adjustment",
      amountCents: -4000,
      amountDeltaCents: -4000,
      referencePaymentId: lifecycleContinuityIds.paymentId,
      sourceType: "payment_edit",
      createdAt: lifecycleContinuityDates.now,
    };

    expect(originalEntry).toEqual(
      expect.objectContaining({
        id: lifecycleContinuityIds.ledgerEntryId,
        entryType: "payment",
        amountCents: 164000,
        signedAmountCents: -164000,
        paymentDocumentId: lifecycleContinuityIds.paymentId,
      }),
    );
    expect(adjustmentEntry).toEqual(
      expect.objectContaining({
        entryType: "adjustment",
        referencePaymentId: lifecycleContinuityIds.paymentId,
        amountDeltaCents: -4000,
      }),
    );
  });

  it("keeps decision workflow status separate from obligation financial truth", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [fixtureLease()],
      canonicalPayments: [fixturePayment({ amountCents: 100000 })],
    });
    const decision = buildLifecycleContinuityDecision({
      workflowStatus: "resolved",
      reviewTrail: [
        { action: "created", actorId: "system", createdAt: lifecycleContinuityDates.decisionCreatedAt },
        { action: "resolved", actorId: lifecycleContinuityIds.landlordId, createdAt: lifecycleContinuityDates.now },
      ],
    });

    expect(rows[0]).toEqual(
      expect.objectContaining({
        obligationStatus: "underpaid",
        paidAmountCents: 100000,
      }),
    );
    expect(decision).toEqual(
      expect.objectContaining({
        workflowStatus: "resolved",
        financialSignal: "Manual review required",
      }),
    );
    expect(rows[0].obligationStatus).toBe("underpaid");
  });

  it("keeps ledger-only orphan payments unmatched instead of treating them as obligation evidence", () => {
    const orphanLedgerPayment = buildLifecycleContinuityLedgerEntry({
      id: "lc_orphan_ledger_payment_001",
      leaseId: null,
      paymentDocumentId: null,
    });
    const rows = buildPaymentObligationLedgerRows({
      leases: [fixtureLease()],
      canonicalPayments: [],
    });

    expect(orphanLedgerPayment).toEqual(
      expect.objectContaining({
        entryType: "payment",
        paymentDocumentId: null,
        leaseId: null,
      }),
    );
    expect(rows[0]).toEqual(
      expect.objectContaining({
        paidAmountCents: 0,
        obligationStatus: "missing",
        evidenceStatus: "none",
      }),
    );
  });

  it("does not let archived lease payment evidence pay the current active obligation", () => {
    const rows = buildPaymentObligationLedgerRows({
      leases: [fixtureLease("active"), fixtureLease("archived")],
      canonicalPayments: [
        fixturePayment({
          id: "lc_archived_payment_001",
          paymentDocumentId: "lc_archived_payment_001",
          tenantId: lifecycleContinuityIds.archivedTenantId,
          leaseId: lifecycleContinuityIds.archivedLeaseId,
          amountCents: 150000,
          effectiveDate: "2026-05-15",
          paidAt: "2026-05-15",
        }),
      ],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        leaseId: lifecycleContinuityIds.activeLeaseId,
        paidAmountCents: 0,
        obligationStatus: "missing",
      }),
    );
  });
});
