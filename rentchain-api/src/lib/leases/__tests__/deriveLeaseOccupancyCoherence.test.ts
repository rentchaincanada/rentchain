import { describe, expect, it } from "vitest";
import { deriveLeaseOccupancyCoherence } from "../deriveLeaseOccupancyCoherence";

describe("deriveLeaseOccupancyCoherence", () => {
  it("does not treat raw active lease status as operationally active before execution completes", () => {
    const result = deriveLeaseOccupancyCoherence({
      leaseStatus: "active",
      leaseExecutionStatus: "draft",
      occupancyStatus: "occupied",
      tenantStatus: "active",
      paymentReadinessStatus: "ready_to_configure",
    });

    expect(result.leaseOperationalState).toBe("draft");
    expect(result.coherenceStatus).toBe("review_required");
    expect(result.coherenceReason).toBe("lease_status_active_but_execution_incomplete");
    expect(result.flags.leaseMarkedActiveBeforeExecution).toBe(true);
  });

  it("derives coherent active state only when execution and occupancy agree", () => {
    const result = deriveLeaseOccupancyCoherence({
      leaseStatus: "active",
      leaseLifecycleState: "active",
      leaseExecutionStatus: "fully_executed",
      occupancyStatus: "occupied",
      tenancyStatus: "active",
      tenantStatus: "active",
      tenantLifecycleState: "active",
      paymentReadinessStatus: "ready_to_configure",
    });

    expect(result).toMatchObject({
      coherenceStatus: "coherent",
      leaseExecutionState: "executed",
      leaseOperationalState: "active",
      occupancyState: "occupied",
      tenantOperationalState: "active",
      paymentReadinessState: "ready_to_configure",
    });
    expect(result.flags.hasStateConflict).toBe(false);
  });

  it("flags active executed leases on vacant units for review instead of forcing occupancy", () => {
    const result = deriveLeaseOccupancyCoherence({
      leaseStatus: "active",
      leaseExecutionStatus: "fully_executed",
      occupancyStatus: "vacant",
      tenantStatus: "active",
    });

    expect(result.leaseOperationalState).toBe("active");
    expect(result.occupancyState).toBe("review_required");
    expect(result.flags.activeLeaseOnVacantUnit).toBe(true);
    expect(result.flags.hasStateConflict).toBe(true);
  });

  it("flags occupied units without executed active leases", () => {
    const result = deriveLeaseOccupancyCoherence({
      leaseStatus: "sent",
      leaseExecutionStatus: "ready_for_tenant_signature",
      occupancyStatus: "occupied",
      tenantStatus: "current",
    });

    expect(result.leaseOperationalState).toBe("pending_execution");
    expect(result.occupancyState).toBe("review_required");
    expect(result.flags.occupiedUnitWithoutActiveExecutedLease).toBe(true);
    expect(result.flags.tenantActiveWithoutExecutedOccupancy).toBe(true);
  });

  it("surfaces ledger payment activity separately from provider checkout readiness", () => {
    const result = deriveLeaseOccupancyCoherence({
      leaseStatus: "active",
      leaseExecutionStatus: "fully_executed",
      occupancyStatus: "occupied",
      paymentReadinessStatus: "ready_to_configure",
      ledgerPaymentCount: 2,
    });

    expect(result.paymentReadinessState).toBe("recorded_activity_present");
    expect(result.flags.paymentActivityWithoutProviderSetup).toBe(true);
    expect(result.coherenceReason).toBe("ledger_payment_activity_without_provider_payment_setup");
  });

  it("derives archived as terminal without occupancy write assumptions", () => {
    const result = deriveLeaseOccupancyCoherence({
      leaseStatus: "archived",
      leaseExecutionStatus: "fully_executed",
      occupancyStatus: "vacant",
      tenantStatus: "former",
      archivedAt: "2026-05-01T00:00:00.000Z",
    });

    expect(result).toMatchObject({
      coherenceStatus: "coherent",
      leaseOperationalState: "archived",
      occupancyState: "vacant",
      tenantOperationalState: "archived",
    });
  });
});
