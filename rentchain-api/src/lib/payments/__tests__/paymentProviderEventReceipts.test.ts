import { describe, expect, it } from "vitest";
import {
  buildProviderEventReceiptId,
  markProviderEventFailed,
  markProviderEventManualReviewRequired,
  markProviderEventProcessed,
  markProviderEventReceived,
  serializeProviderEventReceiptSummary,
} from "../paymentProviderEventReceipts";

function buildFirestore() {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  return {
    store,
    firestore: {
      collection: (name: string) => ({
        doc: (id: string) => ({
          get: async () => ({
            exists: ensureCollection(name).has(id),
            data: () => ensureCollection(name).get(id),
          }),
          set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
            const col = ensureCollection(name);
            const existing = col.get(id) || {};
            col.set(id, options?.merge ? { ...existing, ...payload } : payload);
          },
        }),
      }),
    },
  };
}

describe("paymentProviderEventReceipts", () => {
  it("builds deterministic receipt ids from idempotency keys", () => {
    expect(buildProviderEventReceiptId("provider_event:stripe:evt_123")).toBe("provider_event:stripe:evt_123");
    expect(buildProviderEventReceiptId("provider/event stripe evt 123")).toBe("provider_event_stripe_evt_123");
  });

  it("creates a first receipt with safe metadata summary", async () => {
    const { firestore } = buildFirestore();
    const result = await markProviderEventReceived({
      firestore,
      idempotencyKey: "provider_event:stripe:evt_1",
      provider: "stripe",
      providerEventId: "evt_1",
      purpose: "rent",
      subjectType: "rent_payment",
      subjectId: "rp-1",
      normalizedStatus: "confirmed",
      rawStatus: "paid",
      metadata: {
        rentPaymentId: "rp-1",
        leaseId: "lease-1",
      },
      now: "2026-05-03T12:00:00.000Z",
    });

    expect(result.isDuplicate).toBe(false);
    expect(result.receipt).toMatchObject({
      receiptId: "provider_event:stripe:evt_1",
      idempotencyKey: "provider_event:stripe:evt_1",
      provider: "stripe",
      providerEventId: "evt_1",
      purpose: "rent",
      subjectType: "rent_payment",
      subjectId: "rp-1",
      status: "received",
      firstReceivedAt: "2026-05-03T12:00:00.000Z",
      lastSeenAt: "2026-05-03T12:00:00.000Z",
      duplicateCount: 0,
      normalizedStatus: "confirmed",
      rawStatus: "paid",
      metadataSummary: {
        keys: ["leaseId", "rentPaymentId"],
      },
    });
  });

  it("marks duplicate receipt without suppressing caller behavior", async () => {
    const { firestore } = buildFirestore();
    await markProviderEventReceived({
      firestore,
      idempotencyKey: "provider_event:stripe:evt_1",
      provider: "stripe",
      providerEventId: "evt_1",
      purpose: "rent",
      now: "2026-05-03T12:00:00.000Z",
    });
    const duplicate = await markProviderEventReceived({
      firestore,
      idempotencyKey: "provider_event:stripe:evt_1",
      provider: "stripe",
      providerEventId: "evt_1",
      purpose: "rent",
      now: "2026-05-03T12:01:00.000Z",
    });

    expect(duplicate.isDuplicate).toBe(true);
    expect(duplicate.previousReceipt).toMatchObject({
      status: "received",
      duplicateCount: 0,
      lastSeenAt: "2026-05-03T12:00:00.000Z",
    });
    expect(duplicate.receipt).toMatchObject({
      status: "ignored_duplicate",
      duplicateCount: 1,
      firstReceivedAt: "2026-05-03T12:00:00.000Z",
      lastSeenAt: "2026-05-03T12:01:00.000Z",
    });
  });

  it("marks processed receipts", async () => {
    const { firestore } = buildFirestore();
    const received = await markProviderEventReceived({
      firestore,
      idempotencyKey: "provider_event:stripe:evt_1",
      provider: "stripe",
      providerEventId: "evt_1",
      now: "2026-05-03T12:00:00.000Z",
    });

    const processed = await markProviderEventProcessed({
      firestore,
      receiptId: received.receiptId,
      now: "2026-05-03T12:02:00.000Z",
    });

    expect(processed).toMatchObject({
      status: "processed",
      processedAt: "2026-05-03T12:02:00.000Z",
      failureReason: null,
    });
  });

  it("marks failed receipts", async () => {
    const { firestore } = buildFirestore();
    const received = await markProviderEventReceived({
      firestore,
      idempotencyKey: "provider_event:stripe:evt_1",
      provider: "stripe",
      providerEventId: "evt_1",
    });

    const failed = await markProviderEventFailed({
      firestore,
      receiptId: received.receiptId,
      failureReason: "rent_payment_update_failed",
      now: "2026-05-03T12:03:00.000Z",
    });

    expect(failed).toMatchObject({
      status: "failed",
      failedAt: "2026-05-03T12:03:00.000Z",
      failureReason: "rent_payment_update_failed",
    });
  });

  it("marks manual review receipts", async () => {
    const { firestore } = buildFirestore();
    const received = await markProviderEventReceived({
      firestore,
      idempotencyKey: "provider_event:stripe:evt_1",
      provider: "stripe",
      providerEventId: "evt_1",
    });

    const manualReview = await markProviderEventManualReviewRequired({
      firestore,
      receiptId: received.receiptId,
      failureReason: "amount_mismatch",
    });

    expect(manualReview).toMatchObject({
      status: "manual_review_required",
      failureReason: "amount_mismatch",
    });
  });

  it("serializes a safe receipt summary", async () => {
    const { firestore } = buildFirestore();
    const received = await markProviderEventReceived({
      firestore,
      idempotencyKey: "provider_event:stripe:evt_1",
      provider: "stripe",
      providerEventId: "evt_1",
      normalizedStatus: "confirmed",
      rawStatus: "paid",
    });

    expect(serializeProviderEventReceiptSummary(received.receipt)).toEqual({
      receiptId: "provider_event:stripe:evt_1",
      idempotencyKey: "provider_event:stripe:evt_1",
      provider: "stripe",
      providerEventId: "evt_1",
      purpose: null,
      subjectType: null,
      subjectId: null,
      status: "received",
      duplicateCount: 0,
      normalizedStatus: "confirmed",
      rawStatus: "paid",
    });
  });
});
