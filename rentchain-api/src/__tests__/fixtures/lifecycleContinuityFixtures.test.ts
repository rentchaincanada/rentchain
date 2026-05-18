import { describe, expect, it } from "vitest";

import {
  buildLifecycleContinuityLease,
  buildLifecycleContinuityScenario,
  buildLifecycleContinuityTenant,
  lifecycleContinuityDates,
  lifecycleContinuityIds,
} from "./lifecycleContinuityFixtures";

describe("lifecycle continuity fixtures", () => {
  it("builds deterministic cross-system records for the canonical lifecycle scenario", () => {
    const scenario = buildLifecycleContinuityScenario();

    expect(scenario.property.id).toBe(lifecycleContinuityIds.propertyId);
    expect(scenario.activeLease.id).toBe(lifecycleContinuityIds.activeLeaseId);
    expect(scenario.activeLease.tenantId).toBe(scenario.activeTenant.id);
    expect(scenario.activeLease.propertyId).toBe(scenario.property.id);
    expect(scenario.payment.ledgerEntryId).toBe(scenario.ledgerEntry.id);
    expect(scenario.ledgerEntry.paymentDocumentId).toBe(scenario.payment.id);
    expect(scenario.obligation.dueDate).toBe(lifecycleContinuityDates.obligationDueDate);
    expect(scenario.obligation.evidence).toEqual([
      {
        paymentDocumentId: scenario.payment.id,
        ledgerEntryId: scenario.ledgerEntry.id,
        amountCents: 164000,
        paymentDate: lifecycleContinuityDates.paymentDate,
      },
    ]);
    expect(scenario.decision.metadata).toMatchObject({
      obligationId: scenario.obligation.id,
      dueDate: lifecycleContinuityDates.obligationDueDate,
      paymentDocumentId: scenario.payment.id,
      ledgerEntryId: scenario.ledgerEntry.id,
    });
    expect(scenario.signedDocument.leaseId).toBe(scenario.activeLease.id);
    expect(scenario.generatedDocument.leaseId).toBe(scenario.upcomingLease.id);
  });

  it("keeps builder overrides isolated from later fixture calls", () => {
    const changedTenant = buildLifecycleContinuityTenant("active", {
      fullName: "Changed Tenant",
    });
    const unchangedTenant = buildLifecycleContinuityTenant("active");
    const changedLease = buildLifecycleContinuityLease("active", {
      rentCents: 175000,
    });
    const unchangedLease = buildLifecycleContinuityLease("active");

    expect(changedTenant.fullName).toBe("Changed Tenant");
    expect(unchangedTenant.fullName).toBe("John Smith");
    expect(changedLease.rentCents).toBe(175000);
    expect(unchangedLease.rentCents).toBe(164000);
  });
});
