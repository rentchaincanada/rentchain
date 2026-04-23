import { beforeEach, describe, expect, it, vi } from "vitest";

type StoredDoc = { id: string; data: any };

const { dbMock, resetDb, seedDoc, readDoc } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, StoredDoc>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name)!;
  }

  return {
    dbMock: {
      collection: (name: string) => ({
        get: async () => {
          const docs = Array.from(ensureCollection(name).values()).map((entry) => ({
            id: entry.id,
            data: () => entry.data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
        doc: (id: string) => ({
          id,
          get: async () => {
            const entry = ensureCollection(name).get(id);
            return {
              id,
              exists: Boolean(entry),
              data: () => entry?.data,
            };
          },
          set: async (data: any) => {
            ensureCollection(name).set(id, { id, data });
          },
        }),
      }),
    },
    resetDb: () => {
      collections.clear();
    },
    seedDoc: (collection: string, id: string, data: any) => {
      ensureCollection(collection).set(id, { id, data });
    },
    readDoc: (collection: string, id: string) => ensureCollection(collection).get(id)?.data || null,
  };
});

vi.mock("../../../config/firebase", () => ({
  db: dbMock,
}));

describe("loadLandlordAnalyticsSnapshot", () => {
  beforeEach(() => {
    vi.resetModules();
    resetDb();
  });

  it("returns only landlord-scoped analytics and respects property filters", async () => {
    const now = Date.UTC(2026, 3, 20, 12, 0, 0, 0);

    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Alpha" });
    seedDoc("properties", "prop-2", { landlordId: "landlord-1", name: "Beta" });
    seedDoc("properties", "prop-3", { landlordId: "landlord-2", name: "Gamma" });

    seedDoc("units", "unit-1", { landlordId: "landlord-1", propertyId: "prop-1", status: "occupied" });
    seedDoc("units", "unit-2", { landlordId: "landlord-1", propertyId: "prop-2", status: "vacant" });
    seedDoc("units", "unit-3", { landlordId: "landlord-2", propertyId: "prop-3", status: "occupied" });

    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      status: "active",
      endDate: new Date(now + 25 * 24 * 60 * 60 * 1000).toISOString(),
      monthlyRent: 1650,
    });

    seedDoc("rentalApplications", "app-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      createdAt: now - 3 * 24 * 60 * 60 * 1000,
      submittedAt: now - 3 * 24 * 60 * 60 * 1000,
      status: "in_review",
    });
    seedDoc("rentalApplications", "app-2", {
      landlordId: "landlord-2",
      propertyId: "prop-3",
      createdAt: now - 3 * 24 * 60 * 60 * 1000,
      submittedAt: now - 3 * 24 * 60 * 60 * 1000,
      status: "approved",
      approvedAt: now - 2 * 24 * 60 * 60 * 1000,
    });

    seedDoc("workOrders", "wo-1", {
      landlordId: "landlord-1",
      propertyId: "prop-2",
      status: "completed",
      serviceCompletedAt: now - 1 * 24 * 60 * 60 * 1000,
      cost: { actualCostCents: 8200, submittedAt: now - 1 * 24 * 60 * 60 * 1000 },
    });
    seedDoc("workOrders", "wo-2", {
      landlordId: "landlord-2",
      propertyId: "prop-3",
      status: "open",
      createdAt: now - 1 * 24 * 60 * 60 * 1000,
    });
    seedDoc("landlordDecisionStates", "landlord-1__review_lease_renewals:prop-1", {
      landlordId: "landlord-1",
      decisionId: "review_lease_renewals:prop-1",
      state: "reviewed",
      reviewedAt: "2026-04-20T12:00:00.000Z",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    });
    seedDoc("landlordDecisionStates", "landlord-1__reduce_vacancy_risk:prop-1", {
      landlordId: "landlord-1",
      decisionId: "reduce_vacancy_risk:prop-1",
      state: "snoozed",
      snoozedAt: "2026-04-20T12:00:00.000Z",
      snoozedUntil: "2026-04-28T12:00:00.000Z",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    });

    const { loadLandlordAnalyticsSnapshot } = await import("../landlordAnalyticsSnapshot");

    const scoped = await loadLandlordAnalyticsSnapshot({
      landlordId: "landlord-1",
      propertyId: "prop-1",
      period: "90d",
      now,
    });

    expect(scoped.filters.propertyId).toBe("prop-1");
    expect(scoped.leasing.totalProperties).toBe(1);
    expect(scoped.leasing.totalUnits).toBe(1);
    expect(scoped.summary.occupiedUnits).toBe(1);
    expect(scoped.summary.maintenanceCostCents).toBe(0);
    expect(scoped.summary.estimatedScheduledRentCents).toBe(165000);
    expect(scoped.summary.activeApplications).toBe(1);
    expect(scoped.comparisons.deltas.summary.estimatedScheduledRentCents.direction).toBe("flat");
    expect(scoped.comparisons.deltas.summary.activeApplications.direction).toBe("flat");
    expect(scoped.predictive.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "projected_vacancy_risk",
          status: "supported",
        }),
      ])
    );
    expect(scoped.decisions.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "review_lease_renewals:prop-1",
          decisionType: "review_lease_renewals",
          recommendedAction: "Review renewals",
          state: "reviewed",
          reviewedAt: "2026-04-20T12:00:00.000Z",
          actionKey: "open_lease_renewals_flow",
          actionLabel: "Open renewals focus",
          destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
          workflowCategory: "lease_renewals",
          automationEligible: false,
          automationState: "blocked",
          automationReason: expect.stringContaining("Reviewed decisions stay manual"),
          executionMappingState: "mapped",
          executionMapping: expect.objectContaining({
            action: "lease.auto_send_notice",
            resourceType: "lease",
            resourceId: "lease-1",
            prerequisitesMet: false,
          }),
          executionInputState: "partial",
          executionInputReason: expect.stringContaining("rentChangeMode"),
          executionInputMissingFields: [
            "rentChangeMode",
            "newTermType",
            "newLeaseStartDate",
            "newLeaseEndDate",
            "responseDeadlineAt",
          ],
          executionInput: expect.objectContaining({
            noticeType: "renewal_offer",
            legalTemplateKey: "ns.fixed_term.renewal_offer.v1",
            noticeRuleVersion: "ns-v1",
            province: "NS",
            leaseType: "fixed_term",
            currentRent: 1650,
            rentChangeMode: null,
            proposedRent: null,
            newTermType: null,
            newLeaseStartDate: null,
            newLeaseEndDate: null,
            responseDeadlineAt: null,
          }),
        }),
      ])
    );
    expect(scoped.decisions.items.find((decision) => decision.id === "reduce_vacancy_risk:prop-1")).toBeUndefined();
    expect(scoped.decisionOutcomeAnalytics).toEqual({
      scope: "landlord_all_time",
      appearedCount: 3,
      reviewedCount: 0,
      dismissedCount: 0,
      executedCount: 0,
      failedExecutionCount: 0,
      resolvedCount: 0,
      resolutionRate: 0,
      medianTimeToResolutionHours: null,
      averageTimeToExecutionHours: null,
    });
    expect(scoped.propertyMetrics).toEqual([
      expect.objectContaining({
        propertyId: "prop-1",
        metrics: expect.objectContaining({
          totalUnits: 1,
          occupiedUnits: 1,
          estimatedScheduledRentCents: 165000,
        }),
        deltas: expect.objectContaining({
          occupiedUnits: expect.objectContaining({
            direction: "flat",
          }),
        }),
      }),
    ]);
  });

  it("returns a stable empty payload when a landlord has no analytics data", async () => {
    const now = Date.UTC(2026, 3, 20, 12, 0, 0, 0);
    const { loadLandlordAnalyticsSnapshot } = await import("../landlordAnalyticsSnapshot");
    const result = await loadLandlordAnalyticsSnapshot({
      landlordId: "landlord-1",
      now,
    });

    expect(result.summary.occupiedUnits).toBe(0);
    expect(result.summary.maintenanceCostCents).toBe(0);
    expect(result.insights).toEqual([]);
    expect(result.predictive.metrics.every((metric) => metric.status === "insufficient_data")).toBe(true);
    expect(result.decisions.items).toEqual([]);
    expect(result.decisionOutcomeAnalytics.appearedCount).toBe(0);
    expect(result.propertyMetrics).toEqual([]);
    expect(result.comparisons.deltas.summary.maintenanceCostCents.direction).toBe("flat");
  });

  it("promotes a complete mapped lease-renewal decision to ready automation state", async () => {
    const nowIso = "2026-04-20T12:00:00.000Z";
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Alpha",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    seedDoc("units", "unit-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      unitNumber: "1",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      unitNumber: "1",
      status: "active",
      leaseType: "fixed_term",
      province: "NS",
      currentRent: 1650,
      monthlyRent: 1650,
      startDate: "2025-05-11",
      endDate: "2026-05-10",
      renewalRentChangeMode: "no_change",
      renewalDecisionDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
      renewalNewTermType: "fixed_term",
      renewalNewLeaseStartDate: "2026-05-11",
      renewalNewLeaseEndDate: "2027-05-10",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    seedDoc("events", "event-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      type: "lease_expiry",
      severity: "high",
      status: "active",
      message: "Lease is expiring soon.",
      createdAt: nowIso,
      occurredAt: nowIso,
    });

    const { loadLandlordAnalyticsSnapshot } = await import("../landlordAnalyticsSnapshot");
    const result = await loadLandlordAnalyticsSnapshot({
      landlordId: "landlord-1",
      propertyId: "prop-1",
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result.decisions.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "review_lease_renewals:prop-1",
          automationEligible: true,
          automationState: "ready",
          executionMappingState: "mapped",
          executionInputState: "complete",
          executionInputMissingFields: [],
        }),
      ])
    );
  });

  it("derives one exact maintenance approval decision when one approval-ready work order is visible", async () => {
    const nowIso = "2026-04-20T12:00:00.000Z";
    seedDoc("properties", "prop-2", {
      landlordId: "landlord-1",
      name: "Beta",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    seedDoc("workOrders", "wo-1", {
      landlordId: "landlord-1",
      propertyId: "prop-2",
      propertyLabel: "Beta",
      unitLabel: "Unit 2",
      title: "Replace sink valve",
      status: "completed",
      cost: {
        actualCostCents: 32000,
        currency: "CAD",
        submittedByRole: "contractor",
        submittedById: "contractor-1",
        submittedAt: Date.UTC(2026, 3, 19, 12, 0, 0, 0),
        reviewStatus: "pending_review",
        linkedExpenseStatus: "not_linked",
        latestRevisionNumber: 1,
      },
      costAttachments: [
        {
          id: "attachment-1",
          uploadedAt: Date.UTC(2026, 3, 19, 12, 0, 0, 0),
          uploadedByRole: "contractor",
          uploadedById: "contractor-1",
          visibility: "landlord_only",
          fileName: "invoice.pdf",
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    });

    const { loadLandlordAnalyticsSnapshot } = await import("../landlordAnalyticsSnapshot");
    const result = await loadLandlordAnalyticsSnapshot({
      landlordId: "landlord-1",
      propertyId: "prop-2",
      now: Date.UTC(2026, 3, 20, 12, 0, 0, 0),
    });

    expect(result.decisions.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "approve_maintenance_cost:wo-1",
          decisionType: "approve_maintenance_cost",
          actionKey: "open_maintenance_cost_approval_flow",
          actionLabel: "Open cost approval",
          destination: "/work-orders?entry=maintenance-cost-approval&propertyId=prop-2&workOrderId=wo-1",
          workflowCategory: "maintenance_cost_approval",
          recommendedAction: "Review work order approval",
          automationEligible: false,
          automationState: "blocked",
          automationReason: expect.stringContaining("explicit maintenance execution is not enabled yet"),
          executionMappingState: "mapped",
          executionMapping: expect.objectContaining({
            action: "maintenance.auto_approve_cost",
            resourceType: "work_order",
            resourceId: "wo-1",
            prerequisitesMet: true,
          }),
          executionInputState: "complete",
          executionInputMissingFields: [],
          executionInput: expect.objectContaining({
            actualCostCents: 32000,
            reviewStatus: "pending_review",
            hasSupportingEvidence: true,
            withinAutoApprovalThreshold: true,
          }),
        }),
      ])
    );
  });

  it("emits a first-seen decision.appeared event once across repeated snapshot loads", async () => {
    const now = Date.UTC(2026, 3, 20, 12, 0, 0, 0);

    seedDoc("properties", "prop-1", { landlordId: "landlord-1", name: "Alpha" });
    seedDoc("units", "unit-1", { landlordId: "landlord-1", propertyId: "prop-1", status: "occupied" });
    seedDoc("leases", "lease-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      status: "active",
      leaseType: "fixed_term",
      province: "NS",
      monthlyRent: 1650,
      endDate: new Date(now + 25 * 24 * 60 * 60 * 1000).toISOString(),
    });
    seedDoc("events", "event-1", {
      landlordId: "landlord-1",
      propertyId: "prop-1",
      type: "lease_expiry",
      severity: "high",
      status: "active",
      message: "Lease is expiring soon.",
      createdAt: now,
      occurredAt: now,
    });

    const { loadLandlordAnalyticsSnapshot } = await import("../landlordAnalyticsSnapshot");

    await loadLandlordAnalyticsSnapshot({
      landlordId: "landlord-1",
      propertyId: "prop-1",
      now,
    });

    expect(readDoc("canonicalEvents", "decision_appeared__landlord-1__review_lease_renewals:prop-1")).toEqual(
      expect.objectContaining({
        type: "decision.appeared",
        action: "appeared",
        visibility: "landlord",
        resource: expect.objectContaining({
          type: "analytics_decision",
          id: "review_lease_renewals:prop-1",
        }),
        metadata: expect.objectContaining({
          landlordId: "landlord-1",
          decisionId: "review_lease_renewals:prop-1",
          decisionType: "review_lease_renewals",
          source: "landlord_analytics_decisions",
        }),
      })
    );

    await loadLandlordAnalyticsSnapshot({
      landlordId: "landlord-1",
      propertyId: "prop-1",
      now: now + 60_000,
    });

    const canonicalEventDocs = await dbMock.collection("canonicalEvents").get();
    const appearanceEvents = (canonicalEventDocs.docs || [])
      .map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }))
      .filter(
        (event: any) =>
          event.type === "decision.appeared" && event.metadata?.decisionId === "review_lease_renewals:prop-1"
      );

    expect(appearanceEvents).toHaveLength(1);
    expect(appearanceEvents[0].id).toBe("decision_appeared__landlord-1__review_lease_renewals:prop-1");
  });

  it("derives all-time decision outcome analytics from canonical decision events", async () => {
    const nowIso = "2026-04-20T12:00:00.000Z";
    seedDoc("properties", "prop-1", {
      landlordId: "landlord-1",
      name: "Alpha",
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    seedDoc("canonicalEvents", "event-appeared", {
      type: "decision.appeared",
      visibility: "landlord",
      resource: { type: "analytics_decision", id: "decision-1" },
      metadata: { landlordId: "landlord-1", decisionId: "decision-1" },
      occurredAt: "2026-04-01T12:00:00.000Z",
    });
    seedDoc("canonicalEvents", "event-reviewed", {
      type: "decision.reviewed",
      visibility: "landlord",
      resource: { type: "analytics_decision", id: "decision-1" },
      metadata: { landlordId: "landlord-1", decisionId: "decision-1" },
      occurredAt: "2026-04-03T12:00:00.000Z",
    });
    seedDoc("canonicalEvents", "event-appeared-2", {
      type: "decision.appeared",
      visibility: "landlord",
      resource: { type: "analytics_decision", id: "decision-2" },
      metadata: { landlordId: "landlord-1", decisionId: "decision-2" },
      occurredAt: "2026-04-05T12:00:00.000Z",
    });
    seedDoc("canonicalEvents", "event-executed", {
      type: "decision.executed",
      visibility: "landlord",
      resource: { type: "analytics_decision", id: "decision-2" },
      metadata: { landlordId: "landlord-1", decisionId: "decision-2" },
      occurredAt: "2026-04-07T12:00:00.000Z",
    });
    seedDoc("canonicalEvents", "event-failed", {
      type: "decision.execution_failed",
      visibility: "landlord",
      resource: { type: "analytics_decision", id: "decision-3" },
      metadata: { landlordId: "landlord-1", decisionId: "decision-3" },
      occurredAt: "2026-04-06T12:00:00.000Z",
    });

    const { loadLandlordAnalyticsSnapshot } = await import("../landlordAnalyticsSnapshot");
    const result = await loadLandlordAnalyticsSnapshot({
      landlordId: "landlord-1",
      now: Date.parse(nowIso),
    });

    expect(result.decisionOutcomeAnalytics).toEqual({
      scope: "landlord_all_time",
      appearedCount: 2,
      reviewedCount: 1,
      dismissedCount: 0,
      executedCount: 1,
      failedExecutionCount: 1,
      resolvedCount: 2,
      resolutionRate: 1,
      medianTimeToResolutionHours: 48,
      averageTimeToExecutionHours: 48,
    });
  });
});
