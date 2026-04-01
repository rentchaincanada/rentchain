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
        return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn: any) => docs.forEach(fn) };
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

vi.mock("../leaseIntegrityService", () => ({
  loadPropertyLeaseIntegrityDiagnostics: vi.fn(async (propertyId: string) => {
    if (propertyId === "prop-1") {
      return {
        issues: [
          { issueType: "duplicate_active_agreement_overlap" },
          { issueType: "unit_status_mismatch" },
        ],
      };
    }
    return { issues: [] };
  }),
  reportTenantPointerIssues: vi.fn(async (propertyId: string) => {
    if (propertyId === "prop-1") {
      return [{ issueType: "tenant_stale_currentLeaseId" }];
    }
    return [];
  }),
}));

describe("adminOverviewView", () => {
  beforeEach(() => {
    resetFakeDb();
    seedDoc("properties", "prop-1", { ownerUserId: "owner-1", landlordId: "landlord-1" });
    seedDoc("properties", "prop-2", { ownerUserId: "", landlordId: "" });
    seedDoc("units", "unit-1", { propertyId: "prop-1" });
    seedDoc("units", "unit-2", { propertyId: "prop-2" });
    seedDoc("tenants", "tenant-1", { landlordId: "landlord-1" });
    seedDoc("tenants", "tenant-2", { landlordId: "landlord-2" });
    seedDoc("leases", "lease-1", { status: "active", propertyId: "prop-1" });
    seedDoc("leases", "lease-2", { status: "inactive", propertyId: "prop-2" });
    seedDoc("telemetry_events", "event-1", {
      actor: "admin",
      type: "admin_overview_opened",
      ts: 1000,
    });
    seedDoc("telemetry_events", "event-2", {
      role: "admin",
      eventName: "admin_properties_opened",
      createdAt: 2000,
    });
    seedDoc("telemetry_events", "event-3", {
      role: "landlord",
      eventName: "nudge_clicked",
      createdAt: 3000,
    });
  });

  it("returns safe aggregate overview counts and integrity snapshot", async () => {
    const { loadAdminOverview } = await import("../admin/adminOverviewView");
    const result = await loadAdminOverview({ firestore: fakeDb as any });

    expect(result.summary.totalProperties).toBe(2);
    expect(result.summary.totalUnits).toBe(2);
    expect(result.summary.totalTenants).toBe(2);
    expect(result.summary.totalLeases).toBe(2);
    expect(result.summary.activeLeases).toBe(1);
    expect(result.integrity.orphanProperties).toBe(1);
    expect(result.integrity.missingOwnerLinks).toBe(1);
    expect(result.integrity.duplicateActiveLeases).toBe(1);
    expect(result.integrity.staleLeasePointers).toBe(1);
    expect(result.integrity.propertyUnitMismatches).toBe(1);
  });

  it("returns admin-only recent activity summary without raw docs", async () => {
    const { loadAdminOverview } = await import("../admin/adminOverviewView");
    const result = await loadAdminOverview({ firestore: fakeDb as any });

    expect(result.activity.recentAdminAccessCount).toBe(2);
    expect(result.activity.recentHighImpactEvents).toHaveLength(2);
    expect(result.activity.recentHighImpactEvents[0]).toEqual(
      expect.objectContaining({
        key: expect.any(String),
        label: expect.any(String),
        ts: expect.anything(),
      })
    );
  });
});
