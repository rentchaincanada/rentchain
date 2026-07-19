import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { runReceivablesSchemaInventoryCommandCore } from "./receivablesSchemaInventoryCommandCore";
import type { RunReceivablesSchemaInventoryCommandInput } from "./receivablesSchemaInventoryCommandTypes";
import {
  RECEIVABLES_SCHEMA_INVENTORY_LOCAL_COMMAND_MAX_BYTES,
  ReceivablesSchemaInventoryLocalCommandError,
  type ReceivablesSchemaInventoryLocalCommandErrorCode,
  type ReceivablesSchemaInventoryLocalCommandResult,
  type RunReceivablesSchemaInventoryLocalCommandInput,
} from "./receivablesSchemaInventoryLocalCommandTypes";

const TOP_LEVEL_KEYS = new Set([
  "checkedAt",
  "receiptManifestVersion",
  "schema",
  "indexes",
  "iam",
  "completeness",
  "consistency",
  "pagination",
  "unsafeFieldExclusion",
  "rollout",
  "rollback",
  "verification",
]);

const BASE_KEYS = ["receiptVersion", "state", "confirmed", "conflictsDetected", "claimScope"];

const RECEIPT_KEYS: Readonly<Record<string, readonly string[]>> = {
  schema: [
    ...BASE_KEYS,
    "requiredSourcesCovered",
    "supportedVersionsOnly",
    "canonicalOwnershipPresent",
    "canonicalMappingsPresent",
    "sourceRevisionsPresent",
  ],
  indexes: [
    ...BASE_KEYS,
    "requiredCount",
    "attestedReadyCount",
    "exactQueryCoverageAttested",
    "targetStateAttested",
  ],
  iam: [
    ...BASE_KEYS,
    "dedicatedIdentityAttested",
    "shortLivedIdentityAttested",
    "readOnlyAttested",
    "writeDeniedAttested",
    "privilegedAccessDeniedAttested",
    "environmentBindingAttested",
  ],
  completeness: [
    ...BASE_KEYS,
    "exactScopeAttested",
    "exhaustionAttested",
    "catchToEmptyAbsent",
    "postReadFilteringAbsent",
  ],
  consistency: [
    ...BASE_KEYS,
    "boundaryProtocolAttested",
    "crossSourceBoundaryAttested",
    "concurrentChangeInvalidates",
  ],
  pagination: [
    ...BASE_KEYS,
    "deterministicOrderingAttested",
    "cursorProgressionAttested",
    "capFailsClosed",
    "capHandlingAmbiguous",
  ],
  unsafeFieldExclusion: [
    ...BASE_KEYS,
    "allowlistProjectionAttested",
    "restrictedFieldsExcluded",
    "safeOutputAttested",
  ],
  rollout: [
    ...BASE_KEYS,
    "orderedGatesAttested",
    "defaultOffAttested",
    "mutationDeferred",
    "operatorApprovalRequired",
  ],
  rollback: [
    ...BASE_KEYS,
    "rollbackPlanAttested",
    "appendSafeHistoryProtected",
    "broaderIdentityFallbackProhibited",
  ],
  verification: [
    ...BASE_KEYS,
    "automatedTestsAttested",
    "negativePermissionTestsAttested",
    "controlledContextChecksAttested",
    "postChangeChecksAttested",
  ],
};

const UNSAFE_TERM =
  /(?:firestore|firebase|credential|secret|password|private.?key|access.?token|api.?key|bank|routing|transit|institution.?number|account.?number|provider|rotessa|stripe|payment|allocation|balance|charge|rent.?roll|aging|receivable.?schedule|tenant.?balance|amount|storage.?path|document.?path|collection.?path|process\.env|environment.?value)/i;

