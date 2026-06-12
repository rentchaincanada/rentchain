import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoCounter = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function applyMerge(existing: any, payload: any) {
    return { ...(existing || {}), ...(payload || {}) };
  }

  function snapshotFor(name: string, filters: Array<{ field: string; value: any }>) {
    const docs = Array.from(ensureCollection(name).values())
      .filter((doc) => filters.every((filter) => doc.data?.[filter.field] === filter.value))
      .map((doc) => ({
        id: doc.id,
        exists: true,
        data: () => doc.data,
      }));
    return { docs, size: docs.length };
  }

  function collectionApi(name: string, filters: Array<{ field: string; value: any }> = []): any {
    return {
      doc: (id?: string) => {
        const col = ensureCollection(name);
        const docId = id || `${name}-auto-${++autoCounter}`;
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
      where: (field: string, op: string, value: any) => {
        if (op !== "==") throw new Error(`Unsupported where op: ${op}`);
        return collectionApi(name, [...filters, { field, value }]);
      },
      get: async () => snapshotFor(name, filters),
    };
  }

  const dbMock = {
    collection: (name: string) => collectionApi(name),
    batch: () => {
      const writes: Array<() => Promise<void>> = [];
      return {
        set: (ref: any, payload: any, options?: { merge?: boolean }) => {
          writes.push(() => ref.set(payload, options));
        },
        commit: async () => {
          for (const write of writes) await write();
        },
      };
    },
  };

  return {
    dbMock,
    resetDb: () => {
      collections.clear();
      autoCounter = 0;
    },
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
  };
});

vi.mock("../../firebase", () => ({
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

  it("persists occupancy status, occupant name, and lease end date", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1" });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "101",
      status: "vacant",
    });
    const app = await createApp();

    const res = await request(app).patch("/api/units/unit-1").send({
      status: "occupied",
      occupantName: "Jane Tenant",
      leaseEndDate: "2027-06-10",
    });

    expect(res.status).toBe(200);
    expect(res.body?.unit).toMatchObject({
      id: "unit-1",
      status: "occupied",
      occupantName: "Jane Tenant",
      leaseEndDate: "2027-06-10",
    });
  });

  it("returns UNIT_ID_UNRESOLVED when updating a placeholder unit", async () => {
    const app = await createApp();

    const res = await request(app).patch("/api/units/placeholder-0").send({
      status: "occupied",
      occupantName: "Jane Tenant",
      leaseEndDate: "2027-06-10",
    });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      error: "UNIT_ID_UNRESOLVED",
      code: "UNIT_ID_UNRESOLVED",
    });
  });

  it("returns persisted IDs when creating units for a property", async () => {
    seedDoc("properties", "prop-1", { landlordId: "landlord-1" });
    const app = await createApp();

    const res = await request(app)
      .post("/api/properties/prop-1/units")
      .send({
        units: [
          { unitNumber: "101", beds: 1, baths: 1, sqft: 500, marketRent: 1500, status: "vacant" },
          { unitNumber: "102", beds: 2, baths: 1, sqft: 700, marketRent: 1900, status: "vacant" },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, created: 2 });
    expect(res.body.units).toHaveLength(2);
    expect(res.body.units[0]).toMatchObject({ id: "units-auto-1", unitNumber: "101", propertyId: "prop-1" });
    expect(res.body.units[1]).toMatchObject({ id: "units-auto-2", unitNumber: "102", propertyId: "prop-1" });
    expect(res.body.items).toEqual(res.body.units);
  });
});
