import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runReceivablesLocalInventoryDevEntrypoint } from "../receivablesLocalInventoryDevEntrypoint";
import { runReceivablesSchemaInventoryLocalCommand } from "../receivablesSchemaInventoryLocalCommand";
import type { ReceivablesSchemaInventoryLocalCommandResult } from "../receivablesSchemaInventoryLocalCommandTypes";

const validFixture = new URL(
  "../__fixtures__/schemaInventorySanitizedReceipts.valid.json",
  import.meta.url
);
const unsafeFixture = new URL(
  "../__fixtures__/schemaInventorySanitizedReceipts.unsafe.json",
  import.meta.url
);
const roots: string[] = [];

function root(): string {
  const value = mkdtempSync(join(tmpdir(), "rentchain-dev-entrypoint-"));
  roots.push(value);
  return value;
}

function fixture(targetRoot: string, source = validFixture, name = "receipts.json"): string {
  mkdirSync(join(targetRoot, "inputs"), { recursive: true });
  copyFileSync(source, join(targetRoot, "inputs", name));
  return `inputs/${name}`;
}

function harness(targetRoot = root()) {
  const output: string[] = [];
  const errors: string[] = [];
  return {
    targetRoot,
    output,
    errors,
    dependencies: {
      approvedRoot: targetRoot,
      runLocalCommand: runReceivablesSchemaInventoryLocalCommand,
      writeOutput: (value: string) => output.push(value),
      writeError: (value: string) => errors.push(value),
    },
  };
}

afterEach(() => {
  for (const value of roots.splice(0)) rmSync(value, { recursive: true, force: true });
});

