import { describe, expect, it } from "vitest";
import { deriveAgentDecisions } from "../deriveAgentDecisions";

describe("deriveAgentDecisions", () => {
  it("derives a short deterministic list of landlord actions from existing signals", () => {
    const result = deriveAgentDecisions({
      filters: {
        propertyId: null,
      },
      deltas: {
        summary: {
          vacancyRate: { current: 0.25, prior: 0.1, absoluteDelta: 0.15, relativeDelta: 1.5, direction: "worse" },
          applicationConversionRate: {
            current: 0.2,
            prior: 0.5,
            absoluteDelta: -0.3,
            relativeDelta: -0.6,
            direction: "worse",
          },
          activeApplications: { current: 1, prior: 3, absoluteDelta: -2, relativeDelta: -0.66, direction: "worse" },
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
            relativeDelta: -0.14,
            direction: "worse",
          },
          leasesEndingSoon: { current: 3, prior: 1, absoluteDelta: 2, relativeDelta: 2, direction: "worse" },
        },
        applications: {
          submitted: { current: 1, prior: 4, absoluteDelta: -3, relativeDelta: -0.75, direction: "worse" },
          conversionRate: {
            current: 0.2,
            prior: 0.5,
            absoluteDelta: -0.3,
            relativeDelta: -0.6,
            direction: "worse",
          },
        },
      },
      alerts: [
        {
          id: "1",
          type: "high_vacancy",
          severity: "high",
          status: "active",
          title: "Vacancy is elevated",
          message: "Vacancy is 25% in the current view.",
          propertyId: "prop-2",
          detectedAt: "2026-04-20T00:00:00.000Z",
          lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
          notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
        },
        {
          id: "2",
          type: "application_conversion_drop",
          severity: "high",
          status: "active",
          title: "Application conversion dropped",
          message: "Application conversion fell from 50% to 20%.",
          detectedAt: "2026-04-20T00:00:00.000Z",
          lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
          notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
        },
      ],
      predictiveMetrics: [
        {
          key: "projected_vacancy_risk",
          label: "Projected vacancy risk",
          riskLevel: "high",
          status: "supported",
          explanation: "Beta already carries concentrated vacancy pressure, so near-term vacancy risk is elevated.",
          supportingValues: { topPropertyId: "prop-2", vacancyRate: 0.25 },
        },
        {
          key: "projected_application_slowdown_risk",
          label: "Projected application slowdown risk",
          riskLevel: "high",
          status: "supported",
          explanation: "Application demand or conversion efficiency has dropped materially versus the prior period.",
        },
        {
          key: "projected_revenue_pressure_signal",
          label: "Projected revenue pressure signal",
          riskLevel: "medium",
          status: "supported",
          explanation: "Scheduled rent is already trending down versus the prior period, which creates elevated near-term revenue pressure.",
        },
      ],
      benchmarking: {
        summary: {
          propertyCount: 2,
          comparedPropertyCount: 2,
          benchmarkDimensions: ["vacancyRate"],
        },
        comparisons: [
          {
            propertyId: "prop-2",
            propertyName: "Beta",
            metrics: {
              vacancyRate: 0.5,
              occupancyRate: 0.5,
              applicationVolume: 1,
              applicationConversionRate: null,
              openWorkOrders: 1,
              maintenanceCostCents: 7500,
              maintenanceCostPerUnitCents: 2500,
              leasesEndingSoon: 1,
              estimatedScheduledRentCents: 340000,
              estimatedRentPerOccupiedUnitCents: 170000,
              totalUnits: 3,
              occupiedUnits: 2,
              vacantUnits: 1,
            },
            benchmarks: {},
          },
        ],
        insights: [
          {
            type: "vacancy_risk",
            severity: "high",
            propertyId: "prop-2",
            message: "Beta currently has the highest vacancy pressure in your portfolio.",
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

    expect(result.items.map((item) => item.decisionType)).toEqual([
      "reduce_vacancy_risk",
      "improve_application_conversion",
      "review_revenue_pressure",
      "focus_highest_risk_property",
    ]);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        id: "reduce_vacancy_risk:prop-2",
        priority: "high",
        recommendedAction: "View property analytics",
        actionKey: "open_vacancy_readiness_flow",
        actionLabel: "Open vacancy readiness",
        destination: "/analytics?entry=vacancy-readiness&propertyId=prop-2",
        workflowCategory: "vacancy_readiness",
        automationEligible: false,
        automationState: "manual_only",
        automationReason: null,
        executionMappingState: "none",
        executionMapping: null,
        href: "/analytics?entry=vacancy-readiness&propertyId=prop-2",
        state: "pending",
        reviewedAt: null,
      })
    );
    expect(result.items[0].supportingSignals.map((signal) => signal.key)).toEqual(
      expect.arrayContaining(["high_vacancy", "projected_vacancy_risk", "vacancy_risk", "summary.vacancyRate"])
    );
  });

  it("suppresses portfolio focus decisions for property-filtered views and returns empty state when signals are weak", () => {
    const result = deriveAgentDecisions({
      filters: {
        propertyId: "prop-1",
      },
      deltas: {
        summary: {
          vacancyRate: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          applicationConversionRate: { current: 0.5, prior: 0.5, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          activeApplications: { current: 2, prior: 2, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          openWorkOrders: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          maintenanceCostCents: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          estimatedScheduledRentCents: { current: 300000, prior: 300000, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          leasesEndingSoon: { current: 0, prior: 0, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
        },
        applications: {
          submitted: { current: 2, prior: 2, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
          conversionRate: { current: 0.5, prior: 0.5, absoluteDelta: 0, relativeDelta: 0, direction: "flat" },
        },
      },
      alerts: [],
      predictiveMetrics: [
        {
          key: "projected_vacancy_risk",
          label: "Projected vacancy risk",
          riskLevel: "low",
          status: "supported",
          explanation: "Current occupancy is stable and vacancy is not worsening materially versus the prior period.",
        },
      ],
      benchmarking: {
        summary: {
          propertyCount: 1,
          comparedPropertyCount: 1,
          benchmarkDimensions: ["vacancyRate"],
        },
        comparisons: [],
        insights: [],
        filters: {
          period: "90d",
          propertyId: "prop-1",
          from: "2026-01-20T00:00:00.000Z",
          to: "2026-04-20T00:00:00.000Z",
        },
      },
    });

    expect(result.items).toEqual([]);
  });

  it("assigns stable workflow hooks for each supported decision type", () => {
    const result = deriveAgentDecisions({
      filters: {
        propertyId: null,
      },
      deltas: {
        summary: {
          vacancyRate: { current: 0.2, prior: 0.05, absoluteDelta: 0.15, relativeDelta: 3, direction: "worse" },
          applicationConversionRate: {
            current: 0.1,
            prior: 0.4,
            absoluteDelta: -0.3,
            relativeDelta: -0.75,
            direction: "worse",
          },
          activeApplications: { current: 1, prior: 4, absoluteDelta: -3, relativeDelta: -0.75, direction: "worse" },
          openWorkOrders: { current: 5, prior: 1, absoluteDelta: 4, relativeDelta: 4, direction: "worse" },
          maintenanceCostCents: {
            current: 90000,
            prior: 30000,
            absoluteDelta: 60000,
            relativeDelta: 2,
            direction: "worse",
          },
          estimatedScheduledRentCents: {
            current: 500000,
            prior: 650000,
            absoluteDelta: -150000,
            relativeDelta: -0.23,
            direction: "worse",
          },
          leasesEndingSoon: { current: 4, prior: 1, absoluteDelta: 3, relativeDelta: 3, direction: "worse" },
        },
        applications: {
          submitted: { current: 1, prior: 5, absoluteDelta: -4, relativeDelta: -0.8, direction: "worse" },
          conversionRate: {
            current: 0.1,
            prior: 0.4,
            absoluteDelta: -0.3,
            relativeDelta: -0.75,
            direction: "worse",
          },
        },
      },
      alerts: [
        {
          id: "lease",
          type: "lease_expiry",
          severity: "high",
          status: "active",
          title: "Lease expiries are elevated",
          message: "Lease expiries are elevated in the current view.",
          propertyId: "prop-1",
          detectedAt: "2026-04-20T00:00:00.000Z",
          lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
          notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
        },
        {
          id: "vacancy",
          type: "high_vacancy",
          severity: "high",
          status: "active",
          title: "Vacancy is elevated",
          message: "Vacancy is elevated in the current view.",
          propertyId: "prop-2",
          detectedAt: "2026-04-20T00:00:00.000Z",
          lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
          notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
        },
        {
          id: "applications",
          type: "application_conversion_drop",
          severity: "high",
          status: "active",
          title: "Application conversion dropped",
          message: "Application conversion dropped in the current view.",
          propertyId: "prop-3",
          detectedAt: "2026-04-20T00:00:00.000Z",
          lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
          notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
        },
        {
          id: "maintenance",
          type: "work_order_concentration",
          severity: "high",
          status: "active",
          title: "Work orders are concentrated",
          message: "Work orders are concentrated in one property.",
          propertyId: "prop-4",
          detectedAt: "2026-04-20T00:00:00.000Z",
          lastEvaluatedAt: "2026-04-20T00:00:00.000Z",
          notification: { inAppEligible: true, emailEligible: true, automationEligible: false },
        },
      ],
      predictiveMetrics: [
        {
          key: "projected_vacancy_risk",
          label: "Projected vacancy risk",
          riskLevel: "high",
          status: "supported",
          explanation: "Vacancy risk remains elevated.",
          supportingValues: { topPropertyId: "prop-2" },
        },
        {
          key: "projected_lease_expiry_concentration",
          label: "Projected lease expiry concentration",
          riskLevel: "high",
          status: "supported",
          explanation: "Lease expiry concentration remains elevated.",
          supportingValues: { topPropertyId: "prop-1" },
        },
        {
          key: "projected_application_slowdown_risk",
          label: "Projected application slowdown risk",
          riskLevel: "high",
          status: "supported",
          explanation: "Application slowdown risk remains elevated.",
          supportingValues: { topPropertyId: "prop-3" },
        },
        {
          key: "projected_maintenance_burden_risk",
          label: "Projected maintenance burden risk",
          riskLevel: "high",
          status: "supported",
          explanation: "Maintenance burden remains elevated.",
          supportingValues: { topPropertyId: "prop-4" },
        },
        {
          key: "projected_revenue_pressure_signal",
          label: "Projected revenue pressure signal",
          riskLevel: "high",
          status: "supported",
          explanation: "Revenue pressure remains elevated.",
          supportingValues: { topPropertyId: "prop-5" },
        },
      ],
      benchmarking: {
        summary: {
          propertyCount: 5,
          comparedPropertyCount: 5,
          benchmarkDimensions: ["vacancyRate"],
        },
        comparisons: [
          {
            propertyId: "prop-2",
            propertyName: "Beta",
            metrics: {
              vacancyRate: 0.5,
              occupancyRate: 0.5,
              applicationVolume: 1,
              applicationConversionRate: 0.1,
              openWorkOrders: 1,
              maintenanceCostCents: 5000,
              maintenanceCostPerUnitCents: 2500,
              leasesEndingSoon: 1,
              estimatedScheduledRentCents: 300000,
              estimatedRentPerOccupiedUnitCents: 150000,
              totalUnits: 2,
              occupiedUnits: 1,
              vacantUnits: 1,
            },
            benchmarks: {},
          },
        ],
        insights: [
          {
            type: "vacancy_risk",
            severity: "high",
            propertyId: "prop-2",
            message: "Beta has the highest vacancy pressure.",
          },
          {
            type: "maintenance_concentration",
            severity: "high",
            propertyId: "prop-4",
            message: "Maintenance is concentrated in Delta.",
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

    expect(result.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          decisionType: "review_lease_renewals",
          actionKey: "open_lease_renewals_flow",
          actionLabel: "Open renewals focus",
          destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
          workflowCategory: "lease_renewals",
          automationEligible: false,
          automationState: "manual_only",
          automationReason: null,
          executionMappingState: "none",
          executionMapping: null,
        }),
        expect.objectContaining({
          decisionType: "reduce_vacancy_risk",
          actionKey: "open_vacancy_readiness_flow",
          workflowCategory: "vacancy_readiness",
        }),
        expect.objectContaining({
          decisionType: "improve_application_conversion",
          actionKey: "open_application_funnel_review_flow",
          actionLabel: "Review submitted applications",
          destination: "/applications?entry=application-funnel&status=SUBMITTED",
          workflowCategory: "application_funnel",
          automationState: "manual_only",
        }),
        expect.objectContaining({
          decisionType: "address_maintenance_backlog",
          actionKey: "open_maintenance_backlog_flow",
          actionLabel: "Open maintenance backlog",
          destination: "/work-orders?entry=maintenance-backlog&propertyId=prop-4",
          workflowCategory: "maintenance_backlog",
          automationState: "manual_only",
        }),
        expect.objectContaining({
          decisionType: "review_revenue_pressure",
          actionKey: "open_revenue_pressure_follow_up_flow",
          actionLabel: "Open revenue focus",
          destination: "/analytics?entry=revenue-pressure&propertyId=prop-5",
          workflowCategory: "revenue_follow_up",
          automationState: "manual_only",
        }),
      ])
    );
  });
});
