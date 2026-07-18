import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { completeReceivablesSourceSnapshotFixture } from "../__fixtures__/receivablesSourceSnapshotFixtures";
import { runReceivablesDiagnostic } from "../receivablesDiagnosticRunnerCore";
import type { RunReceivablesDiagnosticInput } from "../receivablesDiagnosticRunnerTypes";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function base(overrides: Partial<RunReceivablesDiagnosticInput> = {}): RunReceivablesDiagnosticInput {
  return {
    diagnosticConfig: { enabled: true },
    target: { landlordId: "landlord-a", leaseId: "lease-a", context: "lease_receivables" },
    allowlistDecision: {
      approved: true,
      landlordId: "landlord-a",
      leaseId: "lease-a",
      context: "lease_receivables",
      reason: "Approved diagnostic fixture",
      expiresOn: "2026-02-28",
    },
    operatorIntent: {
      intentType: "receivables_diagnostic",
      operatorIdentifier: "operator-a",
      operatorDisplayName: "Accounting Support",
      reason: "Validate projection parity",
      landlordId: "landlord-a",
      leaseId: "lease-a",
      context: "lease_receivables",
    },
    sourceSnapshotInput: clone(completeReceivablesSourceSnapshotFixture),
    asOfDate: "2026-02-15",
    diagnosticRunMetadata: { checkedAt: "2026-02-15T12:00:00.000Z" },
    expectedComparatorVersion: "receivables_shadow_comparison_v1",
    ...overrides,
  };
}

