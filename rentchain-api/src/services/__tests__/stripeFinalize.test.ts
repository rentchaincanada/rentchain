import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, upsertDoc, getDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function docRef(collectionName: string, docId: string) {
    const col = ensureCollection(collectionName);
    return {
      id: docId,
      path: `${collectionName}/${docId}`,
      get: async () => {
        const entry = col.get(docId);
        return {
          id: docId,
          exists: Boolean(entry),
          data: () => entry?.data,
        };
      },
      set: async (payload: any, options?: { merge?: boolean }) => {
        if (options?.merge && col.has(docId)) {
          const existing = col.get(docId)!;
          col.set(docId, { id: docId, data: { ...(existing.data || {}), ...(payload || {}) } });
          return;
        }
        col.set(docId, { id: docId, data: payload });
      },
    };
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        doc: (id: string) => docRef(name, id),
        where: (field: string, op: string, value: any) => ({
          limit: (count: number) => ({
            get: async () => {
              const docs = Array.from(ensureCollection(name).values())
                .filter((entry) => op === "==" && entry.data?.[field] === value)
                .slice(0, count)
                .map((entry) => ({
                  id: entry.id,
                  data: () => entry.data,
                  ref: docRef(name, entry.id),
                }));
              return { empty: docs.length === 0, docs };
            },
          }),
        }),
      }),
      runTransaction: async (fn: any) => {
        const tx = {
          get: async (ref: any) => ref.get(),
          set: (ref: any, payload: any, options?: { merge?: boolean }) => ref.set(payload, options),
        };
        return fn(tx);
      },
    },
    resetDb: () => {
      collections.clear();
    },
    upsertDoc: (collectionName: string, id: string, data: any) => {
      ensureCollection(collectionName).set(id, { id, data });
    },
    getDoc: (collectionName: string, id: string) => ensureCollection(collectionName).get(id)?.data || null,
  };
});

const enqueueScreeningJobMock = vi.fn(async () => undefined);

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../screeningJobs", () => ({
  enqueueScreeningJob: enqueueScreeningJobMock,
}));

describe("finalizeStripePayment", () => {
  beforeEach(() => {
    resetDb();
    enqueueScreeningJobMock.mockClear();
  });

  it("writes canonical paid fields used by screening status surfaces", async () => {
    upsertDoc("screeningOrders", "order_1", {
      id: "order_1",
      applicationId: "app_1",
      landlordId: "landlord_1",
      status: "unpaid",
      paymentStatus: "unpaid",
      finalized: false,
      amountTotalCents: 4900,
      currency: "cad",
    });
    upsertDoc("rentalApplications", "app_1", {
      id: "app_1",
      landlordId: "landlord_1",
      screening: {},
    });

    const { finalizeStripePayment } = await import("../stripeFinalize");
    const result = await finalizeStripePayment({
      eventId: "evt_1",
      eventType: "checkout.session.completed",
      orderId: "order_1",
      sessionId: "sess_1",
      paymentIntentId: "pi_1",
      stripeChargeId: "ch_1",
      amountTotalCents: 4900,
      currency: "cad",
      applicationId: "app_1",
      landlordId: "landlord_1",
    });

    expect(result.ok).toBe(true);
    const order = getDoc("screeningOrders", "order_1");
    expect(order?.status).toBe("paid");
    expect(order?.paymentStatus).toBe("paid");
    expect(order?.stripeSessionId).toBe("sess_1");
    expect(order?.stripeCheckoutSessionId).toBe("sess_1");
    expect(order?.stripePaymentIntentId).toBe("pi_1");
    expect(order?.stripeChargeId).toBe("ch_1");
    expect(typeof order?.paidAt).toBe("number");

    const app = getDoc("rentalApplications", "app_1");
    expect(app?.screening?.status).toBe("paid");
    expect(app?.screening?.orderId).toBe("order_1");
    expect(enqueueScreeningJobMock).toHaveBeenCalledTimes(1);
  });

  it("treats canonical status=paid as already finalized even if paymentStatus mirror is stale", async () => {
    upsertDoc("screeningOrders", "order_2", {
      id: "order_2",
      applicationId: "app_2",
      landlordId: "landlord_1",
      status: "paid",
      paymentStatus: "unpaid",
      finalized: false,
    });

    const { finalizeStripePayment } = await import("../stripeFinalize");
    const result = await finalizeStripePayment({
      eventId: "evt_2",
      eventType: "checkout.session.completed",
      orderId: "order_2",
      sessionId: "sess_2",
      paymentIntentId: "pi_2",
      stripeChargeId: "ch_2",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.alreadyFinalized).toBe(true);
    }
    const order = getDoc("screeningOrders", "order_2");
    expect(order?.status).toBe("paid");
    expect(order?.stripeCheckoutSessionId).toBe("sess_2");
    expect(order?.stripePaymentIntentId).toBe("pi_2");
  });
});
