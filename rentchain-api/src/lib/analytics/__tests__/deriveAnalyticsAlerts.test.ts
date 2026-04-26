import { describe, expect, it } from "vitest";
import { deriveAnalyticsAlerts } from "../deriveAnalyticsAlerts";
import type { LandlordAnalyticsSnapshot } from "../analyticsTypes";

function buildSnapshot(overrides?: Partial<LandlordAnalyticsSnapshot>): LandlordAnalyticsSnapshot {
  return {
    summary: {
      occupiedUnits: 4,
      vacancyRate: 0.25,
      activeApplications: 1,
      applicationConversionRate: 0.2,
      openWorkOrders: 3,
      maintenanceCostCents: 90000,
      estimatedScheduledRentCents: 660000,
      leasesEndingSoon: 2,
    },
    applications: {
      started: 1,
      submitted: 1,
      approved: 0,
      rejected: 0,
      declined: 0,
      pendingReviewCount: 1,
      conversionRate: 0.2,
    },
    leasing: {
      totalProperties: 2,
      totalUnits: 5,
      occupiedUnits: 4,
      vacantUnits: 1,
      occupancyRate: 0.8,
      leasesEndingIn30Days: 2,
      leasesEndingIn60Days: 2,
      leasesEndingIn90Days: 3,
      turnoverCount: 1,
    },
    maintenance: {
      openWorkOrders: 3,
      completedWorkOrders: 1,
      reopenedWorkOrders: 1,
      maintenanceCostCents: 90000,
      averageCostPerCompletedWorkOrderCents: 45000,
      costConcentrationByProperty: [{ propertyId: "prop-1", workOrderCount: 3, totalCostCents: 90000 }],
    },
    revenue: {
      estimatedScheduledRentCents: 660000,
      averageRentPerOccupiedUnitCents: 165000,
    },
    decisions: {
      items: [],
    },
    insights: [
      { type: "maintenance_cost_increase", severity: "medium", message: "Maintenance costs increased compared with the previous period." },
      { type: "work_order_concentration", severity: "high", message: "Most open work orders are tied to one property (3).", propertyId: "prop-1" },
      { type: "applications_drop", severity: "low", message: "Applications dropped compared with the previous period." },
    ],
    comparisons: {
      previousPeriod: {
        summary: {
          occupiedUnits: 4,
          vacancyRate: 0.1,
          activeApplications: 4,
          applicationConversionRate: 0.6,
          openWorkOrders: 1,
          maintenanceCostCents: 30000,
          estimatedScheduledRentCents: 640000,
          leasesEndingSoon: 1,
        },
        applications: {
          started: 4,
          submitted: 3,
          approved: 1,
          rejected: 0,
          declined: 0,
          pendingReviewCount: 2,
          conversionRate: 0.6,
        },
        leasing: {
          totalProperties: 2,
          totalUnits: 5,
          occupiedUnits: 4,
          vacantUnits: 1,
          occupancyRate: 0.8,
          leasesEndingIn30Days: 1,
          leasesEndingIn60Days: 1,
          leasesEndingIn90Days: 2,
          turnoverCount: 1,
        },
        maintenance: {
          openWorkOrders: 1,
          completedWorkOrders: 1,
          reopenedWorkOrders: 0,
          maintenanceCostCents: 30000,
          averageCostPerCompletedWorkOrderCents: 30000,
          costConcentrationByProperty: [],
        },
        revenue: {
          estimatedScheduledRentCents: 640000,
          averageRentPerOccupiedUnitCents: 160000,
        },
      },
      deltas: {
        summary: {
          occupiedUnits: { current: 4, prior: 4, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          vacancyRate: { current: 0.25, prior: 0.1, absoluteDelta: 0.15, relativeDelta: 1.5, direction: "worse" },
          activeApplications: { current: 1, prior: 4, absoluteDelta: -3, relativeDelta: -0.75, direction: "worse" },
          applicationConversionRate: {
            current: 0.2,
            prior: 0.6,
            absoluteDelta: -0.4,
            relativeDelta: -0.6667,
            direction: "worse",
          },
          openWorkOrders: { current: 3, prior: 1, absoluteDelta: 2, relativeDelta: 2, direction: "worse" },
          maintenanceCostCents: {
            current: 90000,
            prior: 30000,
            absoluteDelta: 60000,
            relativeDelta: 2,
            direction: "worse",
          },
          estimatedScheduledRentCents: {
            current: 660000,
            prior: 640000,
            absoluteDelta: 20000,
            relativeDelta: 0.0313,
            direction: "better",
          },
          leasesEndingSoon: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "worse" },
        },
        applications: {
          started: { current: 1, prior: 4, absoluteDelta: -3, relativeDelta: -0.75, direction: "worse" },
          submitted: { current: 1, prior: 3, absoluteDelta: -2, relativeDelta: -0.6667, direction: "worse" },
          approved: { current: 0, prior: 1, absoluteDelta: -1, relativeDelta: -1, direction: "worse" },
          rejected: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
          declined: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
          pendingReviewCount: { current: 1, prior: 2, absoluteDelta: -1, relativeDelta: -0.5, direction: "better" },
          conversionRate: {
            current: 0.2,
            prior: 0.6,
            absoluteDelta: -0.4,
            relativeDelta: -0.6667,
            direction: "worse",
          },
        },
        leasing: {
          occupiedUnits: { current: 4, prior: 4, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          vacantUnits: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          occupancyRate: { current: 0.8, prior: 0.8, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          leasesEndingIn30Days: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "worse" },
          leasesEndingIn60Days: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "worse" },
          leasesEndingIn90Days: { current: 3, prior: 2, absoluteDelta: 1, relativeDelta: 0.5, direction: "worse" },
        },
        maintenance: {
          openWorkOrders: { current: 3, prior: 1, absoluteDelta: 2, relativeDelta: 2, direction: "worse" },
          completedWorkOrders: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          reopenedWorkOrders: { current: 1, prior: 0, absoluteDelta: 1, relativeDelta: null, direction: "insufficient_data" },
          maintenanceCostCents: {
            current: 90000,
            prior: 30000,
            absoluteDelta: 60000,
            relativeDelta: 2,
            direction: "worse",
          },
          averageCostPerCompletedWorkOrderCents: {
            current: 45000,
            prior: 30000,
            absoluteDelta: 15000,
            relativeDelta: 0.5,
            direction: "worse",
          },
        },
        revenue: {
          estimatedScheduledRentCents: {
            current: 660000,
            prior: 640000,
            absoluteDelta: 20000,
            relativeDelta: 0.0313,
            direction: "better",
          },
          averageRentPerOccupiedUnitCents: {
            current: 165000,
            prior: 160000,
            absoluteDelta: 5000,
            relativeDelta: 0.0313,
            direction: "better",
          },
        },
      },
    },
    properties: [
      { id: "prop-1", name: "Alpha" },
      { id: "prop-2", name: "Beta" },
    ],
    propertyMetrics: [],
    filters: {
      period: "30d",
      propertyId: null,
      from: "2026-03-20T00:00:00.000Z",
      to: "2026-04-20T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("deriveAnalyticsAlerts", () => {
  it("derives deterministic active alerts from the landlord analytics snapshot", () => {
    const result = deriveAnalyticsAlerts({
      snapshot: buildSnapshot(),
      status: "active",
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result.summary).toEqual({
      activeCount: 8,
      highSeverityCount: 2,
      mediumSeverityCount: 4,
      lowSeverityCount: 2,
    });
    expect(result.alerts.map((alert) => alert.type)).toEqual([
      "application_conversion_drop",
      "work_order_concentration",
      "lease_expiry",
      "maintenance_cost_spike",
      "high_vacancy",
      "vacancy_increase",
      "low_application_activity",
      "application_drop",
    ]);
    expect(result.alerts[0].notification.inAppEligible).toBe(true);
  });

  it("returns resolved alerts cleanly when no rules are currently active", () => {
    const result = deriveAnalyticsAlerts({
      snapshot: buildSnapshot({
        summary: {
          occupiedUnits: 4,
          vacancyRate: 0.05,
          activeApplications: 3,
          applicationConversionRate: 0.6,
          openWorkOrders: 0,
          maintenanceCostCents: 5000,
          estimatedScheduledRentCents: 660000,
          leasesEndingSoon: 0,
        },
        applications: {
          started: 4,
          submitted: 3,
          approved: 2,
          rejected: 0,
          declined: 0,
          pendingReviewCount: 1,
          conversionRate: 0.6,
        },
        leasing: {
          totalProperties: 2,
          totalUnits: 5,
          occupiedUnits: 4,
          vacantUnits: 1,
          occupancyRate: 0.8,
          leasesEndingIn30Days: 0,
          leasesEndingIn60Days: 0,
          leasesEndingIn90Days: 1,
          turnoverCount: 0,
        },
        maintenance: {
          openWorkOrders: 0,
          completedWorkOrders: 2,
          reopenedWorkOrders: 0,
          maintenanceCostCents: 5000,
          averageCostPerCompletedWorkOrderCents: 2500,
          costConcentrationByProperty: [],
        },
        insights: [],
        comparisons: {
          previousPeriod: {
            summary: {
              occupiedUnits: 4,
              vacancyRate: 0.05,
              activeApplications: 2,
              applicationConversionRate: 0.5,
              openWorkOrders: 1,
              maintenanceCostCents: 7000,
              estimatedScheduledRentCents: 660000,
              leasesEndingSoon: 1,
            },
            applications: {
              started: 3,
              submitted: 2,
              approved: 1,
              rejected: 0,
              declined: 0,
              pendingReviewCount: 1,
              conversionRate: 0.5,
            },
            leasing: {
              totalProperties: 2,
              totalUnits: 5,
              occupiedUnits: 4,
              vacantUnits: 1,
              occupancyRate: 0.8,
              leasesEndingIn30Days: 1,
              leasesEndingIn60Days: 1,
              leasesEndingIn90Days: 1,
              turnoverCount: 0,
            },
            maintenance: {
              openWorkOrders: 1,
              completedWorkOrders: 1,
              reopenedWorkOrders: 0,
              maintenanceCostCents: 7000,
              averageCostPerCompletedWorkOrderCents: 7000,
              costConcentrationByProperty: [],
            },
            revenue: {
              estimatedScheduledRentCents: 660000,
              averageRentPerOccupiedUnitCents: 165000,
            },
          },
          deltas: {
            summary: {
              occupiedUnits: { current: 4, prior: 4, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
              vacancyRate: { current: 0.05, prior: 0.05, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
              activeApplications: { current: 3, prior: 2, absoluteDelta: 1, relativeDelta: 0.5, direction: "better" },
              applicationConversionRate: {
                current: 0.6,
                prior: 0.5,
                absoluteDelta: 0.1,
                relativeDelta: 0.2,
                direction: "better",
              },
              openWorkOrders: { current: 0, prior: 1, absoluteDelta: -1, relativeDelta: -1, direction: "better" },
              maintenanceCostCents: { current: 5000, prior: 7000, absoluteDelta: -2000, relativeDelta: -0.2857, direction: "better" },
              estimatedScheduledRentCents: { current: 660000, prior: 660000, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
              leasesEndingSoon: { current: 0, prior: 1, absoluteDelta: -1, relativeDelta: -1, direction: "better" },
            },
            applications: {
              started: { current: 4, prior: 3, absoluteDelta: 1, relativeDelta: 0.3333, direction: "better" },
              submitted: { current: 3, prior: 2, absoluteDelta: 1, relativeDelta: 0.5, direction: "better" },
              approved: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "better" },
              rejected: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
              declined: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
              pendingReviewCount: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
              conversionRate: { current: 0.6, prior: 0.5, absoluteDelta: 0.1, relativeDelta: 0.2, direction: "better" },
            },
            leasing: {
              occupiedUnits: { current: 4, prior: 4, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
              vacantUnits: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
              occupancyRate: { current: 0.8, prior: 0.8, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
              leasesEndingIn30Days: { current: 0, prior: 1, absoluteDelta: -1, relativeDelta: -1, direction: "better" },
              leasesEndingIn60Days: { current: 0, prior: 1, absoluteDelta: -1, relativeDelta: -1, direction: "better" },
              leasesEndingIn90Days: { current: 1, prior: 1, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            },
            maintenance: {
              openWorkOrders: { current: 0, prior: 1, absoluteDelta: -1, relativeDelta: -1, direction: "better" },
              completedWorkOrders: { current: 2, prior: 1, absoluteDelta: 1, relativeDelta: 1, direction: "better" },
              reopenedWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: null, direction: "flat" },
              maintenanceCostCents: { current: 5000, prior: 7000, absoluteDelta: -2000, relativeDelta: -0.2857, direction: "better" },
              averageCostPerCompletedWorkOrderCents: {
                current: 2500,
                prior: 7000,
                absoluteDelta: -4500,
                relativeDelta: -0.6429,
                direction: "better",
              },
            },
            revenue: {
              estimatedScheduledRentCents: { current: 660000, prior: 660000, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
              averageRentPerOccupiedUnitCents: { current: 165000, prior: 165000, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
            },
          },
        },
        propertyMetrics: [],
      }),
      status: "resolved",
    });

    expect(result.summary.activeCount).toBe(0);
    expect(result.alerts.every((alert) => alert.status === "resolved")).toBe(true);
  });
});
