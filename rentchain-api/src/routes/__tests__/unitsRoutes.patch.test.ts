import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function applyMerge(existing: any, payload: any) {
    return { ...(existing || {}), ...(payload || {}) };
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const col = ensureCollection(name);
        const docId = id || "auto";
        return {
          id: docId,
          get: async () => {
            const existing = col.get(docId);
            return {
              id: docId,
              exists: Boolean(existing),
              data: () => existing?.data,
            };
          },
          set: async (payload: any, options?: { merge?: boolean }) => {
            if (options?.merge) {
              const existing = col.get(docId)?.data || {};
              col.set(docId, { id: docId, data: applyMerge(existing, payload) });
              return;
            }
            col.set(docId, { id: docId, data: payload });
          },
        };
      },
    }),
  };

  return {
    dbMock,
    resetDb: () => collections.clear(),
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    serverTimestamp: () => Date.now(),
  },
}));

vi.mock("../../middleware/authMiddleware", () => ({
  authenticateJwt: (req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  },
}));

vi.mock("../../services/capabilityGuard", () => ({
  requireCapability: vi.fn(async () => ({ ok: true, plan: "starter" })),
}));

async function createApp() {
  const router = (await import("../unitsRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api", router);
  return app;
}

describe("unitsRoutes PATCH aliases", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("accepts name + marketRent aliases for unit updates", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1" });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      rent: 1000,
      marketRent: 1000,
    });
    const app = await createApp();

    const res = await request(app).patch("/api/units/unit-1").send({
      name: "101A",
      marketRent: 1800,
    });

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.unit?.unitNumber).toBe("101A");
    expect(res.body?.unit?.rent).toBe(1800);
    expect(res.body?.unit?.marketRent).toBe(1800);
  });
});

