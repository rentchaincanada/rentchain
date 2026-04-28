import { describe, expect, it } from "vitest";
import {
  derivePaymentExperience,
  isRentPaymentRetryAvailable,
  type RentPaymentRecord,
} from "../rentPaymentService";

function buildPayment(overrides: Partial<RentPaymentRecord>): RentPaymentRecord {
  return {
    id: "rp-1",
    leaseId: "lease-1",
    tenantId: "tenant-1",
    landlordId: "landlord-1",
    amountCents: 180000,
    currency: "cad",
    status: "checkout_created",
    processor: "stripe",
    processorCheckoutSessionId: "cs_1",
    processorPaymentIntentId: "pi_1",
    createdAt: "2026-04-27T10:00:00.000Z",
    updatedAt: "2026-04-27T10:00:00.000Z",
    paidAt: null,
    ...overrides,
  };
}

describe("rentPaymentService payment experience", () => {
  it("derives history, pending latest status, and blocked retry correctly", () => {
    const history = [
      buildPayment({
        id: "rp-2",
        status: "payment_pending",
        createdAt: "2026-04-28T10:00:00.000Z",
        updatedAt: "2026-04-28T10:05:00.000Z",
      }),
      buildPayment({
        id: "rp-1",
        status: "failed",
        updatedAt: "2026-04-27T10:10:00.000Z",
      }),
    ];

    const result = derivePaymentExperience(history, "lease-1");

    expect(result.history.map((item) => item.id)).toEqual(["rp-2", "rp-1"]);
    expect(result.latestStatus).toBe("pending");
    expect(result.retryAvailable).toBe(false);
    expect(result.receiptSummary.available).toBe(false);
  });

  it("allows retry only for failed, canceled, and expired", () => {
    expect(isRentPaymentRetryAvailable("failed")).toBe(true);
    expect(isRentPaymentRetryAvailable("canceled")).toBe(true);
    expect(isRentPaymentRetryAvailable("expired")).toBe(true);
    expect(isRentPaymentRetryAvailable("checkout_created")).toBe(false);
    expect(isRentPaymentRetryAvailable("payment_pending")).toBe(false);
    expect(isRentPaymentRetryAvailable("paid")).toBe(false);
  });

  it("derives a print-safe receipt summary from the latest paid payment", () => {
    const history = [
      buildPayment({
        id: "rp-3",
        status: "failed",
        createdAt: "2026-04-29T10:00:00.000Z",
        updatedAt: "2026-04-29T10:01:00.000Z",
      }),
      buildPayment({
        id: "rp-2",
        status: "paid",
        createdAt: "2026-04-28T10:00:00.000Z",
        updatedAt: "2026-04-28T10:02:00.000Z",
        paidAt: "2026-04-28T10:02:00.000Z",
      }),
    ];

    const result = derivePaymentExperience(history, "lease-1");

    expect(result.latestStatus).toBe("failed");
    expect(result.retryAvailable).toBe(true);
    expect(result.receiptSummary).toEqual({
      available: true,
      label: "Payment summary available",
      amountCents: 180000,
      paidAt: "2026-04-28T10:02:00.000Z",
      leaseReference: "lease-1",
    });
  });
});
