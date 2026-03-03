import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, upsertDoc, retrieveSessionMock, retrievePaymentIntentMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function toDocRef(collectionName: string, docId: string) {
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

  const dbMock = {
    collection: (name: string) => ({
      doc: (id?: string) => toDocRef(name, id || `auto_${++autoId}`),
      where: (field: string, op: string, value: any) => ({
        limit: (count: number) => ({
          get: async () => {
            const col = ensureCollection(name);
            const docs = Array.from(col.values())
              .filter((entry) => op === "==" && entry.data?.[field] === value)
              .slice(0, count)
              .map((entry) => ({
                id: entry.id,
                data: () => entry.data,
                ref: toDocRef(name, entry.id),
              }));
            return {
              empty: docs.length === 0,
              docs,
            };
          },
        }),
      }),
    }),
  };

  const retrieveSessionMock = vi.fn(async () => ({
    id: "sess_test",
    payment_status: "paid",
    payment_intent: { id: "pi_test", status: "succeeded", latest_charge: "ch_test" },
  }));
  const retrievePaymentIntentMock = vi.fn(async () => ({
    id: "pi_test",
    status: "succeeded",
    latest_charge: "ch_test",
  }));

  return {
    dbMock,
    retrieveSessionMock,
    retrievePaymentIntentMock,
    resetDb: () => {
      collections.clear();
      autoId = 0;
      retrieveSessionMock.mockClear();
      retrievePaymentIntentMock.mockClear();
    },
    upsertDoc: (collectionName: string, id: string, data: any) => {
      ensureCollection(collectionName).set(id, { id, data });
    },
  };
});

vi.mock("../../config/firebase", () => ({ db: dbMock }));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    const token = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "").trim().toLowerCase();
    if (token === "admin") {
      req.user = { id: "admin-1", landlordId: "admin-1", role: "admin" };
      return next();
    }
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    return next();
  },
}));

vi.mock("../../middleware/attachAccount", () => ({
  attachAccount: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/rateLimit", () => ({
  rateLimitScreeningIp: (_req: any, _res: any, next: any) => next(),
  rateLimitScreeningUser: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../services/stripeService", () => ({
  isStripeConfigured: () => true,
  getStripeClient: () => ({
    checkout: { sessions: { retrieve: retrieveSessionMock } },
    paymentIntents: { retrieve: retrievePaymentIntentMock },
  }),
}));

vi.mock("../../services/screening/screeningEvents", () => ({
  writeScreeningEvent: vi.fn(async () => undefined),
}));

vi.mock("../../services/screening/runPrimaryWithFallback", () => ({
  runPrimaryWithFallback: vi.fn(async () => ({ ok: true })),
}));

async function createApp() {
  const router = (await import("../rentalApplicationsRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("screening order status + reconcile", () => {
  beforeEach(() => {
    resetDb();
  });

  it("returns unpaid when no order exists for a valid application", async () => {
    upsertDoc("rentalApplications", "app_no_order", {
      id: "app_no_order",
      landlordId: "landlord-1",
      status: "SUBMITTED",
    });
    const app = await createApp();
    const res = await request(app)
      .get("/api/screening/orders/status")
      .query({ applicationId: "app_no_order" })
      .set("Authorization", "Bearer landlord");

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.data?.status).toBe("unpaid");
    expect(res.body?.data?.orderId).toBeNull();
  }, 20000);

  it("reconciles unpaid order to paid using Stripe session state", async () => {
    upsertDoc("rentalApplications", "app_paid", {
      id: "app_paid",
      landlordId: "landlord-1",
      status: "SUBMITTED",
      screeningStatus: "unpaid",
    });
    upsertDoc("screeningOrders", "order_paid", {
      id: "order_paid",
      applicationId: "app_paid",
      landlordId: "landlord-1",
      status: "unpaid",
      paymentStatus: "unpaid",
      stripeSessionId: "sess_test",
      amountTotalCents: 4900,
      currency: "cad",
    });
    const app = await createApp();

    const reconcile = await request(app)
      .post("/api/screening/orders/reconcile")
      .set("Authorization", "Bearer landlord")
      .send({ applicationId: "app_paid" });

    expect(reconcile.status).toBe(200);
    expect(reconcile.body?.ok).toBe(true);
    expect(reconcile.body?.data?.status).toBe("paid");
    expect(reconcile.body?.data?.stripeCheckoutSessionId).toBe("sess_test");
    expect(reconcile.body?.data?.stripePaymentIntentId).toBe("pi_test");

    const status = await request(app)
      .get("/api/screening/orders/status")
      .query({ applicationId: "app_paid" })
      .set("Authorization", "Bearer landlord");
    expect(status.status).toBe(200);
    expect(status.body?.data?.status).toBe("paid");
  }, 20000);

  it("status endpoint treats canonical status as source of truth over paymentStatus mirror", async () => {
    upsertDoc("screeningOrders", "order_status_canonical", {
      id: "order_status_canonical",
      applicationId: "app_status_canonical",
      landlordId: "landlord-1",
      status: "paid",
      paymentStatus: "unpaid",
      amountTotalCents: 4900,
      currency: "cad",
    });
    const app = await createApp();

    const res = await request(app)
      .get("/api/screening/orders/status")
      .query({ applicationId: "app_status_canonical" })
      .set("Authorization", "Bearer landlord");

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.data?.status).toBe("paid");
  });

  it("throttles reconcile calls within 20s and avoids duplicate Stripe fetches", async () => {
    upsertDoc("screeningOrders", "order_throttle", {
      id: "order_throttle",
      applicationId: "app_throttle",
      landlordId: "landlord-1",
      status: "unpaid",
      paymentStatus: "unpaid",
      stripeSessionId: "sess_test",
      amountTotalCents: 4900,
      currency: "cad",
      lastReconcileAt: Date.now() - 5000,
    });
    const app = await createApp();

    const first = await request(app)
      .post("/api/screening/orders/reconcile")
      .set("Authorization", "Bearer landlord")
      .send({ applicationId: "app_throttle" });
    expect(first.status).toBe(200);
    expect(first.body?.ok).toBe(true);
    expect(first.body?.data?.status).toBe("unpaid");
    expect(retrieveSessionMock).toHaveBeenCalledTimes(0);
  });
});