describe("runReceivablesDiagnostic", () => {
  it("returns a deterministic minimal status for a complete safe injected diagnostic", () => {
    expect(runReceivablesDiagnostic(base())).toEqual({
      ok: true,
      status: "equivalent",
      reasonCodes: ["SHADOW_EQUIVALENT"],
      warnings: [],
      diagnosticVersion: "receivables_diagnostic_runner_v1",
      snapshotVersion: "receivables_source_snapshot_v1",
      comparatorVersion: "receivables_shadow_comparison_v1",
      checkedAt: "2026-02-15T12:00:00.000Z",
    });
  });

  it("is disabled by default", () => {
    expect(runReceivablesDiagnostic(base({ diagnosticConfig: undefined }))).toMatchObject({
      ok: false,
      reasonCodes: ["DIAGNOSTIC_DISABLED"],
    });
  });

  it("fails closed when allowlist approval is missing", () => {
    expect(runReceivablesDiagnostic(base({ allowlistDecision: undefined }))).toMatchObject({
      status: "rejected",
      reasonCodes: ["DIAGNOSTIC_ALLOWLIST_MISSING"],
    });
  });

  it("fails closed when allowlist approval is false", () => {
    const input = base();
    input.allowlistDecision!.approved = false;
    expect(runReceivablesDiagnostic(input).reasonCodes).toEqual(["DIAGNOSTIC_ALLOWLIST_NOT_APPROVED"]);
  });

  it("requires an exact landlord, lease, and context allowlist match", () => {
    const input = base();
    input.allowlistDecision!.leaseId = "lease-other";
    expect(runReceivablesDiagnostic(input).reasonCodes).toEqual(["DIAGNOSTIC_ALLOWLIST_SCOPE_MISMATCH"]);
  });

  it("rejects expired or unexplained allowlist decisions", () => {
    const expired = base();
    expired.allowlistDecision!.expiresOn = "2026-02-14";
    expect(runReceivablesDiagnostic(expired).reasonCodes).toEqual(["DIAGNOSTIC_ALLOWLIST_EXPIRED"]);
    const unexplained = base();
    unexplained.allowlistDecision!.reason = " ";
    expect(runReceivablesDiagnostic(unexplained).reasonCodes).toEqual(["DIAGNOSTIC_ALLOWLIST_REASON_MISSING"]);
  });

  it("fails closed when operator intent is missing", () => {
    expect(runReceivablesDiagnostic(base({ operatorIntent: undefined })).reasonCodes).toEqual([
      "DIAGNOSTIC_OPERATOR_INTENT_MISSING",
    ]);
  });

  it("requires operator identity, reason, diagnostic intent, and exact scope", () => {
    const missingIdentity = base();
    missingIdentity.operatorIntent!.operatorIdentifier = null;
    expect(runReceivablesDiagnostic(missingIdentity).reasonCodes).toEqual(["DIAGNOSTIC_OPERATOR_IDENTITY_MISSING"]);
    const missingReason = base();
    missingReason.operatorIntent!.reason = "";
    expect(runReceivablesDiagnostic(missingReason).reasonCodes).toEqual(["DIAGNOSTIC_OPERATOR_REASON_MISSING"]);
    const wrongIntent = base();
    wrongIntent.operatorIntent!.intentType = "report_export";
    expect(runReceivablesDiagnostic(wrongIntent).reasonCodes).toEqual(["DIAGNOSTIC_OPERATOR_INTENT_INVALID"]);
    const wrongScope = base();
    wrongScope.operatorIntent!.context = "portfolio_receivables";
    expect(runReceivablesDiagnostic(wrongScope).reasonCodes).toEqual(["DIAGNOSTIC_OPERATOR_SCOPE_MISMATCH"]);
  });

  it("requires valid injected metadata and matching as-of/source scope", () => {
    expect(runReceivablesDiagnostic(base({ diagnosticRunMetadata: undefined })).reasonCodes).toEqual([
      "DIAGNOSTIC_METADATA_INVALID",
    ]);
    expect(runReceivablesDiagnostic(base({ asOfDate: "02/15/2026" })).reasonCodes).toEqual([
      "DIAGNOSTIC_AS_OF_DATE_INVALID",
    ]);
    const mismatch = base();
    mismatch.sourceSnapshotInput!.lease.leaseId = "lease-other";
    expect(runReceivablesDiagnostic(mismatch).reasonCodes).toEqual(["DIAGNOSTIC_SNAPSHOT_SCOPE_MISMATCH"]);
  });

  it("fails closed on snapshot ownership failure", () => {
    const input = base();
    input.sourceSnapshotInput!.ownership.proofSource = "in_memory_fallback";
    expect(runReceivablesDiagnostic(input).reasonCodes).toContain("SNAPSHOT_OWNERSHIP_FALLBACK_REJECTED");
  });

  it("fails closed on incomplete and ambiguous snapshot evidence", () => {
    const incomplete = base();
    incomplete.sourceSnapshotInput!.evidence.ledgerEntries.state = "truncated";
    expect(runReceivablesDiagnostic(incomplete).reasonCodes).toContain("SNAPSHOT_SOURCE_INCOMPLETE");
    const ambiguous = base();
    ambiguous.sourceSnapshotInput!.lease.tenantMappingState = "ambiguous";
    expect(runReceivablesDiagnostic(ambiguous).reasonCodes).toEqual(expect.arrayContaining([
      "SNAPSHOT_MAPPING_AMBIGUOUS",
      "SNAPSHOT_SOURCE_AMBIGUOUS",
    ]));
  });

  it("fails closed on unsafe source data", () => {
    const input = base();
    input.sourceSnapshotInput!.evidence.ledgerEntries.records = [{
      ...input.sourceSnapshotInput!.evidence.ledgerEntries.records[0],
      bankAccountNumber: "not-allowed",
    }];
    expect(runReceivablesDiagnostic(input).reasonCodes).toEqual(["SNAPSHOT_UNSAFE_SOURCE_DATA"]);
  });

  it("fails closed when the injected comparator remains disabled", () => {
    const input = base();
    input.sourceSnapshotInput!.comparatorConfig.enabled = false;
    expect(runReceivablesDiagnostic(input).reasonCodes).toEqual(["SNAPSHOT_CONFIG_NOT_READY"]);
  });

  it("fails closed on comparator parity failure", () => {
    const input = base();
    input.sourceSnapshotInput!.legacyEffects[0].signedAmountCents = 99_999;
    expect(runReceivablesDiagnostic(input).reasonCodes).toEqual(["SHADOW_PARITY_MISMATCH"]);
  });

  it("rejects an unexpected comparator contract version", () => {
    expect(runReceivablesDiagnostic(base({ expectedComparatorVersion: "future-version" })).reasonCodes).toEqual([
      "DIAGNOSTIC_COMPARATOR_VERSION_MISMATCH",
    ]);
  });

  it("never returns financial values, scope identifiers, or internal source inputs", () => {
    const result = runReceivablesDiagnostic(base());
    expect(Object.keys(result).sort()).toEqual([
      "checkedAt",
      "comparatorVersion",
      "diagnosticVersion",
      "ok",
      "reasonCodes",
      "snapshotVersion",
      "status",
      "warnings",
    ]);
    const serialized = JSON.stringify(result).toLowerCase();
    for (const forbidden of [
      "balance", "amount", "charge", "payment", "allocation", "aging", "rentroll", "schedule",
      "tenant-a", "lease-a", "landlord-a", "property-a", "operator-a", "provider", "processor", "firestore", "storage",
    ]) expect(serialized).not.toContain(forbidden);
  });

  it("has no runtime, route, Firestore, provider, scheduler, or job-framework dependency", () => {
    const source = readFileSync(new URL("../receivablesDiagnosticRunnerCore.ts", import.meta.url), "utf8").toLowerCase();
    for (const forbidden of [
      "firebase", "firestore", "express", "router", "request", "response", "cron", "scheduler", "pubsub",
      "rotessa", "provider", "process.env", "setinterval", "settimeout",
    ]) expect(source).not.toContain(forbidden);
  });
});
