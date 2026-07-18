import { describe, expect, it } from "vitest";
import { RECEIVABLE_TRANSACTION_TYPES, normalizeReceivableTransaction } from "../receivablesTypes";

const base = {
  transactionId: "txn-1",
  leaseId: "lease-1",
  propertyId: "property-1",
  unitId: "unit-1",
  responsibilityId: "responsibility-1",
  tenantId: "tenant-1",
  amountCents: 10000,
  currency: "cad",
  effectiveDate: "2026-01-01",
  dueDate: "2026-01-01",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  sourceRef: null,
  sourceVersion: "lease-v1",
  reversesTransactionId: null,
  appliesToTransactionId: null,
  metadata: {},
};

describe("receivablesTypes", () => {
  it.each(RECEIVABLE_TRANSACTION_TYPES)("normalizes modeled type %s", (type) => {
    const input = {
      ...base,
      type,
      ...(type === "adjustment" ? { metadata: { adjustmentDirection: "increase" } } : {}),
      ...(type === "payment_reversal" ? { reversesTransactionId: "payment-1" } : {}),
    };
    const result = normalizeReceivableTransaction(input);
    expect(result.transaction).toEqual(expect.objectContaining({ type, amountCents: 10000, currency: "cad" }));
    if (type === "nsf_fee") {
      expect(result.findings).toContainEqual(expect.objectContaining({ code: "nsf_fee_policy_not_enabled", severity: "review" }));
    }
  });

  it("rejects ambiguous amounts, invalid dates, unsupported currency, and missing scope", () => {
    const result = normalizeReceivableTransaction({
      type: "scheduled_rent_charge",
      amountCents: 10.5,
      currency: "usd",
      effectiveDate: "2026-02-30",
    });
    expect(result.transaction).toBeNull();
    expect(result.findings.map((finding) => finding.code)).toEqual(
      expect.arrayContaining(["required_field_missing", "invalid_amount_cents", "unsupported_currency", "invalid_date_only"])
    );
  });

  it("requires adjustment direction and reversal lineage", () => {
    expect(normalizeReceivableTransaction({ ...base, type: "adjustment" }).transaction).toBeNull();
    expect(normalizeReceivableTransaction({ ...base, type: "payment_reversal" }).transaction).toBeNull();
  });

  it("does not mutate input data", () => {
    const input = Object.freeze({ ...base, type: "credit", metadata: Object.freeze({}) });
    const snapshot = JSON.stringify(input);
    normalizeReceivableTransaction(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
