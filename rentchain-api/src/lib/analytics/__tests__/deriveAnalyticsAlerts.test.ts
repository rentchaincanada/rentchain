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
    insights: [
      { type: "maintenance_cost_increase", severity: "medium", message: "Maintenance costs increased compared with the previous period." },
      { type: "work_order_concentration", severity: "high", message: "Most open work orders are tied to one property (3).", propertyId: "prop-1" },
      { type: "applications_drop", severity: "low", message: "Applications dropped compared with the previous period." },
    ],
    comparisons: {
      previousPeriod: {
        vacancyRate: 0.1,
        applicationConversionRate: 0.6,
        applicationsStarted: 4,
        applicationsSubmitted: 3,
        maintenanceCostCents: 30000,
        openWorkOrders: 1,
      },
    },
    properties: [
      { id: "prop-1", name: "Alpha" },
      { id: "prop-2", name: "Beta" },
    ],
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
            vacancyRate: 0.05,
            applicationConversionRate: 0.5,
            applicationsStarted: 3,
            applicationsSubmitted: 2,
            maintenanceCostCents: 7000,
            openWorkOrders: 1,
          },
        },
      }),
      status: "resolved",
    });

    expect(result.summary.activeCount).toBe(0);
    expect(result.alerts.every((alert) => alert.status === "resolved")).toBe(true);
  });
});
