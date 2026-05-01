import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc, setPlan, getPlan } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;
  let currentPlan = "free";

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function matches(entry: StoredDoc, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every((filter) => (filter.op === "==" ? entry.data?.[filter.field] === filter.value : true));
  }

  function buildQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => buildQuery(name, [...filters, { field, op, value }]),
      limit: (n: number) => ({
        get: async () => {
          const rows = Array.from(ensureCollection(name).values()).filter((entry) => matches(entry, filters)).slice(0, n);
          return {
            empty: rows.length === 0,
            size: rows.length,
            docs: rows.map((row) => ({ id: row.id, data: () => row.data })),
          };
        },
      }),
      get: async () => {
        const rows = Array.from(ensureCollection(name).values()).filter((entry) => matches(entry, filters));
        return {
          empty: rows.length === 0,
          size: rows.length,
          docs: rows.map((row) => ({ id: row.id, data: () => row.data })),
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
            const row = col.get(docId);
            return { id: docId, exists: Boolean(row), data: () => row?.data };
          },
          set: async (payload: any, options?: { merge?: boolean }) => {
            const current = col.get(docId)?.data || {};
            col.set(docId, { id: docId, data: options?.merge ? { ...current, ...payload } : payload });
          },
          delete: async () => {
            col.delete(docId);
          },
        };
      },
      add: async (payload: any) => {
        const id = `auto_${++autoId}`;
        ensureCollection(name).set(id, { id, data: payload });
        return { id };
      },
      where: (field: string, op: string, value: any) => buildQuery(name, [{ field, op, value }]),
      limit: (n: number) => buildQuery(name).limit(n),
    }),
  };

  return {
    dbMock,
    resetDb: () => {
      collections.clear();
      autoId = 0;
      currentPlan = "free";
    },
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
    setPlan: (plan: string) => {
      currentPlan = plan;
    },
    getPlan: () => currentPlan,
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => next(),
}));

vi.mock("../../lib/gcs", () => ({
  uploadBufferToGcs: vi.fn(),
}));

vi.mock("multer", () => {
  const multer = () => ({
    single: () => (_req: any, _res: any, next: any) => next(),
  });
  (multer as any).memoryStorage = vi.fn(() => ({}));
  return { default: multer };
});

vi.mock("../../ai/agent", () => ({
  runAIAgent: vi.fn(),
}));

vi.mock("../../services/entitlementsService", () => ({
  getUserEntitlements: vi.fn(async () => ({
    userId: "landlord-1",
    role: "landlord",
    plan: getPlan(),
    capabilities: [],
    landlordId: "landlord-1",
  })),
}));

async function createApp() {
  const router = (await import("../expensesRoutes")).default;
  const app = express();
  app.use(express.json({ limit: "1mb" }));
  app.use((req: any, _res: any, next: any) => {
    req.user = { id: "landlord-1", landlordId: "landlord-1", role: "landlord", plan: "free" };
    next();
  });
  app.use("/api", router);
  return app;
}

describe("expenses routes", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
    setPlan("free");
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Alpha Property",
      portfolioStatus: "active",
    });
    seedDoc("properties", "prop-archived", {
      landlordId: "landlord-1",
      name: "Beta Property",
      portfolioStatus: "archived",
    });
  });

  it("creates and filters landlord expenses", async () => {
    const app = await createApp();
    const createRes = await request(app).post("/api/expenses").send({
      propertyId: "prop-1",
      category: "Repairs",
      amountCents: 12500,
      incurredAtMs: Date.parse("2026-03-01T00:00:00.000Z"),
      vendorName: "FixIt",
    });

    expect(createRes.status).toBe(200);

    const listRes = await request(app).get("/api/expenses?category=Repairs");
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0]?.propertyId).toBe("prop-1");
  });

  it("guards csv import to Pro+", async () => {
    const app = await createApp();
    const res = await request(app).post("/api/expenses/import/csv").send({
      csvText: "propertyId,date,category,amount\nprop-1,2026-03-01,Repairs,100.00",
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("UPGRADE_REQUIRED");
  });

  it("imports a RentChain-exported csv shape and skips unknown property rows with reasons", async () => {
    setPlan("pro");
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "12A",
    });

    const app = await createApp();
    const res = await request(app).post("/api/expenses/import/csv").send({
      csvText: [
        "date,property,unit,category,vendor,description,amount,status,source",
        "2026-03-01,Alpha Property,12A,Repairs,FixIt,Pipe repair,125.00,recorded,manual",
        "2026-03-02,Missing Property,,Repairs,FixIt,Unknown property,10.00,recorded,manual",
      ].join("\n"),
    });

    expect(res.status).toBe(200);
    expect(res.body.rowsImported).toBe(1);
    expect(res.body.rowsSkipped).toBe(1);
    expect(res.body.errors).toContain('Row 3: property "Missing Property" was not found in your portfolio.');

    const listRes = await request(app).get("/api/expenses");
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0]?.propertyId).toBe("prop-1");
    expect(listRes.body.items[0]?.unitId).toBe("unit-1");
    expect(listRes.body.items[0]?.amountCents).toBe(12500);
  });

  it("exports csv for Pro plans", async () => {
    setPlan("pro");
    seedDoc("expenses", "expense-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: null,
      category: "Repairs",
      vendorName: "FixIt",
      amountCents: 12500,
      incurredAtMs: Date.parse("2026-03-01T00:00:00.000Z"),
      notes: "Pipe repair",
      status: "recorded",
      source: "manual",
    });
    const app = await createApp();
    const res = await request(app).get("/api/expenses/export.csv");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(String(res.headers["content-disposition"] || "")).toMatch(
      /^attachment; filename="rentchain-expenses-\d{4}-\d{2}-\d{2}\.csv"$/
    );
    expect(res.text).toContain("Alpha Property");
    expect(res.text).toContain("125.00");
  });

  it("exports spreadsheet xml with human property and unit labels", async () => {
    setPlan("pro");
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "12A",
    });
    seedDoc("expenses", "expense-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      category: "Repairs",
      vendorName: "FixIt",
      amountCents: 12500,
      incurredAtMs: Date.parse("2026-03-01T00:00:00.000Z"),
      notes: "Pipe repair",
      status: "recorded",
      source: "manual",
    });
    const app = await createApp();
    const res = await request(app).get("/api/expenses/export.xlsx");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/vnd.ms-excel");
    expect(String(res.headers["content-disposition"] || "")).toMatch(
      /^attachment; filename="rentchain-expenses-\d{4}-\d{2}-\d{2}\.xls"$/
    );
    expect(res.text).toContain("Alpha Property");
    expect(res.text).toContain("12A");
    expect(res.text).not.toContain("prop-1");
    expect(res.text).not.toContain("unit-1");
  });
});
