import { describe, expect, it, vi } from "vitest";

vi.mock("../../stripeService", () => ({
  isStripeConfigured: () => true,
}));

vi.mock("../../rentPayments/rentPaymentService", async () => {
  const actual = await vi.importActual<typeof import("../../rentPayments/rentPaymentService")>(
    "../../rentPayments/rentPaymentService"
  );
  return {
    ...actual,
    getRentPaymentSummaryForLease: vi.fn(async ({ blockedReason }) => ({
      paymentRail: {
        enabled: false,
        enabledAt: null,
        processor: null,
        blockedReason,
      },
      latestPayment: null,
      paymentExperience: {
        history: [],
        latestStatus: null,
        retryAvailable: false,
        receiptSummary: {
          available: false,
          label: "No payment summary available yet",
          amountCents: null,
          paidAt: null,
          leaseReference: null,
        },
      },
    })),
  };
});

describe("buildLeasePaymentProjection", () => {
  it("builds the same lease/payment projection pieces from one shared helper", async () => {
    const { buildLeasePaymentProjection } = await import("../buildLeasePaymentProjection");
    const result = await buildLeasePaymentProjection({
      rawLease: {
        status: "active",
        dueDay: 1,
        paymentRailEnabled: true,
        paymentRailEnabledAt: "2026-04-28T12:00:00.000Z",
        paymentRailProcessor: "stripe",
        tenantSignedAt: "2026-04-20T12:00:00.000Z",
        landlordSignedAt: "2026-04-21T12:00:00.000Z",
      },
      lease: {
        id: "lease-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        primaryTenantId: "tenant-1",
        tenantIds: ["tenant-1"],
        propertyId: "prop-1",
        unitId: "unit-1",
        unitNumber: "1A",
        monthlyRent: 1800,
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        status: "active",
      },
      leaseId: "lease-1",
      documentUrl: "safe-document-ref",
    });

    expect(result.leaseReadiness.leaseExecution.executionStatus).toBe("fully_executed");
    expect(result.paymentReadiness.readinessStatus).toBe("ready_to_configure");
    expect(result.blockedReason).toBeNull();
    expect(result.rentPaymentSummary.paymentRail.blockedReason).toBeNull();
  });

  it("preserves blocked reason derivation when rent terms are incomplete", async () => {
    const { buildLeasePaymentProjection } = await import("../buildLeasePaymentProjection");
    const result = await buildLeasePaymentProjection({
      rawLease: {
        status: "draft",
        dueDay: null,
      },
      lease: {
        id: "lease-2",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        primaryTenantId: "tenant-1",
        tenantIds: ["tenant-1"],
        propertyId: "prop-1",
        unitId: "unit-1",
        unitNumber: "1A",
        monthlyRent: null,
        startDate: null,
        endDate: null,
        status: "draft",
      },
      leaseId: "lease-2",
      documentUrl: null,
    });

    expect(result.paymentReadiness.readinessStatus).toBe("blocked");
    expect(result.blockedReason).toBe("payment_readiness_not_ready");
    expect(result.rentPaymentSummary.paymentRail.blockedReason).toBe("payment_readiness_not_ready");
  });

  it("uses provided Form P due day metadata when the lease row is stale", async () => {
    const { buildLeasePaymentProjection } = await import("../buildLeasePaymentProjection");
    const result = await buildLeasePaymentProjection({
      rawLease: {
        status: "active",
        dueDay: null,
        tenantSignedAt: "2026-04-20T12:00:00.000Z",
        landlordSignedAt: "2026-04-21T12:00:00.000Z",
        formPFields: {
          rent_payments: {
            due_day: {
              label: "Due day",
              status: "provided",
              value: 1,
            },
          },
        },
      },
      lease: {
        id: "lease-3",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        primaryTenantId: "tenant-1",
        tenantIds: ["tenant-1"],
        propertyId: "prop-1",
        unitId: "unit-1",
        unitNumber: "1A",
        monthlyRent: 1800,
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        status: "active",
      },
      leaseId: "lease-3",
      documentUrl: "safe-document-ref",
    });

    expect(result.paymentReadiness.rentTerms.dueDateAvailable).toBe(true);
    expect(result.paymentReadiness.readinessStatus).toBe("ready_to_configure");
    expect(result.blockedReason).toBeNull();
  });
});
