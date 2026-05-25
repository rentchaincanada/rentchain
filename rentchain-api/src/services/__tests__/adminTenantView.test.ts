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
      if (op === "array-contains") return Array.isArray(actual) && actual.includes(value);
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
    seedDoc("tenants", "tenant-4", {
      fullName: "Chip Milo",
      email: "chip@example.com",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-coburg-6",
      unitNumber: "unit-coburg-6",
      currentLeaseId: "lease-4",
      screeningStatus: "complete",
      moveInStatus: "ready",
      createdAt: "2026-03-04T00:00:00.000Z",
      updatedAt: "2026-03-07T00:00:00.000Z",
    });
    seedDoc("tenants", "tenant-6", {
      fullName: "Field Unit Tenant",
      email: "field@example.com",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-field-6",
      unitNumber: "unit-field-6",
      currentLeaseId: "lease-6",
      createdAt: "2026-03-04T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z",
    });
    seedDoc("tenants", "tenant-5", {
      fullName: "Chip Milo",
      email: "chip.applicant@example.com",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      applicantStatus: "submitted",
      applicationId: "application-chip",
      createdAt: "2026-03-04T00:00:00.000Z",
      updatedAt: "2026-03-08T00:00:00.000Z",
    });
    seedDoc("tenants", "tenant-live-chip", {
      fullName: "Chip Milo",
      email: "chip.live@example.com",
      tenantId: "chip-user-1",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "a1O2tQcdEZ7t6y3GHT5G",
      unitNumber: "a1O2tQcdEZ7t6y3GHT5G",
      leaseStatus: "active",
      status: "active",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
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
    seedDoc("leases", "lease-4", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-coburg-6",
      unitNumber: "unit-coburg-6",
      status: "active",
      leaseStartDate: "2026-04-01",
      leaseEndDate: "2027-03-31",
    });
    seedDoc("leases", "lease-6", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-field-6",
      unitNumber: "unit-field-6",
      status: "active",
      leaseStartDate: "2026-05-01",
      leaseEndDate: "2027-04-30",
    });
    seedDoc("leases", "ZD2VvH7cCZ7Q8YfVGR55", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "a1O2tQcdEZ7t6y3GHT5G",
      unitNumber: "a1O2tQcdEZ7t6y3GHT5G",
      tenantIds: ["chip-user-1"],
      status: "active",
      startDate: "2026-05-01",
      endDate: "2027-04-30",
    });

    seedDoc("properties", "prop-1", { name: "Coburg Rd" });
    seedDoc("properties", "prop-2", { name: "Summit" });
    seedDoc("units", "unit-doc-coburg-6", { propertyId: "prop-1", unitId: "unit-coburg-6", unitNumber: "6" });
    seedDoc("units", "unit-field-doc-6", { unitId: "unit-field-6", unitNumber: "6" });
    seedDoc("units", "a1O2tQcdEZ7t6y3GHT5G", { propertyId: "prop-1", unitNumber: "6" });
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
    expect(result.items[0]).toHaveProperty("lifecycle");
    expect(result.items[0]).toHaveProperty("flags");
    expect(result.items[0]).not.toHaveProperty("inviteToken");
  });

  it("derives a canonical lifecycle state from linked lease and screening fields", async () => {
    const { listAdminTenants } = await import("../admin/adminTenantView");
    const result = await listAdminTenants({ firestore: fakeDb as any, q: "jane", page: 1, pageSize: 25 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.lifecycle).toMatchObject({
      lifecycleState: "active",
      lifecycleLabel: "Active",
      sourceFields: {
        screeningStatus: "complete",
        leaseStatus: "active",
        occupancyStatus: "ready",
      },
      flags: expect.objectContaining({
        hasActiveLease: true,
        hasCompletedScreening: true,
      }),
    });
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

    expect(leaseFiltered.items.map((item) => item.id)).toEqual(["tenant-live-chip", "tenant-6", "tenant-4", "tenant-1"]);
    expect(screeningFiltered.items.map((item) => item.id)).toEqual(["tenant-4", "tenant-1"]);
    expect(moveInFiltered.items.map((item) => item.id)).toEqual(["tenant-2"]);
  });

  it("marks incompatible cross-linked leases as missing lease links", async () => {
    const { listAdminTenants } = await import("../admin/adminTenantView");
    const result = await listAdminTenants({ firestore: fakeDb as any, q: "broken", page: 1, pageSize: 25 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.leaseId).toBeNull();
    expect(result.items[0]?.flags.missingLeaseLink).toBe(true);
  });

  it("uses linked unit documents when lease and tenant unit fields contain raw unit ids", async () => {
    const { listAdminTenants } = await import("../admin/adminTenantView");
    const result = await listAdminTenants({ firestore: fakeDb as any, q: "chip@example.com", page: 1, pageSize: 25 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      fullName: "Chip Milo",
      propertyName: "Coburg Rd",
      unitNumber: "6",
      leaseId: "lease-4",
      leaseStatus: "active",
      currentLeaseStartDate: "2026-04-01",
      currentLeaseEndDate: "2027-03-31",
    });
  });

  it("uses unitId field lookup when raw unit id does not match the unit document id", async () => {
    const { listAdminTenants } = await import("../admin/adminTenantView");
    const result = await listAdminTenants({ firestore: fakeDb as any, q: "field@example.com", page: 1, pageSize: 25 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      fullName: "Field Unit Tenant",
      propertyName: "Coburg Rd",
      unitNumber: "6",
      leaseId: "lease-6",
      leaseStatus: "active",
    });
  });

  it("reverse-links active leases and resolves raw unit ids when tenant lease pointers are missing", async () => {
    const { listAdminTenants } = await import("../admin/adminTenantView");
    const result = await listAdminTenants({ firestore: fakeDb as any, q: "chip.live@example.com", page: 1, pageSize: 25 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      fullName: "Chip Milo",
      propertyName: "Coburg Rd",
      unitId: "a1O2tQcdEZ7t6y3GHT5G",
      unitNumber: "6",
      leaseId: "ZD2VvH7cCZ7Q8YfVGR55",
      leaseStatus: "active",
      currentLeaseStartDate: "2026-05-01",
      currentLeaseEndDate: "2027-04-30",
    });
  });

  it("does not expose raw unit ids when converted tenant unit references cannot be resolved", async () => {
    seedDoc("tenants", "tenant-alice", {
      fullName: "Alice Wonderland",
      email: "alice@example.com",
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "LP1buUj0kSH6A668slqP",
      unitNumber: "LP1buUj0kSH6A668slqP",
      leaseStatus: "active",
      status: "active",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
    });

    const { listAdminTenants } = await import("../admin/adminTenantView");
    const result = await listAdminTenants({ firestore: fakeDb as any, q: "alice", page: 1, pageSize: 25 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      fullName: "Alice Wonderland",
      unitId: "LP1buUj0kSH6A668slqP",
      unitNumber: null,
      leaseStatus: "active",
      currentLeaseStartDate: null,
      currentLeaseEndDate: null,
    });
  });

  it("keeps legitimate applicant and active tenant workspaces distinct for the same person", async () => {
    const { listAdminTenants } = await import("../admin/adminTenantView");
    const result = await listAdminTenants({ firestore: fakeDb as any, q: "chip milo", sortBy: "createdAt", sortDir: "asc", page: 1, pageSize: 25 });

    expect(result.items).toHaveLength(3);
    expect(result.items.map((item) => item.id).sort()).toEqual(["tenant-4", "tenant-5", "tenant-live-chip"]);
    expect(result.items.find((item) => item.id === "tenant-4")?.lifecycle.lifecycleState).toBe("active");
    expect(result.items.find((item) => item.id === "tenant-5")?.lifecycle.lifecycleState).toBe("applicant");
    expect(result.items.find((item) => item.id === "tenant-live-chip")?.lifecycle.lifecycleState).toBe("active");
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

    expect(result.total).toBe(7);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(1);
    expect(result.hasMore).toBe(true);
    expect(result.items[0]?.fullName).toBe("Broken Link");
  });
});
