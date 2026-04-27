import { describe, expect, it } from "vitest";
import { derivePaymentReadiness } from "../derivePaymentReadiness";

describe("derivePaymentReadiness", () => {
  it("derives not_ready when required rent terms are missing", () => {
    const result = derivePaymentReadiness({
      leaseId: "lease-1",
      monthlyRent: 1800,
      startDate: "2026-02-01",
      endDate: null,
      dueDay: null,
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      leaseExecution: { executionStatus: "draft" },
    });

    expect(result.readinessStatus).toBe("not_ready");
    expect(result.requiredNextAction).toBe("review_rent_terms");
    expect(result.rentTerms.dueDateAvailable).toBe(false);
    expect(result.paymentSetup).toEqual({
      processorConnected: false,
      moneyMovementEnabled: false,
      storedPaymentMethod: false,
    });
  });

  it("derives ready_to_configure from complete safe lease terms", () => {
    const result = derivePaymentReadiness({
      leaseId: "lease-1",
      monthlyRent: 1800,
      startDate: "2026-02-01",
      endDate: null,
      dueDay: 1,
      tenantId: "tenant-1",
      propertyId: "prop-1",
      unitId: "unit-1",
      leaseExecution: { executionStatus: "fully_executed" },
    });

    expect(result.readinessStatus).toBe("ready_to_configure");
    expect(result.requiredNextAction).toBe("confirm_payment_setup_later");
    expect(result.rentTerms.leaseExecuted).toBe(true);
    expect(result.paymentSetup).toEqual({
      processorConnected: false,
      moneyMovementEnabled: false,
      storedPaymentMethod: false,
    });
  });

  it("derives blocked when the lease record is ambiguous or blocked", () => {
    const result = derivePaymentReadiness({
      leaseId: "lease-1",
      monthlyRent: null,
      startDate: null,
      endDate: null,
      dueDay: null,
      tenantId: null,
      propertyId: null,
      unitId: null,
      leaseExecution: { executionStatus: "blocked" },
    });

    expect(result.readinessStatus).toBe("blocked");
    expect(result.requiredNextAction).toBe("complete_lease_details");
    expect(result.paymentSetup.processorConnected).toBe(false);
    expect(result.paymentSetup.moneyMovementEnabled).toBe(false);
    expect(result.paymentSetup.storedPaymentMethod).toBe(false);
  });
});
