import { describe, expect, it } from "vitest";
import {
  buildDecisionContextLinks,
  buildDecisionEvidenceItems,
  findRelatedDelinquencySignal,
  findRelatedObligationRow,
} from "./decisionContext";
import type { DecisionItem } from "./decisionDisplay";

const decision: DecisionItem = {
  decisionId: "decision-1",
  leaseId: "lease-1",
  propertyId: "property-1",
  unitId: "unit-1",
  tenantId: "tenant-1",
  paymentIntentId: "pi-1",
  rentPaymentId: "rp-1",
  decisionType: "review_overdue_rent",
  severity: "critical",
  status: "assigned",
  reason: "Rent past due date",
  metadata: {
    signalId: "signal-1",
    signalType: "overdue",
    obligationStatus: "missing",
    outstandingAmountCents: 145000,
  },
  latestAction: {
    actionId: "action-1",
    decisionId: "decision-1",
    actionType: "assigned",
    nextStatus: "assigned",
    actorEmail: "ops@example.com",
    createdAt: "2026-05-05T12:00:00.000Z",
  },
};

describe("decisionContext", () => {
  it("builds deterministic context links from available identifiers", () => {
    expect(buildDecisionContextLinks(decision, { includeAdminReviewLink: true })).toEqual([
      expect.objectContaining({ key: "lease", label: "Lease summary", href: "/leases/lease-1/summary" }),
      expect.objectContaining({ key: "ledger", label: "Payment ledger", href: "/leases/lease-1/ledger" }),
      expect.objectContaining({ key: "property", label: "Property / unit", href: "/properties?propertyId=property-1&unitId=unit-1" }),
      expect.objectContaining({ key: "tenant", label: "Tenant", href: "/tenants?tenantId=tenant-1" }),
      expect.objectContaining({ key: "admin_review", label: "Lifecycle review", href: "/admin/lease-lifecycle-review" }),
    ]);
  });

  it("returns no links when context identifiers are unavailable", () => {
    expect(buildDecisionContextLinks({ ...decision, leaseId: null, propertyId: null, unitId: null, tenantId: null })).toEqual([]);
  });

  it("matches obligation rows and delinquency signals by stable references", () => {
    const row = {
      rowId: "row-1",
      leaseId: "lease-1",
      paymentIntentId: "pi-1",
      rentPaymentId: "rp-1",
      propertyId: "property-1",
      unitId: "unit-1",
      expectedAmountCents: 145000,
      paidAmountCents: 0,
      currency: "cad",
      obligationStatus: "missing" as const,
      evidenceStatus: "none" as const,
      source: "payment_intent" as const,
      reasons: ["expected_payment_missing"],
    };
    const signal = {
      signalId: "signal-1",
      leaseId: "lease-1",
      paymentIntentId: "pi-1",
      propertyId: "property-1",
      expectedAmountCents: 145000,
      paidAmountCents: 0,
      outstandingAmountCents: 145000,
      signalType: "overdue" as const,
      severity: "critical" as const,
      detectedAt: "2026-05-05T12:00:00.000Z",
      reasons: ["obligation_missing_after_due_date"],
    };

    expect(findRelatedObligationRow(decision, [row])).toBe(row);
    expect(findRelatedDelinquencySignal(decision, [signal])).toBe(signal);
  });

  it("builds evidence without leaking undefined values", () => {
    const items = buildDecisionEvidenceItems(decision);

    expect(items).toEqual(
      expect.arrayContaining([
        { label: "Decision reason", value: "Rent past due date" },
        { label: "Severity", value: "Critical" },
        { label: "Related delinquency signal", value: "Overdue" },
        { label: "Outstanding amount", value: "$1,450.00" },
        { label: "Provider payment reference", value: "Internal payment ID: pi-1" },
        { label: "Internal rent payment reference", value: "Internal payment ID: rp-1" },
        { label: "Last action", value: "Assigned by ops@example.com" },
      ])
    );
    expect(items.map((item) => item.value)).not.toContain("undefined");
  });
});
