import { describe, expect, it } from "vitest";
import {
  completeReceivablesSourceSnapshotFixture,
  receivablesSourceSnapshotFixtures,
} from "../__fixtures__/receivablesSourceSnapshotFixtures";
import { buildReceivablesSourceSnapshot } from "../receivablesSourceSnapshotAdapter";
import type { ReceivablesSourceSnapshotAdapterInput } from "../receivablesSourceSnapshotTypes";
import { compareReceivablesShadow } from "../receivablesShadowComparator";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function build(overrides: Partial<ReceivablesSourceSnapshotAdapterInput> = {}) {
  return buildReceivablesSourceSnapshot({
    ...clone(completeReceivablesSourceSnapshotFixture),
    ...overrides,
  });
}

describe("buildReceivablesSourceSnapshot", () => {
  it("creates a stable comparator-ready package for a complete authoritative snapshot", () => {
    const result = build();
    expect(result).toMatchObject({
      snapshotVersion: "receivables_source_snapshot_v1",
      status: "ready",
      reasonCodes: [],
      warnings: [],
      ownershipVerified: true,
      completenessStatus: "complete",
      sourceCounts: {
        ledgerEntries: 1,
        paymentRecords: 0,
        paymentIntents: 0,
        reconciliationRecords: 0,
        leaseObligations: 0,
        allocationRecords: 0,
        legacyEffects: 1,
      },
      normalizedSourceSummary: { status: "complete", recordCount: 1, legacyEffectCount: 1 },
    });
    expect(result.comparatorInput).not.toBeNull();
  });

  it("feeds the Phase 0G comparator in memory without invoking a runtime path", () => {
    const snapshot = build();
    expect(compareReceivablesShadow(snapshot.comparatorInput!)).toEqual({
      ok: true,
      enabled: true,
      allowed: true,
      status: "equivalent",
      reasonCode: "SHADOW_EQUIVALENT",
      warnings: [],
      comparisonVersion: "receivables_shadow_comparison_v1",
    });
  });

  it("fails closed when independent ownership proof is missing", () => {
    const result = buildReceivablesSourceSnapshot(clone(receivablesSourceSnapshotFixtures.missingOwnership));
    expect(result).toMatchObject({ status: "incomplete", ownershipVerified: false, comparatorInput: null });
    expect(result.reasonCodes).toContain("SNAPSHOT_OWNERSHIP_MISSING");
  });

  it("does not accept the in-memory fallback as ownership proof", () => {
    const result = buildReceivablesSourceSnapshot(clone(receivablesSourceSnapshotFixtures.fallbackOwnership));
    expect(result).toMatchObject({ status: "incomplete", ownershipVerified: false, comparatorInput: null });
    expect(result.reasonCodes).toContain("SNAPSHOT_OWNERSHIP_FALLBACK_REJECTED");
  });

  it("fails closed for ambiguous ownership", () => {
    const result = buildReceivablesSourceSnapshot(clone(receivablesSourceSnapshotFixtures.ambiguousOwnership));
    expect(result).toMatchObject({ status: "ambiguous", ownershipVerified: false, comparatorInput: null });
    expect(result.reasonCodes).toContain("SNAPSHOT_OWNERSHIP_AMBIGUOUS");
  });

  it("fails closed when the authoritative property scope differs", () => {
    const input = clone(completeReceivablesSourceSnapshotFixture);
    input.ownership.propertyLandlordId = "landlord-other";
    const result = buildReceivablesSourceSnapshot(input);
    expect(result).toMatchObject({ status: "incomplete", ownershipVerified: false, comparatorInput: null });
    expect(result.reasonCodes).toContain("SNAPSHOT_SCOPE_MISMATCH");
  });

  it.each(["leaseMappingState", "propertyMappingState", "tenantMappingState"] as const)(
    "fails closed for an ambiguous %s",
    (field) => {
      const input = clone(completeReceivablesSourceSnapshotFixture);
      input.lease[field] = "ambiguous";
      const result = buildReceivablesSourceSnapshot(input);
      expect(result).toMatchObject({ status: "ambiguous", comparatorInput: null });
      expect(result.reasonCodes).toEqual(expect.arrayContaining(["SNAPSHOT_MAPPING_AMBIGUOUS", "SNAPSHOT_MAPPING_INCOMPLETE"]));
    }
  );

  it("fails closed for an ambiguous unit mapping", () => {
    const input = clone(completeReceivablesSourceSnapshotFixture);
    input.lease.unitMappingState = "ambiguous";
    const result = buildReceivablesSourceSnapshot(input);
    expect(result.status).toBe("ambiguous");
    expect(result.comparatorInput).toBeNull();
  });

  it.each(["monthlyRentCents", "dueDay", "leaseStartDate", "sourceLeaseVersion"] as const)(
    "fails closed when required billing term %s is missing",
    (field) => {
      const input = clone(completeReceivablesSourceSnapshotFixture);
      input.lease[field] = undefined;
      const result = buildReceivablesSourceSnapshot(input);
      expect(result.reasonCodes).toContain("SNAPSHOT_BILLING_TERMS_INCOMPLETE");
      expect(result.comparatorInput).toBeNull();
    }
  );

  it("requires display context without falling back to IDs", () => {
    const input = clone(completeReceivablesSourceSnapshotFixture);
    input.lease.tenantDisplayName = null;
    const result = buildReceivablesSourceSnapshot(input);
    expect(result.reasonCodes).toContain("SNAPSHOT_BILLING_TERMS_INCOMPLETE");
    expect(result.comparatorInput).toBeNull();
  });

  it("rejects unsafe bank data", () => {
    const result = buildReceivablesSourceSnapshot(clone(receivablesSourceSnapshotFixtures.unsafeSource));
    expect(result).toMatchObject({ status: "unsafe", comparatorInput: null });
    expect(result.reasonCodes).toContain("SNAPSHOT_UNSAFE_SOURCE_DATA");
  });

  it.each([
    ["provider IDs", { providerPaymentId: "provider-secret" }],
    ["admin scope keys", { internalScopeKey: "support-only" }],
    ["storage paths", { attachment: "gs://private-bucket/file" }],
    ["Firestore paths", { referencePath: "firestore://projects/example/databases/default/documents/leases/a" }],
  ])("rejects unsafe %s", (_label, unsafeField) => {
    const input = clone(completeReceivablesSourceSnapshotFixture);
    input.evidence.ledgerEntries.records = [{ ...input.evidence.ledgerEntries.records[0], ...unsafeField }];
    const result = buildReceivablesSourceSnapshot(input);
    expect(result.reasonCodes).toContain("SNAPSHOT_UNSAFE_SOURCE_DATA");
    expect(result.comparatorInput).toBeNull();
  });

  it("fails closed for unsupported currency and frequency", () => {
    const result = buildReceivablesSourceSnapshot(clone(receivablesSourceSnapshotFixtures.unsupportedTerms));
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "SNAPSHOT_CURRENCY_UNSUPPORTED",
      "SNAPSHOT_FREQUENCY_UNSUPPORTED",
    ]));
    expect(result.comparatorInput).toBeNull();
  });

  it.each(["unavailable", "ambiguous", "truncated"] as const)("fails closed for %s evidence", (state) => {
    const input = clone(completeReceivablesSourceSnapshotFixture);
    input.evidence.ledgerEntries.state = state;
    const result = buildReceivablesSourceSnapshot(input);
    expect(result.comparatorInput).toBeNull();
    expect(result.reasonCodes).toContain(state === "ambiguous" ? "SNAPSHOT_SOURCE_AMBIGUOUS" : "SNAPSHOT_SOURCE_INCOMPLETE");
  });

  it("rejects records placed in the wrong source batch", () => {
    const input = clone(completeReceivablesSourceSnapshotFixture);
    input.evidence.paymentRecords = { state: "complete", records: input.evidence.ledgerEntries.records };
    const result = buildReceivablesSourceSnapshot(input);
    expect(result.reasonCodes).toContain("SNAPSHOT_SOURCE_BATCH_KIND_MISMATCH");
    expect(result.comparatorInput).toBeNull();
  });

  it("rejects confirmed-empty batches that contain records", () => {
    const input = clone(completeReceivablesSourceSnapshotFixture);
    input.evidence.ledgerEntries.state = "empty_confirmed";
    const result = buildReceivablesSourceSnapshot(input);
    expect(result.reasonCodes).toContain("SNAPSHOT_SOURCE_INCOMPLETE");
    expect(result.comparatorInput).toBeNull();
  });

  it("fails closed when duplicate legacy evidence cannot be safely normalized", () => {
    const result = buildReceivablesSourceSnapshot(clone(receivablesSourceSnapshotFixtures.duplicateEvidence));
    expect(result).toMatchObject({ status: "ambiguous", comparatorInput: null });
    expect(result.reasonCodes).toContain("SNAPSHOT_NORMALIZATION_FAILED");
  });

  it("fails closed for invalid or duplicate independent legacy effects", () => {
    const input = clone(completeReceivablesSourceSnapshotFixture);
    input.legacyEffects = [input.legacyEffects[0], input.legacyEffects[0]];
    const result = buildReceivablesSourceSnapshot(input);
    expect(result.reasonCodes).toContain("SNAPSHOT_LEGACY_PROJECTION_INVALID");
    expect(result.comparatorInput).toBeNull();
  });

  it("requires exact allowlist assumptions for comparator-ready output", () => {
    const result = build({ comparatorConfig: { enabled: true, landlordAllowlist: "landlord-other" } });
    expect(result.reasonCodes).toContain("SNAPSHOT_CONFIG_NOT_READY");
    expect(result.comparatorInput).toBeNull();
  });

  it("returns deterministic counts, reasons, and snapshot version", () => {
    const input = clone(completeReceivablesSourceSnapshotFixture);
    input.lease.currency = "usd";
    input.lease.billingFrequency = "weekly";
    const first = buildReceivablesSourceSnapshot(input);
    const second = buildReceivablesSourceSnapshot(clone(input));
    expect(first).toEqual(second);
    expect(first.reasonCodes).toEqual([...first.reasonCodes].sort());
    expect(first.snapshotVersion).toBe("receivables_source_snapshot_v1");
  });

  it("does not mutate supplied snapshot evidence", () => {
    const input = clone(completeReceivablesSourceSnapshotFixture);
    const before = clone(input);
    buildReceivablesSourceSnapshot(input);
    expect(input).toEqual(before);
  });

  it("keeps the public-safe validation envelope non-financial", () => {
    const { comparatorInput: _internalOnly, ...validation } = build();
    const serialized = JSON.stringify(validation).toLowerCase();
    for (const forbidden of ["balancecents", "amountcents", "tenant-a", "lease-a", "property-a", "provider", "processor", "firestore://", "gs://"]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
