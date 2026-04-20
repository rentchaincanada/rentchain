import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLandlordAnalyticsSnapshot = vi.fn();

vi.mock("../landlordAnalyticsSnapshot", () => ({
  loadLandlordAnalyticsSnapshot,
}));

describe("loadLandlordAnalyticsAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      summary: {
        occupiedUnits: 3,
        vacancyRate: 0.25,
        activeApplications: 0,
        applicationConversionRate: 0.2,
        openWorkOrders: 2,
        maintenanceCostCents: 75000,
        estimatedScheduledRentCents: 540000,
        leasesEndingSoon: 1,
      },
      applications: {
        started: 0,
        submitted: 0,
        approved: 0,
        rejected: 0,
        declined: 0,
        pendingReviewCount: 0,
        conversionRate: 0.2,
      },
      leasing: {
        totalProperties: 1,
        totalUnits: 4,
        occupiedUnits: 3,
        vacantUnits: 1,
        occupancyRate: 0.75,
        leasesEndingIn30Days: 1,
        leasesEndingIn60Days: 1,
        leasesEndingIn90Days: 1,
        turnoverCount: 0,
      },
      maintenance: {
        openWorkOrders: 2,
        completedWorkOrders: 1,
        reopenedWorkOrders: 0,
        maintenanceCostCents: 75000,
        averageCostPerCompletedWorkOrderCents: 75000,
        costConcentrationByProperty: [],
      },
      revenue: {
        estimatedScheduledRentCents: 540000,
        averageRentPerOccupiedUnitCents: 180000,
      },
      insights: [{ type: "maintenance_cost_increase", severity: "medium", message: "Maintenance costs increased compared with the previous period." }],
      comparisons: {
        previousPeriod: {
          vacancyRate: 0.1,
          applicationConversionRate: 0.5,
          applicationsStarted: 2,
          applicationsSubmitted: 2,
          maintenanceCostCents: 20000,
          openWorkOrders: 1,
        },
      },
      properties: [{ id: "prop-1", name: "Alpha" }],
      filters: {
        period: "90d",
        propertyId: "prop-1",
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    });
  });

  it("composes the landlord analytics snapshot into a filtered alerts payload", async () => {
    const { loadLandlordAnalyticsAlerts } = await import("../landlordAnalyticsAlerts");
    const result = await loadLandlordAnalyticsAlerts({
      landlordId: "landlord-1",
      period: "90d",
      propertyId: "prop-1",
      status: "active",
    });

    expect(loadLandlordAnalyticsSnapshot).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      period: "90d",
      propertyId: "prop-1",
      now: undefined,
    });
    expect(result.filters).toEqual({
      period: "90d",
      propertyId: "prop-1",
      status: "active",
    });
    expect(result.alerts.some((alert) => alert.type === "maintenance_cost_spike")).toBe(true);
  });
});
