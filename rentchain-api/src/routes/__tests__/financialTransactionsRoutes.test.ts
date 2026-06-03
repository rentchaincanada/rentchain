import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();
  let autoId = 0;

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  function buildQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => buildQuery(name, [...filters, { field, op, value }]),
      get: async () => {
        const rows = Array.from(ensureCollection(name).values()).filter((entry) =>
          filters.every((filter) => (filter.op === "==" ? entry.data?.[filter.field] === filter.value : true))
        );
        return {
          docs: rows.map((row) => ({ id: row.id, data: () => row.data })),
        };
      },
      limit: (_n: number) => buildQuery(name, filters),
      doc: (id?: string) => {
        const docId = id || `auto_${++autoId}`;
        return {
          id: docId,
          set: async (payload: any) => ensureCollection(name).set(docId, { id: docId, data: payload }),
          get: async () => {
            const row = ensureCollection(name).get(docId);
            return { id: docId, exists: Boolean(row), data: () => row?.data };
          },
        };
      },
    };
  }

  return {
    dbMock: {
      collection: (name: string) => buildQuery(name),
    },
    resetDb: () => {
      collections.clear();
      autoId = 0;
    },
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
  };
});

vi.mock("../../firebase", () => ({
  db: dbMock,
}));

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => next(),
}));

async function invokeRouter(
  router: any,
  options: {
    method: string;
    url: string;
    role?: "landlord" | "admin";
    query?: Record<string, string>;
  }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path: options.url,
      query: options.query ?? {},
      user: { id: "landlord-1", landlordId: "landlord-1", role: options.role || "landlord" },
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
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("financialTransactionsRoutes", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("lists landlord-scoped transactions filtered by property and work order", async () => {
    const router = (await import("../financialTransactionsRoutes")).default;
    seedDoc("financialTransactions", "txn-1", {
      id: "txn-1",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      workOrderId: "wo-1",
      type: "maintenance_cost_recorded",
      amountCents: 24500,
      currency: "CAD",
      status: "recorded",
      createdAt: 1000,
    });
    seedDoc("financialTransactions", "txn-2", {
      id: "txn-2",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      workOrderId: "wo-2",
      type: "maintenance_cost_linked_to_expense",
      amountCents: 32000,
      currency: "CAD",
      status: "linked",
      createdAt: 2000,
    });
    seedDoc("financialTransactions", "txn-3", {
      id: "txn-3",
      landlordId: "landlord-2",
      propertyId: "prop-1",
      workOrderId: "wo-1",
      type: "maintenance_cost_recorded",
      amountCents: 9999,
      currency: "CAD",
      status: "recorded",
      createdAt: 3000,
    });

    const propertyRes = await invokeRouter(router, {
      method: "GET",
      url: "/financial-transactions",
      query: { propertyId: "prop-1" },
    });
    const workOrderRes = await invokeRouter(router, {
      method: "GET",
      url: "/financial-transactions",
      query: { workOrderId: "wo-2" },
    });

    expect(propertyRes.status).toBe(200);
    expect(propertyRes.body.items).toHaveLength(2);
    expect(propertyRes.body.items.every((item: any) => item.landlordId === "landlord-1")).toBe(true);

    expect(workOrderRes.status).toBe(200);
    expect(workOrderRes.body.items).toHaveLength(1);
    expect(workOrderRes.body.items[0]?.id).toBe("txn-2");
  });
});
