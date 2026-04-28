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
      decisions: { items: [] },
      insights: [{ type: "maintenance_cost_increase", severity: "medium", message: "Maintenance costs increased compared with the previous period." }],
      comparisons: {
        previousPeriod: {
          summary: {
            occupiedUnits: 3,
            vacancyRate: 0.1,
            activeApplications: 2,
            applicationConversionRate: 0.5,
            openWorkOrders: 1,
            maintenanceCostCents: 20000,
            estimatedScheduledRentCents: 520000,
            leasesEndingSoon: 0,
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
            totalProperties: 1,
            totalUnits: 4,
            occupiedUnits: 3,
            vacantUnits: 1,
            occupancyRate: 0.75,
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
            estimatedScheduledRentCents: 520000,
            averageRentPerOccupiedUnitCents: 173333,
          },
        },
        deltas: {
          summary: {
            occupiedUnits: { current: 3, prior: 3, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            vacancyRate: { current: 0.25, prior: 0.1, absoluteDelta: 0.15, relativeDelta: 1.5, direction: "worse" },
            activeApplications: { current: 0, prior: 2, absoluteDelta: -2, relativeDelta: -1, direction: "worse" },
            applicationConversionRate: {
              current: 0.2,
              prior: 0.5,
              absoluteDelta: -0.3,
              relativeDelta: -0.6,
              direction: "worse",
            },
            openWorkOrders: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "worse" },
            maintenanceCostCents: { current: 75000, prior: 20000, absoluteDelta: 55000, relativeDelta: 2.75, direction: "worse" },
            estimatedScheduledRentCents: { current: 540000, prior: 520000, absoluteDelta: 20000, relativeDelta: 0.0385, direction: "better" },
            leasesEndingSoon: { current: 1, prior: 0, absoluteDelta: 1, relativeDelta: null, direction: "insufficient_data" },
          },
          applications: {
            started: { current: 0, prior: 2, absoluteDelta: -2, relativeDelta: -1, direction: "worse" },
            submitted: { current: 0, prior: 2, absoluteDelta: -2, relativeDelta: -1, direction: "worse" },
            approved: { current: 0, prior: 1, absoluteDelta: -1, relativeDelta: -1, direction: "worse" },
            rejected: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            declined: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            pendingReviewCount: { current: 0, prior: 1, absoluteDelta: -1, relativeDelta: -1, direction: "better" },
            conversionRate: { current: 0.2, prior: 0.5, absoluteDelta: -0.3, relativeDelta: -0.6, direction: "worse" },
          },
          leasing: {
            occupiedUnits: { current: 3, prior: 3, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            vacantUnits: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            occupancyRate: { current: 0.75, prior: 0.75, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            leasesEndingIn30Days: { current: 1, prior: 0, absoluteDelta: 1, relativeDelta: null, direction: "insufficient_data" },
            leasesEndingIn60Days: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            leasesEndingIn90Days: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          },
          maintenance: {
            openWorkOrders: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "worse" },
            completedWorkOrders: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            reopenedWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            maintenanceCostCents: { current: 75000, prior: 20000, absoluteDelta: 55000, relativeDelta: 2.75, direction: "worse" },
            averageCostPerCompletedWorkOrderCents: {
              current: 75000,
              prior: 20000,
              absoluteDelta: 55000,
              relativeDelta: 2.75,
              direction: "worse",
            },
          },
          revenue: {
            estimatedScheduledRentCents: { current: 540000, prior: 520000, absoluteDelta: 20000, relativeDelta: 0.0385, direction: "better" },
            averageRentPerOccupiedUnitCents: { current: 180000, prior: 173333, absoluteDelta: 6667, relativeDelta: 0.0385, direction: "better" },
          },
        },
      },
      properties: [{ id: "prop-1", name: "Alpha" }],
      propertyMetrics: [],
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

  it("does not reference archived property names when snapshot properties are already filtered", async () => {
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
      decisions: { items: [] },
      insights: [
        {
          type: "applications_drop",
          severity: "medium",
          message: "Applications declined for the filtered visible property.",
          propertyId: "prop-1",
        },
      ],
      comparisons: {
        previousPeriod: {
          summary: {
            occupiedUnits: 3,
            vacancyRate: 0.1,
            activeApplications: 2,
            applicationConversionRate: 0.5,
            openWorkOrders: 1,
            maintenanceCostCents: 20000,
            estimatedScheduledRentCents: 520000,
            leasesEndingSoon: 0,
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
            totalProperties: 1,
            totalUnits: 4,
            occupiedUnits: 3,
            vacantUnits: 1,
            occupancyRate: 0.75,
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
            estimatedScheduledRentCents: 520000,
            averageRentPerOccupiedUnitCents: 173333,
          },
        },
        deltas: {
          summary: {
            occupiedUnits: { current: 3, prior: 3, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            vacancyRate: { current: 0.25, prior: 0.1, absoluteDelta: 0.15, relativeDelta: 1.5, direction: "worse" },
            activeApplications: { current: 0, prior: 2, absoluteDelta: -2, relativeDelta: -1, direction: "worse" },
            applicationConversionRate: {
              current: 0.2,
              prior: 0.5,
              absoluteDelta: -0.3,
              relativeDelta: -0.6,
              direction: "worse",
            },
            openWorkOrders: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "worse" },
            maintenanceCostCents: { current: 75000, prior: 20000, absoluteDelta: 55000, relativeDelta: 2.75, direction: "worse" },
            estimatedScheduledRentCents: { current: 540000, prior: 520000, absoluteDelta: 20000, relativeDelta: 0.0385, direction: "better" },
            leasesEndingSoon: { current: 1, prior: 0, absoluteDelta: 1, relativeDelta: null, direction: "insufficient_data" },
          },
          applications: {
            started: { current: 0, prior: 2, absoluteDelta: -2, relativeDelta: -1, direction: "worse" },
            submitted: { current: 0, prior: 2, absoluteDelta: -2, relativeDelta: -1, direction: "worse" },
            approved: { current: 0, prior: 1, absoluteDelta: -1, relativeDelta: -1, direction: "worse" },
            rejected: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            declined: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            pendingReviewCount: { current: 0, prior: 1, absoluteDelta: -1, relativeDelta: -1, direction: "better" },
            conversionRate: { current: 0.2, prior: 0.5, absoluteDelta: -0.3, relativeDelta: -0.6, direction: "worse" },
          },
          leasing: {
            occupiedUnits: { current: 3, prior: 3, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            vacantUnits: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            occupancyRate: { current: 0.75, prior: 0.75, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            leasesEndingIn30Days: { current: 1, prior: 0, absoluteDelta: 1, relativeDelta: null, direction: "insufficient_data" },
            leasesEndingIn60Days: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            leasesEndingIn90Days: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          },
          maintenance: {
            openWorkOrders: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "worse" },
            completedWorkOrders: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            reopenedWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            maintenanceCostCents: { current: 75000, prior: 20000, absoluteDelta: 55000, relativeDelta: 2.75, direction: "worse" },
            averageCostPerCompletedWorkOrderCents: {
              current: 75000,
              prior: 20000,
              absoluteDelta: 55000,
              relativeDelta: 2.75,
              direction: "worse",
            },
          },
          revenue: {
            estimatedScheduledRentCents: { current: 540000, prior: 520000, absoluteDelta: 20000, relativeDelta: 0.0385, direction: "better" },
            averageRentPerOccupiedUnitCents: { current: 180000, prior: 173333, absoluteDelta: 6667, relativeDelta: 0.0385, direction: "better" },
          },
        },
      },
      properties: [{ id: "prop-1", name: "Visible Property" }],
      propertyMetrics: [],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    });

    const { loadLandlordAnalyticsAlerts } = await import("../landlordAnalyticsAlerts");
    const result = await loadLandlordAnalyticsAlerts({
      landlordId: "landlord-1",
      period: "90d",
      status: "all",
    });

    expect(JSON.stringify(result)).not.toContain("Property_test");
    expect(result.alerts.some((alert) => alert.propertyName === "Visible Property")).toBe(true);
  });
});
