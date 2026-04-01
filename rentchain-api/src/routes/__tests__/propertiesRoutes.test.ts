import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function applyMerge(existing: any, payload: any) {
    const next = { ...(existing || {}) };
    for (const [k, v] of Object.entries(payload || {})) {
      if (v && typeof v === "object" && (v as any).__op === "inc") {
        next[k] = Number(next[k] || 0) + Number((v as any).n || 0);
      } else {
        next[k] = v;
      }
    }
    return next;
  }

  function buildQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    let limitCount: number | null = null;
    const matchesFilter = (entry: StoredDoc, filter: { field: string; op: string; value: any }) => {
      if (filter.op === "==") return entry.data?.[filter.field] === filter.value;
      if (filter.op === "array-contains") {
        return Array.isArray(entry.data?.[filter.field]) && entry.data?.[filter.field].includes(filter.value);
      }
      return true;
    };
    return {
      where: (field: string, op: string, value: any) =>
        buildQuery(name, [...filters, { field, op, value }]),
      orderBy: (_field: string, _dir?: "asc" | "desc") => buildQuery(name, filters),
      limit: (n: number) => {
        limitCount = n;
        return {
          get: async () => {
            const col = ensureCollection(name);
            let rows = Array.from(col.values());
            rows = rows.filter((entry) => filters.every((f) => matchesFilter(entry, f)));
            if (limitCount !== null) rows = rows.slice(0, limitCount);
            return {
              empty: rows.length === 0,
              size: rows.length,
              docs: rows.map((r) => ({ id: r.id, data: () => r.data })),
            };
          },
        };
      },
      get: async () => {
        const col = ensureCollection(name);
        let rows = Array.from(col.values());
        rows = rows.filter((entry) => filters.every((f) => matchesFilter(entry, f)));
        return {
          empty: rows.length === 0,
          size: rows.length,
          docs: rows.map((r) => ({ id: r.id, data: () => r.data })),
        };
      },
    };
  }

  const dbMock = {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const col = ensureCollection(name);
        const docId = id || `auto_${++autoId}`;
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
          update: async (payload: any) => {
            const existing = col.get(docId)?.data || {};
            col.set(docId, { id: docId, data: applyMerge(existing, payload) });
          },
        };
      },
      where: (field: string, op: string, value: any) => buildQuery(name, [{ field, op, value }]),
      orderBy: (field: string, dir?: "asc" | "desc") => buildQuery(name).orderBy(field, dir),
    }),
    runTransaction: async (cb: any) => {
      const tx = {
        set: (ref: any, payload: any, options?: { merge?: boolean }) => ref.set(payload, options),
        update: (ref: any, payload: any) => ref.update(payload),
      };
      await cb(tx);
    },
    batch: () => {
      const ops: Array<() => Promise<void>> = [];
      return {
        set: (ref: any, payload: any, options?: { merge?: boolean }) => {
          ops.push(() => ref.set(payload, options));
        },
        commit: async () => {
          for (const op of ops) await op();
        },
      };
    },
  };

  return {
    dbMock,
    resetDb: () => {
      collections.clear();
      autoId = 0;
    },
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
  };
});

vi.mock("../../entitlements/entitlements.middleware", () => ({
  requireCapability: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => next(),
}));

vi.mock("../../middleware/requireAuthz", () => ({
  requirePermission: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../../config/firebase", () => ({
  db: dbMock,
  FieldValue: {
    increment: (n: number) => ({ __op: "inc", n }),
    serverTimestamp: () => Date.now(),
  },
}));

async function createApp() {
  const router = (await import("../propertiesRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord" };
    next();
  });
  app.use("/api/properties", router);
  return app;
}

async function createAppForUser(user: Record<string, unknown>) {
  const router = (await import("../propertiesRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = user;
    next();
  });
  app.use("/api/properties", router);
  return app;
}

async function createAdminApp(user: Record<string, unknown>) {
  const router = (await import("../adminPropertiesRoutes")).default;
  const app = express();
  app.use(express.json());
  app.use((req: any, _res: any, next: any) => {
    req.user = user;
    next();
  });
  app.use("/api/admin", router);
  return app;
}

