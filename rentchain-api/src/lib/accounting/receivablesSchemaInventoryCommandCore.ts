import {
  RECEIVABLES_SCHEMA_INVENTORY_CLAIM_SCOPE,
  RECEIVABLES_SCHEMA_INVENTORY_COMMAND_CORE_VERSION,
  RECEIVABLES_SCHEMA_INVENTORY_PHASE,
  RECEIVABLES_SCHEMA_INVENTORY_RECEIPT_VERSION,
  type ReceivablesSchemaInventoryCommandResult,
  type ReceivablesSchemaInventoryReasonCode,
  type ReceivablesSchemaInventoryReceiptBase,
  type ReceivablesSchemaInventoryReceiptState,
  type ReceivablesSchemaInventoryReceiptSummary,
  type ReceivablesSchemaInventoryStatus,
  type RunReceivablesSchemaInventoryCommandInput,
} from "./receivablesSchemaInventoryCommandTypes";

const RECEIPT_KEYS = [
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
] as const;

const VALID_STATES = new Set<ReceivablesSchemaInventoryReceiptState>([
  "ready",
  "not_ready",
  "partial",
  "ambiguous",
  "unsafe",
]);

const NEXT_STEP_BY_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ["INVENTORY_SCHEMA", "Resolve schema receipt evidence."],
  ["INVENTORY_INDEX", "Complete index receipt evidence."],
  ["INVENTORY_IAM", "Resolve read-only identity receipt evidence."],
  ["INVENTORY_COMPLETENESS", "Complete source exhaustion evidence."],
  ["INVENTORY_CONSISTENCY", "Resolve consistent-boundary evidence."],
  ["INVENTORY_PAGINATION", "Resolve pagination and cap evidence."],
  ["INVENTORY_UNSAFE_FIELD", "Prove restricted-field exclusion."],
  ["INVENTORY_SAFE_OUTPUT", "Prove bounded output safety."],
  ["INVENTORY_ROLLOUT", "Complete controlled rollout evidence."],
  ["INVENTORY_ROLLBACK", "Complete rollback evidence."],
  ["INVENTORY_VERIFICATION", "Complete verification evidence."],
  ["INVENTORY_OPERATIONAL", "Remove unsupported operational claims."],
  ["INVENTORY_RECEIPT", "Supply complete and consistent receipts."],
  ["INVENTORY_MANIFEST", "Use the supported receipt manifest."],
  ["INVENTORY_CHECKED_AT", "Supply a valid check timestamp."],
];

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function nonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function requireTrue(
  value: unknown,
  code: ReceivablesSchemaInventoryReasonCode,
  reasons: Set<ReceivablesSchemaInventoryReasonCode>
) {
  if (value !== true) reasons.add(code);
}

function validateBase(
  receipt: ReceivablesSchemaInventoryReceiptBase,
  reasons: Set<ReceivablesSchemaInventoryReasonCode>
) {
  if (receipt.receiptVersion !== RECEIVABLES_SCHEMA_INVENTORY_RECEIPT_VERSION) {
    reasons.add("INVENTORY_RECEIPT_VERSION_MISMATCH");
  }
  if (receipt.confirmed !== true) reasons.add("INVENTORY_RECEIPT_UNCONFIRMED");
  if (receipt.conflictsDetected === true) reasons.add("INVENTORY_RECEIPT_CONTRADICTORY");
  if (receipt.claimScope !== RECEIVABLES_SCHEMA_INVENTORY_CLAIM_SCOPE) {
    reasons.add("INVENTORY_OPERATIONAL_CLAIM_REJECTED");
  }
  if (!VALID_STATES.has(receipt.state as ReceivablesSchemaInventoryReceiptState)) {
    reasons.add("INVENTORY_RECEIPT_STATE_INVALID");
    return;
  }
  if (receipt.state === "not_ready") reasons.add("INVENTORY_RECEIPT_NOT_READY");
  if (receipt.state === "partial") reasons.add("INVENTORY_RECEIPT_PARTIAL");
  if (receipt.state === "ambiguous") reasons.add("INVENTORY_RECEIPT_AMBIGUOUS");
  if (receipt.state === "unsafe") reasons.add("INVENTORY_RECEIPT_UNSAFE");
}

function receiptSummary(input: RunReceivablesSchemaInventoryCommandInput): ReceivablesSchemaInventoryReceiptSummary {
  const summary: ReceivablesSchemaInventoryReceiptSummary = {
    required: RECEIPT_KEYS.length,
    received: 0,
    ready: 0,
    notReady: 0,
    partial: 0,
    ambiguous: 0,
    unsafe: 0,
  };
  for (const key of RECEIPT_KEYS) {
    const receipt = input[key];
    if (!receipt) continue;
    summary.received += 1;
    if (receipt.state === "ready") summary.ready += 1;
    else if (receipt.state === "not_ready") summary.notReady += 1;
    else if (receipt.state === "partial") summary.partial += 1;
    else if (receipt.state === "ambiguous") summary.ambiguous += 1;
    else if (receipt.state === "unsafe") summary.unsafe += 1;
  }
  return summary;
}

