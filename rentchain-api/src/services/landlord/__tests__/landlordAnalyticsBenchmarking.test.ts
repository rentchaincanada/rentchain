import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLandlordAnalyticsSnapshot = vi.fn();

vi.mock("../landlordAnalyticsSnapshot", () => ({
  loadLandlordAnalyticsSnapshot,
}));

describe("loadLandlordAnalyticsBenchmarking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses the landlord analytics snapshot and preserves portfolio-wide comparisons for property filters", async () => {
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      summary: {
        occupiedUnits: 3,
        vacancyRate: 0.25,
        activeApplications: 1,
        applicationConversionRate: 0.5,
        openWorkOrders: 2,
        maintenanceCostCents: 60000,
        estimatedScheduledRentCents: 450000,
        leasesEndingSoon: 1,
      },
      applications: {
        started: 2,
        submitted: 2,
        approved: 1,
        rejected: 0,
        declined: 0,
        pendingReviewCount: 1,
        conversionRate: 0.5,
      },
      leasing: {
        totalProperties: 2,
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
        maintenanceCostCents: 60000,
        averageCostPerCompletedWorkOrderCents: 60000,
        costConcentrationByProperty: [],
      },
      revenue: {
        estimatedScheduledRentCents: 450000,
        averageRentPerOccupiedUnitCents: 150000,
      },
      decisions: { items: [] },
      insights: [],
      comparisons: {
        previousPeriod: {
          summary: {
            occupiedUnits: 2,
            vacancyRate: 0.1,
            activeApplications: 1,
            applicationConversionRate: 0.4,
            openWorkOrders: 1,
            maintenanceCostCents: 20000,
            estimatedScheduledRentCents: 420000,
            leasesEndingSoon: 0,
          },
          applications: {
            started: 1,
            submitted: 1,
            approved: 0,
            rejected: 0,
            declined: 0,
            pendingReviewCount: 1,
            conversionRate: 0.4,
          },
          leasing: {
            totalProperties: 2,
            totalUnits: 4,
            occupiedUnits: 2,
            vacantUnits: 2,
            occupancyRate: 0.5,
            leasesEndingIn30Days: 0,
            leasesEndingIn60Days: 1,
            leasesEndingIn90Days: 1,
            turnoverCount: 0,
          },
          maintenance: {
            openWorkOrders: 1,
            completedWorkOrders: 1,
            reopenedWorkOrders: 0,
            maintenanceCostCents: 20000,
            averageCostPerCompletedWorkOrderCents: 20000,
            costConcentrationByProperty: [],
          },
          revenue: {
            estimatedScheduledRentCents: 420000,
            averageRentPerOccupiedUnitCents: 140000,
          },
        },
        deltas: {
          summary: {} as any,
          applications: {} as any,
          leasing: {} as any,
          maintenance: {} as any,
          revenue: {} as any,
        },
      },
      properties: [
        { id: "prop-1", name: "Alpha" },
        { id: "prop-2", name: "Beta" },
      ],
      propertyMetrics: [
        {
          propertyId: "prop-1",
          propertyName: "Alpha",
          metrics: {
            vacancyRate: 0,
            occupancyRate: 1,
            applicationVolume: 2,
            applicationConversionRate: 0.5,
            openWorkOrders: 1,
            maintenanceCostCents: 10000,
            maintenanceCostPerUnitCents: 5000,
            leasesEndingSoon: 0,
            estimatedScheduledRentCents: 300000,
            estimatedRentPerOccupiedUnitCents: 150000,
            totalUnits: 2,
            occupiedUnits: 2,
            vacantUnits: 0,
          },
        },
        {
          propertyId: "prop-2",
          propertyName: "Beta",
          metrics: {
            vacancyRate: 0.5,
            occupancyRate: 0.5,
            applicationVolume: 0,
            applicationConversionRate: null,
            openWorkOrders: 1,
            maintenanceCostCents: 50000,
            maintenanceCostPerUnitCents: 25000,
            leasesEndingSoon: 1,
            estimatedScheduledRentCents: 150000,
            estimatedRentPerOccupiedUnitCents: 150000,
            totalUnits: 2,
            occupiedUnits: 1,
            vacantUnits: 1,
          },
        },
      ],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    });

    const { loadLandlordAnalyticsBenchmarking } = await import("../landlordAnalyticsBenchmarking");
    const result = await loadLandlordAnalyticsBenchmarking({
      landlordId: "landlord-1",
      period: "90d",
      propertyId: "prop-2",
    });

    expect(loadLandlordAnalyticsSnapshot).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      period: "90d",
      propertyId: undefined,
      now: undefined,
    });
    expect(result.summary.propertyCount).toBe(2);
    expect(result.comparisons).toHaveLength(1);
    expect(result.comparisons[0]?.propertyId).toBe("prop-2");
  });
});
