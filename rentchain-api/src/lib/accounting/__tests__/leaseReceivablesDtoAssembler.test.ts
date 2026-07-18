import { describe, expect, it } from "vitest";
import { buildLeaseChargeSchedulePreview } from "../chargeSchedulePreview";
import { assembleLandlordLeaseReceivablesDto } from "../leaseReceivablesDtoAssembler";
import type { LandlordLeaseReceivablesAssemblerInput } from "../leaseReceivablesDtoTypes";

const transaction = (overrides: Record<string, unknown> = {}) => ({
  transactionId: "charge-1",
  leaseId: "lease-internal-1",
  propertyId: "property-internal-1",
  unitId: "unit-internal-1",
  responsibilityId: "responsibility-internal-1",
  tenantId: "tenant-internal-1",
  type: "scheduled_rent_charge",
  amountCents: 100_000,
  currency: "cad",
  effectiveDate: "2026-01-01",
  dueDate: "2026-01-01",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  metadata: {},
  ...overrides,
});

const baseInput = (overrides: Partial<LandlordLeaseReceivablesAssemblerInput> = {}): LandlordLeaseReceivablesAssemblerInput => ({
  leaseId: "lease-internal-1",
  propertyId: "property-internal-1",
  unitId: "unit-internal-1",
  responsibilityId: "responsibility-internal-1",
  tenantId: "tenant-internal-1",
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
  transactions: [transaction()],
  transactionSourceState: "complete",
  legacyBalanceCents: 100_000,
  agingAllocationPolicy: "explicit",
  ...overrides,
});

