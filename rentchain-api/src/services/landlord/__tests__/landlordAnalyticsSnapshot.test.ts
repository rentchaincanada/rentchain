import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        get: async () => {
          const docs = Array.from(ensureCollection(name).values()).map((entry) => ({
            id: entry.id,
            data: () => entry.data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
    resetDb: () => {
      collections.clear();
    },
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
  };
});

vi.mock("../../../config/firebase", () => ({
  db: dbMock,
}));

describe("loadLandlordAnalyticsSnapshot", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("returns only landlord-scoped analytics and respects property filters", async () => {
    const now = Date.UTC(2026, 3, 20, 12, 0, 0, 0);

    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Alpha" });
    seedDoc("properties", "prop-2", { landlordId: "landlord-1", name: "Beta" });
    seedDoc("properties", "prop-3", { landlordId: "landlord-2", name: "Gamma" });

    seedDoc("units", "unit-1", { landlordId: "landlord-1", propertyId: "prop-1", status: "occupied" });
    seedDoc("units", "unit-2", { landlordId: "landlord-1", propertyId: "prop-2", status: "vacant" });
    seedDoc("units", "unit-3", { landlordId: "landlord-2", propertyId: "prop-3", status: "occupied" });

    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      status: "active",
      endDate: new Date(now + 25 * 24 * 60 * 60 * 1000).toISOString(),
      monthlyRent: 1650,
    });

    seedDoc("rentalApplications", "app-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      createdAt: now - 3 * 24 * 60 * 60 * 1000,
      submittedAt: now - 3 * 24 * 60 * 60 * 1000,
      status: "in_review",
    });
    seedDoc("rentalApplications", "app-2", {
      landlordId: "landlord-2",
      propertyId: "prop-3",
      createdAt: now - 3 * 24 * 60 * 60 * 1000,
      submittedAt: now - 3 * 24 * 60 * 60 * 1000,
      status: "approved",
      approvedAt: now - 2 * 24 * 60 * 60 * 1000,
    });

    seedDoc("workOrders", "wo-1", {
      landlordId: "landlord-1",
      propertyId: "prop-2",
      status: "completed",
      serviceCompletedAt: now - 1 * 24 * 60 * 60 * 1000,
      cost: { actualCostCents: 8200, submittedAt: now - 1 * 24 * 60 * 60 * 1000 },
    });
    seedDoc("workOrders", "wo-2", {
      landlordId: "landlord-2",
      propertyId: "prop-3",
      status: "open",
      createdAt: now - 1 * 24 * 60 * 60 * 1000,
    });

    const { loadLandlordAnalyticsSnapshot } = await import("../landlordAnalyticsSnapshot");

    const scoped = await loadLandlordAnalyticsSnapshot({
      landlordId: "landlord-1",
      propertyId: "prop-1",
      period: "90d",
      now,
    });

    expect(scoped.filters.propertyId).toBe("prop-1");
    expect(scoped.leasing.totalProperties).toBe(1);
    expect(scoped.leasing.totalUnits).toBe(1);
    expect(scoped.summary.occupiedUnits).toBe(1);
    expect(scoped.summary.maintenanceCostCents).toBe(0);
    expect(scoped.summary.estimatedScheduledRentCents).toBe(165000);
    expect(scoped.summary.activeApplications).toBe(1);
    expect(scoped.propertyMetrics).toEqual([
      expect.objectContaining({
        propertyId: "prop-1",
        metrics: expect.objectContaining({
          totalUnits: 1,
          occupiedUnits: 1,
          estimatedScheduledRentCents: 165000,
        }),
      }),
    ]);
  });

  it("returns a stable empty payload when a landlord has no analytics data", async () => {
    const now = Date.UTC(2026, 3, 20, 12, 0, 0, 0);
    const { loadLandlordAnalyticsSnapshot } = await import("../landlordAnalyticsSnapshot");
    const result = await loadLandlordAnalyticsSnapshot({
      landlordId: "landlord-1",
      now,
    });

    expect(result.summary.occupiedUnits).toBe(0);
    expect(result.summary.maintenanceCostCents).toBe(0);
    expect(result.insights).toEqual([]);
    expect(result.propertyMetrics).toEqual([]);
  });
});
