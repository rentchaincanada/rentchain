import { beforeEach, describe, expect, it } from "vitest";

const { fakeDb, resetFakeDb, seedDoc } = (() => {
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
      doc: (id: string) => ({
        get: async () => {
          const doc = ensureCollection(name).get(id);
          return { id, exists: !!doc, data: () => doc?.data };
        },
      }),
      get: async () => {
        const docs = Array.from(ensureCollection(name).values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: any) => docs.forEach(fn) };
      },
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => makeQuery(name),
    },
  };
})();

describe("adminLeaseView", () => {
  beforeEach(() => {
    resetFakeDb();
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      unitNumber: "101",
      tenantIds: ["tenant-1", "tenant-2"],
      status: "active",
      monthlyRent: 1800,
      leaseStartDate: "2026-01-01",
      leaseEndDate: "2026-12-31",
      riskGrade: "B",
      updatedAt: "2026-03-05T00:00:00.000Z",
      createdAt: "2026-03-01T00:00:00.000Z",
    });
    seedDoc("leases", "lease-2", {
      landlordId: "landlord-2",
      propertyId: "prop-2",
      unitLabel: "8B",
      tenantId: "tenant-3",
      status: "pending",
      currentRent: 2400,
      leaseStartDate: "2026-02-01",
      leaseEndDate: "2027-01-31",
      riskGrade: "A",
      duplicateAgreement: true,
      updatedAt: "2026-03-06T00:00:00.000Z",
      createdAt: "2026-03-02T00:00:00.000Z",
    });
    seedDoc("leases", "lease-3", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "102",
      tenantId: "tenant-4",
      status: "inactive",
      monthlyRent: 1200,
      occupancyMismatch: true,
      leaseStartDate: "2025-01-01",
      leaseEndDate: "2025-12-31",
      riskGrade: "C",
      updatedAt: "2026-03-03T00:00:00.000Z",
      createdAt: "2026-03-01T00:00:00.000Z",
    });

    seedDoc("properties", "prop-1", { name: "Coburg Rd" });
    seedDoc("properties", "prop-2", { name: "Summit" });

    seedDoc("tenants", "tenant-1", { fullName: "Jane Tenant" });
    seedDoc("tenants", "tenant-2", { firstName: "Co", lastName: "Tenant" });
    seedDoc("tenants", "tenant-3", { fullName: "Alex Summit" });
    seedDoc("tenants", "tenant-4", { fullName: "Old Lease" });

    seedDoc("landlords", "landlord-1", { businessName: "Harbour Homes" });
    seedDoc("landlords", "landlord-2", { displayName: "Summit Rentals" });
  });

  it("returns safe shaped lease rows with tenant names", async () => {
    const { listAdminLeases } = await import("../admin/adminLeaseView");
    const result = await listAdminLeases({ firestore: fakeDb as any, page: 1, pageSize: 25 });

    expect(result.items[0]).toHaveProperty("id");
    expect(result.items[0]).toHaveProperty("propertyName");
    expect(result.items[0]).toHaveProperty("tenantNames");
    expect(result.items[0]).toHaveProperty("leaseDisplayLabel");
    expect(result.items[0]).toHaveProperty("landlordDisplayName");
    expect(result.items[0]).toHaveProperty("integrity");
    expect(result.items[0]).not.toHaveProperty("auditBlob");
    expect(result.items.find((item) => item.id === "lease-1")?.leaseDisplayLabel).toBe("Coburg Rd · Unit 101 · Jane Tenant");
    expect(result.items.find((item) => item.id === "lease-1")?.landlordDisplayName).toBe("Harbour Homes");
  });

  it("supports search across property, unit, tenant, and lease id", async () => {
    const { listAdminLeases } = await import("../admin/adminLeaseView");
    const byTenant = await listAdminLeases({ firestore: fakeDb as any, q: "jane", page: 1, pageSize: 25 });
    const byProperty = await listAdminLeases({ firestore: fakeDb as any, q: "summit", page: 1, pageSize: 25 });
    const byLeaseId = await listAdminLeases({ firestore: fakeDb as any, q: "lease-3", page: 1, pageSize: 25 });

    expect(byTenant.items.map((item) => item.id)).toEqual(["lease-1"]);
    expect(byProperty.items.map((item) => item.id)).toEqual(["lease-2"]);
    expect(byLeaseId.items.map((item) => item.id)).toEqual(["lease-3"]);
  });

  it("filters by status, risk grade, integrity, and date range", async () => {
    const { listAdminLeases } = await import("../admin/adminLeaseView");
    const statusFiltered = await listAdminLeases({ firestore: fakeDb as any, status: "active", page: 1, pageSize: 25 });
    const riskFiltered = await listAdminLeases({ firestore: fakeDb as any, riskGrade: "a", page: 1, pageSize: 25 });
    const integrityFiltered = await listAdminLeases({
      firestore: fakeDb as any,
      integrity: "duplicateAgreement",
      page: 1,
      pageSize: 25,
    });
    const dateFiltered = await listAdminLeases({
      firestore: fakeDb as any,
      startAfter: "2026-01-15",
      startBefore: "2026-02-15",
      page: 1,
      pageSize: 25,
    });

    expect(statusFiltered.items.map((item) => item.id)).toEqual(["lease-1"]);
    expect(riskFiltered.items.map((item) => item.id)).toEqual(["lease-2"]);
    expect(integrityFiltered.items.map((item) => item.id)).toEqual(["lease-2"]);
    expect(dateFiltered.items.map((item) => item.id)).toEqual(["lease-2"]);
  });

  it("supports landlord/property scoping and pagination", async () => {
    const { listAdminLeases } = await import("../admin/adminLeaseView");
    const scoped = await listAdminLeases({
      firestore: fakeDb as any,
      landlordId: "landlord-1",
      propertyId: "prop-1",
      sortBy: "monthlyRent",
      sortDir: "desc",
      page: 2,
      pageSize: 1,
    });

    expect(scoped.total).toBe(2);
    expect(scoped.page).toBe(2);
    expect(scoped.pageSize).toBe(1);
    expect(scoped.hasMore).toBe(false);
    expect(scoped.items[0]?.id).toBe("lease-3");
  });
});