describe("assembleLandlordLeaseReceivablesDto", () => {
  it("assembles complete balance, aging, rent-roll, and schedule summaries", () => {
    const result = assembleLandlordLeaseReceivablesDto(baseInput());

    expect(result.schemaVersion).toBe("landlord_lease_receivables_v1");
    expect(result.dataCompleteness).toEqual({ status: "complete", missing: [] });
    expect(result.leaseSummary).toEqual(expect.objectContaining({
      propertyDisplayName: "10 Harbour Street",
      unitDisplayName: "Unit 2",
      tenantDisplayName: "Example Tenant",
      leaseStatusLabel: "Active",
    }));
    expect(result.billingSummary).toEqual(expect.objectContaining({
      monthlyRentCents: 100_000,
      scheduledRentDisplay: "$1,000.00 CAD",
      dueDay: 1,
    }));
    expect(result.balanceSummary).toEqual(expect.objectContaining({ netBalanceCents: 100_000, outstandingCents: 100_000 }));
    expect(result.agingSummary).toEqual(expect.objectContaining({ days31To60Cents: 100_000, totalOutstandingCents: 100_000 }));
    expect(result.rentRollSummary).toEqual(expect.objectContaining({ scheduledRentCents: 100_000, nextDueDate: "2026-03-01" }));
    expect(result.schedulePreviewSummary).toEqual(expect.objectContaining({ status: "available", occurrenceCount: 3, stale: false }));
    expect(result.sourceEquivalence.status).toBe("equivalent");
    expect(result.warnings).toEqual([]);
  });

  it.each([
    ["lease start", { leaseStartDate: undefined }, "leaseStartDate"],
    ["monthly rent", { monthlyRentCents: undefined }, "monthlyRentCents"],
    ["due day", { dueDay: undefined }, "dueDay"],
    ["supported frequency", { billingFrequency: "weekly" }, "billingFrequency"],
  ])("fails the schedule closed when %s is missing or invalid", (_label, overrides, missingField) => {
    const result = assembleLandlordLeaseReceivablesDto(baseInput(overrides));

    expect(result.schedulePreviewSummary.status).toBe("unavailable");
    expect(result.schedulePreviewSummary.previewFingerprint).toBeNull();
    expect(result.rentRollSummary).toBeNull();
    expect(result.balanceSummary?.netBalanceCents).toBe(100_000);
    expect(result.dataCompleteness.status).toBe("partial");
    expect(result.dataCompleteness.missing).toContain(missingField);
  });

  it("keeps missing display fields nullable and never falls back to internal IDs", () => {
    const result = assembleLandlordLeaseReceivablesDto(baseInput({
      propertyDisplayName: null,
      unitDisplayName: null,
      tenantDisplayName: null,
      responsibilityDisplayName: null,
    }));
    const serialized = JSON.stringify(result);

    expect(result.leaseSummary).toEqual(expect.objectContaining({
      propertyDisplayName: null,
      unitDisplayName: null,
      tenantDisplayName: null,
      responsibilityDisplayName: null,
    }));
    expect(result.dataCompleteness.status).toBe("partial");
    expect(serialized).not.toContain("lease-internal-1");
    expect(serialized).not.toContain("property-internal-1");
    expect(serialized).not.toContain("unit-internal-1");
    expect(serialized).not.toContain("tenant-internal-1");
    expect(serialized).not.toContain("responsibility-internal-1");
  });

  it("fails financial summaries closed for ambiguous tenant mapping", () => {
    const result = assembleLandlordLeaseReceivablesDto(baseInput({ tenantMappingState: "ambiguous" }));

    expect(result.leaseSummary.tenantDisplayName).toBeNull();
    expect(result.balanceSummary).toBeNull();
    expect(result.agingSummary).toBeNull();
    expect(result.rentRollSummary).toBeNull();
    expect(result.dataCompleteness.status).toBe("unavailable");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "tenant_mapping_ambiguous" }));
  });

  it("fails financial summaries closed when tenant mapping is missing", () => {
    const result = assembleLandlordLeaseReceivablesDto(baseInput({ tenantMappingState: "missing" }));

    expect(result.balanceSummary).toBeNull();
    expect(result.agingSummary).toBeNull();
    expect(result.rentRollSummary).toBeNull();
    expect(result.dataCompleteness.status).toBe("unavailable");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "tenant_mapping_missing" }));
  });

  it.each(["incomplete", "ambiguous"] as const)("fails financial summaries closed for a %s transaction source", (transactionSourceState) => {
    const result = assembleLandlordLeaseReceivablesDto(baseInput({ transactionSourceState }));

    expect(result.balanceSummary).toBeNull();
    expect(result.agingSummary).toBeNull();
    expect(result.sourceEquivalence.status).toBe("unavailable");
    expect(result.dataCompleteness.status).toBe("unavailable");
  });

  it("normalizes unsafe enum-like source fields instead of trusting them", () => {
    const result = assembleLandlordLeaseReceivablesDto(baseInput({
      leaseStatus: "provider_active",
      tenantMappingState: "guessed",
      transactionSourceState: "probably_complete",
    }));

    expect(result.leaseSummary.leaseStatus).toBe("unknown");
    expect(result.leaseSummary.leaseStatusLabel).toBe("Status not provided");
    expect(result.balanceSummary).toBeNull();
    expect(result.dataCompleteness.status).toBe("unavailable");
    expect(result.warnings.map((warning) => warning.code)).toEqual(expect.arrayContaining([
      "lease_status_unknown",
      "receivable_source_state_invalid",
      "tenant_mapping_state_invalid",
    ]));
  });

  it("fails closed when the projected and legacy balances are not equivalent", () => {
    const result = assembleLandlordLeaseReceivablesDto(baseInput({ legacyBalanceCents: 99_999 }));

    expect(result.sourceEquivalence.status).toBe("mismatch");
    expect(result.balanceSummary).toBeNull();
    expect(result.agingSummary).toBeNull();
    expect(result.dataCompleteness.status).toBe("unavailable");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "legacy_balance_mismatch" }));
  });

  it("produces stable DTOs for equivalent inputs and changes fingerprints for changed terms", () => {
    const first = assembleLandlordLeaseReceivablesDto(baseInput());
    const equivalent = assembleLandlordLeaseReceivablesDto(baseInput({ transactions: [transaction()] }));
    const changed = assembleLandlordLeaseReceivablesDto(baseInput({ monthlyRentCents: 100_001 }));

    expect(first).toEqual(equivalent);
    expect(first.sourceFingerprint).toBe(equivalent.sourceFingerprint);
    expect(first.schedulePreviewSummary.previewFingerprint).not.toBe(changed.schedulePreviewSummary.previewFingerprint);
    expect(first.sourceFingerprint).not.toBe(changed.sourceFingerprint);
  });

  it("returns the current fingerprint and a safe warning for stale preview state", () => {
    const oldPreview = buildLeaseChargeSchedulePreview({
      ...baseInput(),
      monthlyRentCents: 90_000,
    });
    const result = assembleLandlordLeaseReceivablesDto(baseInput({ expectedPreviewFingerprint: oldPreview.previewFingerprint }));

    expect(result.schedulePreviewSummary.stale).toBe(true);
    expect(result.schedulePreviewSummary.previewFingerprint).not.toBe(oldPreview.previewFingerprint);
    expect(result.dataCompleteness.status).toBe("partial");
    expect(result.warnings).toContainEqual(expect.objectContaining({ code: "receivable_schedule_state_stale" }));
  });

  it("uses Phase 0 accounting behavior for credits, adjustments, payments, reversals, and write-offs", () => {
    const transactions = [
      transaction(),
      transaction({ transactionId: "credit", type: "credit", amountCents: 5_000, appliesToTransactionId: "charge-1" }),
      transaction({ transactionId: "increase", type: "adjustment", amountCents: 2_000, metadata: { adjustmentDirection: "increase" } }),
      transaction({ transactionId: "payment", type: "payment_applied", amountCents: 30_000, appliesToTransactionId: "charge-1" }),
      transaction({ transactionId: "reversal", type: "payment_reversal", amountCents: 30_000, reversesTransactionId: "payment" }),
      transaction({ transactionId: "writeoff", type: "write_off", amountCents: 1_000, appliesToTransactionId: "charge-1" }),
    ];
    const result = assembleLandlordLeaseReceivablesDto(baseInput({ transactions, legacyBalanceCents: 96_000 }));

    expect(result.balanceSummary).toEqual(expect.objectContaining({
      creditsCents: 5_000,
      adjustmentIncreasesCents: 2_000,
      appliedPaymentsCents: 30_000,
      reversalsCents: 30_000,
      writeOffsCents: 1_000,
      netBalanceCents: 96_000,
    }));
    expect(result.agingSummary?.totalOutstandingCents).toBe(94_000);
  });

  it("represents overpayment separately from outstanding receivables", () => {
    const result = assembleLandlordLeaseReceivablesDto(baseInput({
      transactions: [
        transaction({ amountCents: 50_000 }),
        transaction({ transactionId: "payment", type: "payment_applied", amountCents: 60_000, appliesToTransactionId: "charge-1" }),
      ],
      legacyBalanceCents: -10_000,
    }));

    expect(result.balanceSummary).toEqual(expect.objectContaining({ netBalanceCents: -10_000, outstandingCents: 0, overpaymentCents: 10_000 }));
    expect(result.agingSummary?.totalOutstandingCents).toBe(0);
  });

  it("preserves exact Phase 0 aging bucket boundaries", () => {
    const result = assembleLandlordLeaseReceivablesDto(baseInput({
      asOfDate: "2026-04-02",
      previewThroughDate: "2026-04-30",
      transactions: [transaction()],
    }));

    expect(result.agingSummary?.days90PlusCents).toBe(100_000);
  });

  it("does not expose provider IDs, storage paths, Firestore paths, or internal scope keys", () => {
    const sensitiveInput = baseInput({
      leaseId: "leases/private-lease",
      propertyId: "properties/private-property",
      unitId: "units/private-unit",
      tenantId: "tenants/private-tenant",
      responsibilityId: "responsibilities/private-scope",
      propertyDisplayName: null,
      unitDisplayName: null,
      tenantDisplayName: null,
      responsibilityDisplayName: null,
      transactions: [transaction({
        leaseId: "leases/private-lease",
        propertyId: "properties/private-property",
        unitId: "units/private-unit",
        tenantId: "tenants/private-tenant",
        responsibilityId: "responsibilities/private-scope",
        providerId: "provider-secret-123",
        paymentProcessorId: "processor-secret-456",
        storagePath: "gs://private-bucket/tenant/file.pdf",
      })],
    });
    const serialized = JSON.stringify(assembleLandlordLeaseReceivablesDto(sensitiveInput));

    for (const unsafe of [
      "leases/private-lease",
      "properties/private-property",
      "units/private-unit",
      "tenants/private-tenant",
      "responsibilities/private-scope",
      "provider-secret-123",
      "processor-secret-456",
      "gs://private-bucket/tenant/file.pdf",
    ]) {
      expect(serialized).not.toContain(unsafe);
    }
  });

  it("does not mutate provided inputs", () => {
    const input = baseInput({ transactions: [Object.freeze(transaction())] });
    const snapshot = structuredClone(input);

    assembleLandlordLeaseReceivablesDto(input);

    expect(input).toEqual(snapshot);
  });
});