function inventoryStatus(reasons: readonly ReceivablesSchemaInventoryReasonCode[]): ReceivablesSchemaInventoryStatus {
  if (!reasons.length) return "ready_for_next_audit";
  if (
    reasons.some((code) =>
      code === "INVENTORY_RECEIPT_UNSAFE" ||
      code === "INVENTORY_OPERATIONAL_CLAIM_REJECTED" ||
      code === "INVENTORY_IAM_WRITE_CAPABLE" ||
      code === "INVENTORY_IAM_PRIVILEGED_ACCESS_PRESENT" ||
      code === "INVENTORY_COMPLETENESS_CATCH_TO_EMPTY_PRESENT" ||
      code === "INVENTORY_COMPLETENESS_POST_FILTER_PRESENT" ||
      code === "INVENTORY_ROLLOUT_MUTATION_NOT_DEFERRED" ||
      code === "INVENTORY_ROLLBACK_BROAD_IDENTITY_FALLBACK_ALLOWED"
    )
  ) return "blocked";
  if (
    reasons.some((code) =>
      code === "INVENTORY_RECEIPT_AMBIGUOUS" ||
      code === "INVENTORY_RECEIPT_CONTRADICTORY" ||
      code === "INVENTORY_PAGINATION_CAP_AMBIGUOUS"
    )
  ) return "ambiguous";
  if (
    reasons.includes("INVENTORY_RECEIPT_PARTIAL") ||
    reasons.includes("INVENTORY_INDEX_COVERAGE_INCOMPLETE")
  ) return "partial";
  return "not_ready";
}

function nextSteps(reasonCodes: readonly ReceivablesSchemaInventoryReasonCode[]): string[] {
  const steps = new Set<string>();
  for (const reason of reasonCodes) {
    const match = NEXT_STEP_BY_PREFIX.find(([prefix]) => reason.startsWith(prefix));
    if (match) steps.add(match[1]);
  }
  return [...steps].sort();
}

