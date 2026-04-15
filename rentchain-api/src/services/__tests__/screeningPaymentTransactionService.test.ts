import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, getDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        doc: (id?: string) => {
          const docId = id || `auto_${++autoId}`;
          return {
            id: docId,
            set: async (payload: any) => {
              ensureCollection(name).set(docId, { id: docId, data: payload });
            },
            get: async () => {
              const row = ensureCollection(name).get(docId);
              return { id: docId, exists: Boolean(row), data: () => row?.data };
            },
          };
        },
        where: (field: string, op: string, value: any) => ({
          get: async () => {
            const rows = Array.from(ensureCollection(name).values()).filter((entry) =>
              op === "==" ? entry.data?.[field] === value : true
            );
            return {
              docs: rows.map((row) => ({ id: row.id, data: () => row.data })),
            };
          },
        }),
      }),
    },
    resetDb: () => {
      collections.clear();
      autoId = 0;
    },
    getDoc: (collectionName: string, id: string) => ensureCollection(collectionName).get(id)?.data || null,
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

describe("screeningPaymentTransactionService", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("records a deterministic initiated payment transaction for screening checkout", async () => {
    const { recordScreeningPaymentInitiated } = await import("../screeningPaymentTransactionService");
    await recordScreeningPaymentInitiated({
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      applicationId: "app-1",
      screeningOrderId: "order-1",
      amountCents: 4900,
      currency: "cad",
      stripeCheckoutSessionId: "sess_1",
      serviceLevel: "VERIFIED",
      recordedAt: 1000,
    });

    expect(getDoc("financialTransactions", "payment_initiated_order-1")).toEqual(
      expect.objectContaining({
        id: "payment_initiated_order-1",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        applicationId: "app-1",
        type: "payment_initiated",
        amountCents: 4900,
        currency: "CAD",
        status: "pending",
      })
    );
  });

  it("records deterministic success and failure transactions keyed by stripe event id", async () => {
    const { recordScreeningPaymentSucceeded, recordScreeningPaymentFailed } = await import(
      "../screeningPaymentTransactionService"
    );

    await recordScreeningPaymentSucceeded({
      landlordId: "landlord-1",
      applicationId: "app-1",
      screeningOrderId: "order-1",
      amountCents: 4900,
      currency: "cad",
      stripeEventId: "evt_success",
      eventType: "checkout.session.completed",
    });
    await recordScreeningPaymentFailed({
      landlordId: "landlord-1",
      applicationId: "app-1",
      screeningOrderId: "order-1",
      amountCents: 4900,
      currency: "cad",
      stripeEventId: "evt_failed",
      eventType: "payment_intent.payment_failed",
      failureCode: "card_declined",
      failureMessage: "Card was declined",
    });

    expect(getDoc("financialTransactions", "payment_succeeded_evt_success")).toEqual(
      expect.objectContaining({
        type: "payment_succeeded",
        status: "completed",
        applicationId: "app-1",
      })
    );
    expect(getDoc("financialTransactions", "payment_failed_evt_failed")).toEqual(
      expect.objectContaining({
        type: "payment_failed",
        status: "failed",
        applicationId: "app-1",
        metadata: expect.objectContaining({
          failureCode: "card_declined",
        }),
      })
    );
  });
});
