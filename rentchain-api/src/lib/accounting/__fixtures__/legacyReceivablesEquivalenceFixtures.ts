import type { NormalizeLegacyReceivablesSourcesInput } from "../legacyReceivablesSourceTypes";

const scope = {
  landlordId: "landlord-a",
  leaseId: "lease-a",
  propertyId: "property-a",
  tenantId: "tenant-a",
  tenantMappingState: "resolved" as const,
  ownershipProof: { state: "independently_verified" as const, landlordId: "landlord-a", leaseId: "lease-a" },
};

const payment = {
  sourceKind: "payment_record" as const,
  sourceId: "payment-a",
  evidenceRole: "posted_transaction" as const,
  landlordId: "landlord-a",
  leaseId: "lease-a",
  propertyId: "property-a",
  tenantId: "tenant-a",
  transactionType: "payment_applied" as const,
  amountCents: 150000,
  currency: "cad",
  effectiveDate: "2026-06-01",
  canonicalEventKey: "rent-payment-june",
};

const ledgerPayment = {
  ...payment,
  sourceKind: "ledger_entry" as const,
  sourceId: "ledger-payment-a",
};

export const legacyReceivablesEquivalenceFixtures: Record<string, NormalizeLegacyReceivablesSourcesInput> = {
  paymentOnly: { ...scope, records: [payment] },
  linkedLedgerAndPayment: { ...scope, records: [payment, ledgerPayment] },
  ambiguousUnlinkedDuplicates: {
    ...scope,
    records: [
      { ...payment, canonicalEventKey: null },
      { ...ledgerPayment, canonicalEventKey: null },
    ],
  },
  changedEvidence: {
    ...scope,
    records: [{ ...payment, amountCents: 149900 }],
  },
  ownershipUnverified: {
    ...scope,
    ownershipProof: { state: "unverified", landlordId: "landlord-a", leaseId: "lease-a" },
    records: [payment],
  },
};
