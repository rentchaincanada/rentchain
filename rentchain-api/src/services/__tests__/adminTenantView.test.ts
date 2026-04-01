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
          return {
            id,
            exists: !!doc,
            data: () => doc?.data,
          };
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

describe("adminTenantView", () => {
  beforeEach(() => {
    resetFakeDb();

    seedDoc("tenants", "tenant-1", {
      fullName: "Jane Tenant",
      firstName: "Jane",
      lastName: "Tenant",
      email: "jane@example.com",
      phone: "902-555-1000",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      unitNumber: "101",
      currentLeaseId: "lease-1",
      screeningStatus: "complete",
      moveInStatus: "ready",
      createdAt: "2026-03-01T00:00:00.000Z",
      updatedAt: "2026-03-05T00:00:00.000Z",
      inviteToken: "secret-token",
    });
    seedDoc("tenants", "tenant-2", {
      fullName: "Alex Summit",
      email: "alex@example.com",
      phone: "416-555-2000",
      landlordId: "landlord-2",
      propertyId: "prop-2",
      unit: "8B",
      currentLeaseId: "lease-2",
      screeningStatus: "",
      moveInStatus: "pending",
      createdAt: "2026-03-02T00:00:00.000Z",
      updatedAt: "2026-03-06T00:00:00.000Z",
    });
    seedDoc("tenants", "tenant-3", {
      fullName: "Broken Link",
      email: "broken@example.com",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      currentLeaseId: "lease-cross",
      createdAt: "2026-03-03T00:00:00.000Z",
      updatedAt: "2026-03-04T00:00:00.000Z",
    });

    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      unitNumber: "101",
      status: "active",
      leaseStartDate: "2026-01-01",
      leaseEndDate: "2026-12-31",
    });
    seedDoc("leases", "lease-2", {
      landlordId: "landlord-2",
      propertyId: "prop-2",
      unitLabel: "8B",
      status: "pending",
      leaseStartDate: "2026-02-01",
      leaseEndDate: "2027-01-31",
    });
    seedDoc("leases", "lease-cross", {
      landlordId: "landlord-9",
      propertyId: "prop-9",
      unitId: "unit-9",
      status: "active",
    });

    seedDoc("properties", "prop-1", { name: "Coburg Rd" });
    seedDoc("properties", "prop-2", { name: "Summit" });
  });

  it("returns only safe admin tenant view fields", async () => {
    const { listAdminTenants } = await import("../admin/adminTenantView");
    const result = await listAdminTenants({ firestore: fakeDb as any, page: 1, pageSize: 25 });

    expect(result.items[0]).toHaveProperty("id");
    expect(result.items[0]).toHaveProperty("fullName");
    expect(result.items[0]).toHaveProperty("email");
    expect(result.items[0]).toHaveProperty("landlordId");
    expect(result.items[0]).toHaveProperty("propertyId");
    expect(result.items[0]).toHaveProperty("propertyName");
    expect(result.items[0]).toHaveProperty("leaseId");
    expect(result.items[0]).toHaveProperty("leaseStatus");
    expect(result.items[0]).toHaveProperty("screeningStatus");
    expect(result.items[0]).toHaveProperty("moveInStatus");
    expect(result.items[0]).toHaveProperty("flags");
    expect(result.items[0]).not.toHaveProperty("inviteToken");
  });

  it("supports search across tenant and property fields", async () => {
    const { listAdminTenants } = await import("../admin/adminTenantView");

    const byName = await listAdminTenants({ firestore: fakeDb as any, q: "jane", page: 1, pageSize: 25 });
    const byProperty = await listAdminTenants({ firestore: fakeDb as any, q: "summit", page: 1, pageSize: 25 });

    expect(byName.items.map((item) => item.id)).toEqual(["tenant-1"]);
    expect(byProperty.items.map((item) => item.id)).toEqual(["tenant-2"]);
  });

  it("filters by lease, screening, and move-in status", async () => {
    const { listAdminTenants } = await import("../admin/adminTenantView");

    const leaseFiltered = await listAdminTenants({
      firestore: fakeDb as any,
      leaseStatus: "active",
      page: 1,
      pageSize: 25,
    });
    const screeningFiltered = await listAdminTenants({
      firestore: fakeDb as any,
      screeningStatus: "complete",
      page: 1,
      pageSize: 25,
    });
    const moveInFiltered = await listAdminTenants({
      firestore: fakeDb as any,
      moveInStatus: "pending",
      page: 1,
      pageSize: 25,
    });

    expect(leaseFiltered.items.map((item) => item.id)).toEqual(["tenant-1"]);
    expect(screeningFiltered.items.map((item) => item.id)).toEqual(["tenant-1"]);
    expect(moveInFiltered.items.map((item) => item.id)).toEqual(["tenant-2"]);
  });

  it("marks incompatible cross-linked leases as missing lease links", async () => {
    const { listAdminTenants } = await import("../admin/adminTenantView");
    const result = await listAdminTenants({ firestore: fakeDb as any, q: "broken", page: 1, pageSize: 25 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.leaseId).toBeNull();
    expect(result.items[0]?.flags.missingLeaseLink).toBe(true);
  });

  it("supports sort and pagination", async () => {
    const { listAdminTenants } = await import("../admin/adminTenantView");
    const result = await listAdminTenants({
      firestore: fakeDb as any,
      sortBy: "fullName",
      sortDir: "asc",
      page: 2,
      pageSize: 1,
    });

    expect(result.total).toBe(3);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(result.items[0]?.fullName).toBe("Broken Link");
  });
});
