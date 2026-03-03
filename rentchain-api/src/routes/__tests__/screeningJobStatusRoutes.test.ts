import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, upsertDoc } = vi.hoisted(() => {
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

  return {
    dbMock,
    resetDb: () => {
      collections.clear();
      autoId = 0;
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
    if (token === "other") {
      req.user = { id: "landlord-2", landlordId: "landlord-2", role: "landlord" };
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
    checkout: { sessions: { create: vi.fn(), retrieve: vi.fn() } },
    paymentIntents: { retrieve: vi.fn() },
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

describe("screening job status route", () => {
  beforeEach(() => {
    resetDb();
  });

  it("returns 404 when no job exists", async () => {
    const app = await createApp();
    const res = await request(app)
      .get("/api/screening/jobs/status")
      .query({ orderId: "order_missing" })
      .set("Authorization", "Bearer landlord");

    expect(res.status).toBe(404);
    expect(res.body?.ok).toBe(false);
    expect(res.body?.error).toBe("not_found");
  });

  it("returns 403 when landlord does not own job", async () => {
    upsertDoc("screeningJobs", "order_1", {
      orderId: "order_1",
      applicationId: "app_1",
      landlordId: "landlord-1",
      status: "running",
      attempt: 1,
      queuedAt: Date.now() - 1000,
      updatedAt: Date.now(),
    });
    const app = await createApp();
    const res = await request(app)
      .get("/api/screening/jobs/status")
      .query({ orderId: "order_1" })
      .set("Authorization", "Bearer other");

    expect(res.status).toBe(403);
    expect(res.body?.error).toBe("forbidden");
  });

  it("returns normalized status payload for owner", async () => {
    const now = Date.now();
    upsertDoc("screeningJobs", "order_2", {
      orderId: "order_2",
      applicationId: "app_2",
      landlordId: "landlord-1",
      status: "provider_calling",
      provider: "transunion",
      attempt: 2,
      queuedAt: now - 5000,
      startedAt: now - 4000,
      providerCalledAt: now - 3000,
      updatedAt: now - 2000,
      lastError: null,
    });
    const app = await createApp();
    const res = await request(app)
      .get("/api/screening/jobs/status")
      .query({ applicationId: "app_2" })
      .set("Authorization", "Bearer landlord");

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.data?.orderId).toBe("order_2");
    expect(res.body?.data?.applicationId).toBe("app_2");
    expect(res.body?.data?.status).toBe("provider_calling");
    expect(res.body?.data?.provider).toBe("transunion");
    expect(res.body?.data?.attempt).toBe(2);
  });
});

