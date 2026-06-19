import { beforeEach, describe, expect, it, vi } from "vitest";

type CollectionName =
  | "properties"
  | "units"
  | "leases"
  | "tenants"
  | "ledgerEvents"
  | "ledgerEntries"
  | "rentPayments"
  | "payments";

const writes = {
  add: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const store: Record<CollectionName, Array<Record<string, unknown> & { id: string }>> = {
  properties: [],
  units: [],
  leases: [],
  tenants: [],
  ledgerEvents: [],
  ledgerEntries: [],
  rentPayments: [],
  payments: [],
};

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function fakeDoc(record: Record<string, unknown> & { id: string }) {
  return {
    id: record.id,
    data: () => record,
  };
}

function query(collectionName: CollectionName, filters: Array<{ field: string; op: string; value: unknown }> = []) {
  return {
    where(field: string, op: string, value: unknown) {
      return query(collectionName, [...filters, { field, op, value }]);
    },
    limit() {
      return this;
    },
    async get() {
      const docs = store[collectionName].filter((record) =>
        filters.every((filter) => {
          if (filter.op === "==") return record[filter.field] === filter.value;
          if (filter.op === "in") return asArray(filter.value).includes(record[filter.field]);
          return false;
        })
      );
      return { docs: docs.map(fakeDoc) };
    },
    add: writes.add,
    doc() {
      return {
        set: writes.set,
        update: writes.update,
        delete: writes.delete,
      };
    },
  };
}

vi.mock("../../../firebase", () => ({
  db: {
    collection(name: CollectionName) {
      return query(name);
    },
  },
}));

describe("loadLandlordPortfolioStatusFinancialInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(store) as CollectionName[]) {
      store[key] = [];
    }
  });

  it("loads portfolio inputs through read-only Firestore queries without source mutations", async () => {
    store.properties = [{ id: "property-1", landlordId: "landlord-1" }];
    store.units = [{ id: "unit-1", landlordId: "landlord-1", propertyId: "property-1" }];
    store.leases = [{ id: "lease-1", landlordId: "landlord-1", propertyId: "property-1", tenantId: "tenant-1" }];
    store.tenants = [{ id: "tenant-1", landlordId: "landlord-1", propertyId: "property-1", currentLeaseId: "lease-1" }];
    store.rentPayments = [{ id: "payment-1", landlordId: "landlord-1", leaseId: "lease-1", tenantId: "tenant-1" }];

    const { loadLandlordPortfolioStatusFinancialInput } = await import("../loadLandlordPortfolioStatusFinancialInput");
    const input = await loadLandlordPortfolioStatusFinancialInput({
      landlordId: "landlord-1",
      periodMonth: "2026-06",
      generatedAt: "2026-06-19T12:00:00.000Z",
    });

    expect(input).toEqual(
      expect.objectContaining({
        landlordId: "landlord-1",
        periodMonth: "2026-06",
        generatedAt: "2026-06-19T12:00:00.000Z",
      })
    );
    expect(input.properties?.map((record) => record.id)).toEqual(["property-1"]);
    expect(input.units?.map((record) => record.id)).toEqual(["unit-1"]);
    expect(input.leases?.map((record) => record.id)).toEqual(["lease-1"]);
    expect(input.tenants?.map((record) => record.id)).toEqual(["tenant-1"]);
    expect(input.rentPayments?.map((record) => record.id)).toEqual(["payment-1"]);
    expect(writes.add).not.toHaveBeenCalled();
    expect(writes.set).not.toHaveBeenCalled();
    expect(writes.update).not.toHaveBeenCalled();
    expect(writes.delete).not.toHaveBeenCalled();
  });
});
