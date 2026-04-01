import { beforeEach, describe, expect, it, vi } from "vitest";

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
        return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn: any) => docs.forEach(fn) };
      },
      doc: (id: string) => ({
        get: async () => {
          const doc = ensureCollection(name).get(id);
          return { id, exists: !!doc, data: () => doc?.data };
        },
      }),
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

vi.mock("../leaseIntegrityService", () => ({
  loadPropertyLeaseIntegrityDiagnostics: vi.fn(async (propertyId: string) => {
    if (propertyId === "prop-1") {
      return {
        issues: [
          {
            issueType: "duplicate_active_agreement_overlap",
            relatedLeaseIds: ["lease-1", "lease-2"],
            relatedTenantIds: ["tenant-1"],
            unitId: "unit-1",
          },
          {
            issueType: "unit_status_mismatch",
            relatedLeaseIds: ["lease-3"],
            relatedTenantIds: ["tenant-2"],
            unitId: "unit-2",
          },
        ],
      };
    }
    return { issues: [] };
  }),
  reportTenantPointerIssues: vi.fn(async (propertyId: string) => {
    if (propertyId === "prop-1") {
      return [
        {
          issueType: "tenant_stale_currentLeaseId",
          relatedLeaseIds: ["lease-old", "lease-new"],
          relatedTenantIds: ["tenant-3"],
        },
      ];
    }
    return [];
  }),
}));

describe("adminIntegrityView", () => {
  beforeEach(() => {
    resetFakeDb();
    seedDoc("properties", "prop-1", { ownerUserId: "owner-1", landlordId: "landlord-1", name: "Coburg Rd" });
    seedDoc("properties", "prop-2", { ownerUserId: "", landlordId: "", name: "Orphan House" });
  });

  it("returns grouped integrity sections with bounded safe samples", async () => {
    const { loadAdminIntegrity } = await import("../admin/adminIntegrityView");
    const result = await loadAdminIntegrity({ firestore: fakeDb as any });

    expect(result.totals.issueTypes).toBe(5);
    expect(result.totals.totalIssues).toBe(5);
    expect(result.totals.highSeverity).toBe(3);
    expect(result.totals.mediumSeverity).toBe(2);

    const orphan = result.sections.find((section) => section.key === "orphan_properties");
    expect(orphan?.count).toBe(1);
    expect(orphan?.samples[0]).toEqual(
      expect.objectContaining({
        type: "property",
        propertyId: "prop-2",
        relatedAdminPath: expect.stringContaining("/admin/properties"),
      })
    );

    const duplicate = result.sections.find((section) => section.key === "duplicate_active_leases");
    expect(duplicate?.count).toBe(1);
    expect(duplicate?.samples[0]).toEqual(
      expect.objectContaining({
        type: "lease",
        leaseId: "lease-1",
        tenantId: "tenant-1",
        relatedAdminPath: expect.stringContaining("/admin/leases"),
      })
    );
  });

  it("returns zero counts cleanly when no integrity issues are present", async () => {
    resetFakeDb();
    seedDoc("properties", "prop-healthy", { ownerUserId: "owner-1", landlordId: "landlord-1", name: "Healthy House" });

    const { loadAdminIntegrity } = await import("../admin/adminIntegrityView");
    const result = await loadAdminIntegrity({ firestore: fakeDb as any });

    expect(result.totals.totalIssues).toBe(0);
    expect(result.sections.every((section) => section.count === 0)).toBe(true);
    expect(result.sections.every((section) => section.samples.length === 0)).toBe(true);
  });
});
