import { describe, expect, it } from "vitest";
import { getCanonicalPaymentEditId, isEditablePaymentRecord, type PaymentRecord } from "./paymentsApi";

const payment = (patch: Partial<PaymentRecord>): PaymentRecord => ({
  id: "payment-doc-1",
  amount: 1800,
  status: "Recorded",
  ...patch,
});

describe("paymentsApi edit eligibility", () => {
  it("allows canonical payments rows by canonical id or canonical source", () => {
    expect(getCanonicalPaymentEditId(payment({ paymentDocumentId: "payment-doc-2" }))).toBe("payment-doc-2");
    expect(getCanonicalPaymentEditId(payment({ source: "payments" }))).toBe("payment-doc-1");
    expect(getCanonicalPaymentEditId(payment({ source: "payment" }))).toBe("payment-doc-1");
    expect(getCanonicalPaymentEditId(payment({ source: "legacyPayments" }))).toBe("payment-doc-1");
  });

  it("blocks non-canonical payment sources and checkout rows", () => {
    expect(isEditablePaymentRecord(payment({ source: "rentPayments", paymentDocumentId: "payment-doc-2" }))).toBe(false);
    expect(isEditablePaymentRecord(payment({ source: "rent_payment", paymentDocumentId: "payment-doc-2" }))).toBe(false);
    expect(isEditablePaymentRecord(payment({ source: "ledgerEntries", paymentDocumentId: "payment-doc-2" }))).toBe(false);
    expect(isEditablePaymentRecord(payment({ source: "ledger_entry", paymentDocumentId: "payment-doc-2" }))).toBe(false);
    expect(isEditablePaymentRecord(payment({ source: "payments", status: "checkout_created" }))).toBe(false);
    expect(isEditablePaymentRecord(payment({ source: "payments", status: "provider_checkout" }))).toBe(false);
  });

  it("does not allow an id-only row without canonical provenance", () => {
    expect(getCanonicalPaymentEditId(payment({}))).toBe("");
  });
});
