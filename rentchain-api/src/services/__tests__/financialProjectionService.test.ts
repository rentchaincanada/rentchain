import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

function buildDocs(name: string) {
  return Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
    id,
    exists: true,
    data: () => data,
  }));
}

function applyFilter(rows: Array<{ id: string; exists: boolean; data: () => any }>, field: string, value: any) {
  return rows.filter((row) => row.data()?.[field] === value);
}

function buildQuery(name: string, rowsFactory: () => Array<{ id: string; exists: boolean; data: () => any }>) {
  return {
    where: (field: string, _op: string, value: any) =>
      buildQuery(name, () => applyFilter(rowsFactory(), field, value)),
    orderBy: (field: string, direction?: string) => ({
      limit: (count: number) => ({
        get: async () => {
          const docs = rowsFactory()
            .slice()
            .sort((a, b) => {
              const av = String(a.data()?.[field] || "");
              const bv = String(b.data()?.[field] || "");
              return direction === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
            })
            .slice(0, count);
          return { docs };
        },
      }),
      get: async () => {
        const docs = rowsFactory()
          .slice()
          .sort((a, b) => {
            const av = String(a.data()?.[field] || "");
            const bv = String(b.data()?.[field] || "");
            return direction === "desc" ? bv.localeCompare(av) : av.localeCompare(bv);
          });
        return { docs };
      },
    }),
    limit: (count: number) => ({
      get: async () => ({ docs: rowsFactory().slice(0, count) }),
    }),
    get: async () => ({ docs: rowsFactory() }),
    doc: (id: string) => ({
      get: async () => {
        const row = ensureCollection(name).get(id);
        return {
          id,
          exists: row !== undefined,
          data: () => row ?? null,
        };
      },
    }),
  };
}

vi.mock("../../firebase", () => ({
  db: {
    collection: (name: string) => buildQuery(name, () => buildDocs(name)),
  },
}));

