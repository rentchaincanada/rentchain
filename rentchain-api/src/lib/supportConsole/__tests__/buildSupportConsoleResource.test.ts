import { beforeEach, describe, expect, it, vi } from "vitest";

const { collections, dbMock } = vi.hoisted(() => {
  const collections = new Map<string, Map<string, any>>();

  function ensureCollection(name: string) {
    if (!collections.has(name)) {
      collections.set(name, new Map<string, any>());
    }
    return collections.get(name)!;
  }

  return {
    collections,
    dbMock: {
      collection: (name: string) => ({
        doc: (id?: string) => ({
          id,
          async get() {
            return {
              id,
              exists: ensureCollection(name).has(String(id)),
              data: () => ensureCollection(name).get(String(id)),
            };
          },
        }),
        async get() {
          const docs = Array.from(ensureCollection(name).entries()).map(([id, data]) => ({
            id,
            data: () => data,
          }));
          return { docs, empty: docs.length === 0, size: docs.length };
        },
      }),
    },
  };
});

vi.mock("../../../config/firebase", () => ({
  db: dbMock,
}));

function seedDoc(collectionName: string, id: string, data: any) {
  if (!collections.has(collectionName)) {
    collections.set(collectionName, new Map<string, any>());
  }
  collections.get(collectionName)!.set(id, { id, ...data });
}

