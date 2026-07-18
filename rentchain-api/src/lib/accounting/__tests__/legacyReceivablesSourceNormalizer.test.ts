import { describe, expect, it } from "vitest";
import { legacyReceivablesEquivalenceFixtures as fixtures } from "../__fixtures__/legacyReceivablesEquivalenceFixtures";
import { normalizeLegacyReceivablesSources } from "../legacyReceivablesSourceNormalizer";
import type { NormalizeLegacyReceivablesSourcesInput } from "../legacyReceivablesSourceTypes";

function base(overrides: Partial<NormalizeLegacyReceivablesSourcesInput> = {}): NormalizeLegacyReceivablesSourcesInput {
  return {
    landlordId: "landlord-a",
    leaseId: "lease-a",
    propertyId: "property-a",
    tenantId: "tenant-a",
    tenantMappingState: "resolved",
    ownershipProof: { state: "independently_verified", landlordId: "landlord-a", leaseId: "lease-a" },
    records: [],
    ...overrides,
  };
}

describe("normalizeLegacyReceivablesSources", () => {
  it("produces stable output for equivalent linked payment evidence", () => {
    const paymentOnly = normalizeLegacyReceivablesSources(fixtures.paymentOnly);
    const linked = normalizeLegacyReceivablesSources(fixtures.linkedLedgerAndPayment);

    expect(paymentOnly.sourceState).toBe("complete");
    expect(linked.sourceState).toBe("complete");
    expect(paymentOnly.transactions).toHaveLength(1);
    expect(linked.transactions).toHaveLength(1);
    expect(linked.transactions).toEqual(paymentOnly.transactions);
    expect(linked.sourceFingerprint).toBe(paymentOnly.sourceFingerprint);
    expect(linked.transactions[0].sourceRef).toBe("legacy_event:rent-payment-june");
    expect(linked.transactions[0]).toMatchObject({ type: "payment_applied", amountCents: 150000 });
  });

  it("does not double-count explicitly linked ledger and payment records", () => {
    const result = normalizeLegacyReceivablesSources(fixtures.linkedLedgerAndPayment);
    expect(result.transactions.map((row) => row.amountCents)).toEqual([150000]);
  });

  it("fails closed for unlinked exact matches", () => {
    const result = normalizeLegacyReceivablesSources(fixtures.ambiguousUnlinkedDuplicates);
    expect(result).toMatchObject({ sourceState: "ambiguous", transactions: [] });
    expect(result.findings.map((item) => item.code)).toContain("unlinked_exact_match_requires_review");
  });

  it("changes its normalized fingerprint when source evidence changes", () => {
    const current = normalizeLegacyReceivablesSources(fixtures.paymentOnly);
    const changed = normalizeLegacyReceivablesSources(fixtures.changedEvidence);
    expect(changed.sourceFingerprint).not.toBe(current.sourceFingerprint);
    expect(changed.transactions[0].amountCents).toBe(149900);
  });

  it("does not treat an in-memory fallback assertion as ownership proof", () => {
    const result = normalizeLegacyReceivablesSources(fixtures.ownershipUnverified);
    expect(result).toMatchObject({ sourceState: "incomplete", transactions: [] });
    expect(result.findings.map((item) => item.code)).toContain("landlord_ownership_not_independently_verified");
  });

  it("fails closed when the proof scope differs from the requested lease", () => {
    const result = normalizeLegacyReceivablesSources(base({
      ownershipProof: { state: "independently_verified", landlordId: "landlord-a", leaseId: "lease-other" },
    }));
    expect(result.sourceState).toBe("incomplete");
    expect(result.transactions).toEqual([]);
  });

  it("fails closed on ambiguous tenant mapping", () => {
    const result = normalizeLegacyReceivablesSources(base({ tenantMappingState: "ambiguous" }));
    expect(result.sourceState).toBe("ambiguous");
    expect(result.transactions).toEqual([]);
  });

  it("rejects conflicting amounts inside an explicitly linked group", () => {
    const records = fixtures.linkedLedgerAndPayment.records.map((record, index) =>
      index === 1 ? { ...record, amountCents: 149000 } : record
    );
    const result = normalizeLegacyReceivablesSources({ ...fixtures.linkedLedgerAndPayment, records });
    expect(result.sourceState).toBe("ambiguous");
    expect(result.transactions).toEqual([]);
    expect(result.findings.map((item) => item.code)).toContain("conflicting_linked_financial_evidence");
  });

  it("rejects duplicate evidence of the same source class in one event", () => {
    const first = fixtures.paymentOnly.records[0];
    const result = normalizeLegacyReceivablesSources({
      ...fixtures.paymentOnly,
      records: [first, { ...first, sourceId: "payment-b" }],
    });
    expect(result.sourceState).toBe("ambiguous");
    expect(result.findings.map((item) => item.code)).toContain("ambiguous_duplicate_source_evidence");
  });

  it("does not let payment intents create receivable transactions", () => {
    const result = normalizeLegacyReceivablesSources(base({
      records: [{
        sourceKind: "payment_intent",
        sourceId: "intent-a",
        evidenceRole: "posted_transaction",
        landlordId: "landlord-a",
        leaseId: "lease-a",
        propertyId: "property-a",
        transactionType: "payment_applied",
        amountCents: 10000,
        currency: "cad",
        effectiveDate: "2026-06-01",
      }],
    }));
    expect(result.sourceState).toBe("incomplete");
    expect(result.transactions).toEqual([]);
    expect(result.findings.map((item) => item.code)).toContain("payment_intent_cannot_create_receivable_transaction");
  });

  it("allows payment intent and reconciliation records only as corroborating evidence", () => {
    const result = normalizeLegacyReceivablesSources(base({
      records: [
        {
          sourceKind: "payment_intent",
          sourceId: "intent-a",
          evidenceRole: "corroborating_evidence",
          landlordId: "landlord-a",
          leaseId: "lease-a",
          propertyId: "property-a",
        },
        {
          sourceKind: "reconciliation_record",
          sourceId: "reconciliation-a",
          evidenceRole: "corroborating_evidence",
          landlordId: "landlord-a",
          leaseId: "lease-a",
          propertyId: "property-a",
        },
      ],
    }));
    expect(result).toMatchObject({ sourceState: "complete", transactions: [], findings: [] });
  });

  it("keeps allocation records as corroborating evidence instead of inventing credits", () => {
    const result = normalizeLegacyReceivablesSources(base({
      records: [{
        sourceKind: "allocation_record",
        sourceId: "allocation-a",
        evidenceRole: "posted_transaction",
        landlordId: "landlord-a",
        leaseId: "lease-a",
        propertyId: "property-a",
        transactionType: "credit",
        amountCents: 10000,
        currency: "cad",
        effectiveDate: "2026-06-01",
      }],
    }));
    expect(result.sourceState).toBe("incomplete");
    expect(result.transactions).toEqual([]);
    expect(result.findings.map((item) => item.code)).toContain("allocation_record_cannot_create_receivable_transaction");
  });

  it("maps reversal source references onto canonical transaction identities", () => {
    const payment = fixtures.paymentOnly.records[0];
    const result = normalizeLegacyReceivablesSources({
      ...fixtures.paymentOnly,
      records: [
        payment,
        {
          ...payment,
          sourceId: "reversal-a",
          canonicalEventKey: "rent-payment-june-reversal",
          transactionType: "payment_reversal",
          reversesSourceId: "payment-a",
          effectiveDate: "2026-06-03",
        },
      ],
    });
    expect(result.sourceState).toBe("complete");
    expect(result.transactions[1]).toMatchObject({
      transactionId: "legacy_event:rent-payment-june-reversal",
      reversesTransactionId: "legacy_event:rent-payment-june",
    });
  });

  it("rejects unsupported currency and mismatched record scope", () => {
    const record = fixtures.paymentOnly.records[0];
    const result = normalizeLegacyReceivablesSources({
      ...fixtures.paymentOnly,
      records: [{ ...record, landlordId: "landlord-b", currency: "usd" }],
    });
    expect(result.sourceState).toBe("incomplete");
    expect(result.transactions).toEqual([]);
    expect(result.findings.map((item) => item.code)).toEqual(
      expect.arrayContaining(["legacy_landlord_scope_mismatch", "unsupported_currency"])
    );
  });
});
