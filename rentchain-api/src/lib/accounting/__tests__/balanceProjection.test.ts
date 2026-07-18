import { describe, expect, it } from "vitest";
import { projectReceivableBalance } from "../balanceProjection";

const transaction = (overrides: Record<string, unknown> = {}) => ({
  transactionId: "tx-1",
  leaseId: "lease-1",
  propertyId: "property-1",
  type: "scheduled_rent_charge",
  amountCents: 100_000,
  currency: "cad",
  effectiveDate: "2026-01-01",
  dueDate: "2026-01-01",
  ...overrides,
});

describe("projectReceivableBalance", () => {
  it("projects charges, reductions, and directional adjustments deterministically", () => {
    const inputs = [
      transaction(),
      transaction({ transactionId: "credit-1", type: "credit", amountCents: 5_000 }),
      transaction({ transactionId: "payment-1", type: "payment_applied", amountCents: 30_000 }),
      transaction({ transactionId: "writeoff-1", type: "write_off", amountCents: 2_000 }),
      transaction({ transactionId: "increase-1", type: "adjustment", amountCents: 1_000, metadata: { adjustmentDirection: "increase" } }),
      transaction({ transactionId: "decrease-1", type: "adjustment", amountCents: 500, metadata: { adjustmentDirection: "decrease" } }),
    ];

    const first = projectReceivableBalance(inputs);
    const second = projectReceivableBalance([...inputs].reverse());

    expect(first).toEqual(second);
    expect(first.netBalanceCents).toBe(63_500);
    expect(first.outstandingCents).toBe(63_500);
    expect(first.overpaymentCents).toBe(0);
  });

  it("restores a payment only for a valid matching reversal", () => {
    const result = projectReceivableBalance([
      transaction(),
      transaction({ transactionId: "payment-1", type: "payment_applied", amountCents: 100_000 }),
      transaction({
        transactionId: "reversal-1",
        type: "payment_reversal",
        amountCents: 100_000,
        reversesTransactionId: "payment-1",
      }),
    ]);

    expect(result.netBalanceCents).toBe(100_000);
    expect(result.reversalCents).toBe(100_000);
    expect(result.findings).toEqual([]);
  });

  it("fails closed for mismatched and duplicate reversals", () => {
    const result = projectReceivableBalance([
      transaction(),
      transaction({ transactionId: "payment-1", type: "payment_applied", amountCents: 40_000 }),
      transaction({ transactionId: "bad", type: "payment_reversal", amountCents: 20_000, reversesTransactionId: "payment-1" }),
      transaction({ transactionId: "valid", type: "payment_reversal", amountCents: 40_000, reversesTransactionId: "payment-1" }),
      transaction({ transactionId: "duplicate", type: "payment_reversal", amountCents: 40_000, reversesTransactionId: "payment-1" }),
    ]);

    expect(result.netBalanceCents).toBe(100_000);
    expect(result.findings.map((finding) => finding.code)).toEqual([
      "duplicate_payment_reversal",
      "payment_reversal_mismatch",
    ]);
  });

  it("supports lease, property, and as-of scope without mutating inputs", () => {
    const inputs = [
      transaction(),
      transaction({ transactionId: "future", effectiveDate: "2026-02-01" }),
      transaction({ transactionId: "other", leaseId: "lease-2" }),
    ];
    const snapshot = structuredClone(inputs);
    const result = projectReceivableBalance(inputs, { leaseId: "lease-1", propertyId: "property-1", asOfDate: "2026-01-31" });

    expect(result.chargeCents).toBe(100_000);
    expect(inputs).toEqual(snapshot);
  });
});
