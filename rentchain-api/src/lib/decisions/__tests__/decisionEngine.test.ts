import { describe, expect, it } from "vitest";
import { deriveDecisions, type DecisionLeaseLifecycleInput } from "../decisionEngine";
import type { DelinquencySignal } from "../../payments/delinquencySignals";
import type { PaymentObligationLedgerRow } from "../../payments/paymentObligationLedger";

function signal(overrides: Partial<DelinquencySignal> = {}): DelinquencySignal {
  return {
    signalId: "delinquency:overdue:pi-1",
    leaseId: "lease-1",
    paymentIntentId: "pi-1",
    rentPaymentId: "rp-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T00:00:00.000Z",
    dueDate: "2026-04-10T00:00:00.000Z",
    expectedAmountCents: 180000,
    paidAmountCents: 0,
    outstandingAmountCents: 180000,
    signalType: "overdue",
    severity: "critical",
    detectedAt: "2026-04-15T00:00:00.000Z",
    reasons: ["obligation_pending_after_due_date"],
    ...overrides,
  };
}

function row(overrides: Partial<PaymentObligationLedgerRow> = {}): PaymentObligationLedgerRow {
  return {
    rowId: "obligation:pi-1",
    leaseId: "lease-1",
    paymentIntentId: "pi-1",
    rentPaymentId: "rp-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T00:00:00.000Z",
    dueDate: "2026-04-10T00:00:00.000Z",
    expectedAmountCents: 180000,
    paidAmountCents: 0,
    currency: "cad",
    obligationStatus: "pending",
    paymentIntentStatus: "pending_settlement",
    rentPaymentStatus: "payment_pending",
    reconciliationStatus: null,
    evidenceStatus: "pending",
    source: "payment_intent",
    reasons: ["payment_intent_pending_settlement"],
    ...overrides,
  };
}

function lifecycle(overrides: Partial<NonNullable<DecisionLeaseLifecycleInput>> = {}): NonNullable<DecisionLeaseLifecycleInput> {
  return {
    leaseId: "lease-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    state: "notice_period",
    reasons: ["active_notice_signal"],
    effectiveStartDate: "2026-04-01",
    effectiveEndDate: "2026-05-01",
    isCurrent: true,
    isTerminal: false,
    isOccupancyActive: true,
    isRenewalProtected: false,
    requiresReview: false,
    ...overrides,
  };
}