describe("buildSupportConsoleResource", () => {
  beforeEach(() => {
    collections.clear();
  });

  it("builds an application console with timeline, insight, policy, automation, and reconciliation", async () => {
    seedDoc("rentalApplications", "app-1", {
      applicantName: "Alex Tenant",
      propertyId: "prop-1",
      unitId: "unit-2",
      screeningStatus: "complete",
      screeningMonetization: {
        quoteStatus: "generated",
        quoteGeneratedAt: "2026-04-10T09:00:00.000Z",
        paymentStatus: "paid",
        paidAt: "2026-04-10T10:05:00.000Z",
        fulfillmentStatus: "completed",
        quoteId: "quote-1",
        checkoutSessionId: "cs_123",
      },
    });
    seedDoc("screeningOrders", "order-1", {
      applicationId: "app-1",
      stripeCheckoutSessionId: "cs_123",
      updatedAt: Date.parse("2026-04-10T10:10:00.000Z"),
    });
    seedDoc("financialTransactions", "tx-1", {
      applicationId: "app-1",
      type: "payment_succeeded",
      createdAt: Date.parse("2026-04-10T10:05:00.000Z"),
    });
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "application.created",
      domain: "application",
      action: "created",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-10T09:00:00.000Z",
      recordedAt: "2026-04-10T09:00:00.000Z",
      visibility: "internal",
      summary: "Application created",
    });
    seedDoc("canonicalEvents", "event-2", {
      version: "v1",
      type: "screening.quote_generated",
      domain: "screening",
      action: "quote_generated",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "screening_order", id: "order-1", parentType: "rental_application", parentId: "app-1" },
      occurredAt: "2026-04-10T09:05:00.000Z",
      recordedAt: "2026-04-10T09:05:00.000Z",
      visibility: "internal",
      summary: "Screening quote generated",
      metadata: { applicationId: "app-1" },
    });
    seedDoc("canonicalEvents", "event-3", {
      version: "v1",
      type: "policy.evaluated",
      domain: "policy",
      action: "evaluated",
      status: "allow",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-10T09:06:00.000Z",
      recordedAt: "2026-04-10T09:06:00.000Z",
      visibility: "internal",
      summary: "Policy evaluated for screening.start_checkout",
      metadata: {
        domain: "screening",
        action: "start_checkout",
        outcome: "allow",
        topReasonCode: "SCREENING_READY",
      },
    });
    seedDoc("canonicalEvents", "event-4", {
      version: "v1",
      type: "automation.executed",
      domain: "system",
      action: "executed",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "rental_application", id: "app-1" },
      occurredAt: "2026-04-10T09:07:00.000Z",
      recordedAt: "2026-04-10T09:07:00.000Z",
      visibility: "internal",
      summary: "Automation executed for screening.auto_start_checkout",
      metadata: {
        action: "screening.auto_start_checkout",
        executed: true,
        skipped: false,
        policyOutcome: "allow",
      },
    });
    seedDoc("canonicalEvents", "event-5", {
      version: "v1",
      type: "screening.paid",
      domain: "screening",
      action: "paid",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "screening_order", id: "order-1", parentType: "rental_application", parentId: "app-1" },
      occurredAt: "2026-04-10T10:05:00.000Z",
      recordedAt: "2026-04-10T10:05:00.000Z",
      visibility: "internal",
      summary: "Screening payment completed",
      metadata: { applicationId: "app-1" },
    });
    seedDoc("canonicalEvents", "event-6", {
      version: "v1",
      type: "screening.completed",
      domain: "screening",
      action: "completed",
      actor: { type: "system", role: "system", id: "system" },
      resource: { type: "screening_order", id: "order-1", parentType: "rental_application", parentId: "app-1" },
      occurredAt: "2026-04-10T10:10:00.000Z",
      recordedAt: "2026-04-10T10:10:00.000Z",
      visibility: "internal",
      summary: "Screening completed",
      metadata: { applicationId: "app-1" },
    });

    const { buildSupportConsoleResource } = await import("../buildSupportConsoleResource");
    const result = await buildSupportConsoleResource({
      resourceType: "application",
      resourceId: "app-1",
    });

    expect(result?.resource).toEqual(
      expect.objectContaining({
        type: "application",
        id: "app-1",
        title: "Alex Tenant",
      })
    );
    expect(result?.timeline[0]).toEqual(
      expect.objectContaining({
        title: "Screening completed",
        domain: "screening",
      })
    );
    expect(result?.insight).toEqual(
      expect.objectContaining({
        domain: "screening",
        summary: expect.objectContaining({
          lifecycleState: "completed",
        }),
      })
    );
    expect(result?.policyDecisions).toEqual([
      expect.objectContaining({
        action: "start_checkout",
        outcome: "allow",
        reasonCodes: ["SCREENING_READY"],
      }),
    ]);
    expect(result?.automation).toEqual([
      expect.objectContaining({
        action: "screening.auto_start_checkout",
        executed: true,
        skipped: false,
      }),
    ]);
    expect(result?.reconciliation).toEqual(
      expect.objectContaining({
        status: "fulfilled",
      })
    );
    expect(result?.debug).toEqual(
      expect.objectContaining({
        canonicalEventCount: 6,
        domainsPresent: ["application", "policy", "screening", "system"],
        identifiers: expect.objectContaining({
          propertyId: "prop-1",
          checkoutSessionId: "***_123",
          quoteId: "***te-1",
          screeningOrderId: "***er-1",
        }),
      })
    );
    expect(result?.governance).toEqual({
      sensitivity: "restricted",
      metadataOnly: true,
      retentionCategory: "support_diagnostics",
      redactionApplied: true,
    });
  });

  it("builds a maintenance console without reconciliation", async () => {
    seedDoc("maintenanceRequests", "maint-1", {
      title: "Leaking sink",
      propertyId: "prop-9",
      unitId: "unit-3",
      status: "assigned",
    });
    seedDoc("canonicalEvents", "event-1", {
      version: "v1",
      type: "maintenance.request_created",
      domain: "maintenance",
      action: "request_created",
      actor: { type: "tenant", role: "tenant", id: "tenant-1" },
      resource: { type: "maintenance_request", id: "maint-1" },
      occurredAt: "2026-04-11T09:00:00.000Z",
      recordedAt: "2026-04-11T09:00:00.000Z",
      visibility: "landlord",
      summary: "Maintenance request submitted",
    });
    seedDoc("canonicalEvents", "event-2", {
      version: "v1",
      type: "policy.evaluated",
      domain: "policy",
      action: "evaluated",
      status: "review",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "work_order", id: "wo-1" },
      occurredAt: "2026-04-11T10:00:00.000Z",
      recordedAt: "2026-04-11T10:00:00.000Z",
      visibility: "internal",
      summary: "Policy evaluated for maintenance.approve_cost",
      metadata: {
        domain: "maintenance",
        action: "approve_cost",
        outcome: "review",
        topReasonCode: "MAINTENANCE_COST_REVIEW_REQUIRED",
        maintenanceRequestId: "maint-1",
      },
    });
    seedDoc("canonicalEvents", "event-3", {
      version: "v1",
      type: "automation.skipped",
      domain: "system",
      action: "skipped",
      actor: { type: "landlord", role: "landlord", id: "landlord-1" },
      resource: { type: "work_order", id: "wo-1" },
      occurredAt: "2026-04-11T10:00:01.000Z",
      recordedAt: "2026-04-11T10:00:01.000Z",
      visibility: "internal",
      summary: "Automation skipped for maintenance.auto_approve_cost",
      metadata: {
        action: "maintenance.auto_approve_cost",
        executed: false,
        skipped: true,
        reason: "MAINTENANCE_AUTO_APPROVE_COST_POLICY_REVIEW_REQUIRED",
        maintenanceRequestId: "maint-1",
      },
    });

    const { buildSupportConsoleResource } = await import("../buildSupportConsoleResource");
    const result = await buildSupportConsoleResource({
      resourceType: "maintenance",
      resourceId: "maint-1",
    });

    expect(result?.resource).toEqual(
      expect.objectContaining({
        type: "maintenance",
        title: "Leaking sink",
      })
    );
    expect(result?.insight).toEqual(
      expect.objectContaining({
        domain: "maintenance",
      })
    );
    expect(result?.policyDecisions[0]).toEqual(
      expect.objectContaining({
        action: "approve_cost",
        outcome: "review",
      })
    );
    expect(result?.automation[0]).toEqual(
      expect.objectContaining({
        action: "maintenance.auto_approve_cost",
        executed: false,
        skipped: true,
      })
    );
    expect(result?.reconciliation).toBeNull();
  });

  it("returns a stable missing-resource response", async () => {
    const { buildSupportConsoleResource } = await import("../buildSupportConsoleResource");
    const result = await buildSupportConsoleResource({
      resourceType: "lease",
      resourceId: "lease-missing",
    });

    expect(result).toEqual({
      resource: {
        type: "lease",
        id: "lease-missing",
        title: null,
        subtitle: null,
        status: null,
        parentType: null,
        parentId: null,
      },
      timeline: [],
      insight: null,
      policyDecisions: [],
      automation: [],
      reconciliation: null,
      sla: null,
      assignment: null,
      resolution: null,
      watch: null,
      debug: {
        canonicalEventCount: 0,
        domainsPresent: [],
        identifiers: {},
      },
      governance: {
        sensitivity: "restricted",
        metadataOnly: true,
        retentionCategory: "support_diagnostics",
        redactionApplied: true,
      },
    });
  });
});