describe("properties routes publish + defaults", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("creates properties as DRAFT with screeningRequiredBeforeApproval=true", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/properties").send({
      addressLine1: "123 Main St",
      city: "Halifax",
      province: "NS",
      totalUnits: 0,
    });

    expect(res.status).toBe(201);
    expect(res.body?.status).toBe("DRAFT");
    expect(res.body?.portfolioStatus).toBe("active");
    expect(res.body?.screeningRequiredBeforeApproval).toBe(true);
    expect(res.body?.publishedAt).toBeNull();
  });

  it("excludes archived properties by default and returns them when filtered", async () => {
    seedDoc("properties", "prop-active", {
      landlordId: "landlord-1",
      name: "Active Property",
      createdAt: "2026-03-01T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-archived", {
      landlordId: "landlord-1",
      name: "Archived Property",
      createdAt: "2026-03-02T00:00:00.000Z",
      portfolioStatus: "archived",
    });

    const app = await createApp();
    const activeRes = await request(app).get("/api/properties");
    const archivedRes = await request(app).get("/api/properties?status=archived");

    expect(activeRes.status).toBe(200);
    expect(activeRes.body.items).toHaveLength(1);
    expect(activeRes.body.items[0]?.id).toBe("prop-active");

    expect(archivedRes.status).toBe(200);
    expect(archivedRes.body.items).toHaveLength(1);
    expect(archivedRes.body.items[0]?.id).toBe("prop-archived");
  });

  it("returns only landlord A owned and managed properties on the landlord endpoint", async () => {
    seedDoc("properties", "prop-a-owned", {
      landlordId: "landlord-a",
      ownerUserId: "landlord-a",
      name: "A Owned",
      createdAt: "2026-03-01T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-a-managed", {
      landlordId: "landlord-z",
      ownerUserId: "landlord-z",
      managerUserIds: ["landlord-a"],
      name: "A Managed",
      createdAt: "2026-03-02T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-b-owned", {
      landlordId: "landlord-b",
      ownerUserId: "landlord-b",
      name: "B Owned",
      createdAt: "2026-03-03T00:00:00.000Z",
      portfolioStatus: "active",
    });

    const app = await createAppForUser({ id: "landlord-a", landlordId: "landlord-a", role: "landlord" });
    const res = await request(app).get("/api/properties");

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: any) => item.id).sort()).toEqual(["prop-a-managed", "prop-a-owned"]);
  });

  it("does not allow landlord query params to widen access to another landlord's properties", async () => {
    seedDoc("properties", "prop-a-owned", {
      landlordId: "landlord-a",
      ownerUserId: "landlord-a",
      name: "A Owned",
      createdAt: "2026-03-01T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-b-owned", {
      landlordId: "landlord-b",
      ownerUserId: "landlord-b",
      name: "B Owned",
      createdAt: "2026-03-03T00:00:00.000Z",
      portfolioStatus: "active",
    });

    const app = await createAppForUser({ id: "landlord-a", landlordId: "landlord-a", role: "landlord" });
    const res = await request(app).get("/api/properties?landlordId=landlord-b");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]?.id).toBe("prop-a-owned");
  });

  it("does not automatically widen landlord endpoint results for admin-role users", async () => {
    seedDoc("properties", "prop-admin-owned", {
      landlordId: "admin-1",
      ownerUserId: "admin-1",
      name: "Admin Owned",
      createdAt: "2026-03-01T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-other", {
      landlordId: "landlord-b",
      ownerUserId: "landlord-b",
      name: "Other",
      createdAt: "2026-03-03T00:00:00.000Z",
      portfolioStatus: "active",
    });

    const app = await createAppForUser({ id: "admin-1", landlordId: "admin-1", role: "admin" });
    const res = await request(app).get("/api/properties");

    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]?.id).toBe("prop-admin-owned");
  });

  it("allows system admin users to access the dedicated admin property list", async () => {
    seedDoc("properties", "prop-a", {
      landlordId: "landlord-a",
      ownerUserId: "landlord-a",
      name: "A Owned",
      createdAt: "2026-03-01T00:00:00.000Z",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-b", {
      landlordId: "landlord-b",
      ownerUserId: "landlord-b",
      name: "B Owned",
      createdAt: "2026-03-03T00:00:00.000Z",
      portfolioStatus: "active",
    });

    const app = await createAdminApp({
      id: "admin-1",
      landlordId: "admin-1",
      role: "admin",
      permissions: ["system.admin"],
      revokedPermissions: [],
    });
    const res = await request(app).get("/api/admin/properties");

    expect(res.status).toBe(200);
    expect(res.body.items.map((item: any) => item.id).sort()).toEqual(["prop-a", "prop-b"]);
  });

  it("archives a property without deleting related records", async () => {
    seedDoc("properties", "prop-archive", {
      landlordId: "landlord-1",
      name: "Archive Me",
      portfolioStatus: "active",
    });
    seedDoc("units", "unit-archive", {
      landlordId: "landlord-1",
      propertyId: "prop-archive",
      unitNumber: "10",
    });

    const app = await createApp();
    const res = await request(app).post("/api/properties/prop-archive/archive").send({});

    expect(res.status).toBe(200);
    expect(res.body?.property?.portfolioStatus).toBe("archived");

    const activeRes = await request(app).get("/api/properties");
    const archivedRes = await request(app).get("/api/properties?status=archived");

    expect(activeRes.body.items).toHaveLength(0);
    expect(archivedRes.body.items).toHaveLength(1);
    expect(archivedRes.body.items[0]?.id).toBe("prop-archive");
  });

  it("returns units_required when publishing with no units", async () => {
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Test Property",
      status: "DRAFT",
    });
    const app = await createApp();
    const res = await request(app).post("/api/properties/prop-1/publish").send({});

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      ok: false,
      error: "units_required",
    });
  });

  it("publishes when at least one unit exists", async () => {
    seedDoc("properties", "prop-2", {
      landlordId: "landlord-1",
      name: "Test Property 2",
      status: "DRAFT",
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-2",
      unitNumber: "101",
    });

    const app = await createApp();
    const res = await request(app).post("/api/properties/prop-2/publish").send({});

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);
    expect(res.body?.property?.status).toBe("PUBLISHED");
    expect(typeof res.body?.property?.publishedAt).toBe("number");
  });
});
