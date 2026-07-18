import { describe, expect, it } from "vitest";
import { compareReceivablesShadow } from "../receivablesShadowComparator";
import type {
  CompareReceivablesShadowInput,
  ReceivablesShadowSourceCompleteness,
} from "../receivablesShadowComparatorTypes";

const completeSources = (): ReceivablesShadowSourceCompleteness => ({
  lease: "complete",
  property: "complete",
  unit: "complete",
  tenantResponsibility: "complete",
  ledgerEntries: "complete",
  paymentRecords: "empty_confirmed",
  paymentIntents: "empty_confirmed",
  reconciliationRecords: "empty_confirmed",
  leaseObligations: "complete",
  allocationRecords: "empty_confirmed",
});

const transaction = () => ({
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
});

function base(overrides: Partial<CompareReceivablesShadowInput> = {}): CompareReceivablesShadowInput {
  return {
    config: { enabled: true, landlordAllowlist: "landlord-a" },
    requestLandlordId: "landlord-a",
    ownershipProof: { state: "independently_verified", landlordId: "landlord-a", leaseId: "lease-a" },
    sourceCompleteness: completeSources(),
    normalizationInput: {
      landlordId: "landlord-a",
      leaseId: "lease-a",
      propertyId: "property-a",
      tenantId: "tenant-a",
      tenantMappingState: "resolved",
      ownershipProof: { state: "independently_verified", landlordId: "landlord-a", leaseId: "lease-a" },
      records: [transaction()],
    },
    dtoInput: {
      leaseId: "lease-a",
      propertyId: "property-a",
      unitId: "unit-a",
      responsibilityId: "responsibility-a",
      tenantId: "tenant-a",
      propertyDisplayName: "10 Harbour Street",
      unitDisplayName: "Unit 2",
      tenantDisplayName: "Example Tenant",
      responsibilityDisplayName: "Primary lease responsibility",
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
      asOfDate: "2026-02-15",
      previewThroughDate: "2026-03-31",
      agingAllocationPolicy: "explicit",
    },
    legacyProjection: { state: "available", balanceCents: 100_000 },
    ...overrides,
  };
}

describe("compareReceivablesShadow", () => {
  it.each([undefined, false, "false", "TRUE", 1])("is disabled by default or for a non-explicit enabled value: %s", (enabled) => {
    const result = compareReceivablesShadow(base({ config: { enabled, landlordAllowlist: "landlord-a" } }));
    expect(result).toEqual({
      ok: false,
      enabled: false,
      allowed: false,
      status: "disabled",
      reasonCode: "SHADOW_DISABLED",
      warnings: [],
      comparisonVersion: "receivables_shadow_comparison_v1",
    });
  });

  it.each([undefined, "", "  ", "*", [], ["*"]])("denies empty, malformed, or wildcard allowlists", (landlordAllowlist) => {
    const result = compareReceivablesShadow(base({ config: { enabled: true, landlordAllowlist } }));
    expect(result).toMatchObject({ ok: false, enabled: true, allowed: false, status: "not_allowed", reasonCode: "SHADOW_NOT_ALLOWLISTED" });
  });

  it("requires exact, case-sensitive allowlist membership", () => {
    const result = compareReceivablesShadow(base({ config: { enabled: true, landlordAllowlist: "Landlord-A, landlord-b" } }));
    expect(result).toMatchObject({ allowed: false, reasonCode: "SHADOW_NOT_ALLOWLISTED" });
  });

  it("fails closed when authoritative ownership is not independently proven", () => {
    const result = compareReceivablesShadow(base({
      ownershipProof: { state: "unverified", landlordId: "landlord-a", leaseId: "lease-a" },
    }));
    expect(result).toMatchObject({ ok: false, allowed: true, status: "not_ready", reasonCode: "SHADOW_OWNERSHIP_UNVERIFIED" });
  });

  it("fails closed when proof or DTO scope differs from the normalized scope", () => {
    const input = base();
    const result = compareReceivablesShadow({ ...input, dtoInput: { ...input.dtoInput, leaseId: "lease-other" } });
    expect(result.reasonCode).toBe("SHADOW_OWNERSHIP_UNVERIFIED");
  });

  it.each(["unavailable", "ambiguous", "truncated"] as const)("fails closed for a %s source", (state) => {
    const result = compareReceivablesShadow(base({
      sourceCompleteness: { ...completeSources(), ledgerEntries: state },
    }));
    expect(result).toMatchObject({ status: "not_ready", reasonCode: "SHADOW_SOURCE_INCOMPLETE" });
  });

  it("does not accept confirmed-empty identity sources", () => {
    const result = compareReceivablesShadow(base({
      sourceCompleteness: { ...completeSources(), tenantResponsibility: "empty_confirmed" },
    }));
    expect(result.reasonCode).toBe("SHADOW_SOURCE_INCOMPLETE");
  });

  it("fails closed when Phase 0E source normalization fails", () => {
    const input = base();
    const result = compareReceivablesShadow({
      ...input,
      normalizationInput: {
        ...input.normalizationInput,
        records: [{ ...transaction(), currency: "usd" }],
      },
    });
    expect(result).toMatchObject({ status: "not_ready", reasonCode: "SHADOW_NORMALIZATION_FAILED" });
  });

  it.each([
    { state: "unavailable" },
    { state: "incomparable", balanceCents: 100_000 },
    { state: "available", balanceCents: 100_000.5 },
    { state: "available", balanceCents: Number.MAX_SAFE_INTEGER + 1 },
  ])("requires an independently available safe-integer legacy projection", (legacyProjection) => {
    const result = compareReceivablesShadow(base({ legacyProjection }));
    expect(result.reasonCode).toBe("SHADOW_LEGACY_PARITY_UNAVAILABLE");
  });

  it("fails closed when Phase 0C cannot assemble a complete DTO", () => {
    const input = base();
    const result = compareReceivablesShadow({
      ...input,
      dtoInput: { ...input.dtoInput, dueDay: undefined },
    });
    expect(result).toMatchObject({ status: "not_ready", reasonCode: "SHADOW_DTO_ASSEMBLY_FAILED" });
  });

  it("fails closed on a one-cent parity mismatch", () => {
    const result = compareReceivablesShadow(base({
      legacyProjection: { state: "available", balanceCents: 99_999 },
    }));
    expect(result).toMatchObject({ status: "not_ready", reasonCode: "SHADOW_PARITY_MISMATCH" });
  });

  it("returns only minimal non-financial status for exact equivalence", () => {
    const result = compareReceivablesShadow(base());
    expect(result).toEqual({
      ok: true,
      enabled: true,
      allowed: true,
      status: "equivalent",
      reasonCode: "SHADOW_EQUIVALENT",
      warnings: [],
      comparisonVersion: "receivables_shadow_comparison_v1",
    });
    expect(Object.keys(result).sort()).toEqual([
      "allowed",
      "comparisonVersion",
      "enabled",
      "ok",
      "reasonCode",
      "status",
      "warnings",
    ]);
    const serialized = JSON.stringify(result).toLowerCase();
    for (const forbidden of [
      "balance",
      "amount",
      "charge",
      "payment",
      "aging",
      "rentroll",
      "schedule",
      "tenant-a",
      "lease-a",
      "property-a",
      "provider",
      "processor",
      "firestore",
      "storage",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
