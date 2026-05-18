import { describe, expect, it } from "vitest";

import {
  buildLifecycleContinuityFrontendScenario,
  buildLifecycleContinuityPaymentRow,
  lifecycleContinuityUiDates,
  lifecycleContinuityUiIds,
} from "./lifecycleContinuityFixtures";

describe("frontend lifecycle continuity fixtures", () => {
  it("builds operational labels and routes without using raw IDs as primary labels", () => {
    const scenario = buildLifecycleContinuityFrontendScenario();
    const currentLease = scenario.tenantRow.currentLease as {
      label: string;
      href: string;
    };

    expect(currentLease.label).toBe("North Towers - Unit 101 Lease");
    expect(currentLease.label).not.toContain(lifecycleContinuityUiIds.activeLeaseId);
    expect(currentLease.href).toBe(
      `/leases/${lifecycleContinuityUiIds.activeLeaseId}/summary`,
    );
    expect(scenario.tenantWorkspaceDocumentContext).toMatchObject({
      leaseId: lifecycleContinuityUiIds.activeLeaseId,
      documentStatus: "signed",
      confidence: "high",
    });
  });

  it("keeps payment, ledger, and obligation references aligned for UI regression tests", () => {
    const scenario = buildLifecycleContinuityFrontendScenario();
    const ledgerEntries = scenario.leaseLedger.ledgerEntries as Array<{
      id: string;
      paymentDocumentId: string;
      effectiveDate: string;
    }>;
    const obligations = scenario.leaseLedger.obligations as Array<{
      dueDate: string;
      paidAmount: string;
      outstandingAmount: string;
    }>;
    const paymentRow = buildLifecycleContinuityPaymentRow({
      amount: "$1,700.00",
    });

    expect(scenario.paymentRow.ledgerEntryId).toBe(ledgerEntries[0].id);
    expect(ledgerEntries[0].paymentDocumentId).toBe(scenario.paymentRow.id);
    expect(ledgerEntries[0].effectiveDate).toBe(
      lifecycleContinuityUiDates.paymentDate,
    );
    expect(obligations[0]).toMatchObject({
      dueDate: lifecycleContinuityUiDates.obligationDueDate,
      paidAmount: "$1,640.00",
      outstandingAmount: "$0.00",
    });
    expect(paymentRow.amount).toBe("$1,700.00");
    expect(buildLifecycleContinuityPaymentRow().amount).toBe("$1,640.00");
  });
});
