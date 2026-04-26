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
    };
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        doc: (id?: string) => {
          const docId = id || `auto_${++autoId}`;
          return {
            id: docId,
            set: async (payload: any) => {
              ensureCollection(name).set(docId, { id: docId, data: payload });
            },
            get: async () => {
              const row = ensureCollection(name).get(docId);
              return { id: docId, exists: Boolean(row), data: () => row?.data };
            },
          };
        },
        where: (field: string, op: string, value: any) => buildQuery(name, [{ field, op, value }]),
      }),
    },
    resetDb: () => {
      collections.clear();
      autoId = 0;
    },
    seedDoc: (collection: string, id: string, data: any) => ensureCollection(collection).set(id, { id, data }),
  };
});

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

describe("financialTransactionService", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("creates a financial transaction with the controlled event model", async () => {
    const { createTransaction } = await import("../financialTransactionService");
    const item = await createTransaction({
      landlordId: "landlord-1",
      propertyId: "prop-1",
      maintenanceRequestId: "maint-1",
      workOrderId: "wo-1",
      type: "maintenance_cost_recorded",
      amountCents: 24500,
      currency: "cad",
      status: "recorded",
      metadata: { source: "test" },
      createdAt: 1000,
      updatedAt: 1000,
    });

    expect(item.id).toMatch(/^auto_/);
    expect(item.currency).toBe("CAD");
    expect(item.type).toBe("maintenance_cost_recorded");
    expect(item.status).toBe("recorded");
  });

  it("returns landlord-scoped property and work-order queries", async () => {
    const { getTransactionsByProperty, getTransactionsByWorkOrder } = await import("../financialTransactionService");
    seedDoc("financialTransactions", "txn-1", {
      id: "txn-1",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      workOrderId: "wo-1",
      type: "maintenance_cost_recorded",
      amountCents: 24500,
      currency: "CAD",
      status: "recorded",
      createdAt: 2000,
    });
    seedDoc("financialTransactions", "txn-2", {
      id: "txn-2",
      landlordId: "landlord-1",
      propertyId: "prop-2",
      workOrderId: "wo-2",
      type: "maintenance_cost_linked_to_expense",
      amountCents: 32000,
      currency: "CAD",
      status: "linked",
      createdAt: 3000,
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
      createdAt: 4000,
    });

    const byProperty = await getTransactionsByProperty("landlord-1", "prop-1");
    const byWorkOrder = await getTransactionsByWorkOrder("landlord-1", "wo-2");

    expect(byProperty).toHaveLength(1);
    expect(byProperty[0]?.id).toBe("txn-1");
    expect(byWorkOrder).toHaveLength(1);
    expect(byWorkOrder[0]?.id).toBe("txn-2");
  });
});
