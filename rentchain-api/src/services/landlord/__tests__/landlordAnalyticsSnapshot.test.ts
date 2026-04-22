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
    seedDoc("landlordDecisionStates", "landlord-1__review_lease_renewals:prop-1", {
      landlordId: "landlord-1",
      decisionId: "review_lease_renewals:prop-1",
      state: "reviewed",
      reviewedAt: "2026-04-20T12:00:00.000Z",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    });
    seedDoc("landlordDecisionStates", "landlord-1__reduce_vacancy_risk:prop-1", {
      landlordId: "landlord-1",
      decisionId: "reduce_vacancy_risk:prop-1",
      state: "snoozed",
      snoozedAt: "2026-04-20T12:00:00.000Z",
      snoozedUntil: "2026-04-28T12:00:00.000Z",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
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
    expect(scoped.comparisons.deltas.summary.estimatedScheduledRentCents.direction).toBe("flat");
    expect(scoped.comparisons.deltas.summary.activeApplications.direction).toBe("flat");
    expect(scoped.predictive.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "projected_vacancy_risk",
          status: "supported",
        }),
      ])
    );
    expect(scoped.decisions.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "review_lease_renewals:prop-1",
          decisionType: "review_lease_renewals",
          recommendedAction: "Review renewals",
          state: "reviewed",
          reviewedAt: "2026-04-20T12:00:00.000Z",
          actionKey: "open_lease_renewals_flow",
          actionLabel: "Open renewals focus",
          destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
          workflowCategory: "lease_renewals",
          automationEligible: false,
          automationState: "blocked",
          automationReason: expect.stringContaining("Reviewed decisions stay manual"),
        }),
      ])
    );
    expect(scoped.decisions.items.find((decision) => decision.id === "reduce_vacancy_risk:prop-1")).toBeUndefined();
    expect(scoped.propertyMetrics).toEqual([
      expect.objectContaining({
        propertyId: "prop-1",
        metrics: expect.objectContaining({
          totalUnits: 1,
          occupiedUnits: 1,
          estimatedScheduledRentCents: 165000,
        }),
        deltas: expect.objectContaining({
          occupiedUnits: expect.objectContaining({
            direction: "flat",
          }),
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
    expect(result.predictive.metrics.every((metric) => metric.status === "insufficient_data")).toBe(true);
    expect(result.decisions.items).toEqual([]);
    expect(result.propertyMetrics).toEqual([]);
    expect(result.comparisons.deltas.summary.maintenanceCostCents.direction).toBe("flat");
  });
});
