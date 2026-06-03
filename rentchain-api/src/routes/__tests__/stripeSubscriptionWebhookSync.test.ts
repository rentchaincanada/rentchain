import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, ensureCollection, constructEventMock, docRef } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();

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

  return {
    store,
    ensureCollection,
    constructEventMock: vi.fn(),
    docRef,
  };
});

vi.mock("../../firebase", () => ({
  db: {
    collection: vi.fn((name: string) => ({
      doc: (id: string) => docRef(name, id),
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
  },
}));

vi.mock("../../config/screeningConfig", () => ({
  STRIPE_WEBHOOK_SECRET: "whsec_test",
}));

vi.mock("../../services/stripeService", () => ({
  getStripeClient: () => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
    checkout: {
      sessions: {
        list: vi.fn(async () => ({ data: [] })),
      },
    },
  }),
}));

vi.mock("../../lib/stripeNotConfigured", () => ({
  stripeNotConfiguredResponse: () => ({ ok: false, error: "stripe_not_configured" }),
  isStripeNotConfiguredError: () => false,
}));

vi.mock("../../services/screening/screeningOrchestrator", () => ({
  beginScreening: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/stripeFinalize", () => ({
  finalizeStripePayment: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/stripeScreeningProcessor", () => ({
  applyScreeningResultsFromOrder: vi.fn(async () => ({ ok: true })),
}));

vi.mock("../../services/screeningPaymentTransactionService", () => ({
  recordScreeningPaymentFailed: vi.fn(async () => undefined),
}));

async function invokeWebhook(body: string) {
  const { stripeWebhookHandler } = await import("../stripeScreeningOrdersWebhookRoutes");
  return await new Promise<{ status: number; body: any; text?: string }>((resolve, reject) => {
    const req: any = {
      body: Buffer.from(body),
      headers: {
        "stripe-signature": "t=1,v1=test",
      },
    };
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: null, text: String(payload || "") });
        return this;
      },
    };
    stripeWebhookHandler(req, res).catch(reject);
  });
}

describe("stripe subscription webhook sync", () => {
  beforeEach(() => {
    store.clear();
    constructEventMock.mockReset();
    ensureCollection("landlords").set("landlord_1", {
      plan: "free",
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      subscriptionInterval: null,
      currentPeriodEnd: null,
    });
  });

  it("syncs landlord subscription state from customer.subscription.updated", async () => {
    constructEventMock.mockReturnValueOnce({
      id: "evt_sub_1",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          customer: "cus_123",
          status: "active",
          current_period_end: 1_735_689_600,
          metadata: {
            landlordId: "landlord_1",
            tier: "pro",
            interval: "yearly",
          },
          items: {
            data: [
              {
                price: {
                  id: "price_any",
                  recurring: { interval: "year" },
                },
              },
            ],
          },
        },
      },
    });

    const res = await invokeWebhook('{"id":"evt_sub_1","type":"customer.subscription.updated"}');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(ensureCollection("landlords").get("landlord_1")).toEqual(
      expect.objectContaining({
        plan: "pro",
        stripeCustomerId: "cus_123",
        stripeSubscriptionId: "sub_123",
        subscriptionStatus: "active",
        subscriptionInterval: "yearly",
        currentPeriodEnd: 1_735_689_600_000,
        subscriptionUpdatedAt: expect.any(Number),
      })
    );
  });

  it("keeps repeated subscription deliveries idempotent", async () => {
    const event = {
      id: "evt_sub_repeat",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_repeat",
          customer: "cus_repeat",
          status: "active",
          current_period_end: 1_735_700_000,
          metadata: {
            landlordId: "landlord_1",
            tier: "starter",
            interval: "monthly",
          },
          items: {
            data: [
              {
                price: {
                  id: "price_any",
                  recurring: { interval: "month" },
                },
              },
            ],
          },
        },
      },
    };
    constructEventMock.mockReturnValue(event);

    const first = await invokeWebhook('{"id":"evt_sub_repeat","type":"customer.subscription.updated"}');
    const firstSnapshot = ensureCollection("landlords").get("landlord_1");

    const second = await invokeWebhook('{"id":"evt_sub_repeat","type":"customer.subscription.updated"}');
    const secondSnapshot = ensureCollection("landlords").get("landlord_1");

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondSnapshot).toEqual(
      expect.objectContaining({
        plan: "starter",
        stripeCustomerId: "cus_repeat",
        stripeSubscriptionId: "sub_repeat",
        subscriptionStatus: "active",
        subscriptionInterval: "monthly",
        currentPeriodEnd: 1_735_700_000_000,
      })
    );
    expect(secondSnapshot.plan).toBe(firstSnapshot.plan);
    expect(secondSnapshot.stripeCustomerId).toBe(firstSnapshot.stripeCustomerId);
    expect(secondSnapshot.stripeSubscriptionId).toBe(firstSnapshot.stripeSubscriptionId);
    expect(secondSnapshot.subscriptionStatus).toBe(firstSnapshot.subscriptionStatus);
    expect(secondSnapshot.subscriptionInterval).toBe(firstSnapshot.subscriptionInterval);
    expect(secondSnapshot.currentPeriodEnd).toBe(firstSnapshot.currentPeriodEnd);
  });
});
