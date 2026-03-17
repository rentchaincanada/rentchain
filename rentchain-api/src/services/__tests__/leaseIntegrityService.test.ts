import { beforeEach, describe, expect, it, vi } from "vitest";

const { fakeDb, resetFakeDb, seedDoc } = vi.hoisted(() => {
  const store = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }

  function matches(doc: any, filters: Array<{ field: string; op: string; value: any }>) {
    return filters.every(({ field, op, value }) => {
      const actual = doc?.data?.[field];
      if (op === "==") return actual === value;
      if (op === "array-contains") return Array.isArray(actual) && actual.includes(value);
      return false;
    });
  }

  function makeQuery(name: string, filters: Array<{ field: string; op: string; value: any }> = []) {
    return {
      where: (field: string, op: string, value: any) => makeQuery(name, [...filters, { field, op, value }]),
      get: async () => {
        const docs = Array.from(ensureCollection(name).values())
          .filter((doc) => matches(doc, filters))
          .map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, empty: docs.length === 0, size: docs.length, forEach: (fn: any) => docs.forEach(fn) };
      },
      doc: (id: string) => ({
        get: async () => {
          const entry = ensureCollection(name).get(id);
          return { id, exists: Boolean(entry), data: () => entry?.data };
        },
      }),
    };
  }

  return {
    resetFakeDb: () => {
      store.clear();
    },
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        get: async () => makeQuery(name).get(),
        doc: (id: string) => makeQuery(name).doc(id),
      }),
    },
  };
});

vi.mock("../../config/firebase", () => ({
  db: fakeDb,
}));

describe("leaseIntegrityService tenant currentLeaseId diagnostics", () => {
  beforeEach(() => {
    resetFakeDb();
  });

  function seedUnit(id: string, data: Record<string, unknown>) {
    seedDoc("units", id, {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      ...data,
    });
  }

  function seedLease(id: string, data: Record<string, unknown>) {
    seedDoc("leases", id, {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      unitNumber: "A",
      status: "active",
      monthlyRent: 1800,
      currentRent: 1800,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      createdAt: 1,
      updatedAt: 1,
      ...data,
    });
  }

  function seedTenant(id: string, data: Record<string, unknown>) {
    seedDoc("tenants", id, {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      ...data,
    });
  }

  it("emits tenant_missing_currentLeaseId when one active canonical agreement exists", async () => {
    seedUnit("unit-1", { unitNumber: "A", status: "occupied" });
    seedLease("lease-1", { tenantId: "tenant-1", tenantIds: ["tenant-1"] });
    seedTenant("tenant-1", { currentLeaseId: null });

    const mod = await import("../leaseIntegrityService");
    const issues = await mod.reportTenantPointerIssues("prop-1", "landlord-1", fakeDb as any);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueType: "tenant_missing_currentLeaseId",
          relatedLeaseIds: ["lease-1"],
          relatedTenantIds: ["tenant-1"],
        }),
      ])
    );
  });

  it("emits tenant_stale_currentLeaseId when the stored pointer is stale", async () => {
    seedUnit("unit-1", { unitNumber: "A", status: "occupied" });
    seedLease("lease-1", { tenantId: "tenant-2", tenantIds: ["tenant-2"] });
    seedTenant("tenant-2", { currentLeaseId: "stale-lease" });

    const mod = await import("../leaseIntegrityService");
    const issues = await mod.reportTenantPointerIssues("prop-1", "landlord-1", fakeDb as any);

    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueType: "tenant_stale_currentLeaseId",
          relatedLeaseIds: expect.arrayContaining(["stale-lease", "lease-1"]),
          relatedTenantIds: ["tenant-2"],
        }),
      ])
    );
  });

  it("does not downgrade ambiguous overlapping agreements into a single-winner fallback", async () => {
    seedUnit("unit-1", { unitNumber: "A", status: "occupied" });
    seedLease("lease-1", {
      tenantId: "tenant-3",
      tenantIds: ["tenant-3"],
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      createdAt: 1,
    });
    seedLease("lease-2", {
      tenantId: "tenant-3",
      tenantIds: ["tenant-3"],
      startDate: "2026-06-15",
      endDate: "2026-12-31",
      createdAt: 2,
    });

    const mod = await import("../leaseIntegrityService");
    const resolved = await mod.resolveTenantCurrentLeasePointer("tenant-3", "prop-1", "landlord-1", fakeDb as any);

    expect(resolved).toEqual({
      leaseId: "lease-1",
      stale: false,
      ambiguous: true,
    });
  });
});
