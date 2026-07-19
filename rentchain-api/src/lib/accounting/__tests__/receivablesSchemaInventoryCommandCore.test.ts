import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { completeReceivablesSchemaInventoryCommandFixture } from "../__fixtures__/receivablesSchemaInventoryCommandFixtures";
import { runReceivablesSchemaInventoryCommandCore } from "../receivablesSchemaInventoryCommandCore";
import type { RunReceivablesSchemaInventoryCommandInput } from "../receivablesSchemaInventoryCommandTypes";

const clone = <T>(value: T): T => structuredClone(value);
const run = (change?: (input: RunReceivablesSchemaInventoryCommandInput) => void) => {
  const input = clone(completeReceivablesSchemaInventoryCommandFixture);
  change?.(input);
  return runReceivablesSchemaInventoryCommandCore(input);
};

describe("runReceivablesSchemaInventoryCommandCore", () => {
  it("returns only ready_for_next_audit for complete safe injected receipts", () => {
    expect(run()).toEqual({
      ok: true,
      inventoryStatus: "ready_for_next_audit",
      commandCoreVersion: "receivables_schema_inventory_command_core_v1",
      phase: "phase_0u",
      reasonCodes: [],
      warnings: ["Injected receipts support next-audit discussion only."],
      checkedAt: "2026-07-20T12:00:00.000Z",
      requiredNextSteps: [],
      receiptSummary: {
        required: 10,
        received: 10,
        ready: 10,
        notReady: 0,
        partial: 0,
        ambiguous: 0,
        unsafe: 0,
      },
    });
  });

  it.each([
    ["schema", "INVENTORY_RECEIPT_MISSING"],
    ["indexes", "INVENTORY_RECEIPT_MISSING"],
    ["iam", "INVENTORY_RECEIPT_MISSING"],
    ["completeness", "INVENTORY_RECEIPT_MISSING"],
    ["consistency", "INVENTORY_RECEIPT_MISSING"],
    ["pagination", "INVENTORY_RECEIPT_MISSING"],
    ["unsafeFieldExclusion", "INVENTORY_RECEIPT_MISSING"],
    ["rollout", "INVENTORY_RECEIPT_MISSING"],
    ["rollback", "INVENTORY_RECEIPT_MISSING"],
    ["verification", "INVENTORY_RECEIPT_MISSING"],
  ] as const)("fails closed when the %s receipt is missing", (key, reason) => {
    const result = run((input) => { delete input[key]; });
    expect(result).toMatchObject({ ok: false, inventoryStatus: "not_ready" });
    expect(result.reasonCodes).toContain(reason);
    expect(result.receiptSummary.received).toBe(9);
  });

  it("returns partial for a partial receipt set", () => {
    const result = run((input) => {
      input.indexes!.state = "partial";
      input.indexes!.attestedReadyCount = 4;
    });
    expect(result.inventoryStatus).toBe("partial");
    expect(result.reasonCodes).toContain("INVENTORY_INDEX_COVERAGE_INCOMPLETE");
    expect(result.receiptSummary.partial).toBe(1);
  });

  it("blocks write-capable IAM evidence", () => {
    const result = run((input) => { input.iam!.writeDeniedAttested = false; });
    expect(result).toMatchObject({ ok: false, inventoryStatus: "blocked" });
    expect(result.reasonCodes).toContain("INVENTORY_IAM_WRITE_CAPABLE");
  });

  it("fails closed without completeness proof", () => {
    const result = run((input) => { input.completeness!.exhaustionAttested = false; });
    expect(result.inventoryStatus).toBe("not_ready");
    expect(result.reasonCodes).toContain("INVENTORY_COMPLETENESS_EXHAUSTION_UNPROVEN");
  });

  it("fails closed without consistency proof", () => {
    const result = run((input) => { input.consistency!.crossSourceBoundaryAttested = false; });
    expect(result.reasonCodes).toContain("INVENTORY_CONSISTENCY_BOUNDARY_UNPROVEN");
  });

  it("returns ambiguous for ambiguous capped-query evidence", () => {
    const result = run((input) => {
      input.pagination!.state = "ambiguous";
      input.pagination!.capHandlingAmbiguous = true;
    });
    expect(result.inventoryStatus).toBe("ambiguous");
    expect(result.reasonCodes).toContain("INVENTORY_PAGINATION_CAP_AMBIGUOUS");
  });

  it("fails closed without unsafe-field exclusion", () => {
    const result = run((input) => { input.unsafeFieldExclusion!.restrictedFieldsExcluded = false; });
    expect(result.reasonCodes).toContain("INVENTORY_UNSAFE_FIELD_EXCLUSION_UNPROVEN");
  });

  it("fails closed without rollout, rollback, and verification proof", () => {
    const result = run((input) => {
      input.rollout!.orderedGatesAttested = false;
      input.rollback!.rollbackPlanAttested = false;
      input.verification!.postChangeChecksAttested = false;
    });
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "INVENTORY_ROLLOUT_ORDER_UNPROVEN",
      "INVENTORY_ROLLBACK_PLAN_MISSING",
      "INVENTORY_VERIFICATION_POST_CHANGE_MISSING",
    ]));
  });

  it("fails closed for contradictory receipts", () => {
    const result = run((input) => { input.schema!.conflictsDetected = true; });
    expect(result.inventoryStatus).toBe("ambiguous");
    expect(result.reasonCodes).toContain("INVENTORY_RECEIPT_CONTRADICTORY");
  });

  it("blocks unsafe receipts", () => {
    const result = run((input) => { input.schema!.state = "unsafe"; });
    expect(result.inventoryStatus).toBe("blocked");
    expect(result.reasonCodes).toContain("INVENTORY_RECEIPT_UNSAFE");
  });

  it.each([
    "ready_for_production",
    "ready_for_adapter",
    "ready_for_deployment",
    "ready_for_runtime_reads",
  ])("rejects the unsupported operational claim %s", (claimScope) => {
    const result = run((input) => { input.schema!.claimScope = claimScope; });
    expect(result.inventoryStatus).toBe("blocked");
    expect(result.reasonCodes).toContain("INVENTORY_OPERATIONAL_CLAIM_REJECTED");
  });

  it("returns sorted deterministic reasons and next steps", () => {
    const first = run((input) => {
      input.schema!.canonicalOwnershipPresent = false;
      input.iam!.dedicatedIdentityAttested = false;
    });
    const second = run((input) => {
      input.schema!.canonicalOwnershipPresent = false;
      input.iam!.dedicatedIdentityAttested = false;
    });
    expect(first).toEqual(second);
    expect(first.reasonCodes).toEqual([...first.reasonCodes].sort());
    expect(first.requiredNextSteps).toEqual([...first.requiredNextSteps].sort());
  });

  it("does not mutate injected receipts", () => {
    const input = clone(completeReceivablesSchemaInventoryCommandFixture);
    const before = clone(input);
    runReceivablesSchemaInventoryCommandCore(input);
    expect(input).toEqual(before);
  });

  it("keeps output non-financial, scope-free, and infrastructure-free", () => {
    const serialized = JSON.stringify(run()).toLowerCase();
    for (const forbidden of [
      "balance", "amount", "charge", "payment", "allocation", "rent roll", "aging",
      "schedule", "tenant", "landlord", "leaseid", "propertyid", "firestore", "storage",
      "bank", "credential", "secret", "provider", "environment", "scopekey",
    ]) expect(serialized).not.toContain(forbidden);
  });

  it("uses injected evidence only and has no runtime dependency", () => {
    const source = readFileSync(
      new URL("../receivablesSchemaInventoryCommandCore.ts", import.meta.url),
      "utf8"
    ).toLowerCase();
    for (const forbidden of [
      "firebase", "@google-cloud", "firestore", "terraform", "process.env", "process.argv",
      "express", "router", "cron", "scheduler", "pubsub", "rotessa", "stripe",
      "readfilesync", "writefilesync", "fetch(", "axios", "child_process",
    ]) expect(source).not.toContain(forbidden);
  });
});
