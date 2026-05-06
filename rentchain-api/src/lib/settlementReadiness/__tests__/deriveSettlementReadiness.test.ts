import { describe, expect, it } from "vitest";
import { deriveSettlementReadiness } from "../deriveSettlementReadiness";

const row = {
  rowId: "obligation:pi-1",
  leaseId: "lease-1",
  paymentIntentId: "pi-1",
  rentPaymentId: "rp-1",
  propertyId: "property-1",
  unitId: "unit-1",
  tenantId: "tenant-1",
  expectedAmountCents: 200000,
  paidAmountCents: 200000,
  currency: "cad",
  obligationStatus: "paid",
  paymentIntentStatus: "reconciled",
  rentPaymentStatus: "paid",
  reconciliationStatus: "reconciled",
  evidenceStatus: "reconciled",
  source: "reconciliation",
  reasons: ["paid_amount_matches_expected"],
} as const;

describe("deriveSettlementReadiness", () => {
  it("derives deterministic read-only settlement readiness", () => {
    const readiness = deriveSettlementReadiness({
      landlordId: "landlord-1",
      obligationRows: [row as any],
      reconciliationRecords: [
        {
          reconciliationId: "recon-1",
          provider: "stripe",
          providerEventId: "evt-1",
          idempotencyKey: "key-1",
          receiptId: "receipt-1",
          paymentIntentId: "pi-1",
          reconciliationStatus: "reconciled",
          reasons: [],
          requiresManualReview: false,
          automationEligible: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      evidencePacks: [{ evidencePackId: "evidence-1", scopeId: "lease-1", status: "ready_for_review" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", scopeId: "lease-1", status: "completed" }],
      auditComplianceReadiness: { status: "ready_for_review" } as any,
    });

    expect(readiness).toEqual(
      expect.objectContaining({
        status: "ready_for_review",
        manualReviewRequired: true,
        paymentExecutionEnabled: false,
        bankingIntegrationEnabled: false,
        tokenizationEnabled: false,
      })
    );
    expect(readiness.ledgerReferences[0]).toEqual(expect.objectContaining({ status: "verified" }));
    expect(readiness.canonicalEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(["settlement_readiness_derived", "settlement_reconciliation_verified", "settlement_redaction_applied"])
    );
  });

  it("blocks readiness when reconciliation requires manual review", () => {
    const readiness = deriveSettlementReadiness({
      landlordId: "landlord-1",
      obligationRows: [{ ...row, obligationStatus: "manual_review_required", reconciliationStatus: "manual_review_required" } as any],
      reconciliationRecords: [
        {
          reconciliationId: "recon-1",
          provider: "stripe",
          providerEventId: "evt-1",
          idempotencyKey: "key-1",
          receiptId: "receipt-1",
          paymentIntentId: "pi-1",
          reconciliationStatus: "manual_review_required",
          reasons: ["mismatch"],
          requiresManualReview: true,
          automationEligible: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      evidencePacks: [{ evidencePackId: "evidence-1", scopeId: "lease-1" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", scopeId: "lease-1" }],
    });

    expect(readiness.status).toBe("blocked");
    expect(readiness.blockedReasons.join(" ")).toMatch(/manual/i);
  });

  it("returns unknown when source context is unavailable", () => {
    const readiness = deriveSettlementReadiness({ landlordId: "landlord-1" });

    expect(readiness.status).toBe("unknown");
    expect(readiness.summary.totalReferences).toBe(0);
  });

  it("excludes sensitive payment and banking payloads", () => {
    const readiness = deriveSettlementReadiness({
      landlordId: "landlord-1",
      obligationRows: [row as any],
      paymentEvents: [{ rawBankAccount: "123456", pciPayload: "card-data" }],
      evidencePacks: [{ evidencePackId: "evidence-1", scopeId: "lease-1" }],
      operatorReviewSessions: [{ reviewSessionId: "review-1", scopeId: "lease-1" }],
    });

    const serialized = JSON.stringify(readiness);
    expect(serialized).not.toContain("123456");
    expect(serialized).not.toContain("card-data");
    expect(readiness.redactions).toEqual(expect.arrayContaining(["Raw bank account and routing data are excluded."]));
  });
});
