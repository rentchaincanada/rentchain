import { describe, expect, it } from "vitest";
import { derivePredictiveMetrics } from "../derivePredictiveMetrics";

describe("derivePredictiveMetrics", () => {
  it("derives deterministic predictive metrics from snapshot outputs", () => {
    const result = derivePredictiveMetrics({
      summary: {
        occupiedUnits: 4,
        vacancyRate: 0.25,
        activeApplications: 1,
        applicationConversionRate: 0.2,
        openWorkOrders: 3,
        maintenanceCostCents: 120000,
        estimatedScheduledRentCents: 600000,
        leasesEndingSoon: 3,
      },
      leasing: {
        totalProperties: 2,
        totalUnits: 6,
        occupiedUnits: 4,
        vacantUnits: 2,
        occupancyRate: 4 / 6,
        leasesEndingIn30Days: 3,
        leasesEndingIn60Days: 4,
        leasesEndingIn90Days: 4,
        turnoverCount: 1,
      },
      maintenance: {
        openWorkOrders: 3,
        completedWorkOrders: 1,
        reopenedWorkOrders: 0,
        maintenanceCostCents: 120000,
        averageCostPerCompletedWorkOrderCents: 120000,
        costConcentrationByProperty: [],
      },
      revenue: {
        estimatedScheduledRentCents: 600000,
        averageRentPerOccupiedUnitCents: 150000,
      },
      comparisons: {
        previousPeriod: {
          summary: {
            occupiedUnits: 5,
            vacancyRate: 1 / 6,
            activeApplications: 3,
            applicationConversionRate: 0.5,
            openWorkOrders: 1,
            maintenanceCostCents: 40000,
            estimatedScheduledRentCents: 700000,
            leasesEndingSoon: 1,
          },
          applications: {
            started: 4,
            submitted: 4,
            approved: 2,
            rejected: 0,
            declined: 0,
            pendingReviewCount: 1,
            conversionRate: 0.5,
          },
          leasing: {
            totalProperties: 2,
            totalUnits: 6,
            occupiedUnits: 5,
            vacantUnits: 1,
            occupancyRate: 5 / 6,
            leasesEndingIn30Days: 1,
            leasesEndingIn60Days: 2,
            leasesEndingIn90Days: 2,
            turnoverCount: 0,
          },
          maintenance: {
            openWorkOrders: 1,
            completedWorkOrders: 1,
            reopenedWorkOrders: 0,
            maintenanceCostCents: 40000,
            averageCostPerCompletedWorkOrderCents: 40000,
            costConcentrationByProperty: [],
          },
          revenue: {
            estimatedScheduledRentCents: 700000,
            averageRentPerOccupiedUnitCents: 140000,
          },
        },
        deltas: {
          summary: {
            occupiedUnits: { current: 4, prior: 5, absoluteDelta: -1, relativeDelta: -0.2, direction: "worse" },
            vacancyRate: {
              current: 0.25,
              prior: 1 / 6,
              absoluteDelta: 0.0833,
              relativeDelta: 0.5,
              direction: "worse",
            },
            activeApplications: { current: 1, prior: 3, absoluteDelta: -2, relativeDelta: -0.6667, direction: "worse" },
            applicationConversionRate: {
              current: 0.2,
              prior: 0.5,
              absoluteDelta: -0.3,
              relativeDelta: -0.6,
              direction: "worse",
            },
            openWorkOrders: { current: 3, prior: 1, absoluteDelta: 2, relativeDelta: 2, direction: "worse" },
            maintenanceCostCents: {
              current: 120000,
              prior: 40000,
              absoluteDelta: 80000,
              relativeDelta: 2,
              direction: "worse",
            },
            estimatedScheduledRentCents: {
              current: 600000,
              prior: 700000,
              absoluteDelta: -100000,
              relativeDelta: -0.1429,
              direction: "worse",
            },
            leasesEndingSoon: { current: 3, prior: 1, absoluteDelta: 2, relativeDelta: 2, direction: "worse" },
          },
          applications: {
            started: { current: 1, prior: 4, absoluteDelta: -3, relativeDelta: -0.75, direction: "worse" },
            submitted: { current: 1, prior: 4, absoluteDelta: -3, relativeDelta: -0.75, direction: "worse" },
            approved: { current: 0, prior: 2, absoluteDelta: -2, relativeDelta: -1, direction: "worse" },
            rejected: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            declined: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            pendingReviewCount: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            conversionRate: {
              current: 0.2,
              prior: 0.5,
              absoluteDelta: -0.3,
              relativeDelta: -0.6,
              direction: "worse",
            },
          },
          leasing: {
            occupiedUnits: { current: 4, prior: 5, absoluteDelta: -1, relativeDelta: -0.2, direction: "worse" },
            vacantUnits: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "worse" },
            occupancyRate: { current: 4 / 6, prior: 5 / 6, absoluteDelta: -0.1667, relativeDelta: -0.2, direction: "worse" },
            leasesEndingIn30Days: { current: 3, prior: 1, absoluteDelta: 2, relativeDelta: 2, direction: "worse" },
            leasesEndingIn60Days: { current: 4, prior: 2, absoluteDelta: 2, relativeDelta: 1, direction: "worse" },
            leasesEndingIn90Days: { current: 4, prior: 2, absoluteDelta: 2, relativeDelta: 1, direction: "worse" },
          },
          maintenance: {
            openWorkOrders: { current: 3, prior: 1, absoluteDelta: 2, relativeDelta: 2, direction: "worse" },
            completedWorkOrders: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            reopenedWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            maintenanceCostCents: {
              current: 120000,
              prior: 40000,
              absoluteDelta: 80000,
              relativeDelta: 2,
              direction: "worse",
            },
            averageCostPerCompletedWorkOrderCents: {
              current: 120000,
              prior: 40000,
              absoluteDelta: 80000,
              relativeDelta: 2,
              direction: "worse",
            },
          },
          revenue: {
            estimatedScheduledRentCents: {
              current: 600000,
              prior: 700000,
              absoluteDelta: -100000,
              relativeDelta: -0.1429,
              direction: "worse",
            },
            averageRentPerOccupiedUnitCents: {
              current: 150000,
              prior: 140000,
              absoluteDelta: 10000,
              relativeDelta: 0.0714,
              direction: "better",
            },
          },
        },
      },
      propertyMetrics: [
        {
          propertyId: "prop-1",
          propertyName: "Alpha",
          metrics: {
            vacancyRate: 0,
            occupancyRate: 1,
            applicationVolume: 1,
            applicationConversionRate: 1,
            openWorkOrders: 0,
            maintenanceCostCents: 20000,
            maintenanceCostPerUnitCents: 10000,
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
            openWorkOrders: 3,
            maintenanceCostCents: 100000,
            maintenanceCostPerUnitCents: 25000,
            leasesEndingSoon: 3,
            estimatedScheduledRentCents: 300000,
            estimatedRentPerOccupiedUnitCents: 150000,
            totalUnits: 4,
            occupiedUnits: 2,
            vacantUnits: 2,
          },
        },
      ],
    });

    expect(result.metrics.map((metric) => metric.riskLevel)).toEqual(["high", "high", "high", "high", "high"]);
    expect(result.metrics.find((metric) => metric.key === "projected_vacancy_risk")?.explanation).toMatch(/vacancy pressure/i);
    expect(result.metrics.find((metric) => metric.key === "projected_revenue_pressure_signal")?.supportingValues).toEqual(
      expect.objectContaining({
        priorEstimatedScheduledRentCents: 700000,
      })
    );
  });

  it("returns insufficient-data metrics when the snapshot lacks a usable baseline", () => {
    const result = derivePredictiveMetrics({
      summary: {
        occupiedUnits: 0,
        vacancyRate: null,
        activeApplications: 0,
        applicationConversionRate: null,
        openWorkOrders: 0,
        maintenanceCostCents: 0,
        estimatedScheduledRentCents: 0,
        leasesEndingSoon: 0,
      },
      leasing: {
        totalProperties: 0,
        totalUnits: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        occupancyRate: null,
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
        estimatedScheduledRentCents: 0,
        averageRentPerOccupiedUnitCents: null,
      },
      comparisons: {
        previousPeriod: {
          summary: {
            occupiedUnits: 0,
            vacancyRate: null,
            activeApplications: 0,
            applicationConversionRate: null,
            openWorkOrders: 0,
            maintenanceCostCents: 0,
            estimatedScheduledRentCents: 0,
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
            totalProperties: 0,
            totalUnits: 0,
            occupiedUnits: 0,
            vacantUnits: 0,
            occupancyRate: null,
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
            estimatedScheduledRentCents: 0,
            averageRentPerOccupiedUnitCents: null,
          },
        },
        deltas: {
          summary: {
            occupiedUnits: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            vacancyRate: { current: null, prior: null, absoluteDelta: null, relativeDelta: null, direction: "insufficient_data" },
            activeApplications: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            applicationConversionRate: { current: null, prior: null, absoluteDelta: null, relativeDelta: null, direction: "insufficient_data" },
            openWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            maintenanceCostCents: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            estimatedScheduledRentCents: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            leasesEndingSoon: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
          },
          applications: {
            started: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            submitted: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            approved: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            rejected: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            declined: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            pendingReviewCount: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            conversionRate: { current: null, prior: null, absoluteDelta: null, relativeDelta: null, direction: "insufficient_data" },
          },
          leasing: {
            occupiedUnits: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            vacantUnits: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            occupancyRate: { current: null, prior: null, absoluteDelta: null, relativeDelta: null, direction: "insufficient_data" },
            leasesEndingIn30Days: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            leasesEndingIn60Days: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            leasesEndingIn90Days: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
          },
          maintenance: {
            openWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            completedWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            reopenedWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            maintenanceCostCents: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            averageCostPerCompletedWorkOrderCents: {
              current: null,
              prior: null,
              absoluteDelta: null,
              relativeDelta: null,
              direction: "insufficient_data",
            },
          },
          revenue: {
            estimatedScheduledRentCents: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
            averageRentPerOccupiedUnitCents: {
              current: null,
              prior: null,
              absoluteDelta: null,
              relativeDelta: null,
              direction: "insufficient_data",
            },
          },
        },
      },
      propertyMetrics: [],
    });

    expect(result.metrics).toHaveLength(5);
    expect(result.metrics.every((metric) => metric.status === "insufficient_data")).toBe(true);
  });
});
