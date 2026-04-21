import { describe, expect, it } from "vitest";
import { derivePortfolioBenchmarking } from "../derivePortfolioBenchmarking";

describe("derivePortfolioBenchmarking", () => {
  it("derives deterministic property-to-property comparisons and insights", () => {
    const result = derivePortfolioBenchmarking({
      snapshot: {
        summary: {
          occupiedUnits: 6,
          vacancyRate: 0.14,
          activeApplications: 3,
          applicationConversionRate: 0.5,
          openWorkOrders: 4,
          maintenanceCostCents: 180000,
          estimatedScheduledRentCents: 990000,
          leasesEndingSoon: 2,
        },
        applications: {
          started: 8,
          submitted: 6,
          approved: 3,
          rejected: 1,
          declined: 0,
          pendingReviewCount: 3,
          conversionRate: 0.5,
        },
        leasing: {
          totalProperties: 3,
          totalUnits: 7,
          occupiedUnits: 6,
          vacantUnits: 1,
          occupancyRate: 6 / 7,
          leasesEndingIn30Days: 2,
          leasesEndingIn60Days: 3,
          leasesEndingIn90Days: 3,
          turnoverCount: 1,
        },
        maintenance: {
          openWorkOrders: 4,
          completedWorkOrders: 3,
          reopenedWorkOrders: 1,
          maintenanceCostCents: 180000,
          averageCostPerCompletedWorkOrderCents: 60000,
          costConcentrationByProperty: [],
        },
        revenue: {
          estimatedScheduledRentCents: 990000,
          averageRentPerOccupiedUnitCents: 165000,
        },
        insights: [],
        comparisons: {
          previousPeriod: {
            vacancyRate: 0.1,
            applicationConversionRate: 0.4,
            applicationsStarted: 6,
            applicationsSubmitted: 4,
            maintenanceCostCents: 120000,
            openWorkOrders: 2,
          },
        },
        properties: [
          { id: "prop-1", name: "Alpha" },
          { id: "prop-2", name: "Beta" },
          { id: "prop-3", name: "Gamma" },
        ],
        propertyMetrics: [
          {
            propertyId: "prop-1",
            propertyName: "Alpha",
            metrics: {
              vacancyRate: 0,
              occupancyRate: 1,
              applicationVolume: 3,
              applicationConversionRate: 2 / 3,
              openWorkOrders: 1,
              maintenanceCostCents: 20000,
              maintenanceCostPerUnitCents: 10000,
              leasesEndingSoon: 0,
              estimatedScheduledRentCents: 360000,
              estimatedRentPerOccupiedUnitCents: 180000,
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
              applicationVolume: 1,
              applicationConversionRate: null,
              openWorkOrders: 3,
              maintenanceCostCents: 140000,
              maintenanceCostPerUnitCents: 70000,
              leasesEndingSoon: 2,
              estimatedScheduledRentCents: 150000,
              estimatedRentPerOccupiedUnitCents: 150000,
              totalUnits: 2,
              occupiedUnits: 1,
              vacantUnits: 1,
            },
          },
          {
            propertyId: "prop-3",
            propertyName: "Gamma",
            metrics: {
              vacancyRate: 0,
              occupancyRate: 1,
              applicationVolume: 2,
              applicationConversionRate: 0.5,
              openWorkOrders: 0,
              maintenanceCostCents: 20000,
              maintenanceCostPerUnitCents: 6667,
              leasesEndingSoon: 0,
              estimatedScheduledRentCents: 480000,
              estimatedRentPerOccupiedUnitCents: 160000,
              totalUnits: 3,
              occupiedUnits: 3,
              vacantUnits: 0,
            },
          },
        ],
        filters: {
          period: "90d",
          propertyId: null,
          from: "2026-01-20T00:00:00.000Z",
          to: "2026-04-20T00:00:00.000Z",
        },
      },
    });

    expect(result.summary.propertyCount).toBe(3);
    expect(result.comparisons).toHaveLength(3);
    expect(result.comparisons[0]?.benchmarks.vacancyRate).toEqual(
      expect.objectContaining({
        rank: 1,
        direction: "better",
      })
    );
    expect(result.comparisons.find((item) => item.propertyId === "prop-2")?.benchmarks.applicationConversionRate).toEqual(
      expect.objectContaining({
        direction: "insufficient_data",
      })
    );
    expect(result.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "vacancy_leader",
          propertyId: "prop-1",
        }),
        expect.objectContaining({
          type: "maintenance_concentration",
          propertyId: "prop-2",
        }),
      ])
    );
  });

  it("returns a clean empty-state benchmark response for single-property portfolios", () => {
    const result = derivePortfolioBenchmarking({
      snapshot: {
        summary: {
          occupiedUnits: 1,
          vacancyRate: 0,
          activeApplications: 0,
          applicationConversionRate: null,
          openWorkOrders: 0,
          maintenanceCostCents: 0,
          estimatedScheduledRentCents: 150000,
          leasesEndingSoon: 0,
        },
        applications: {
          started: 0,
          submitted: 0,
          approved: 0,
          rejected: 0,
          declined: 0,
          pendingReviewCount: 0,
          conversionRate: null,
        },
        leasing: {
          totalProperties: 1,
          totalUnits: 1,
          occupiedUnits: 1,
          vacantUnits: 0,
          occupancyRate: 1,
          leasesEndingIn30Days: 0,
          leasesEndingIn60Days: 0,
          leasesEndingIn90Days: 0,
          turnoverCount: 0,
        },
        maintenance: {
          openWorkOrders: 0,
          completedWorkOrders: 0,
          reopenedWorkOrders: 0,
          maintenanceCostCents: 0,
          averageCostPerCompletedWorkOrderCents: null,
          costConcentrationByProperty: [],
        },
        revenue: {
          estimatedScheduledRentCents: 150000,
          averageRentPerOccupiedUnitCents: 150000,
        },
        insights: [],
        comparisons: {
          previousPeriod: {
            vacancyRate: null,
            applicationConversionRate: null,
            applicationsStarted: 0,
            applicationsSubmitted: 0,
            maintenanceCostCents: 0,
            openWorkOrders: 0,
          },
        },
        properties: [{ id: "prop-1", name: "Solo" }],
        propertyMetrics: [
          {
            propertyId: "prop-1",
            propertyName: "Solo",
            metrics: {
              vacancyRate: 0,
              occupancyRate: 1,
              applicationVolume: 0,
              applicationConversionRate: null,
              openWorkOrders: 0,
              maintenanceCostCents: 0,
              maintenanceCostPerUnitCents: 0,
              leasesEndingSoon: 0,
              estimatedScheduledRentCents: 150000,
              estimatedRentPerOccupiedUnitCents: 150000,
              totalUnits: 1,
              occupiedUnits: 1,
              vacantUnits: 0,
            },
          },
        ],
        filters: {
          period: "30d",
          propertyId: null,
          from: "2026-03-21T00:00:00.000Z",
          to: "2026-04-20T00:00:00.000Z",
        },
      },
    });

    expect(result.comparisons).toHaveLength(1);
    expect(result.insights).toEqual([]);
  });
});
