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
      doc: (id?: string) => {
        const resolvedId = id || `${name}-${ensureCollection(name).size + 1}`;
        return {
          id: resolvedId,
          get: async () => {
            const entry = ensureCollection(name).get(resolvedId);
            return { id: resolvedId, exists: Boolean(entry), data: () => entry?.data };
          },
          set: async (data: any, opts?: { merge?: boolean }) => {
            const prev = ensureCollection(name).get(resolvedId)?.data || {};
            ensureCollection(name).set(resolvedId, {
              id: resolvedId,
              data: opts?.merge ? { ...prev, ...data } : data,
            });
          },
        };
      },
    };
  }

  return {
    resetFakeDb: () => store.clear(),
    seedDoc: (name: string, id: string, data: any) => ensureCollection(name).set(id, { id, data }),
    fakeDb: {
      collection: (name: string) => ({
        where: (field: string, op: string, value: any) => makeQuery(name, [{ field, op, value }]),
        get: async () => makeQuery(name).get(),
        doc: (id?: string) => makeQuery(name).doc(id),
      }),
    },
  };
})();

function seedProperty(id = "prop-1") {
  seedDoc("properties", id, { landlordId: "landlord-1", name: "Test Property" });
}

function seedUnit(id = "unit-1") {
  seedDoc("units", id, {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitNumber: "A",
    label: "Unit A",
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
    currentLeaseId: null,
    ...data,
  });
}

describe("leaseOverlapCleanupService", () => {
  beforeEach(() => {
    resetFakeDb();
    seedProperty();
    seedUnit();
  });

  it("previews explicit lease status and pointer changes without mutating leases", async () => {
    seedLease("lease-1", { tenantId: "tenant-1", tenantIds: ["tenant-1"] });
    seedLease("lease-2", { tenantId: "tenant-2", tenantIds: ["tenant-2"] });
    seedTenant("tenant-1", { currentLeaseId: "lease-2" });
    seedTenant("tenant-2", { currentLeaseId: "lease-2" });

    const { previewLeaseOverlapCleanup } = await import("../leaseAudit/leaseOverlapCleanupService");
    const preview = await previewLeaseOverlapCleanup({
      firestore: fakeDb as any,
      landlordId: "landlord-1",
      propertyId: "prop-1",
      canonicalLeaseId: "lease-1",
      overlapLeaseIds: ["lease-1", "lease-2"],
      dryRun: true,
    });

    expect(preview.leaseChanges).toEqual([
      { leaseId: "lease-2", fromStatus: "active", toStatus: "superseded" },
    ]);
    expect(preview.tenantChanges).toEqual(
      expect.arrayContaining([
        { tenantId: "tenant-1", fromCurrentLeaseId: "lease-2", toCurrentLeaseId: "lease-1" },
        { tenantId: "tenant-2", fromCurrentLeaseId: "lease-2", toCurrentLeaseId: null },
      ])
    );
    const loserLease = await fakeDb.collection("leases").doc("lease-2").get();
    expect(loserLease.data()?.status).toBe("active");
  });

  it("applies only the explicit lease status and currentLeaseId changes", async () => {
    seedLease("lease-1", { tenantId: "tenant-1", tenantIds: ["tenant-1"] });
    seedLease("lease-2", { tenantId: "tenant-1", tenantIds: ["tenant-1"] });
    seedTenant("tenant-1", { currentLeaseId: "lease-2" });

    const { applyLeaseOverlapCleanup } = await import("../leaseAudit/leaseOverlapCleanupService");
    const result = await applyLeaseOverlapCleanup({
      firestore: fakeDb as any,
      landlordId: "landlord-1",
      propertyId: "prop-1",
      canonicalLeaseId: "lease-1",
      overlapLeaseIds: ["lease-1", "lease-2"],
      actorUserId: "admin-1",
      dryRun: false,
    });

    expect(result.applied).toBe(true);
    expect((await fakeDb.collection("leases").doc("lease-2").get()).data()?.status).toBe("superseded");
    expect((await fakeDb.collection("tenants").doc("tenant-1").get()).data()?.currentLeaseId).toBe("lease-1");
    const log = await fakeDb.collection("leaseOverlapResolutionLogs").doc(result.resolutionLogId).get();
    expect(log.exists).toBe(true);
    expect(log.data()?.actorUserId).toBe("admin-1");
  });

  it("rejects groups that cross logical units", async () => {
    seedDoc("units", "unit-2", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "B",
      label: "Unit B",
    });
    seedLease("lease-1", { unitId: "unit-1", unitNumber: "A", tenantId: "tenant-1", tenantIds: ["tenant-1"] });
    seedLease("lease-2", { unitId: "unit-2", unitNumber: "B", tenantId: "tenant-2", tenantIds: ["tenant-2"] });

    const { previewLeaseOverlapCleanup } = await import("../leaseAudit/leaseOverlapCleanupService");
    await expect(
      previewLeaseOverlapCleanup({
        firestore: fakeDb as any,
        landlordId: "landlord-1",
        propertyId: "prop-1",
        canonicalLeaseId: "lease-1",
        overlapLeaseIds: ["lease-1", "lease-2"],
        dryRun: true,
      })
    ).rejects.toThrow("cleanup_group_logical_unit_mismatch");
  });
});
