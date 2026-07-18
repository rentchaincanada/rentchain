import type { ReceivablesSourceSnapshotAdapterInput } from "../receivablesSourceSnapshotTypes";

const charge = {
  sourceKind: "ledger_entry" as const,
  sourceId: "ledger-charge-a",
  evidenceRole: "posted_transaction" as const,
  landlordId: "landlord-a",
  leaseId: "lease-a",
  propertyId: "property-a",
  unitId: "unit-a",
  responsibilityId: "responsibility-a",
  tenantId: "tenant-a",
  transactionType: "scheduled_rent_charge" as const,
  amountCents: 100_000,
  currency: "cad",
  effectiveDate: "2026-01-01",
  dueDate: "2026-01-01",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  canonicalEventKey: "rent-charge-2026-01",
};

export const completeReceivablesSourceSnapshotFixture: ReceivablesSourceSnapshotAdapterInput = {
  comparatorConfig: { enabled: true, landlordAllowlist: "landlord-a" },
  ownership: {
    proofSource: "authoritative_lease",
    landlordId: "landlord-a",
    leaseId: "lease-a",
    leaseLandlordId: "landlord-a",
    propertyId: "property-a",
    propertyLandlordId: "landlord-a",
  },
  lease: {
    leaseId: "lease-a",
    landlordId: "landlord-a",
    propertyId: "property-a",
    unitId: "unit-a",
    responsibilityId: "responsibility-a",
    tenantId: "tenant-a",
    propertyDisplayName: "10 Harbour Street",
    unitDisplayName: "Unit 2",
    tenantDisplayName: "Example Tenant",
    responsibilityDisplayName: "Primary lease responsibility",
    leaseMappingState: "resolved",
    propertyMappingState: "resolved",
    unitMappingState: "resolved",
    tenantMappingState: "resolved",
    leaseStatus: "active",
    leaseStartDate: "2026-01-01",
    leaseEndDate: "2026-03-31",
    monthlyRentCents: 100_000,
    dueDay: 1,
    billingFrequency: "monthly",
    currency: "cad",
    depositAmountCents: null,
    sourceLeaseVersion: "lease-version-1",
  },
  evidence: {
    ledgerEntries: { state: "complete", records: [charge] },
    paymentRecords: { state: "empty_confirmed", records: [] },
    paymentIntents: { state: "empty_confirmed", records: [] },
    reconciliationRecords: { state: "empty_confirmed", records: [] },
    leaseObligations: { state: "empty_confirmed", records: [] },
    allocationRecords: { state: "empty_confirmed", records: [] },
  },
  legacyEffectsState: "complete",
  legacyEffects: [{
    effectId: "legacy-charge-a",
    landlordId: "landlord-a",
    leaseId: "lease-a",
    propertyId: "property-a",
    currency: "cad",
    effectiveDate: "2026-01-01",
    signedAmountCents: 100_000,
  }],
  asOfDate: "2026-02-15",
  previewThroughDate: "2026-03-31",
};

export const receivablesSourceSnapshotFixtures = {
  complete: completeReceivablesSourceSnapshotFixture,
  missingOwnership: {
    ...completeReceivablesSourceSnapshotFixture,
    ownership: { ...completeReceivablesSourceSnapshotFixture.ownership, proofSource: "missing" },
  },
  fallbackOwnership: {
    ...completeReceivablesSourceSnapshotFixture,
    ownership: { ...completeReceivablesSourceSnapshotFixture.ownership, proofSource: "in_memory_fallback" },
  },
  ambiguousOwnership: {
    ...completeReceivablesSourceSnapshotFixture,
    ownership: { ...completeReceivablesSourceSnapshotFixture.ownership, proofSource: "ambiguous" },
  },
  duplicateEvidence: {
    ...completeReceivablesSourceSnapshotFixture,
    evidence: {
      ...completeReceivablesSourceSnapshotFixture.evidence,
      ledgerEntries: {
        state: "complete",
        records: [charge, { ...charge, sourceId: "ledger-charge-b" }],
      },
    },
  },
  unsafeSource: {
    ...completeReceivablesSourceSnapshotFixture,
    evidence: {
      ...completeReceivablesSourceSnapshotFixture.evidence,
      ledgerEntries: {
        state: "complete",
        records: [{ ...charge, bankAccountNumber: "not-allowed" } as typeof charge],
      },
    },
  },
  unsupportedTerms: {
    ...completeReceivablesSourceSnapshotFixture,
    lease: { ...completeReceivablesSourceSnapshotFixture.lease, currency: "usd", billingFrequency: "weekly" },
  },
} satisfies Record<string, ReceivablesSourceSnapshotAdapterInput>;
