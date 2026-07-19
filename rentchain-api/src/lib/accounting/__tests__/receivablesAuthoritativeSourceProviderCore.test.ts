import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { completeReceivablesAuthoritativeSourceProviderFixture } from "../__fixtures__/receivablesAuthoritativeSourceProviderFixtures";
import { buildReceivablesAuthoritativeSource } from "../receivablesAuthoritativeSourceProviderCore";
import type { BuildReceivablesAuthoritativeSourceInput } from "../receivablesAuthoritativeSourceProviderTypes";
import { buildReceivablesSourceSnapshot } from "../receivablesSourceSnapshotAdapter";

const clone = <T>(value: T): T => structuredClone(value);
const build = (change?: (input: BuildReceivablesAuthoritativeSourceInput) => void) => {
  const input = clone(completeReceivablesAuthoritativeSourceProviderFixture); change?.(input);
  return buildReceivablesAuthoritativeSource(input);
};

describe("buildReceivablesAuthoritativeSource", () => {
  it("produces a safe Phase 0I input from complete authoritative receipts", () => {
    const result = build();
    expect(result).toMatchObject({
      providerCoreVersion: "receivables_authoritative_source_provider_v1", status: "safe", reasonCodes: [], warnings: [],
      ownershipProofSummary: { status: "verified", method: "canonical_direct" },
      sourceCompletenessSummary: { status: "complete", completeCount: 7, emptyCount: 5 },
      receiptSummary: { requiredCount: 12, acceptedCount: 12, manifestVersion: "receivables_authoritative_source_manifest_v1" },
    });
    expect(result.safeSnapshotInput).not.toBeNull();
  });

  it("feeds Phase 0I in memory without runtime invocation", () => {
    const provider = build();
    expect(buildReceivablesSourceSnapshot(provider.safeSnapshotInput!)).toMatchObject({ status: "ready", reasonCodes: [] });
  });

  it("fails closed when ownership is missing", () => {
    expect(build((i) => { delete i.receipts!.ownership; }).reasonCodes).toContain("PROVIDER_RECEIPT_MISSING");
  });

  it.each([
    ["alias-only", "aliasOwnershipMapping", "PROVIDER_SOURCE_ALIAS_REJECTED"],
    ["post-read filtered", "postReadFiltered", "PROVIDER_SOURCE_POST_FILTER_REJECTED"],
    ["catch-to-empty", "catchToEmpty", "PROVIDER_SOURCE_CATCH_TO_EMPTY_REJECTED"],
  ] as const)("rejects %s ownership", (_label, field, code) => {
    expect(build((i) => { (i.receipts!.ownership as any)[field] = true; }).reasonCodes).toContain(code);
  });

  it("rejects capped results without completeness proof", () => {
    expect(build((i) => { i.receipts!.ledger!.capped = true; i.receipts!.ledger!.completenessProven = false; }).reasonCodes)
      .toContain("PROVIDER_SOURCE_CAPPED_INCOMPLETE");
  });

  it("rejects incomplete ledger evidence", () => {
    expect(build((i) => { i.receipts!.ledger!.completenessState = "partial"; }).reasonCodes).toContain("PROVIDER_SOURCE_INCOMPLETE");
  });

  it("rejects overlapping payment evidence without canonical linkage", () => {
    const result = build((i) => {
      const charge = i.receipts!.ledger!.records[0];
      i.receipts!.payment!.completenessState = "complete";
      i.receipts!.payment!.records = [{ ...charge, sourceKind: "payment_record", sourceId: "payment-a" }];
    });
    expect(result.reasonCodes).toContain("PROVIDER_CANONICAL_NORMALIZATION_FAILED");
  });

  it("prevents payment intents and reconciliation from inventing transactions", () => {
    for (const key of ["paymentIntent", "reconciliation"] as const) {
      const result = build((i) => {
        const kind = key === "paymentIntent" ? "payment_intent" : "reconciliation_record";
        i.receipts![key]!.completenessState = "complete";
        i.receipts![key]!.records = [{
          sourceKind: kind, sourceId: `${kind}-a`, evidenceRole: "posted_transaction", landlordId: "landlord-a",
          leaseId: "lease-a", propertyId: "property-a", transactionType: "payment_applied", amountCents: 100_000,
          currency: "cad", effectiveDate: "2026-01-15",
        }];
      });
      expect(result.reasonCodes).toContain("PROVIDER_CANONICAL_NORMALIZATION_FAILED");
    }
  });

  it.each([
    ["bank data", { bankAccountNumber: "secret" }],
    ["provider data", { providerPaymentId: "provider-a" }],
    ["admin data", { adminScope: "support" }],
    ["Firestore path", { reference: "firestore://projects/p/databases/default/documents/x/y" }],
    ["storage path", { attachment: "gs://bucket/private" }],
  ])("rejects unsafe %s", (_label, unsafeField) => {
    const result = build((i) => { i.receipts!.ledger!.records = [{ ...i.receipts!.ledger!.records[0], ...unsafeField }]; });
    expect(result).toMatchObject({ status: "unsafe", safeSnapshotInput: null });
    expect(result.reasonCodes).toContain("PROVIDER_UNSAFE_SOURCE_DATA");
  });

  it("rejects internal IDs used as display labels", () => {
    expect(build((i) => { i.receipts!.tenant!.records[0].displayName = "tenant-a"; }).reasonCodes)
      .toContain("PROVIDER_DISPLAY_ID_FALLBACK_REJECTED");
  });

  it("fails closed for mismatched read boundaries and scope", () => {
    expect(build((i) => { i.receipts!.payment!.readBoundaryVersion = "other"; }).reasonCodes).toContain("PROVIDER_READ_BOUNDARY_MISMATCH");
    expect(build((i) => { i.receipts!.ledger!.scope.leaseId = "other"; }).reasonCodes).toContain("PROVIDER_SCOPE_MISMATCH");
  });

  it("keeps the public-safe validation envelope non-financial", () => {
    const { safeSnapshotInput: _internal, ...safe } = build();
    const serialized = JSON.stringify(safe).toLowerCase();
    for (const forbidden of ["balance", "amount", "charge", "payment-a", "tenant-a", "lease-a", "landlord-a", "property-a", "provider-a", "firestore://", "gs://"])
      expect(serialized).not.toContain(forbidden);
  });

  it("does not mutate injected receipts", () => {
    const input = clone(completeReceivablesAuthoritativeSourceProviderFixture); const before = clone(input);
    buildReceivablesAuthoritativeSource(input); expect(input).toEqual(before);
  });

  it("has no Firestore, route, job, scheduler, provider, or runtime dependency", () => {
    const source = readFileSync(new URL("../receivablesAuthoritativeSourceProviderCore.ts", import.meta.url), "utf8").toLowerCase();
    for (const forbidden of ["from \"../firebase\"", "from \"firebase-admin", "@google-cloud/firestore", "express", "router", "cron", "scheduler", "pubsub", "rotessa", "process.env", "leaseservice"])
      expect(source).not.toContain(forbidden);
  });
});
