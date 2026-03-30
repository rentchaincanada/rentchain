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

function seedUnit(id: string, data: Record<string, unknown> = {}) {
  seedDoc("units", id, {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitNumber: id === "unit-1" ? "1" : "3",
    label: id === "unit-1" ? "Unit 1" : "Unit 3",
    ...data,
  });
}

function seedLease(id: string, data: Record<string, unknown> = {}) {
  seedDoc("leases", id, {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    unitNumber: "1",
    status: "active",
    monthlyRent: 1800,
    currentRent: 1800,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    tenantId: "tenant-1",
    tenantIds: ["tenant-1"],
    ...data,
  });
}

function seedTenant(id = "tenant-1", data: Record<string, unknown> = {}) {
  seedDoc("tenants", id, {
    landlordId: "landlord-1",
    propertyId: "prop-1",
    unitId: "unit-1",
    unitNumber: "1",
    currentLeaseId: "lease-bad",
    ...data,
  });
}

describe("leasePointerCorrectionService", () => {
  beforeEach(() => {
    resetFakeDb();
    seedProperty();
    seedUnit("unit-1");
    seedUnit("unit-3");
  });

  it("identifies a stale tenant currentLeaseId pointing to the wrong unit", async () => {
    seedLease("lease-good", { unitId: "unit-1", unitNumber: "1" });
    seedLease("lease-bad", { unitId: "unit-3", unitNumber: "3", tenantIds: ["tenant-9"], tenantId: "tenant-9" });
    seedTenant("tenant-1", { currentLeaseId: "lease-bad", unitId: "unit-1", unitNumber: "1" });

    const { listTenantLeasePointerConflicts } = await import("../leaseAudit/leasePointerCorrectionService");
    const conflicts = await listTenantLeasePointerConflicts({ firestore: fakeDb as any });

    expect(conflicts).toEqual([
      expect.objectContaining({
        tenantId: "tenant-1",
        currentLeaseId: "lease-bad",
        currentLeaseUnitId: "unit-3",
        tenantUnitId: "unit-1",
        suggestedLeaseId: "lease-good",
      }),
    ]);
  });

  it("previews the currentLeaseId change from wrong-unit lease to selected candidate", async () => {
    seedLease("lease-good", { unitId: "unit-1", unitNumber: "1" });
    seedLease("lease-bad", { unitId: "unit-3", unitNumber: "3", tenantIds: ["tenant-9"], tenantId: "tenant-9" });
    seedTenant("tenant-1", { currentLeaseId: "lease-bad", unitId: "unit-1", unitNumber: "1" });

    const { previewTenantLeasePointerCorrection } = await import("../leaseAudit/leasePointerCorrectionService");
    const preview = await previewTenantLeasePointerCorrection({
      firestore: fakeDb as any,
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      toCurrentLeaseId: "lease-good",
      dryRun: true,
    });

    expect(preview.fromCurrentLeaseId).toBe("lease-bad");
    expect(preview.toCurrentLeaseId).toBe("lease-good");
    expect(preview.conflict.candidateLeases.map((candidate) => candidate.leaseId)).toContain("lease-good");
  });

  it("applies the currentLeaseId update and writes an audit log", async () => {
    seedLease("lease-good", { unitId: "unit-1", unitNumber: "1" });
    seedLease("lease-bad", { unitId: "unit-3", unitNumber: "3", tenantIds: ["tenant-9"], tenantId: "tenant-9" });
    seedTenant("tenant-1", { currentLeaseId: "lease-bad", unitId: "unit-1", unitNumber: "1" });

    const { applyTenantLeasePointerCorrection } = await import("../leaseAudit/leasePointerCorrectionService");
    const result = await applyTenantLeasePointerCorrection({
      firestore: fakeDb as any,
      landlordId: "landlord-1",
      propertyId: "prop-1",
      tenantId: "tenant-1",
      toCurrentLeaseId: "lease-good",
      actorUserId: "admin-1",
    });

    expect(result.applied).toBe(true);
    expect((await fakeDb.collection("tenants").doc("tenant-1").get()).data()?.currentLeaseId).toBe("lease-good");
    const log = await fakeDb.collection("tenantLeasePointerCorrectionLogs").doc(result.resolutionLogId).get();
    expect(log.exists).toBe(true);
    expect(log.data()?.actorUserId).toBe("admin-1");
  });

  it("rejects attempts to point a tenant at a lease from another property or landlord", async () => {
    seedLease("lease-good", { unitId: "unit-1", unitNumber: "1" });
    seedLease("lease-bad", { unitId: "unit-3", unitNumber: "3", tenantIds: ["tenant-9"], tenantId: "tenant-9" });
    seedDoc("leases", "lease-foreign", {
      landlordId: "landlord-9",
      propertyId: "prop-9",
      unitId: "unit-1",
      unitNumber: "1",
      status: "active",
      tenantIds: ["tenant-1"],
    });
    seedTenant("tenant-1", { currentLeaseId: "lease-bad", unitId: "unit-1", unitNumber: "1" });

    const { previewTenantLeasePointerCorrection } = await import("../leaseAudit/leasePointerCorrectionService");
    await expect(
      previewTenantLeasePointerCorrection({
        firestore: fakeDb as any,
        landlordId: "landlord-1",
        propertyId: "prop-1",
        tenantId: "tenant-1",
        toCurrentLeaseId: "lease-foreign",
        dryRun: true,
      })
    ).rejects.toThrow("pointer_correction_candidate_invalid");
  });
});
