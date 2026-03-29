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
    resetFakeDb: () => store.clear(),
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        get: async () => makeQuery(name).get(),
        doc: (id: string) => makeQuery(name).doc(id),
      }),
    },
  };
})();

function seedProperty(id: string, data: Record<string, unknown> = {}) {
  seedDoc("properties", id, {
    landlordId: "landlord-1",
    name: "Test Property",
    ...data,
  });
}

function seedUnit(id: string, data: Record<string, unknown> = {}) {
  seedDoc("units", id, {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitNumber: "A",
    label: "Unit A",
    ...data,
  });
}

function seedLease(id: string, data: Record<string, unknown> = {}) {
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
    tenantId: `${id}-tenant`,
    tenantIds: [`${id}-tenant`],
    ...data,
  });
}

function seedTenant(id: string, data: Record<string, unknown> = {}) {
  seedDoc("tenants", id, {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    ...data,
  });
}

describe("leaseOverlapAuditService", () => {
  beforeEach(() => {
    resetFakeDb();
    seedProperty("prop-1");
    seedUnit("unit-1");
  });

  it("flags multiple current leases on the same unitId", async () => {
    seedLease("lease-1", { tenantId: "tenant-1", tenantIds: ["tenant-1"] });
    seedLease("lease-2", { tenantId: "tenant-2", tenantIds: ["tenant-2"], updatedAt: 2 });

    const { generateLeaseOverlapAuditReport } = await import("../leaseAudit/leaseOverlapAuditService");
    const report = await generateLeaseOverlapAuditReport({ firestore: fakeDb as any });

    expect(report.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          overlapType: "duplicate_current_same_unitId",
          leaseIds: expect.arrayContaining(["lease-1", "lease-2"]),
        }),
      ])
    );
  });

  it("flags duplicate current leases on the same logical unit when aliases differ", async () => {
    seedLease("lease-1", { unitId: "UNIT_A", unitNumber: "Unit A", tenantId: "tenant-1", tenantIds: ["tenant-1"] });
    seedLease("lease-2", { unitId: "A", unitNumber: "A", tenantId: "tenant-2", tenantIds: ["tenant-2"] });

    const { generateLeaseOverlapAuditReport } = await import("../leaseAudit/leaseOverlapAuditService");
    const report = await generateLeaseOverlapAuditReport({ firestore: fakeDb as any });

    expect(report.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          overlapType: "duplicate_current_same_logical_unit",
          leaseIds: expect.arrayContaining(["lease-1", "lease-2"]),
        }),
      ])
    );
  });

  it("flags overlapping date ranges on the same unit", async () => {
    seedLease("lease-1", { startDate: "2026-01-01", endDate: "2026-06-30", tenantId: "tenant-1", tenantIds: ["tenant-1"] });
    seedLease("lease-2", { startDate: "2026-06-15", endDate: "2026-12-31", tenantId: "tenant-2", tenantIds: ["tenant-2"] });

    const { generateLeaseOverlapAuditReport } = await import("../leaseAudit/leaseOverlapAuditService");
    const report = await generateLeaseOverlapAuditReport({ firestore: fakeDb as any });

    expect(report.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          overlapType: "overlapping_dates_same_unit",
          leaseIds: expect.arrayContaining(["lease-1", "lease-2"]),
        }),
      ])
    );
  });

  it("flags property/unit mismatches when a lease unitId points to another property's unit", async () => {
    seedDoc("units", "foreign-unit", {
      landlordId: "landlord-9",
      propertyId: "prop-9",
      unitNumber: "Z9",
      label: "Unit Z9",
    });
    seedLease("lease-1", { unitId: "foreign-unit", unitNumber: "foreign-unit", tenantId: "tenant-1", tenantIds: ["tenant-1"] });

    const { generateLeaseOverlapAuditReport } = await import("../leaseAudit/leaseOverlapAuditService");
    const report = await generateLeaseOverlapAuditReport({ firestore: fakeDb as any });

    expect(report.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          overlapType: "property_unit_mismatch",
          unitId: "foreign-unit",
          leaseIds: ["lease-1"],
        }),
      ])
    );
  });

  it("flags stale pointer conflicts", async () => {
    seedLease("lease-1", { tenantId: "tenant-1", tenantIds: ["tenant-1"] });
    seedTenant("tenant-1", { currentLeaseId: "stale-lease" });

    const { generateLeaseOverlapAuditReport } = await import("../leaseAudit/leaseOverlapAuditService");
    const report = await generateLeaseOverlapAuditReport({ firestore: fakeDb as any });

    expect(report.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          overlapType: "stale_pointer_conflict",
          leaseIds: expect.arrayContaining(["stale-lease", "lease-1"]),
        }),
      ])
    );
  });

  it("does not flag unrelated valid leases on separate units", async () => {
    seedUnit("unit-2", { unitNumber: "B", label: "Unit B" });
    seedLease("lease-1", { unitId: "unit-1", unitNumber: "A", tenantId: "tenant-1", tenantIds: ["tenant-1"] });
    seedLease("lease-2", { unitId: "unit-2", unitNumber: "B", tenantId: "tenant-2", tenantIds: ["tenant-2"] });

    const { generateLeaseOverlapAuditReport } = await import("../leaseAudit/leaseOverlapAuditService");
    const report = await generateLeaseOverlapAuditReport({ firestore: fakeDb as any });

    expect(report.groups).toEqual([]);
  });
});