function reject(code: ReceivablesSchemaInventoryLocalCommandErrorCode): never {
  throw new ReceivablesSchemaInventoryLocalCommandError(code);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInsideRoot(root: string, target: string): boolean {
  const pathFromRoot = relative(root, target);
  return pathFromRoot !== "" && !pathFromRoot.startsWith("..") && !isAbsolute(pathFromRoot);
}

function validateReceiptShape(value: unknown): asserts value is RunReceivablesSchemaInventoryCommandInput {
  if (!isRecord(value)) reject("LOCAL_INVENTORY_RECEIPTS_INVALID");
  if (Object.keys(value).some((key) => !TOP_LEVEL_KEYS.has(key))) {
    reject("LOCAL_INVENTORY_RECEIPTS_INVALID");
  }

  for (const [receiptKey, allowedKeys] of Object.entries(RECEIPT_KEYS)) {
    const receipt = value[receiptKey];
    if (receipt === undefined) continue;
    if (!isRecord(receipt)) reject("LOCAL_INVENTORY_RECEIPTS_INVALID");
    const allowed = new Set(allowedKeys);
    if (Object.keys(receipt).some((key) => !allowed.has(key))) {
      reject("LOCAL_INVENTORY_RECEIPTS_INVALID");
    }
  }
}

function containsUnsafeData(value: unknown): boolean {
  if (typeof value === "string") return UNSAFE_TERM.test(value) || value.includes("/");
  if (Array.isArray(value)) return value.some(containsUnsafeData);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, nestedValue]) => UNSAFE_TERM.test(key) || containsUnsafeData(nestedValue)
  );
}

function readBoundedReceiptFile(input: RunReceivablesSchemaInventoryLocalCommandInput): string {
  if (typeof input.inputFilePath !== "string" || !input.inputFilePath.trim()) {
    reject("LOCAL_INVENTORY_INPUT_PATH_REQUIRED");
  }
  if (isAbsolute(input.inputFilePath) || extname(input.inputFilePath).toLowerCase() !== ".json") {
    reject("LOCAL_INVENTORY_INPUT_PATH_INVALID");
  }

  let approvedRoot: string;
  try {
    approvedRoot = realpathSync(input.approvedRoot);
    if (!statSync(approvedRoot).isDirectory()) reject("LOCAL_INVENTORY_APPROVED_ROOT_INVALID");
  } catch (error) {
    if (error instanceof ReceivablesSchemaInventoryLocalCommandError) throw error;
    reject("LOCAL_INVENTORY_APPROVED_ROOT_INVALID");
  }

  const candidate = resolve(approvedRoot, input.inputFilePath);
  if (!isInsideRoot(approvedRoot, candidate)) reject("LOCAL_INVENTORY_INPUT_PATH_INVALID");

  let descriptor: number | undefined;
  try {
    const initialStat = lstatSync(candidate);
    if (initialStat.isSymbolicLink() || !initialStat.isFile()) reject("LOCAL_INVENTORY_FILE_UNSAFE");
    if (initialStat.size > RECEIVABLES_SCHEMA_INVENTORY_LOCAL_COMMAND_MAX_BYTES) {
      reject("LOCAL_INVENTORY_FILE_TOO_LARGE");
    }
    const canonicalFile = realpathSync(candidate);
    if (!isInsideRoot(approvedRoot, canonicalFile)) reject("LOCAL_INVENTORY_FILE_UNSAFE");
    descriptor = openSync(canonicalFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    const openedStat = fstatSync(descriptor);
    if (!openedStat.isFile()) reject("LOCAL_INVENTORY_FILE_UNSAFE");
    if (openedStat.size > RECEIVABLES_SCHEMA_INVENTORY_LOCAL_COMMAND_MAX_BYTES) {
      reject("LOCAL_INVENTORY_FILE_TOO_LARGE");
    }
    const bytes = readFileSync(descriptor);
    if (bytes.byteLength > RECEIVABLES_SCHEMA_INVENTORY_LOCAL_COMMAND_MAX_BYTES) {
      reject("LOCAL_INVENTORY_FILE_TOO_LARGE");
    }
    return bytes.toString("utf8");
  } catch (error) {
    if (error instanceof ReceivablesSchemaInventoryLocalCommandError) throw error;
    const code = isRecord(error) && error.code;
    if (code === "ENOENT") reject("LOCAL_INVENTORY_FILE_NOT_FOUND");
    reject("LOCAL_INVENTORY_FILE_UNREADABLE");
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

export function runReceivablesSchemaInventoryLocalCommand(
  input: RunReceivablesSchemaInventoryLocalCommandInput
): ReceivablesSchemaInventoryLocalCommandResult {
  const source = readBoundedReceiptFile(input);
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    reject("LOCAL_INVENTORY_JSON_MALFORMED");
  }
  if (containsUnsafeData(parsed)) reject("LOCAL_INVENTORY_RECEIPTS_UNSAFE");
  validateReceiptShape(parsed);
  return runReceivablesSchemaInventoryCommandCore(parsed);
}
