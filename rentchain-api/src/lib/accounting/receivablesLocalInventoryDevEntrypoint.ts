import {
  RECEIVABLES_SCHEMA_INVENTORY_COMMAND_CORE_VERSION,
  RECEIVABLES_SCHEMA_INVENTORY_PHASE,
  type ReceivablesSchemaInventoryCommandResult,
} from "./receivablesSchemaInventoryCommandTypes";
import { ReceivablesSchemaInventoryLocalCommandError } from "./receivablesSchemaInventoryLocalCommandTypes";
import type {
  ReceivablesLocalInventoryDevEntrypointDependencies,
  ReceivablesLocalInventoryDevEntrypointResult,
  RunReceivablesLocalInventoryDevEntrypointInput,
} from "./receivablesLocalInventoryDevEntrypointTypes";

const INPUT_FLAG = "--input";
const MAX_OUTPUT_BYTES = 16 * 1024;
const SAFE_STATUSES = new Set([
  "ready_for_next_audit",
  "not_ready",
  "partial",
  "blocked",
  "ambiguous",
]);
const UNSAFE_OUTPUT_TERM =
  /(?:firestore|firebase|credential|secret|password|private.?key|access.?token|api.?key|bank|routing|transit|account.?number|provider|rotessa|stripe|payment|allocation|balance|charge|rent.?roll|aging|receivable.?schedule|tenant.?balance|amount|storage.?path|document.?path|collection.?path|environment.?value)/i;

function fixedFailure(
  dependencies: ReceivablesLocalInventoryDevEntrypointDependencies,
  code: "DEV_ENTRYPOINT_INVALID_INVOCATION" | "DEV_ENTRYPOINT_INPUT_REJECTED" | "DEV_ENTRYPOINT_INTERNAL_FAILURE",
  result: ReceivablesLocalInventoryDevEntrypointResult
): ReceivablesLocalInventoryDevEntrypointResult {
  try {
    dependencies.writeError(code);
  } catch {
    // Injected sinks are test contracts. Sink failures must not expose raw errors.
  }
  return result;
}

function inputFilePath(args: readonly string[]): string | null {
  if (args.length !== 2 || args[0] !== INPUT_FLAG) return null;
  const value = args[1];
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function safeResult(value: ReceivablesSchemaInventoryCommandResult): boolean {
  const summary = value.receiptSummary;
  return (
    typeof value.ok === "boolean" &&
    SAFE_STATUSES.has(value.inventoryStatus) &&
    value.commandCoreVersion === RECEIVABLES_SCHEMA_INVENTORY_COMMAND_CORE_VERSION &&
    value.phase === RECEIVABLES_SCHEMA_INVENTORY_PHASE &&
    stringArray(value.reasonCodes) &&
    stringArray(value.warnings) &&
    (typeof value.checkedAt === "string" || value.checkedAt === null) &&
    stringArray(value.requiredNextSteps) &&
    typeof summary === "object" &&
    summary !== null &&
    nonNegativeInteger(summary.required) &&
    nonNegativeInteger(summary.received) &&
    nonNegativeInteger(summary.ready) &&
    nonNegativeInteger(summary.notReady) &&
    nonNegativeInteger(summary.partial) &&
    nonNegativeInteger(summary.ambiguous) &&
    nonNegativeInteger(summary.unsafe)
  );
}

function serializeResult(value: ReceivablesSchemaInventoryCommandResult): string | null {
  if (!safeResult(value)) return null;
  const projection: ReceivablesSchemaInventoryCommandResult = {
    ok: value.ok,
    inventoryStatus: value.inventoryStatus,
    commandCoreVersion: value.commandCoreVersion,
    phase: value.phase,
    reasonCodes: [...value.reasonCodes],
    warnings: [...value.warnings],
    checkedAt: value.checkedAt,
    requiredNextSteps: [...value.requiredNextSteps],
    receiptSummary: { ...value.receiptSummary },
  };
  const serialized = JSON.stringify(projection);
  if (Buffer.byteLength(serialized, "utf8") > MAX_OUTPUT_BYTES || UNSAFE_OUTPUT_TERM.test(serialized)) {
    return null;
  }
  return serialized;
}

export function runReceivablesLocalInventoryDevEntrypoint(
  input: RunReceivablesLocalInventoryDevEntrypointInput
): ReceivablesLocalInventoryDevEntrypointResult {
  const path = inputFilePath(input.args);
  if (!path) {
    return fixedFailure(input.dependencies, "DEV_ENTRYPOINT_INVALID_INVOCATION", {
      status: "invalid_invocation",
      exitCode: 64,
    });
  }

  try {
    const result = input.dependencies.runLocalCommand({
      approvedRoot: input.dependencies.approvedRoot,
      inputFilePath: path,
    });
    const serialized = serializeResult(result);
    if (!serialized) {
      return fixedFailure(input.dependencies, "DEV_ENTRYPOINT_INTERNAL_FAILURE", {
        status: "internal_failure",
        exitCode: 70,
      });
    }
    try {
      input.dependencies.writeOutput(serialized);
    } catch {
      return fixedFailure(input.dependencies, "DEV_ENTRYPOINT_INTERNAL_FAILURE", {
        status: "internal_failure",
        exitCode: 70,
      });
    }
    return result.ok
      ? { status: "ready_for_next_audit", exitCode: 0 }
      : { status: "not_ready", exitCode: 2 };
  } catch (error) {
    if (error instanceof ReceivablesSchemaInventoryLocalCommandError) {
      return fixedFailure(input.dependencies, "DEV_ENTRYPOINT_INPUT_REJECTED", {
        status: "invalid_input",
        exitCode: 65,
      });
    }
    return fixedFailure(input.dependencies, "DEV_ENTRYPOINT_INTERNAL_FAILURE", {
      status: "internal_failure",
      exitCode: 70,
    });
  }
}
