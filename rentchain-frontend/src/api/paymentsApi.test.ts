import { describe, expect, it } from "vitest";
import { getCanonicalPaymentEditId, isEditablePaymentRecord, type PaymentRecord } from "./paymentsApi";

const payment = (patch: Partial<PaymentRecord>): PaymentRecord => ({
  id: "payment-doc-1",
  amount: 1800,
  status: "Recorded",
  ...patch,
});

describe("paymentsApi edit eligibility", () => {
  it("allows rows only when the API provides a canonical payment document id", () => {
    expect(getCanonicalPaymentEditId(payment({ paymentDocumentId: "payment-doc-2" }))).toBe("payment-doc-2");
    expect(getCanonicalPaymentEditId(payment({ canonicalPaymentId: "payment-doc-3" }))).toBe("payment-doc-3");
    expect(getCanonicalPaymentEditId(payment({ source: "payments", paymentDocumentId: "payment-doc-4" }))).toBe(
      "payment-doc-4"
    );
  });

  it("blocks non-canonical payment sources and checkout rows", () => {
    expect(isEditablePaymentRecord(payment({ source: "rentPayments", paymentDocumentId: "payment-doc-2" }))).toBe(false);
    expect(isEditablePaymentRecord(payment({ source: "rent_payment", paymentDocumentId: "payment-doc-2" }))).toBe(false);
    expect(isEditablePaymentRecord(payment({ source: "payments", status: "checkout_created" }))).toBe(false);
    expect(isEditablePaymentRecord(payment({ source: "payments", status: "provider_checkout" }))).toBe(false);
    expect(
      isEditablePaymentRecord(payment({ source: "payments", paymentDocumentId: "payment-doc-2", status: "voided" }))
    ).toBe(false);
    expect(
      isEditablePaymentRecord(
        payment({ source: "payments", paymentDocumentId: "payment-doc-2", status: "system_generated" })
      )
    ).toBe(false);
  });

  it("allows ledger rows only when they carry an explicit canonical payment reference", () => {
    expect(getCanonicalPaymentEditId(payment({ source: "ledgerEntries" }))).toBe("");
    expect(getCanonicalPaymentEditId(payment({ source: "ledgerEntries", paymentDocumentId: "payment-doc-2" }))).toBe(
      "payment-doc-2"
    );
  });

  it("does not allow an id-only row without canonical provenance", () => {
    expect(getCanonicalPaymentEditId(payment({}))).toBe("");
    expect(getCanonicalPaymentEditId(payment({ source: "payments" }))).toBe("");
    expect(getCanonicalPaymentEditId(payment({ source: "payment" }))).toBe("");
    expect(getCanonicalPaymentEditId(payment({ source: "legacyPayments" }))).toBe("");
  });
});
