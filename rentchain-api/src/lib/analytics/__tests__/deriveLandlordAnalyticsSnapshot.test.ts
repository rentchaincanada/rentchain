import { describe, expect, it } from "vitest";
import { deriveLandlordAnalyticsSnapshot } from "../deriveLandlordAnalyticsSnapshot";

describe("deriveLandlordAnalyticsSnapshot", () => {
  it("derives landlord-safe summary, revenue, and insights from shared analytics inputs", () => {
    const now = Date.UTC(2026, 3, 20, 12, 0, 0, 0);
    const from = now - 30 * 24 * 60 * 60 * 1000;
    const to = now;

    const result = deriveLandlordAnalyticsSnapshot({
      now,
      from,
      to,
      period: "30d",
      granularity: "daily",
      propertyId: null,
      applications: [
        {
          id: "app-1",
          createdAt: now - 5 * 24 * 60 * 60 * 1000,
          submittedAt: now - 5 * 24 * 60 * 60 * 1000,
          approvedAt: now - 2 * 24 * 60 * 60 * 1000,
          status: "approved",
        },
        {
          id: "app-2",
          createdAt: now - 4 * 24 * 60 * 60 * 1000,
          submittedAt: now - 4 * 24 * 60 * 60 * 1000,
          status: "in_review",
        },
      ],
      screeningReconciliations: [],
      financialTransactions: [],
      workOrders: [
        {
          id: "wo-1",
          propertyId: "prop-1",
          status: "open",
          createdAt: now - 3 * 24 * 60 * 60 * 1000,
        },
        {
          id: "wo-2",
          propertyId: "prop-1",
          status: "completed",
          serviceCompletedAt: now - 1 * 24 * 60 * 60 * 1000,
          cost: {
            actualCostCents: 18000,
            submittedAt: now - 1 * 24 * 60 * 60 * 1000,
          },
        },
      ],
      properties: [{ id: "prop-1" }, { id: "prop-2" }],
      units: [
        { id: "unit-1", propertyId: "prop-1", status: "vacant" },
        { id: "unit-2", propertyId: "prop-1", status: "vacant" },
        { id: "unit-3", propertyId: "prop-2", status: "occupied" },
      ],
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-2",
          status: "active",
          endDate: new Date(now + 20 * 24 * 60 * 60 * 1000).toISOString(),
          monthlyRent: 1800,
        },
      ],
      events: [],
      canonicalEvents: [],
    });

    expect(result.summary).toEqual({
      occupiedUnits: 1,
      vacancyRate: 2 / 3,
      activeApplications: 1,
      applicationConversionRate: 0.5,
      openWorkOrders: 1,
      maintenanceCostCents: 18000,
      estimatedScheduledRentCents: 180000,
      leasesEndingSoon: 1,
    });
    expect(result.revenue).toEqual({
      estimatedScheduledRentCents: 180000,
      averageRentPerOccupiedUnitCents: 180000,
    });
    expect(result.predictive.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "projected_vacancy_risk",
          status: "supported",
        }),
        expect.objectContaining({
          key: "projected_lease_expiry_concentration",
          riskLevel: "medium",
        }),
      ])
    );
    expect(result.decisions.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decisionType: "reduce_vacancy_risk",
          priority: "high",
        }),
        expect.objectContaining({
          decisionType: "review_lease_renewals",
          recommendedAction: "Review renewals",
        }),
      ])
    );
    expect(result.comparisons.previousPeriod).toEqual({
      summary: {
        occupiedUnits: 1,
        vacancyRate: 2 / 3,
        activeApplications: 1,
        applicationConversionRate: null,
        openWorkOrders: 1,
        maintenanceCostCents: 0,
        estimatedScheduledRentCents: 180000,
        leasesEndingSoon: 0,
      },
      applications: expect.objectContaining({
        started: 0,
        submitted: 0,
      }),
      leasing: expect.objectContaining({
        occupiedUnits: 1,
        vacantUnits: 2,
      }),
      maintenance: expect.objectContaining({
        openWorkOrders: 1,
        maintenanceCostCents: 0,
      }),
      revenue: {
        estimatedScheduledRentCents: 180000,
        averageRentPerOccupiedUnitCents: 180000,
      },
    });
    expect(result.comparisons.deltas.summary.vacancyRate).toEqual({
      current: 2 / 3,
      prior: 2 / 3,
      absoluteDelta: 0,
      relativeDelta: 0,
      direction: "flat",
    });
    expect(result.properties).toEqual([
      { id: "prop-1", name: "Untitled property" },
      { id: "prop-2", name: "Untitled property" },
    ]);
    expect(result.propertyMetrics).toEqual([
      expect.objectContaining({
        propertyId: "prop-1",
        metrics: expect.objectContaining({
          vacancyRate: 1,
          openWorkOrders: 1,
          maintenanceCostCents: 18000,
        }),
        deltas: expect.objectContaining({
          maintenanceCostCents: expect.objectContaining({
            direction: "worse",
          }),
        }),
      }),
      expect.objectContaining({
        propertyId: "prop-2",
        metrics: expect.objectContaining({
          vacancyRate: 0,
          estimatedScheduledRentCents: 180000,
          leasesEndingSoon: 1,
        }),
      }),
    ]);
    expect(result.insights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "lease_expiry",
          message: "1 lease ends within 30 days.",
        }),
        expect.objectContaining({
          type: "vacancy_concentration",
          propertyId: "prop-1",
        }),
      ])
    );
  });

  it("returns safe empty analytics output when landlord inputs are sparse", () => {
    const now = Date.UTC(2026, 3, 20, 12, 0, 0, 0);
    const result = deriveLandlordAnalyticsSnapshot({
      now,
      from: now - 7 * 24 * 60 * 60 * 1000,
      to: now,
      period: "30d",
      granularity: "daily",
      propertyId: null,
      applications: [],
      screeningReconciliations: [],
      financialTransactions: [],
      workOrders: [],
      properties: [],
      units: [],
      leases: [],
      events: [],
      canonicalEvents: [],
    });

    expect(result.summary).toEqual({
      occupiedUnits: 0,
      vacancyRate: null,
      activeApplications: 0,
      applicationConversionRate: null,
      openWorkOrders: 0,
      maintenanceCostCents: 0,
      estimatedScheduledRentCents: 0,
      leasesEndingSoon: 0,
    });
    expect(result.insights).toEqual([]);
    expect(result.predictive.metrics.every((metric) => metric.status === "insufficient_data")).toBe(true);
    expect(result.decisions.items).toEqual([]);
    expect(result.properties).toEqual([]);
    expect(result.propertyMetrics).toEqual([]);
    expect(result.comparisons.previousPeriod.summary).toEqual({
      occupiedUnits: 0,
      vacancyRate: null,
      activeApplications: 0,
      applicationConversionRate: null,
      openWorkOrders: 0,
      maintenanceCostCents: 0,
      estimatedScheduledRentCents: 0,
      leasesEndingSoon: 0,
    });
    expect(result.comparisons.deltas.summary.occupiedUnits.direction).toBe("flat");
    expect(result.comparisons.deltas.summary.vacancyRate.direction).toBe("insufficient_data");
  });
});
