import { beforeEach, describe, expect, it, vi } from "vitest";

const collections = new Map<string, Map<string, any>>();
const getTenantDetailBundleMock = vi.fn();
const getTenantLedgerMock = vi.fn();

function ensureCollection(name: string) {
  if (!collections.has(name)) collections.set(name, new Map());
  return collections.get(name)!;
}

vi.mock("../../config/firebase", () => ({
  db: {
    collection: (name: string) => ({
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
      where: (field: string, _op: string, value: any) => {
        const applyFilter = (rows: Array<[string, any]>) =>
          rows.filter(([, data]) => data?.[field] === value);
        return {
          where: (field2: string, _op2: string, value2: any) => ({
            get: async () => {
              const docs = applyFilter(Array.from(ensureCollection(name).entries()))
                .filter(([, data]) => data?.[field2] === value2)
                .map(([id, data]) => ({
                  id,
                  data: () => data,
                }));
              return { docs };
            },
          }),
          orderBy: (_orderField: string, _direction?: string) => ({
            limit: (_count: number) => ({
              get: async () => {
                const docs = applyFilter(Array.from(ensureCollection(name).entries()))
                  .sort((a, b) => String(b[1]?.paidAt || "").localeCompare(String(a[1]?.paidAt || "")))
                  .map(([id, data]) => ({
                    id,
                    data: () => data,
                  }));
                return { docs };
              },
            }),
          }),
          get: async () => {
            const docs = applyFilter(Array.from(ensureCollection(name).entries())).map(([id, data]) => ({
              id,
              data: () => data,
            }));
            return { docs };
          },
        };
      },
      orderBy: (_field: string, _direction?: string) => ({
        limit: (_count: number) => ({
          get: async () => {
            const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
              id,
              data: () => data,
            }));
            return { docs };
          },
        }),
      }),
    }),
  },
}));

vi.mock("../tenantDetailsService", () => ({
  getTenantDetailBundle: getTenantDetailBundleMock,
}));

vi.mock("../tenantLedgerService", () => ({
  getTenantLedger: getTenantLedgerMock,
}));

describe("tenantReportService", () => {
  beforeEach(() => {
    collections.clear();
    vi.clearAllMocks();
    getTenantLedgerMock.mockResolvedValue([]);
  });

  it("uses persisted payments for metrics and current lease ledger for the ledger section", async () => {
    getTenantDetailBundleMock.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        fullName: "Taylor Tenant",
        landlordId: "landlord-1",
        propertyName: "Harbour View",
        unit: "101",
        currentLeaseId: "lease-1",
      },
      currentLease: {
        id: "lease-1",
        propertyName: "Harbour View",
        unit: "101",
      },
    });

    ensureCollection("payments").set("payment-1", {
      tenantId: "tenant-1",
      amount: 1850,
      paidAt: "2026-04-03",
      dueDate: "2026-04-01",
      method: "e-transfer",
      status: "Recorded",
    });
    ensureCollection("ledgerEntries").set("entry-1", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "charge",
      category: "rent",
      amountCents: 185000,
      effectiveDate: "2026-04-01",
      createdAt: 1,
    });
    ensureCollection("ledgerEntries").set("entry-2", {
      landlordId: "landlord-1",
      leaseId: "lease-1",
      entryType: "payment",
      category: "payment",
      amountCents: 185000,
      effectiveDate: "2026-04-03",
      method: "etransfer",
      createdAt: 2,
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

    const { buildTenantReportData } = await import("../tenantReportService");
    const result = await buildTenantReportData("tenant-1");

    expect(result.behavior.totalPayments).toBe(1);
    expect(result.behavior.lastPaymentDate).toBe("2026-04-03");
    expect(result.ledgerEntries).toEqual([
      expect.objectContaining({
        type: "payment",
        amount: 1850,
        runningBalance: 0,
      }),
      expect.objectContaining({
        type: "charge",
        amount: 1850,
        runningBalance: 1850,
      }),
    ]);
    expect(result.ledgerSummary).toEqual({
      currentBalance: 0,
      totalCharges: 1850,
      totalPayments: 1850,
      netLifetime: 3700,
    });
    expect(result.financialActivityRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "recorded_payment",
          displayLabel: "Recorded payment (e-transfer)",
        }),
        expect.objectContaining({
          sourceType: "lease_charge",
          displayLabel: "Rent charge",
        }),
        expect.objectContaining({
          sourceType: "ledger_payment_unmatched",
          displayLabel: "Lease ledger payment (etransfer)",
        }),
      ])
    );
    expect(getTenantLedgerMock).not.toHaveBeenCalled();
  });

  it("falls back to the tenant ledger service only when no current lease exists", async () => {
    getTenantDetailBundleMock.mockResolvedValue({
      tenant: {
        id: "tenant-1",
        fullName: "Taylor Tenant",
        landlordId: "landlord-1",
      },
      currentLease: null,
    });
    ensureCollection("payments").set("payment-1", {
      tenantId: "tenant-1",
      amount: 1850,
      paidAt: "2026-04-03",
      dueDate: "2026-04-01",
      status: "Recorded",
    });
    getTenantLedgerMock.mockResolvedValue([
      {
        id: "legacy-1",
        tenantId: "tenant-1",
        date: "2026-04-01",
        type: "payment",
        amount: 1850,
        runningBalance: -1850,
      },
    ]);

    const { buildTenantReportData } = await import("../tenantReportService");
    const result = await buildTenantReportData("tenant-1");

    expect(getTenantLedgerMock).toHaveBeenCalledWith("tenant-1");
    expect(result.ledgerEntries).toEqual([
      expect.objectContaining({
        id: "legacy-1",
        amount: 1850,
      }),
    ]);
    expect(result.behavior.totalPayments).toBe(1);
    expect(result.financialActivityRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: "recorded_payment",
          displayLabel: "Recorded payment",
        }),
      ])
    );
  });
});
