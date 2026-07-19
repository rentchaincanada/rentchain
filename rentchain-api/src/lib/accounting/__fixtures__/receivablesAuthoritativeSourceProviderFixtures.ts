import {
  RECEIVABLES_AUTHORITATIVE_SOURCE_MANIFEST_VERSION,
  type BuildReceivablesAuthoritativeSourceInput,
  type ReceivablesAuthoritativeReadReceipt,
  type ReceivablesAuthoritativeSourceClass,
} from "../receivablesAuthoritativeSourceProviderTypes";

function receipt<T>(sourceClass: ReceivablesAuthoritativeSourceClass, records: readonly T[], empty = false): ReceivablesAuthoritativeReadReceipt<T> {
  return {
    sourceClass, sourceVersion: `${sourceClass}_v1`, readBoundaryVersion: "read-boundary-1",
    completenessState: empty ? "empty_confirmed" : "complete", authoritative: true, capped: false,
    completenessProven: true, postReadFiltered: false, aliasOwnershipMapping: false, catchToEmpty: false,
    suitableForFinancialDiagnostics: true, reasonCodes: [],
    scope: { landlordId: "landlord-a", leaseId: "lease-a", propertyId: "property-a" }, records,
  };
}

const charge = {
  sourceKind: "ledger_entry" as const, sourceId: "ledger-charge-a", evidenceRole: "posted_transaction" as const,
  landlordId: "landlord-a", leaseId: "lease-a", propertyId: "property-a", unitId: "unit-a",
  responsibilityId: "responsibility-a", tenantId: "tenant-a", transactionType: "scheduled_rent_charge" as const,
  amountCents: 100_000, currency: "cad", effectiveDate: "2026-01-01", dueDate: "2026-01-01",
  periodStart: "2026-01-01", periodEnd: "2026-01-31", canonicalEventKey: "rent-charge-2026-01",
};

export const completeReceivablesAuthoritativeSourceProviderFixture: BuildReceivablesAuthoritativeSourceInput = {
  providerEnabled: true,
  sourceManifestVersion: RECEIVABLES_AUTHORITATIVE_SOURCE_MANIFEST_VERSION,
  target: { landlordId: "landlord-a", leaseId: "lease-a", context: "lease_receivables" },
  comparatorConfig: { enabled: true, landlordAllowlist: "landlord-a" },
  asOfDate: "2026-02-15", previewThroughDate: "2026-03-31",
  receipts: {
    ownership: receipt("ownership", [{ proofSource: "canonical_direct", landlordId: "landlord-a", leaseId: "lease-a", leaseLandlordId: "landlord-a", propertyId: "property-a", propertyLandlordId: "landlord-a" }]),
    lease: receipt("lease", [{
      leaseId: "lease-a", landlordId: "landlord-a", canonicalLandlordId: "landlord-a", propertyId: "property-a",
      unitId: "unit-a", responsibilityId: "responsibility-a", tenantId: "tenant-a", directDocument: true,
      ownershipField: "landlordId", ownershipAliasConflict: false, propertyDisplayName: "10 Harbour Street",
      unitDisplayName: "Unit 2", tenantDisplayName: "Example Tenant", responsibilityDisplayName: "Primary responsibility",
      leaseMappingState: "resolved", propertyMappingState: "resolved", unitMappingState: "resolved", tenantMappingState: "resolved",
      leaseStatus: "active", leaseStartDate: "2026-01-01", leaseEndDate: "2026-03-31", monthlyRentCents: 100_000,
      dueDay: 1, billingFrequency: "monthly", currency: "cad", depositAmountCents: null, sourceLeaseVersion: "lease-version-1",
    }]),
    property: receipt("property", [{ propertyId: "property-a", landlordId: "landlord-a", displayName: "10 Harbour Street" }]),
    unit: receipt("unit", [{ unitId: "unit-a", propertyId: "property-a", landlordId: "landlord-a", displayName: "Unit 2" }]),
    tenant: receipt("tenant", [{ tenantId: "tenant-a", leaseId: "lease-a", displayName: "Example Tenant" }]),
    ledger: receipt("ledger", [charge]),
    payment: receipt("payment", [], true), paymentIntent: receipt("payment_intent", [], true),
    reconciliation: receipt("reconciliation", [], true), obligation: receipt("obligation", [], true), allocation: receipt("allocation", [], true),
    legacyEffects: receipt("legacy_effects", [{ effectId: "legacy-charge-a", landlordId: "landlord-a", leaseId: "lease-a", propertyId: "property-a", currency: "cad", effectiveDate: "2026-01-01", signedAmountCents: 100_000 }]),
  },
};
