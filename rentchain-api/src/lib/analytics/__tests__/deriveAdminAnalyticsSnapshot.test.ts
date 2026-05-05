import { describe, expect, it } from "vitest";
import { deriveAdminAnalyticsSnapshot } from "../deriveAdminAnalyticsSnapshot";

describe("deriveAdminAnalyticsSnapshot", () => {
  it("derives deterministic analytics metrics across the core families", () => {
    const now = Date.UTC(2026, 3, 20, 12, 0, 0, 0);
    const from = now - 30 * 24 * 60 * 60 * 1000;
    const to = now;

    const result = deriveAdminAnalyticsSnapshot({
      now,
      from,
      to,
      period: "30d",
      granularity: "daily",
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
        {
          id: "app-3",
          createdAt: now - 3 * 24 * 60 * 60 * 1000,
          submittedAt: now - 3 * 24 * 60 * 60 * 1000,
          rejectedAt: now - 1 * 24 * 60 * 60 * 1000,
          status: "rejected",
        },
      ],
      screeningReconciliations: [
        {
          status: "fulfilled",
          summary: {
            hasQuote: true,
            hasCheckout: true,
            hasPaidEvent: true,
            hasFulfillment: true,
            lastMeaningfulEventAt: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
          },
        },
        {
          status: "abandoned",
          summary: {
            hasQuote: true,
            hasCheckout: true,
            hasPaidEvent: false,
            hasFulfillment: false,
            lastMeaningfulEventAt: new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString(),
          },
        },
      ],
      financialTransactions: [
        {
          id: "txn-1",
          type: "payment_succeeded",
          amountCents: 3500,
          createdAt: now - 2 * 24 * 60 * 60 * 1000,
          applicationId: "app-1",
        },
      ],
      workOrders: [
        {
          id: "wo-1",
          propertyId: "prop-1",
          status: "open",
          createdAt: now - 7 * 24 * 60 * 60 * 1000,
        },
        {
          id: "wo-2",
          propertyId: "prop-1",
          status: "completed",
          serviceCompletedAt: now - 1 * 24 * 60 * 60 * 1000,
          reopenedAt: now - 12 * 60 * 60 * 1000,
          cost: {
            actualCostCents: 12500,
            submittedAt: now - 1 * 24 * 60 * 60 * 1000,
          },
        },
      ],
      properties: [{ id: "prop-1" }, { id: "prop-2" }],
      units: [
        { id: "unit-1", status: "occupied" },
        { id: "unit-2", status: "vacant" },
        { id: "unit-3", tenantId: "tenant-3" },
      ],
      leases: [
        { id: "lease-1", status: "active", endDate: new Date(now + 20 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "lease-2", status: "active", endDate: new Date(now + 50 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "lease-3", status: "ended", endDate: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString() },
      ],
      events: [
        { id: "event-1", ts: now - 1_000, userId: "user-1" },
        { id: "event-2", ts: now - 2_000, sessionId: "session-1" },
      ],
      canonicalEvents: [
        { id: "ce-1", occurredAt: new Date(now - 10_000).toISOString() },
      ],
    });

    expect(result.summary).toEqual({
      applicationsStarted: 3,
      applicationsSubmitted: 3,
      applicationConversionRate: 1 / 3,
      screeningsPaid: 1,
      screeningRevenueCents: 3500,
      openWorkOrders: 1,
      maintenanceCostCents: 12500,
      occupiedUnits: 2,
      vacancyRate: 1 / 3,
    });
    expect(result.applications).toEqual({
      started: 3,
      submitted: 3,
      approved: 1,
      rejected: 1,
      declined: 0,
      pendingReviewCount: 1,
      conversionRate: 1 / 3,
    });
    expect(result.screening.initiated).toBe(2);
    expect(result.screening.checkoutCreated).toBe(2);
    expect(result.screening.paid).toBe(1);
    expect(result.screening.fulfilled).toBe(1);
    expect(result.screening.abandoned).toBe(1);
    expect(result.screening.totalRevenueCents).toBe(3500);
    expect(result.maintenance).toEqual({
      openWorkOrders: 1,
      completedWorkOrders: 1,
      reopenedWorkOrders: 1,
      maintenanceCostCents: 12500,
      averageCostPerCompletedWorkOrderCents: 12500,
      costConcentrationByProperty: [
        {
          propertyId: "prop-1",
          workOrderCount: 1,
          totalCostCents: 12500,
        },
      ],
    });
    expect(result.portfolio).toEqual({
      totalProperties: 2,
      totalUnits: 3,
      occupiedUnits: 2,
      vacantUnits: 1,
      occupancyRate: 2 / 3,
      leasesEndingIn30Days: 1,
      leasesEndingIn60Days: 2,
      leasesEndingIn90Days: 2,
      turnoverCount: 1,
    });
    expect(result.activity).toEqual({
      trackedEvents: 2,
      canonicalEvents: 1,
      activeActors: 2,
    });
    expect(result.filters.period).toBe("30d");
    expect(result.filters.granularity).toBe("daily");
  });

  it("returns safe empty output when no analytics inputs are present", () => {
    const now = Date.UTC(2026, 3, 20, 12, 0, 0, 0);
    const result = deriveAdminAnalyticsSnapshot({
      now,
      from: now - 7 * 24 * 60 * 60 * 1000,
      to: now,
      period: "30d",
      granularity: "daily",
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
    expect(result.applications.pendingReviewCount).toBe(0);
    expect(result.screening.statusCounts.fulfilled).toBe(0);
    expect(result.maintenance.costConcentrationByProperty).toEqual([]);
    expect(result.portfolio).toEqual({
      totalProperties: 0,
      totalUnits: 0,
      occupiedUnits: 0,
      vacantUnits: 0,
      occupancyRate: null,
      leasesEndingIn30Days: 0,
      leasesEndingIn60Days: 0,
      leasesEndingIn90Days: 0,
      turnoverCount: 0,
    });
    expect(result.activity).toEqual({
      trackedEvents: 0,
      canonicalEvents: 0,
      activeActors: 0,
    });
  });

  it("counts expiring soon leases only when canonical lifecycle is active or notice-period", () => {
    const now = Date.UTC(2026, 4, 5, 12, 0, 0, 0);
    const result = deriveAdminAnalyticsSnapshot({
      now,
      from: now - 30 * 24 * 60 * 60 * 1000,
      to: now,
      period: "30d",
      granularity: "daily",
      applications: [],
      screeningReconciliations: [],
      financialTransactions: [],
      workOrders: [],
      properties: [],
      units: [],
      leases: [
        {
          id: "lease-active",
          status: "active",
          signedAt: "2026-01-01",
          startDate: "2026-01-01",
          endDate: "2026-06-01",
        },
        {
          id: "lease-expired-stale-active",
          status: "active",
          signedAt: "2025-01-01",
          startDate: "2025-01-01",
          endDate: "2026-04-30",
        },
        {
          id: "lease-renewed",
          status: "renewed",
          signedAt: "2025-01-01",
          startDate: "2025-01-01",
          endDate: "2026-06-01",
          successorLeaseId: "lease-next",
          hasSignedSuccessorLease: true,
        },
        {
          id: "lease-future",
          status: "active",
          signedAt: "2026-05-01",
          startDate: "2026-06-01",
          endDate: "2026-06-30",
        },
      ],
      events: [],
      canonicalEvents: [],
    });

    expect(result.portfolio.leasesEndingIn30Days).toBe(1);
    expect(result.portfolio.leasesEndingIn60Days).toBe(1);
    expect(result.portfolio.leasesEndingIn90Days).toBe(1);
  });
});
