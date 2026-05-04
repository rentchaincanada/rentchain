import { describe, expect, it } from "vitest";
import {
  buildPaymentReconciliationRecordId,
  upsertPaymentReconciliationRecord,
} from "../paymentReconciliationRecords";

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

const providerSignal = {
  provider: "stripe" as const,
  providerEventId: "evt_1",
  rawStatus: "paid",
  normalizedStatus: "confirmed" as const,
  purpose: "rent" as const,
};

describe("paymentReconciliationRecords", () => {
  it("builds deterministic record ids from idempotency keys", () => {
    expect(buildPaymentReconciliationRecordId("provider_event:stripe:evt_1")).toBe("provider_event:stripe:evt_1");
    expect(buildPaymentReconciliationRecordId("provider/event stripe evt 1")).toBe("provider_event_stripe_evt_1");
  });

  it("creates a reconciliation record with safe summary fields", async () => {
    const { firestore, store } = buildFirestore();
    const record = await upsertPaymentReconciliationRecord({
      firestore,
      idempotencyKey: "provider_event:stripe:evt_1",
      receiptId: "provider_event:stripe:evt_1",
      subjectType: "rent_payment",
      subjectId: "rp-1",
      purpose: "rent",
      providerSignal,
      reconciliation: {
        reconciliationStatus: "reconciled",
        reasons: ["provider_confirmed_amount_currency_match"],
        requiresManualReview: false,
        automationEligible: true,
      },
      now: "2026-05-03T12:00:00.000Z",
    });

    expect(record).toEqual({
      reconciliationId: "provider_event:stripe:evt_1",
      provider: "stripe",
      providerEventId: "evt_1",
      idempotencyKey: "provider_event:stripe:evt_1",
      receiptId: "provider_event:stripe:evt_1",
      subjectType: "rent_payment",
      subjectId: "rp-1",
      purpose: "rent",
      normalizedStatus: "confirmed",
      rawStatus: "paid",
      reconciliationStatus: "reconciled",
      reasons: ["provider_confirmed_amount_currency_match"],
      requiresManualReview: false,
      automationEligible: true,
      createdAt: "2026-05-03T12:00:00.000Z",
      updatedAt: "2026-05-03T12:00:00.000Z",
    });
  });

  it("upserts the same reconciliation record for duplicate provider events", async () => {
    const { firestore, store } = buildFirestore();
    await upsertPaymentReconciliationRecord({
      firestore,
      idempotencyKey: "provider_event:stripe:evt_1",
      receiptId: "provider_event:stripe:evt_1",
      providerSignal,
      reconciliation: {
        reconciliationStatus: "reconciled",
        reasons: ["provider_confirmed_amount_currency_match"],
        requiresManualReview: false,
        automationEligible: true,
      },
      now: "2026-05-03T12:00:00.000Z",
    });

    const updated = await upsertPaymentReconciliationRecord({
      firestore,
      idempotencyKey: "provider_event:stripe:evt_1",
      receiptId: "provider_event:stripe:evt_1",
      providerSignal,
      reconciliation: {
        reconciliationStatus: "duplicate_risk",
        reasons: ["duplicate_provider_event"],
        requiresManualReview: true,
        automationEligible: false,
      },
      now: "2026-05-03T12:01:00.000Z",
    });

    expect(updated).toMatchObject({
      reconciliationId: "provider_event:stripe:evt_1",
      reconciliationStatus: "duplicate_risk",
      reasons: ["duplicate_provider_event"],
      requiresManualReview: true,
      automationEligible: false,
      createdAt: "2026-05-03T12:00:00.000Z",
      updatedAt: "2026-05-03T12:01:00.000Z",
    });
    expect(store.get("paymentReconciliationRecords")?.size).toBe(1);
  });
});