export function runReceivablesSchemaInventoryCommandCore(
  input: RunReceivablesSchemaInventoryCommandInput
): ReceivablesSchemaInventoryCommandResult {
  const reasons = new Set<ReceivablesSchemaInventoryReasonCode>();
  const checkedAt = isoTimestamp(input.checkedAt);
  if (!checkedAt) reasons.add("INVENTORY_CHECKED_AT_INVALID");
  if (input.receiptManifestVersion !== RECEIVABLES_SCHEMA_INVENTORY_RECEIPT_VERSION) {
    reasons.add("INVENTORY_MANIFEST_VERSION_MISMATCH");
  }

  for (const key of RECEIPT_KEYS) {
    const receipt = input[key];
    if (!receipt) reasons.add("INVENTORY_RECEIPT_MISSING");
    else validateBase(receipt, reasons);
  }

  const schema = input.schema;
  if (schema) {
    requireTrue(schema.requiredSourcesCovered, "INVENTORY_SCHEMA_SOURCE_COVERAGE_MISSING", reasons);
    requireTrue(schema.supportedVersionsOnly, "INVENTORY_SCHEMA_VERSION_UNSUPPORTED", reasons);
    requireTrue(schema.canonicalOwnershipPresent, "INVENTORY_SCHEMA_OWNERSHIP_MISSING", reasons);
    requireTrue(schema.canonicalMappingsPresent, "INVENTORY_SCHEMA_MAPPING_MISSING", reasons);
    requireTrue(schema.sourceRevisionsPresent, "INVENTORY_SCHEMA_REVISION_MISSING", reasons);
  }

  const indexes = input.indexes;
  if (indexes) {
    const required = nonNegativeInteger(indexes.requiredCount);
    const ready = nonNegativeInteger(indexes.attestedReadyCount);
    if (required === null || ready === null || required === 0 || ready > required) {
      reasons.add("INVENTORY_INDEX_COUNT_INVALID");
    } else if (ready !== required) {
      reasons.add("INVENTORY_INDEX_COVERAGE_INCOMPLETE");
    }
    requireTrue(indexes.exactQueryCoverageAttested, "INVENTORY_INDEX_QUERY_ATTESTATION_MISSING", reasons);
    requireTrue(indexes.targetStateAttested, "INVENTORY_INDEX_TARGET_ATTESTATION_MISSING", reasons);
  }

  const iam = input.iam;
  if (iam) {
    requireTrue(iam.dedicatedIdentityAttested, "INVENTORY_IAM_IDENTITY_MISSING", reasons);
    requireTrue(iam.shortLivedIdentityAttested, "INVENTORY_IAM_SHORT_LIVED_UNPROVEN", reasons);
    requireTrue(iam.readOnlyAttested, "INVENTORY_IAM_READ_ONLY_UNPROVEN", reasons);
    if (iam.writeDeniedAttested !== true) reasons.add("INVENTORY_IAM_WRITE_CAPABLE");
    if (iam.privilegedAccessDeniedAttested !== true) reasons.add("INVENTORY_IAM_PRIVILEGED_ACCESS_PRESENT");
    requireTrue(iam.environmentBindingAttested, "INVENTORY_IAM_ENVIRONMENT_BINDING_UNPROVEN", reasons);
  }

  const completeness = input.completeness;
  if (completeness) {
    requireTrue(completeness.exactScopeAttested, "INVENTORY_COMPLETENESS_EXACT_SCOPE_UNPROVEN", reasons);
    requireTrue(completeness.exhaustionAttested, "INVENTORY_COMPLETENESS_EXHAUSTION_UNPROVEN", reasons);
    if (completeness.catchToEmptyAbsent !== true) reasons.add("INVENTORY_COMPLETENESS_CATCH_TO_EMPTY_PRESENT");
    if (completeness.postReadFilteringAbsent !== true) reasons.add("INVENTORY_COMPLETENESS_POST_FILTER_PRESENT");
  }

  const consistency = input.consistency;
  if (consistency) {
    requireTrue(consistency.boundaryProtocolAttested, "INVENTORY_CONSISTENCY_PROTOCOL_MISSING", reasons);
    requireTrue(consistency.crossSourceBoundaryAttested, "INVENTORY_CONSISTENCY_BOUNDARY_UNPROVEN", reasons);
    requireTrue(consistency.concurrentChangeInvalidates, "INVENTORY_CONSISTENCY_CONCURRENT_CHANGE_UNSAFE", reasons);
  }

  const pagination = input.pagination;
  if (pagination) {
    requireTrue(pagination.deterministicOrderingAttested, "INVENTORY_PAGINATION_ORDER_UNPROVEN", reasons);
    requireTrue(pagination.cursorProgressionAttested, "INVENTORY_PAGINATION_CURSOR_UNPROVEN", reasons);
    requireTrue(pagination.capFailsClosed, "INVENTORY_PAGINATION_CAP_FAIL_CLOSED_UNPROVEN", reasons);
    if (pagination.capHandlingAmbiguous !== false) reasons.add("INVENTORY_PAGINATION_CAP_AMBIGUOUS");
  }

  const unsafeFields = input.unsafeFieldExclusion;
  if (unsafeFields) {
    requireTrue(unsafeFields.allowlistProjectionAttested, "INVENTORY_UNSAFE_FIELD_ALLOWLIST_UNPROVEN", reasons);
    requireTrue(unsafeFields.restrictedFieldsExcluded, "INVENTORY_UNSAFE_FIELD_EXCLUSION_UNPROVEN", reasons);
    requireTrue(unsafeFields.safeOutputAttested, "INVENTORY_SAFE_OUTPUT_UNPROVEN", reasons);
  }

  const rollout = input.rollout;
  if (rollout) {
    requireTrue(rollout.orderedGatesAttested, "INVENTORY_ROLLOUT_ORDER_UNPROVEN", reasons);
    requireTrue(rollout.defaultOffAttested, "INVENTORY_ROLLOUT_DEFAULT_OFF_UNPROVEN", reasons);
    if (rollout.mutationDeferred !== true) reasons.add("INVENTORY_ROLLOUT_MUTATION_NOT_DEFERRED");
    requireTrue(rollout.operatorApprovalRequired, "INVENTORY_ROLLOUT_APPROVAL_MISSING", reasons);
  }

  const rollback = input.rollback;
  if (rollback) {
    requireTrue(rollback.rollbackPlanAttested, "INVENTORY_ROLLBACK_PLAN_MISSING", reasons);
    requireTrue(rollback.appendSafeHistoryProtected, "INVENTORY_ROLLBACK_APPEND_SAFETY_UNPROVEN", reasons);
    if (rollback.broaderIdentityFallbackProhibited !== true) {
      reasons.add("INVENTORY_ROLLBACK_BROAD_IDENTITY_FALLBACK_ALLOWED");
    }
  }

  const verification = input.verification;
  if (verification) {
    requireTrue(verification.automatedTestsAttested, "INVENTORY_VERIFICATION_AUTOMATION_MISSING", reasons);
    requireTrue(
      verification.negativePermissionTestsAttested,
      "INVENTORY_VERIFICATION_NEGATIVE_PERMISSION_MISSING",
      reasons
    );
    requireTrue(
      verification.controlledContextChecksAttested,
      "INVENTORY_VERIFICATION_CONTROLLED_CONTEXT_MISSING",
      reasons
    );
    requireTrue(verification.postChangeChecksAttested, "INVENTORY_VERIFICATION_POST_CHANGE_MISSING", reasons);
  }

  const reasonCodes = [...reasons].sort();
  const status = inventoryStatus(reasonCodes);
  return {
    ok: status === "ready_for_next_audit",
    inventoryStatus: status,
    commandCoreVersion: RECEIVABLES_SCHEMA_INVENTORY_COMMAND_CORE_VERSION,
    phase: RECEIVABLES_SCHEMA_INVENTORY_PHASE,
    reasonCodes,
    warnings: ["Injected receipts support next-audit discussion only."],
    checkedAt,
    requiredNextSteps: nextSteps(reasonCodes),
    receiptSummary: receiptSummary(input),
  };
}