describe("decisionEngine", () => {
  it("maps overdue delinquency signal to a critical rent review decision", () => {
    const decisions = deriveDecisions({
      delinquencySignals: [signal()],
      obligationRows: [row()],
      today: "2026-04-15T00:00:00.000Z",
    });

    expect(decisions).toEqual([
      expect.objectContaining({
        decisionId: "decision:review_overdue_rent:delinquency:overdue:pi-1",
        leaseId: "lease-1",
        paymentIntentId: "pi-1",
        rentPaymentId: "rp-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        tenantId: "tenant-1",
        decisionType: "review_overdue_rent",
        severity: "critical",
        status: "detected",
        reason: "Rent obligation is overdue.",
        createdAt: "2026-04-15T00:00:00.000Z",
        updatedAt: "2026-04-15T00:00:00.000Z",
      }),
    ]);
    expect(decisions[0].metadata).toEqual(
      expect.objectContaining({
        source: "delinquency_signal",
        signalId: "delinquency:overdue:pi-1",
        obligationRowId: "obligation:pi-1",
        outstandingAmountCents: 180000,
      })
    );
  });

  it("maps underpaid delinquency signal to a warning decision", () => {
    const decisions = deriveDecisions({
      delinquencySignals: [
        signal({
          signalId: "delinquency:partially_paid:pi-1",
          signalType: "partially_paid",
          severity: "warning",
          paidAmountCents: 100000,
          outstandingAmountCents: 80000,
          reasons: ["obligation_partially_paid"],
        }),
      ],
      obligationRows: [row({ obligationStatus: "underpaid", paidAmountCents: 100000 })],
      today: "2026-04-15T00:00:00.000Z",
    });

    expect(decisions[0]).toEqual(
      expect.objectContaining({
        decisionId: "decision:review_underpaid_rent:delinquency:partially_paid:pi-1",
        decisionType: "review_underpaid_rent",
        severity: "warning",
        reason: "Rent obligation is partially paid.",
      })
    );
  });

  it("maps missing payment signal to a critical decision", () => {
    const decisions = deriveDecisions({
      delinquencySignals: [
        signal({
          signalId: "delinquency:missing_payment:lease-1",
          paymentIntentId: null,
          rentPaymentId: null,
          signalType: "missing_payment",
          severity: "warning",
          reasons: ["missing_rent_payment_after_due_date"],
        }),
      ],
      obligationRows: [row({ paymentIntentId: null, rentPaymentId: null, obligationStatus: "missing" })],
      today: "2026-04-15T00:00:00.000Z",
    });

    expect(decisions[0]).toEqual(
      expect.objectContaining({
        decisionId: "decision:review_missing_payment:delinquency:missing_payment:lease-1",
        decisionType: "review_missing_payment",
        severity: "critical",
        reason: "Expected rent payment is missing.",
      })
    );
  });

  it("maps failed payment signal to a critical decision", () => {
    const decisions = deriveDecisions({
      delinquencySignals: [
        signal({
          signalId: "delinquency:failed_payment:rp-1",
          signalType: "failed_payment",
          reasons: ["obligation_payment_failed"],
        }),
      ],
      obligationRows: [row({ obligationStatus: "failed", rentPaymentStatus: "failed", evidenceStatus: "failed" })],
      today: "2026-04-15T00:00:00.000Z",
    });

    expect(decisions[0]).toEqual(
      expect.objectContaining({
        decisionType: "review_failed_payment",
        severity: "critical",
        reason: "Rent payment did not complete.",
      })
    );
  });

  it("maps manual payment review signal to a warning decision", () => {
    const decisions = deriveDecisions({
      delinquencySignals: [
        signal({
          signalId: "delinquency:manual_review_required:pi-1",
          signalType: "manual_review_required",
          severity: "warning",
          paidAmountCents: 180000,
          outstandingAmountCents: 0,
          reasons: ["obligation_requires_manual_review"],
        }),
      ],
      obligationRows: [row({ obligationStatus: "manual_review_required", paidAmountCents: 180000 })],
      today: "2026-04-15T00:00:00.000Z",
    });

    expect(decisions[0]).toEqual(
      expect.objectContaining({
        decisionType: "review_manual_payment_issue",
        severity: "warning",
        reason: "Payment evidence requires manual review.",
      })
    );
  });

  it("does not create decisions for informational rent_due signals", () => {
    const decisions = deriveDecisions({
      delinquencySignals: [
        signal({
          signalId: "delinquency:rent_due:pi-1",
          signalType: "rent_due",
          severity: "info",
          reasons: ["obligation_expected_not_past_due"],
        }),
      ],
      obligationRows: [row({ obligationStatus: "expected" })],
      today: "2026-04-09T00:00:00.000Z",
    });

    expect(decisions).toEqual([]);
  });

  it("derives expiring lease decision from notice-period lifecycle nearing end", () => {
    const decisions = deriveDecisions({
      leaseLifecycle: lifecycle(),
      today: "2026-04-15T00:00:00.000Z",
      expiringSoonThresholdDays: 30,
    });

    expect(decisions).toEqual([
      expect.objectContaining({
        decisionId: "decision:review_expiring_lease:lease-1:2026-05-01",
        decisionType: "review_expiring_lease",
        severity: "warning",
        status: "detected",
        reason: "Lease is in notice period and nearing the end of term.",
      }),
    ]);
    expect(decisions[0].metadata).toEqual(
      expect.objectContaining({
        source: "lease_lifecycle",
        lifecycleState: "notice_period",
        daysUntilEnd: 16,
        thresholdDays: 30,
      })
    );
  });

  it("derives occupancy conflict decision from lifecycle occupancy reasons", () => {
    const decisions = deriveDecisions({
      leaseLifecycle: lifecycle({
        state: "unknown",
        reasons: ["expired_occupancy_conflict"],
        requiresReview: true,
      }),
      today: "2026-04-15T00:00:00.000Z",
    });

    expect(decisions[0]).toEqual(
      expect.objectContaining({
        decisionType: "review_occupancy_conflict",
        severity: "critical",
        reason: "Lease lifecycle indicates an occupancy conflict that needs review.",
      })
    );
  });

  it("does not mutate source signals, lifecycle, or obligation rows", () => {
    const sourceSignal = signal();
    const sourceRow = row();
    const sourceLifecycle = lifecycle();
    const before = JSON.stringify({ sourceSignal, sourceRow, sourceLifecycle });

    deriveDecisions({
      delinquencySignals: [sourceSignal],
      obligationRows: [sourceRow],
      leaseLifecycle: sourceLifecycle,
      today: "2026-04-15T00:00:00.000Z",
    });

    expect(JSON.stringify({ sourceSignal, sourceRow, sourceLifecycle })).toBe(before);
  });
});
