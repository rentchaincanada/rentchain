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
            rows = rows.filter((entry) =>
              filters.every((f) => (f.op === "==" ? entry.data?.[f.field] === f.value : true))
            );
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
        rows = rows.filter((entry) =>
          filters.every((f) => (f.op === "==" ? entry.data?.[f.field] === f.value : true))
        );
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
    expect(res.body?.screeningRequiredBeforeApproval).toBe(true);
    expect(res.body?.publishedAt).toBeNull();
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