describe("financialProjectionService", () => {
  beforeEach(() => {
    collections.clear();
    vi.clearAllMocks();
  });

  it("maps payments, charges, credits, and unmatched ledger payments with deterministic labels", async () => {
    ensureCollection("payments").set("payment-1", {
      tenantId: "tenant-1",
      propertyId: "property-1",
      amount: 1200,
      paidAt: "2026-04-03",
      method: "e-transfer",
    });
    ensureCollection("ledgerEntries").set("entry-charge", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      unitId: "unit-1",
      entryType: "charge",
      category: "rent",
      amountCents: 120000,
      effectiveDate: "2026-04-01",
      createdAt: 1,
    });
    ensureCollection("ledgerEntries").set("entry-credit", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      unitId: "unit-1",
      entryType: "charge",
      category: "credit",
      amountCents: 5000,
      effectiveDate: "2026-04-02",
      createdAt: 2,
    });
    ensureCollection("ledgerEntries").set("entry-unmatched", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      unitId: "unit-1",
      entryType: "payment",
      category: "payment",
      amountCents: 40000,
      effectiveDate: "2026-04-04",
      method: "cash",
      createdAt: 3,
    });
    ensureCollection("leases").set("lease-1", {
      tenantId: "tenant-1",
      propertyId: "property-1",
      unitId: "unit-1",
      propertyName: "Harbour View",
      unitLabel: "101",
    });
    ensureCollection("properties").set("property-1", {
      name: "Harbour View",
    });
    ensureCollection("units").set("unit-1", {
      propertyId: "property-1",
      unitNumber: "101",
    });

    const { deriveFinancialProjectionRows } = await import("../financialProjectionService");
    const result = await deriveFinancialProjectionRows({ landlordId: "landlord-1" });

    expect(result.rows.map((row) => row.sourceType)).toEqual([
      "ledger_payment_unmatched",
      "recorded_payment",
      "lease_credit",
      "lease_charge",
    ]);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        propertyLabel: "Harbour View",
        unitLabel: "101",
        displayLabel: "Lease ledger payment (cash)",
        sourceBadge: "Lease ledger payment",
      })
    );
    expect(result.rows[1]).toEqual(
      expect.objectContaining({
        sourceType: "recorded_payment",
        displayLabel: "Recorded payment (e-transfer)",
        propertyLabel: "Harbour View",
        unitLabel: null,
      })
    );
    expect(result.rows[2]).toEqual(
      expect.objectContaining({
        sourceType: "lease_credit",
        direction: "credit",
        displayLabel: "Lease credit",
      })
    );
    expect(result.rows[3]).toEqual(
      expect.objectContaining({
        sourceType: "lease_charge",
        direction: "debit",
        displayLabel: "Rent charge",
      })
    );
    expect(result.counts).toEqual({
      recorded_payment: 1,
      lease_charge: 1,
      lease_credit: 1,
      ledger_payment_unmatched: 1,
    });
  });

  it("suppresses a ledger payment when it matches exactly one persisted payment", async () => {
    ensureCollection("payments").set("payment-1", {
      tenantId: "tenant-1",
      propertyId: "property-1",
      amount: 1200,
      paidAt: "2026-04-03",
    });
    ensureCollection("ledgerEntries").set("entry-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      entryType: "payment",
      category: "payment",
      amountCents: 120000,
      effectiveDate: "2026-04-03",
      createdAt: 1,
    });
    ensureCollection("leases").set("lease-1", {
      tenantId: "tenant-1",
      propertyId: "property-1",
    });

    const { deriveFinancialProjectionRows } = await import("../financialProjectionService");
    const result = await deriveFinancialProjectionRows({ landlordId: "landlord-1" });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].sourceType).toBe("recorded_payment");
    expect(result.counts.ledger_payment_unmatched).toBe(0);
  });

  it("keeps a ledger payment unmatched when multiple persisted payment candidates exist", async () => {
    ensureCollection("payments").set("payment-1", {
      tenantId: "tenant-1",
      propertyId: "property-1",
      amount: 1200,
      paidAt: "2026-04-03",
    });
    ensureCollection("payments").set("payment-2", {
      tenantId: "tenant-1",
      propertyId: "property-1",
      amount: 1200,
      paidAt: "2026-04-03",
    });
    ensureCollection("ledgerEntries").set("entry-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      entryType: "payment",
      category: "payment",
      amountCents: 120000,
      effectiveDate: "2026-04-03",
      createdAt: 1,
    });
    ensureCollection("leases").set("lease-1", {
      tenantId: "tenant-1",
      propertyId: "property-1",
    });

    const { deriveFinancialProjectionRows } = await import("../financialProjectionService");
    const result = await deriveFinancialProjectionRows({ landlordId: "landlord-1" });

    expect(result.rows.map((row) => row.sourceType)).toEqual([
      "recorded_payment",
      "recorded_payment",
      "ledger_payment_unmatched",
    ]);
    expect(result.counts.ledger_payment_unmatched).toBe(1);
  });

  it("keeps unresolved labels null and filters by tenant, property, lease, and date window", async () => {
    ensureCollection("payments").set("payment-1", {
      tenantId: "tenant-1",
      propertyId: "property-1",
      amount: 900,
      paidAt: "2026-04-02",
    });
    ensureCollection("payments").set("payment-2", {
      tenantId: "tenant-2",
      propertyId: "property-2",
      amount: 700,
      paidAt: "2026-04-10",
    });
    ensureCollection("ledgerEntries").set("entry-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      propertyId: "property-1",
      entryType: "charge",
      category: "fee",
      amountCents: 2500,
      effectiveDate: "2026-04-05",
      createdAt: 1,
    });
    ensureCollection("leases").set("lease-1", {
      tenantId: "tenant-1",
      propertyId: "property-1",
    });

    const { deriveFinancialProjectionRows } = await import("../financialProjectionService");
    const result = await deriveFinancialProjectionRows({
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "property-1",
      leaseId: "lease-1",
      from: "2026-04-03",
      to: "2026-04-06",
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual(
      expect.objectContaining({
        sourceType: "lease_charge",
        propertyLabel: null,
        unitLabel: null,
      })
    );
  });
});