describe("runReceivablesLocalInventoryDevEntrypoint", () => {
  it("maps one injected sanitized input to the Phase 0U envelope", () => {
    const context = harness();
    const result = runReceivablesLocalInventoryDevEntrypoint({
      args: ["--input", fixture(context.targetRoot)],
      dependencies: context.dependencies,
    });
    expect(result).toEqual({ status: "ready_for_next_audit", exitCode: 0 });
    expect(context.errors).toEqual([]);
    expect(JSON.parse(context.output[0])).toMatchObject({
      ok: true,
      inventoryStatus: "ready_for_next_audit",
      commandCoreVersion: "receivables_schema_inventory_command_core_v1",
      phase: "phase_0u",
      reasonCodes: [],
      warnings: ["Injected receipts support next-audit discussion only."],
    });
  });

  it.each([
    [[]],
    [["--input"]],
    [["--input", ""]],
    [["--unknown", "inputs/receipts.json"]],
    [["inputs/receipts.json"]],
    [["--input", "one.json", "--input", "two.json"]],
  ])("rejects invalid injected arguments without calling Phase 0W", (args) => {
    const context = harness();
    const runLocalCommand = vi.fn(context.dependencies.runLocalCommand);
    const result = runReceivablesLocalInventoryDevEntrypoint({
      args,
      dependencies: { ...context.dependencies, runLocalCommand },
    });
    expect(result).toEqual({ status: "invalid_invocation", exitCode: 64 });
    expect(runLocalCommand).not.toHaveBeenCalled();
    expect(context.output).toEqual([]);
    expect(context.errors).toEqual(["DEV_ENTRYPOINT_INVALID_INVOCATION"]);
  });

  it("injects the approved root and explicit path unchanged", () => {
    const context = harness();
    const runLocalCommand = vi.fn((): ReceivablesSchemaInventoryLocalCommandResult => ({
      ok: false,
      inventoryStatus: "not_ready",
      commandCoreVersion: "receivables_schema_inventory_command_core_v1",
      phase: "phase_0u",
      reasonCodes: ["INVENTORY_RECEIPT_MISSING"],
      warnings: ["Injected receipts support next-audit discussion only."],
      checkedAt: null,
      requiredNextSteps: ["Supply complete and consistent receipts."],
      receiptSummary: {
        required: 10, received: 0, ready: 0, notReady: 0, partial: 0, ambiguous: 0, unsafe: 0,
      },
    }));
    const args = ["--input", "inputs/receipts.json"] as const;
    const before = [...args];
    const result = runReceivablesLocalInventoryDevEntrypoint({
      args,
      dependencies: { ...context.dependencies, runLocalCommand },
    });
    expect(runLocalCommand).toHaveBeenCalledWith({
      approvedRoot: context.targetRoot,
      inputFilePath: "inputs/receipts.json",
    });
    expect(args).toEqual(before);
    expect(result).toEqual({ status: "not_ready", exitCode: 2 });
    expect(context.errors).toEqual([]);
  });

  it.each([
    ["missing", "inputs/missing.json"],
    ["traversal", "../receipts.json"],
  ])("preserves the Phase 0W %s rejection", (_label, inputFilePath) => {
    const context = harness();
    const result = runReceivablesLocalInventoryDevEntrypoint({
      args: ["--input", inputFilePath],
      dependencies: context.dependencies,
    });
    expect(result).toEqual({ status: "invalid_input", exitCode: 65 });
    expect(context.output).toEqual([]);
    expect(context.errors).toEqual(["DEV_ENTRYPOINT_INPUT_REJECTED"]);
  });

  it("preserves malformed, unsafe, and symlink Phase 0W rejections", () => {
    const context = harness();
    mkdirSync(join(context.targetRoot, "inputs"), { recursive: true });
    writeFileSync(join(context.targetRoot, "inputs", "malformed.json"), "{bad", "utf8");
    fixture(context.targetRoot, unsafeFixture, "unsafe.json");
    fixture(context.targetRoot, validFixture, "real.json");
    symlinkSync(
      join(context.targetRoot, "inputs", "real.json"),
      join(context.targetRoot, "inputs", "linked.json")
    );
    for (const inputFilePath of [
      "inputs/malformed.json",
      "inputs/unsafe.json",
      "inputs/linked.json",
    ]) {
      context.output.length = 0;
      context.errors.length = 0;
      expect(runReceivablesLocalInventoryDevEntrypoint({
        args: ["--input", inputFilePath],
        dependencies: context.dependencies,
      })).toEqual({ status: "invalid_input", exitCode: 65 });
      expect(context.output).toEqual([]);
      expect(context.errors).toEqual(["DEV_ENTRYPOINT_INPUT_REJECTED"]);
    }
  });

  it("returns non-ready Phase 0U results through the bounded output sink", () => {
    const context = harness();
    const raw = JSON.parse(readFileSync(validFixture, "utf8")) as { schema: { confirmed: boolean } };
    raw.schema.confirmed = false;
    mkdirSync(join(context.targetRoot, "inputs"));
    writeFileSync(join(context.targetRoot, "inputs", "not-ready.json"), JSON.stringify(raw), "utf8");
    const result = runReceivablesLocalInventoryDevEntrypoint({
      args: ["--input", "inputs/not-ready.json"],
      dependencies: context.dependencies,
    });
    expect(result).toEqual({ status: "not_ready", exitCode: 2 });
    expect(JSON.parse(context.output[0])).toMatchObject({
      ok: false,
      inventoryStatus: "not_ready",
      reasonCodes: expect.arrayContaining(["INVENTORY_RECEIPT_UNCONFIRMED"]),
    });
    expect(context.errors).toEqual([]);
  });

  it("projects only the Phase 0U envelope from an injected result", () => {
    const context = harness();
    const source = runReceivablesSchemaInventoryLocalCommand;
    const runLocalCommand = vi.fn((input) => ({
      ...source(input),
      unexpectedInternalField: "must-not-escape",
    }));
    const result = runReceivablesLocalInventoryDevEntrypoint({
      args: ["--input", fixture(context.targetRoot)],
      dependencies: { ...context.dependencies, runLocalCommand },
    });
    expect(result).toEqual({ status: "ready_for_next_audit", exitCode: 0 });
    expect(context.output[0]).not.toContain("unexpectedInternalField");
    expect(context.output[0]).not.toContain("must-not-escape");
  });

  it.each(["bankAccount", "paymentAmount", "providerSecret", "firestorePath"])(
    "blocks unsafe injected output containing %s",
    (unsafeValue) => {
      const context = harness();
      const runLocalCommand = vi.fn(() => ({
        ok: true,
        inventoryStatus: "ready_for_next_audit",
        commandCoreVersion: "receivables_schema_inventory_command_core_v1",
        phase: "phase_0u",
        reasonCodes: [],
        warnings: [unsafeValue],
        checkedAt: null,
        requiredNextSteps: [],
        receiptSummary: {
          required: 10, received: 10, ready: 10, notReady: 0, partial: 0, ambiguous: 0, unsafe: 0,
        },
      } as ReceivablesSchemaInventoryLocalCommandResult));
      expect(runReceivablesLocalInventoryDevEntrypoint({
        args: ["--input", "inputs/receipts.json"],
        dependencies: { ...context.dependencies, runLocalCommand },
      })).toEqual({ status: "internal_failure", exitCode: 70 });
      expect(context.output).toEqual([]);
      expect(context.errors).toEqual(["DEV_ENTRYPOINT_INTERNAL_FAILURE"]);
    }
  );

  it("maps unexpected dependencies and output-sink failures to a generic code", () => {
    const context = harness();
    for (const dependencies of [
      { ...context.dependencies, runLocalCommand: () => { throw new Error("sensitive detail"); } },
      { ...context.dependencies, writeOutput: () => { throw new Error("sensitive detail"); } },
    ]) {
      context.output.length = 0;
      context.errors.length = 0;
      expect(runReceivablesLocalInventoryDevEntrypoint({
        args: ["--input", fixture(context.targetRoot, validFixture, `${context.errors.length}.json`)],
        dependencies,
      })).toEqual({ status: "internal_failure", exitCode: 70 });
      expect(context.output).toEqual([]);
      expect(context.errors).toEqual(["DEV_ENTRYPOINT_INTERNAL_FAILURE"]);
    }
  });

  it("keeps output non-financial, path-free, and operator-neutral", () => {
    const context = harness();
    runReceivablesLocalInventoryDevEntrypoint({
      args: ["--input", fixture(context.targetRoot)],
      dependencies: context.dependencies,
    });
    const serialized = context.output.join("").toLowerCase();
    for (const forbidden of [
      "balance", "amount", "charge", "payment", "allocation", "rent roll", "aging",
      "schedule", "tenant", "landlord", "firestore", "bank", "credential", "secret",
      "provider", "operator", "production", "operational", context.targetRoot.toLowerCase(),
      "receipts.json",
    ]) expect(serialized).not.toContain(forbidden);
  });

  it("has no process, environment, Firestore, runtime, global-output, or mutation dependency", () => {
    const source = readFileSync(
      new URL("../receivablesLocalInventoryDevEntrypoint.ts", import.meta.url),
      "utf8"
    ).toLowerCase();
    for (const forbidden of [
      "process.argv", "process.env", "process.stdin", "console.", "from \"firebase",
      "from \"@google-cloud", "from \"dotenv", "from \"express", "from \"rotessa",
      "from \"stripe", "from \"node:fs", "cron.schedule", "scheduler.", "writefile(",
      "appendfile(", "readdir(", "fetch(", "axios.", "from \"node:child_process",
    ]) expect(source).not.toContain(forbidden);
  });

  it("is absent from package scripts, the accounting barrel, and runtime startup", () => {
    const packageSource = readFileSync(new URL("../../../../package.json", import.meta.url), "utf8");
    const barrelSource = readFileSync(new URL("../index.ts", import.meta.url), "utf8");
    const runtimeSource = readFileSync(new URL("../../../index.ts", import.meta.url), "utf8");
    for (const source of [packageSource, barrelSource, runtimeSource]) {
      expect(source).not.toContain("receivablesLocalInventoryDevEntrypoint");
      expect(source).not.toContain("phase-1a-receivables-local-inventory");
    }
  });
});
