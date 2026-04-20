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

vi.mock("../../config/firebase", () => ({
  db: dbMock,
}));

describe("adminAnalyticsSnapshot", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("loads a computed admin analytics snapshot from the current Firestore-backed sources", async () => {
    const now = Date.UTC(2026, 3, 20, 12, 0, 0, 0);
    seedDoc("rentalApplications", "app-1", {
      createdAt: now - 2 * 24 * 60 * 60 * 1000,
      submittedAt: now - 2 * 24 * 60 * 60 * 1000,
      approvedAt: now - 1 * 24 * 60 * 60 * 1000,
      status: "approved",
      screeningStatus: "complete",
      screeningPaidAt: now - 1 * 24 * 60 * 60 * 1000,
      screeningCompletedAt: now - 1 * 24 * 60 * 60 * 1000,
    });
    seedDoc("workOrders", "wo-1", {
      propertyId: "prop-1",
      status: "completed",
      serviceCompletedAt: now - 1 * 24 * 60 * 60 * 1000,
      cost: {
        actualCostCents: 8000,
        submittedAt: now - 1 * 24 * 60 * 60 * 1000,
      },
    });
    seedDoc("properties", "prop-1", { name: "Property 1" });
    seedDoc("units", "unit-1", { propertyId: "prop-1", status: "occupied" });
    seedDoc("leases", "lease-1", {
      propertyId: "prop-1",
      status: "active",
      endDate: new Date(now + 15 * 24 * 60 * 60 * 1000).toISOString(),
    });
    seedDoc("events", "event-1", {
      name: "pricing_page_viewed",
      ts: now - 10_000,
      userId: "user-1",
      props: { surface: "pricing_page" },
    });
    seedDoc("canonicalEvents", "canonical-1", {
      id: "canonical-1",
      version: "v1",
      type: "screening.completed",
      domain: "screening",
      action: "completed",
      actor: { type: "system" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
      recordedAt: new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString(),
      visibility: "internal",
      summary: "Completed screening",
      metadata: { applicationId: "app-1" },
    });
    seedDoc("financialTransactions", "txn-1", {
      type: "payment_succeeded",
      amountCents: 4200,
      applicationId: "app-1",
      createdAt: now - 1 * 24 * 60 * 60 * 1000,
    });
    seedDoc("screeningOrders", "order-1", {
      applicationId: "app-1",
      status: "completed",
      paymentStatus: "paid",
      amountTotalCents: 4200,
      updatedAt: now - 1 * 24 * 60 * 60 * 1000,
    });

    const { loadAdminAnalyticsSnapshot } = await import("../admin/adminAnalyticsSnapshot");
    const result = await loadAdminAnalyticsSnapshot({ period: "30d", granularity: "weekly", now });

    expect(result.filters.period).toBe("30d");
    expect(result.filters.granularity).toBe("weekly");
    expect(result.applications.approved).toBe(1);
    expect(result.screening.paid).toBe(1);
    expect(result.screening.totalRevenueCents).toBe(4200);
    expect(result.maintenance.maintenanceCostCents).toBe(8000);
    expect(result.portfolio.occupiedUnits).toBe(1);
    expect(result.activity.trackedEvents).toBe(1);
    expect(result.activity.canonicalEvents).toBe(1);
  });

  it("returns safe empty analytics output when source collections are empty", async () => {
    const now = Date.UTC(2026, 3, 20, 12, 0, 0, 0);
    const { loadAdminAnalyticsSnapshot } = await import("../admin/adminAnalyticsSnapshot");
    const result = await loadAdminAnalyticsSnapshot({ now });

    expect(result.summary).toEqual({
      applicationsStarted: 0,
      applicationsSubmitted: 0,
      applicationConversionRate: null,
      screeningsPaid: 0,
      screeningRevenueCents: 0,
      openWorkOrders: 0,
      maintenanceCostCents: 0,
      occupiedUnits: 0,
      vacancyRate: null,
    });
    expect(result.filters.period).toBe("30d");
    expect(result.filters.granularity).toBe("daily");
  });
});
