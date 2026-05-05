import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, seedDoc, listDocs } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = doc?.data?.[field];
      if (op === "==") return actual === value;
      return false;
    });
  }

  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }]),
      get: async () => {
        const docs = Array.from(ensureCollection(name).values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, empty: docs.length === 0, size: docs.length };
      },
      doc: (id: string) => makeDoc(name, id),
    };
  }

  function makeDoc(name: string, id: string) {
    const col = ensureCollection(name);
    return {
      id,
      get: async () => {
        const entry = col.get(id);
        return { id, exists: Boolean(entry), data: () => entry?.data };
      },
      set: async (data: any) => {
        col.set(id, { id, data });
      },
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
    listDocs: (collection: string) => Array.from(ensureCollection(collection).values()).map((entry) => entry.data),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        get: async () => makeQuery(name).get(),
        doc: (id: string) => makeDoc(name, id),
      }),
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: fakeDb,
}));

let mockUser: any;

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    if (!mockUser) {
      return _res.status(401).json({ ok: false, error: "unauthenticated" });
    }
    req.user = mockUser;
    return next();
  },
}));

function seedLease(overrides: Record<string, any> = {}) {
  seedDoc("leases", "lease-1", {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    tenantId: "tenant-1",
    monthlyRent: 1800,
    startDate: "2026-04-01",
    endDate: "2027-03-31",
    dueDate: "2026-04-01",
    signedAt: "2026-04-01T00:00:00.000Z",
    status: "active",
    ...overrides,
  });
}

async function makeApp() {
  const router = (await import("../decisionRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use("/api/decisions", router);
  return app;
}

describe("decisionRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    resetFakeDb();
    mockUser = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", email: "landlord@example.com" };
  });

  it("returns lease-scoped derived decisions with action overlays", async () => {
    seedLease();
    seedDoc("decisionActions", "action-1", {
      actionId: "action-1",
      decisionId: "decision:review_missing_payment:decision:missing_payment:obligation:lease-1",
      leaseId: "lease-1",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      actionType: "reviewed",
      previousStatus: "detected",
      nextStatus: "reviewed",
      actorId: "landlord-1",
      createdAt: "2026-05-05T12:00:00.000Z",
    });

    const app = await makeApp();
    const res = await request(app).get("/api/decisions?leaseId=lease-1");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.decisions.length).toBeGreaterThan(0);
    expect(res.body.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decisionType: "review_missing_payment",
        }),
      ])
    );
  });

  it("persists decision action records without mutating lease documents", async () => {
    seedLease();
    const app = await makeApp();

    const listRes = await request(app).get("/api/decisions?leaseId=lease-1");
    const decision = listRes.body.decisions.find((row: any) => row.decisionType === "review_missing_payment");
    expect(decision).toBeTruthy();

    const res = await request(app)
      .patch(`/api/decisions/${encodeURIComponent(decision.decisionId)}/action`)
      .send({ leaseId: "lease-1", actionType: "reviewed", note: "Reviewed by operator" });

    expect(res.status).toBe(200);
    expect(res.body.action).toEqual(
      expect.objectContaining({
        decisionId: decision.decisionId,
        leaseId: "lease-1",
        actionType: "reviewed",
        nextStatus: "reviewed",
        note: "Reviewed by operator",
      })
    );
    expect(listDocs("decisionActions")).toHaveLength(1);
    expect(listDocs("leases")).toEqual([
      expect.objectContaining({
        landlordId: "landlord-1",
        status: "active",
      }),
    ]);
  });

  it("blocks landlord access to leases outside their scope", async () => {
    seedLease({ landlordId: "landlord-2" });
    const app = await makeApp();

    const res = await request(app).get("/api/decisions?leaseId=lease-1");

    expect(res.status).toBe(403);
  });
});
