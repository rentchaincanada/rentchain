import { beforeEach, describe, expect, it } from "vitest";

const { fakeDb, resetFakeDb, seedDoc } = (() => {
  const store = new Map<string, Map<string, any>>();
  function ensureCollection(name: string) {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  }
  function makeQuery(name: string) {
    return {
      get: async () => {
        const docs = Array.from(ensureCollection(name).values()).map((doc) => ({ id: doc.id, exists: true, data: () => doc.data }));
        return { docs, size: docs.length, empty: docs.length === 0 };
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

describe("adminAuditView", () => {
  beforeEach(() => {
    resetFakeDb();
    seedDoc("adminAuditEvents", "evt-1", {
      category: "adminAction",
      action: "view_properties",
      label: "Viewed properties",
      pageKey: "properties",
      relatedAdminPath: "/admin/properties",
      occurredAt: 1000,
    });
    seedDoc("adminAuditEvents", "evt-2", {
      category: "export",
      action: "export_properties_csv",
      label: "Exported properties CSV",
      exportType: "properties",
      rowCount: 25,
      capped: false,
      occurredAt: 2000,
    });
    seedDoc("adminAuditEvents", "evt-3", {
      category: "integrity",
      action: "integrity_snapshot_viewed",
      label: "Viewed integrity snapshot with 4 issues",
      severity: "high",
      occurredAt: 3000,
      relatedAdminPath: "/admin/integrity",
    });
    seedDoc("adminAuditEvents", "evt-4", {
      category: "savedFilter",
      action: "create",
      label: "Saved filter created for leases",
      pageKey: "leases",
      occurredAt: 4000,
      relatedAdminPath: "/admin/leases",
    });
  });

  it("returns grouped recent audit sections and summary counts", async () => {
    const { loadAdminAudit } = await import("../admin/adminAuditView");
    const result = await loadAdminAudit({ firestore: fakeDb as any });

    expect(result.summary.recentAdminActions).toBe(1);
    expect(result.summary.recentExports).toBe(1);
    expect(result.summary.recentIntegrityEvents).toBe(1);
    expect(result.summary.recentSavedFilterActions).toBe(1);
    expect(result.sections.exports[0]).toEqual(
      expect.objectContaining({
        exportType: "properties",
        rowCount: 25,
      })
    );
  });
});
