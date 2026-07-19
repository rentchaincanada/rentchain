import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runReceivablesSchemaInventoryLocalCommand } from "../receivablesSchemaInventoryLocalCommand";
import {
  RECEIVABLES_SCHEMA_INVENTORY_LOCAL_COMMAND_MAX_BYTES,
  ReceivablesSchemaInventoryLocalCommandError,
} from "../receivablesSchemaInventoryLocalCommandTypes";

const validFixture = new URL(
  "../__fixtures__/schemaInventorySanitizedReceipts.valid.json",
  import.meta.url
);
const unsafeFixture = new URL(
  "../__fixtures__/schemaInventorySanitizedReceipts.unsafe.json",
  import.meta.url
);
const temporaryRoots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "rentchain-schema-inventory-"));
  temporaryRoots.push(root);
  return root;
}

function copyFixture(root: string, source = validFixture, name = "receipts.json"): string {
  const fixtureDirectory = join(root, "inputs");
  mkdirSync(fixtureDirectory, { recursive: true });
  copyFileSync(source, join(fixtureDirectory, name));
  return `inputs/${name}`;
}

function expectError(action: () => unknown, code: string) {
  try {
    action();
    throw new Error("expected local command rejection");
  } catch (error) {
    expect(error).toBeInstanceOf(ReceivablesSchemaInventoryLocalCommandError);
    expect(error).toMatchObject({ code, message: code });
  }
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("runReceivablesSchemaInventoryLocalCommand", () => {
  it("reads one explicit sanitized receipt file and returns the Phase 0U envelope", () => {
    const root = temporaryRoot();
    const result = runReceivablesSchemaInventoryLocalCommand({
      approvedRoot: root,
      inputFilePath: copyFixture(root),
    });

    expect(result).toEqual({
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

  it("requires an explicit input file path", () => {
    const root = temporaryRoot();
    expectError(
      () => runReceivablesSchemaInventoryLocalCommand({ approvedRoot: root, inputFilePath: "" }),
      "LOCAL_INVENTORY_INPUT_PATH_REQUIRED"
    );
  });

  it("rejects absolute paths and traversal", () => {
    const root = temporaryRoot();
    expectError(
      () => runReceivablesSchemaInventoryLocalCommand({ approvedRoot: root, inputFilePath: validFixture.pathname }),
      "LOCAL_INVENTORY_INPUT_PATH_INVALID"
    );
    expectError(
      () => runReceivablesSchemaInventoryLocalCommand({ approvedRoot: root, inputFilePath: "../receipts.json" }),
      "LOCAL_INVENTORY_INPUT_PATH_INVALID"
    );
  });

  it("rejects a missing file without exposing its path", () => {
    const root = temporaryRoot();
    expectError(
      () => runReceivablesSchemaInventoryLocalCommand({ approvedRoot: root, inputFilePath: "inputs/missing.json" }),
      "LOCAL_INVENTORY_FILE_NOT_FOUND"
    );
  });

  it("rejects malformed JSON", () => {
    const root = temporaryRoot();
    mkdirSync(join(root, "inputs"));
    writeFileSync(join(root, "inputs", "bad.json"), "{not-json", "utf8");
    expectError(
      () => runReceivablesSchemaInventoryLocalCommand({ approvedRoot: root, inputFilePath: "inputs/bad.json" }),
      "LOCAL_INVENTORY_JSON_MALFORMED"
    );
  });

  it("rejects unsafe receipt data", () => {
    const root = temporaryRoot();
    expectError(
      () => runReceivablesSchemaInventoryLocalCommand({
        approvedRoot: root,
        inputFilePath: copyFixture(root, unsafeFixture),
      }),
      "LOCAL_INVENTORY_RECEIPTS_UNSAFE"
    );
  });

  it.each([
    ["credential", "credential"],
    ["bank field", "bankAccount"],
    ["provider secret", "providerSecret"],
    ["financial amount", "amount"],
    ["balance", "tenantBalance"],
    ["charge", "charge"],
    ["payment", "payment"],
    ["allocation", "allocation"],
    ["rent roll", "rentRoll"],
    ["aging", "aging"],
    ["schedule", "receivableSchedule"],
    ["environment value", "environmentValue"],
  ])("rejects an unsafe %s field", (_label, unsafeKey) => {
    const root = temporaryRoot();
    const raw = JSON.parse(readFileSync(validFixture, "utf8")) as Record<string, unknown>;
    raw[unsafeKey] = "restricted";
    mkdirSync(join(root, "inputs"));
    writeFileSync(join(root, "inputs", "unsafe.json"), JSON.stringify(raw), "utf8");
    expectError(
      () => runReceivablesSchemaInventoryLocalCommand({ approvedRoot: root, inputFilePath: "inputs/unsafe.json" }),
      "LOCAL_INVENTORY_RECEIPTS_UNSAFE"
    );
  });

  it("rejects unsupported receipt fields and non-object JSON", () => {
    const root = temporaryRoot();
    mkdirSync(join(root, "inputs"));
    writeFileSync(join(root, "inputs", "unknown.json"), JSON.stringify({ unexpected: true }), "utf8");
    writeFileSync(join(root, "inputs", "array.json"), "[]", "utf8");
    for (const inputFilePath of ["inputs/unknown.json", "inputs/array.json"]) {
      expectError(
        () => runReceivablesSchemaInventoryLocalCommand({ approvedRoot: root, inputFilePath }),
        "LOCAL_INVENTORY_RECEIPTS_INVALID"
      );
    }
  });

  it("passes sanitized receipt validation failures through Phase 0U", () => {
    const root = temporaryRoot();
    const raw = JSON.parse(readFileSync(validFixture, "utf8")) as {
      schema: { confirmed: boolean };
    };
    raw.schema.confirmed = false;
    mkdirSync(join(root, "inputs"));
    writeFileSync(join(root, "inputs", "unconfirmed.json"), JSON.stringify(raw), "utf8");
    const result = runReceivablesSchemaInventoryLocalCommand({
      approvedRoot: root,
      inputFilePath: "inputs/unconfirmed.json",
    });
    expect(result).toMatchObject({ ok: false, inventoryStatus: "not_ready" });
    expect(result.reasonCodes).toContain("INVENTORY_RECEIPT_UNCONFIRMED");
  });

  it("rejects symlinks and directories", () => {
    const root = temporaryRoot();
    const realPath = copyFixture(root);
    symlinkSync(join(root, realPath), join(root, "inputs", "linked.json"));
    for (const inputFilePath of ["inputs/linked.json", "inputs"]) {
      expectError(
        () => runReceivablesSchemaInventoryLocalCommand({ approvedRoot: root, inputFilePath }),
        inputFilePath.endsWith(".json")
          ? "LOCAL_INVENTORY_FILE_UNSAFE"
          : "LOCAL_INVENTORY_INPUT_PATH_INVALID"
      );
    }
  });

  it("rejects oversized files before parsing", () => {
    const root = temporaryRoot();
    mkdirSync(join(root, "inputs"));
    writeFileSync(
      join(root, "inputs", "large.json"),
      "x".repeat(RECEIVABLES_SCHEMA_INVENTORY_LOCAL_COMMAND_MAX_BYTES + 1),
      "utf8"
    );
    expectError(
      () => runReceivablesSchemaInventoryLocalCommand({ approvedRoot: root, inputFilePath: "inputs/large.json" }),
      "LOCAL_INVENTORY_FILE_TOO_LARGE"
    );
  });

  it("keeps successful output non-financial and path-free", () => {
    const root = temporaryRoot();
    const serialized = JSON.stringify(runReceivablesSchemaInventoryLocalCommand({
      approvedRoot: root,
      inputFilePath: copyFixture(root),
    })).toLowerCase();
    for (const forbidden of [
      "balance", "amount", "charge", "payment", "allocation", "rent roll", "aging",
      "schedule", "tenant", "landlord", "firestore", "bank", "credential", "secret",
      "provider", root.toLowerCase(), "receipts.json",
    ]) expect(serialized).not.toContain(forbidden);
  });

  it("has no Firestore, environment, network, runtime, or mutation dependency", () => {
    const source = readFileSync(
      new URL("../receivablesSchemaInventoryLocalCommand.ts", import.meta.url),
      "utf8"
    ).toLowerCase();
    for (const forbidden of [
      "from \"firebase", "from '@google-cloud", "process.env", "process.argv", "dotenv",
      "from \"express", "from \"@google-cloud/pubsub", "from \"rotessa", "from \"stripe",
      "cron.schedule", "scheduler.",
      "writefilesync", "appendfilesync", "fetch(", "axios", "child_process", "readdirsync",
    ]) expect(source).not.toContain(forbidden);
  });
});
