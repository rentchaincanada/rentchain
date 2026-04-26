import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { store, dbMock, ensureCollection } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function docRef(collectionName: string, docId: string) {
    return {
      id: docId,
      path: `${collectionName}/${docId}`,
      get: async () => ({
        exists: ensureCollection(collectionName).has(docId),
        data: () => ensureCollection(collectionName).get(docId),
      }),
      set: async (payload: Record<string, unknown>, options?: { merge?: boolean }) => {
        const col = ensureCollection(collectionName);
        const existing = col.get(docId) || {};
        col.set(docId, options?.merge ? { ...existing, ...payload } : payload);
      },
    };
  }

  const dbMock = {
    collection: vi.fn((name: string) => ({
      doc: (id?: string) => docRef(name, id || `auto_${++autoId}`),
      where: (field: string, op: string, value: any) => ({
        limit: (count: number) => ({
          get: async () => {
            const docs = Array.from(ensureCollection(name).entries())
              .filter(([, data]) => (op === "==" ? data?.[field] === value : true))
              .slice(0, count)
              .map(([id, data]) => ({
                id,
                ref: docRef(name, id),
                data: () => data,
              }));
            return { empty: docs.length === 0, docs };
          },
        }),
      }),
    })),
    runTransaction: async (fn: any) => {
      const tx = {
        get: async (ref: any) => ref.get(),
        set: (ref: any, payload: any, options?: { merge?: boolean }) => ref.set(payload, options),
      };
      return fn(tx);
    },
  };

  return { store, dbMock, ensureCollection };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

let webhookTesting: typeof import("../stripeScreeningOrdersWebhookRoutes").__testing;
let rentalTesting: typeof import("../rentalApplicationsRoutes").__testing;

beforeAll(
  async () => {
    const webhookModule = await import("../stripeScreeningOrdersWebhookRoutes");
    const rentalModule = await import("../rentalApplicationsRoutes");
    webhookTesting = webhookModule.__testing;
    rentalTesting = rentalModule.__testing;
  },
  20000
);

describe("screening payment webhook updates", () => {
  beforeEach(() => {
    store.clear();
  });

  it("marks screening paid once and is idempotent on repeat delivery", async () => {
    ensureCollection("rentalApplications").set("app_1", { screeningStatus: "unpaid" });

    const session = {
      id: "sess_1",
      payment_intent: "pi_1",
      metadata: { applicationId: "app_1" },
    } as any;

    const first = await webhookTesting.handleScreeningPaidFromSession({
      session,
      paidAt: 1700000000000,
      eventType: "checkout.session.completed",
      eventId: "evt_1",
    });

    expect(first.status).toBe("paid_set");
    expect(ensureCollection("rentalApplications").get("app_1")?.screeningStatus).toBe("processing");
    expect(typeof ensureCollection("rentalApplications").get("app_1")?.screeningStartedAt).toBe("number");
    expect(ensureCollection("rentalApplications").get("app_1")?.screeningSessionId).toBe("sess_1");

    const second = await webhookTesting.handleScreeningPaidFromSession({
      session,
      paidAt: 1700000000001,
      eventType: "checkout.session.completed",
      eventId: "evt_2",
    });

    expect(second.status).toBe("already_paid");
  });

  it("ignores checkout.session.completed when applicationId metadata is missing", async () => {
    const session = {
      id: "sess_missing",
      payment_intent: "pi_missing",
      metadata: {},
    } as any;

    const result = await webhookTesting.handleScreeningPaidFromSession({
      session,
      eventType: "checkout.session.completed",
      eventId: "evt_missing",
      paidAt: 1700000000000,
    });

    expect(result.status).toBe("ignored");
    expect(result.missingApplicationId).toBe(true);
  });

  it("marks screening payment failed once and records a failed ledger event", async () => {
    ensureCollection("screeningOrders").set("order_1", {
      id: "order_1",
      applicationId: "app_1",
      landlordId: "landlord_1",
      propertyId: "prop_1",
      unitId: "unit_1",
      status: "unpaid",
      paymentStatus: "unpaid",
      finalized: false,
      amountTotalCents: 4900,
      currency: "cad",
      stripePaymentIntentId: "pi_fail_1",
    });
    ensureCollection("rentalApplications").set("app_1", {
      id: "app_1",
      landlordId: "landlord_1",
      screening: {},
    });

    const first = await webhookTesting.handleScreeningPaymentFailure({
      eventId: "evt_fail_1",
      eventType: "payment_intent.payment_failed",
      paymentIntentId: "pi_fail_1",
      applicationId: "app_1",
      landlordId: "landlord_1",
      amountTotalCents: 4900,
      currency: "cad",
      failureCode: "card_declined",
      failureMessage: "Card declined",
      occurredAt: 1700000000000,
    });

    expect(first.ok).toBe(true);
    expect(first.alreadyProcessed).toBe(false);
    expect(ensureCollection("screeningOrders").get("order_1")?.status).toBe("failed");
    expect(ensureCollection("screeningOrders").get("order_1")?.paymentStatus).toBe("failed");
    expect(ensureCollection("rentalApplications").get("app_1")?.screening?.status).toBe("failed");
    expect(ensureCollection("financialTransactions").get("payment_failed_evt_fail_1")).toEqual(
      expect.objectContaining({
        type: "payment_failed",
        status: "failed",
        applicationId: "app_1",
      })
    );

    const second = await webhookTesting.handleScreeningPaymentFailure({
      eventId: "evt_fail_1",
      eventType: "payment_intent.payment_failed",
      paymentIntentId: "pi_fail_1",
      applicationId: "app_1",
      landlordId: "landlord_1",
      amountTotalCents: 4900,
      currency: "cad",
      failureCode: "card_declined",
      failureMessage: "Card declined",
      occurredAt: 1700000000001,
    });

    expect(second.ok).toBe(true);
    expect(second.alreadyProcessed).toBe(true);
  });
});

describe("screening checkout guard", () => {
  it("detects already-paid screenings", () => {
    expect(rentalTesting.isScreeningAlreadyPaid({ screeningStatus: "paid" })).toBe(true);
    expect(rentalTesting.isScreeningAlreadyPaid({ screeningStatus: "unpaid" })).toBe(false);
  });
});
