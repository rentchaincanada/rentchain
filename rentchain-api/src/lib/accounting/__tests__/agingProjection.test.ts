import { describe, expect, it } from "vitest";
import { projectReceivableAging } from "../agingProjection";

const transaction = (overrides: Record<string, unknown> = {}) => ({
  transactionId: "charge-1",
  leaseId: "lease-1",
  propertyId: "property-1",
  type: "scheduled_rent_charge",
  amountCents: 100_000,
  currency: "cad",
  effectiveDate: "2026-01-01",
  dueDate: "2026-01-01",
  ...overrides,
});

describe("projectReceivableAging", () => {
  it("places outstanding charges into exact date-only aging buckets", () => {
    const result = projectReceivableAging({
      asOfDate: "2026-04-02",
      transactions: [
        transaction({ transactionId: "current", dueDate: "2026-04-02", amountCents: 100 }),
        transaction({ transactionId: "d30", dueDate: "2026-03-03", amountCents: 200 }),
        transaction({ transactionId: "d60", dueDate: "2026-02-01", amountCents: 300 }),
        transaction({ transactionId: "d90", dueDate: "2026-01-02", amountCents: 400 }),
        transaction({ transactionId: "d91", dueDate: "2026-01-01", amountCents: 500 }),
      ],
    });

    expect(result.currentCents).toBe(100);
    expect(result.days1To30Cents).toBe(200);
    expect(result.days31To60Cents).toBe(300);
    expect(result.days61To90Cents).toBe(400);
    expect(result.days90PlusCents).toBe(500);
  });

  it("requires allocation lineage under the explicit policy", () => {
    const result = projectReceivableAging({
      asOfDate: "2026-02-01",
      transactions: [transaction(), transaction({ transactionId: "payment-1", type: "payment_applied", amountCents: 25_000 })],
    });

    expect(result.totalOutstandingCents).toBe(100_000);
    expect(result.findings.map((finding) => finding.code)).toContain("allocation_required");
  });

  it("supports deterministic oldest-due-first allocation", () => {
    const inputs = [
      transaction({ transactionId: "jan", amountCents: 60_000 }),
      transaction({ transactionId: "feb", amountCents: 60_000, effectiveDate: "2026-02-01", dueDate: "2026-02-01" }),
      transaction({ transactionId: "payment", type: "payment_applied", amountCents: 70_000, effectiveDate: "2026-02-02", dueDate: null }),
    ];
    const result = projectReceivableAging({ transactions: inputs, asOfDate: "2026-02-15", allocationPolicy: "oldest_due_first" });

    expect(result.chargeRows).toEqual([
      expect.objectContaining({ transactionId: "feb", outstandingCents: 50_000 }),
    ]);
  });

  it("does not cancel a payment when its reversal is invalid", () => {
    const result = projectReceivableAging({
      asOfDate: "2026-02-01",
      transactions: [
        transaction(),
        transaction({ transactionId: "payment", type: "payment_applied", amountCents: 40_000, appliesToTransactionId: "charge-1" }),
        transaction({ transactionId: "bad-reversal", type: "payment_reversal", amountCents: 20_000, reversesTransactionId: "payment" }),
      ],
    });

    expect(result.totalOutstandingCents).toBe(60_000);
    expect(result.findings.map((finding) => finding.code)).toContain("payment_reversal_mismatch");
  });

  it("preserves the original balance for a valid payment reversal", () => {
    const result = projectReceivableAging({
      asOfDate: "2026-02-01",
      transactions: [
        transaction(),
        transaction({ transactionId: "payment", type: "payment_applied", amountCents: 40_000, appliesToTransactionId: "charge-1" }),
        transaction({ transactionId: "reversal", type: "payment_reversal", amountCents: 40_000, reversesTransactionId: "payment" }),
      ],
    });

    expect(result.totalOutstandingCents).toBe(100_000);
    expect(result.findings).toEqual([]);
  });
});
