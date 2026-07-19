import {
  RECEIVABLES_SCHEMA_READINESS_CLASSIFIER_VERSION,
  RECEIVABLES_SCHEMA_READINESS_EVIDENCE_VERSION,
  RECEIVABLES_SCHEMA_READINESS_PHASE,
  type ClassifyReceivablesSchemaReadinessInput,
  type ReceivablesReadinessEvidenceBase,
  type ReceivablesSchemaReadinessEvidenceState,
  type ReceivablesSchemaReadinessReasonCode,
  type ReceivablesSchemaReadinessResult,
  type ReceivablesSchemaReadinessStatus,
} from "./receivablesSchemaReadinessTypes";

const EVIDENCE_KEYS = [
  "schema",
  "indexes",
  "iam",
  "completeness",
  "consistentRead",
  "pagination",
  "unsafeFieldExclusion",
  "rollout",
  "rollback",
  "verification",
] as const;

const VALID_STATES = new Set<ReceivablesSchemaReadinessEvidenceState>([
  "ready",
  "not_ready",
  "partial",
  "ambiguous",
  "unsafe",
]);

const NEXT_STEP_BY_PREFIX: ReadonlyArray<readonly [string, string]> = [
  ["READINESS_SCHEMA", "Resolve schema compatibility evidence."],
  ["READINESS_INDEX", "Complete exact-query index readiness evidence."],
  ["READINESS_IAM", "Prove the dedicated read-only identity boundary."],
  ["READINESS_COMPLETENESS", "Complete source completeness proof."],
  ["READINESS_CONSISTENCY", "Prove one consistent read boundary."],
  ["READINESS_PAGINATION", "Complete pagination and cap handling proof."],
  ["READINESS_UNSAFE_FIELD", "Prove restricted-field exclusion and safe logging."],
  ["READINESS_ROLLOUT", "Resolve rollout sequencing and approval gates."],
  ["READINESS_ROLLBACK", "Complete phase-specific rollback evidence."],
  ["READINESS_VERIFICATION", "Complete automated and production verification evidence."],
  ["READINESS_EVIDENCE", "Supply complete, compatible, conflict-free evidence."],
  ["READINESS_MANIFEST", "Use the supported evidence manifest version."],
  ["READINESS_CHECKED_AT", "Supply a valid deterministic check timestamp."],
];

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function requireTrue(value: unknown, code: ReceivablesSchemaReadinessReasonCode, reasons: Set<ReceivablesSchemaReadinessReasonCode>) {
  if (value !== true) reasons.add(code);
}

function validateBase(
  evidence: ReceivablesReadinessEvidenceBase,
  reasons: Set<ReceivablesSchemaReadinessReasonCode>
) {
  if (evidence.evidenceVersion !== RECEIVABLES_SCHEMA_READINESS_EVIDENCE_VERSION) {
    reasons.add("READINESS_EVIDENCE_VERSION_MISMATCH");
  }
  if (evidence.confirmed !== true) reasons.add("READINESS_EVIDENCE_UNCONFIRMED");
  if (evidence.conflictsDetected === true) reasons.add("READINESS_EVIDENCE_CONFLICT");
  if (!VALID_STATES.has(evidence.state as ReceivablesSchemaReadinessEvidenceState)) {
    reasons.add("READINESS_EVIDENCE_STATE_INVALID");
    return;
  }
  if (evidence.state === "not_ready") reasons.add("READINESS_EVIDENCE_NOT_READY");
  if (evidence.state === "partial") reasons.add("READINESS_EVIDENCE_PARTIAL");
  if (evidence.state === "ambiguous") reasons.add("READINESS_EVIDENCE_AMBIGUOUS");
  if (evidence.state === "unsafe") reasons.add("READINESS_EVIDENCE_UNSAFE");
}

function readinessStatus(reasons: readonly ReceivablesSchemaReadinessReasonCode[]): ReceivablesSchemaReadinessStatus {
  if (!reasons.length) return "ready";
  if (
    reasons.some((code) =>
      code === "READINESS_EVIDENCE_UNSAFE" ||
      code === "READINESS_IAM_WRITE_CAPABLE" ||
      code === "READINESS_IAM_PRIVILEGED_ACCESS_PRESENT" ||
      code === "READINESS_IAM_LONG_LIVED_KEY_PRESENT" ||
      code === "READINESS_COMPLETENESS_CATCH_TO_EMPTY_PRESENT" ||
      code === "READINESS_COMPLETENESS_POST_FILTER_PRESENT" ||
      code === "READINESS_ROLLOUT_MUTATION_NOT_DEFERRED" ||
      code === "READINESS_ROLLBACK_BROAD_IDENTITY_FALLBACK_ALLOWED"
    )
  ) return "blocked";
  if (reasons.some((code) => code.includes("AMBIGUOUS") || code === "READINESS_EVIDENCE_CONFLICT")) return "ambiguous";
  if (reasons.includes("READINESS_EVIDENCE_PARTIAL") || reasons.includes("READINESS_INDEX_COVERAGE_INCOMPLETE")) return "partial";
  return "not_ready";
}

function nextSteps(reasonCodes: readonly ReceivablesSchemaReadinessReasonCode[]): string[] {
  const steps = new Set<string>();
  for (const reason of reasonCodes) {
    const match = NEXT_STEP_BY_PREFIX.find(([prefix]) => reason.startsWith(prefix));
    if (match) steps.add(match[1]);
  }
  return [...steps].sort();
}

export function classifyReceivablesSchemaReadiness(
  input: ClassifyReceivablesSchemaReadinessInput
): ReceivablesSchemaReadinessResult {
  const reasons = new Set<ReceivablesSchemaReadinessReasonCode>();
  const timestamp = isoTimestamp(input.checkedAt);
  if (!timestamp) reasons.add("READINESS_CHECKED_AT_INVALID");
  if (input.evidenceManifestVersion !== RECEIVABLES_SCHEMA_READINESS_EVIDENCE_VERSION) {
    reasons.add("READINESS_MANIFEST_VERSION_MISMATCH");
  }

  for (const key of EVIDENCE_KEYS) {
    const evidence = input[key];
    if (!evidence) reasons.add("READINESS_EVIDENCE_MISSING");
    else validateBase(evidence, reasons);
  }

  const schema = input.schema;
  if (schema) {
    requireTrue(schema.requiredCollectionsCovered, "READINESS_SCHEMA_COLLECTION_COVERAGE_MISSING", reasons);
    requireTrue(schema.supportedSchemaVersionsOnly, "READINESS_SCHEMA_VERSION_UNSUPPORTED", reasons);
    requireTrue(schema.canonicalOwnershipFieldsPresent, "READINESS_SCHEMA_OWNERSHIP_FIELDS_MISSING", reasons);
    requireTrue(schema.canonicalMappingFieldsPresent, "READINESS_SCHEMA_MAPPING_FIELDS_MISSING", reasons);
    requireTrue(schema.sourceRevisionFieldsPresent, "READINESS_SCHEMA_SOURCE_REVISION_MISSING", reasons);
  }

  const indexes = input.indexes;
  if (indexes) {
    const required = positiveInteger(indexes.requiredIndexCount);
    const ready = positiveInteger(indexes.readyIndexCount);
    if (required === null || ready === null || required === 0 || ready > required) reasons.add("READINESS_INDEX_COUNT_INVALID");
    else if (ready !== required) reasons.add("READINESS_INDEX_COVERAGE_INCOMPLETE");
    requireTrue(indexes.exactQueryCoverageProven, "READINESS_INDEX_EXACT_QUERY_UNPROVEN", reasons);
    requireTrue(indexes.deployedIndexesReady, "READINESS_INDEX_DEPLOYMENT_UNREADY", reasons);
  }

  const iam = input.iam;
  if (iam) {
    requireTrue(iam.dedicatedIdentityPresent, "READINESS_IAM_IDENTITY_MISSING", reasons);
    requireTrue(iam.readOnlyAccessProven, "READINESS_IAM_READ_ONLY_UNPROVEN", reasons);
    if (iam.writeAccessDenied !== true) reasons.add("READINESS_IAM_WRITE_CAPABLE");
    if (iam.privilegedAccessDenied !== true) reasons.add("READINESS_IAM_PRIVILEGED_ACCESS_PRESENT");
    if (iam.longLivedKeysAbsent !== true) reasons.add("READINESS_IAM_LONG_LIVED_KEY_PRESENT");
    requireTrue(iam.environmentBindingProven, "READINESS_IAM_ENVIRONMENT_BINDING_UNPROVEN", reasons);
  }

  const completeness = input.completeness;
  if (completeness) {
    requireTrue(completeness.exactScopeQueriesProven, "READINESS_COMPLETENESS_EXACT_SCOPE_UNPROVEN", reasons);
    requireTrue(completeness.exhaustionProven, "READINESS_COMPLETENESS_EXHAUSTION_UNPROVEN", reasons);
    if (completeness.catchToEmptyAbsent !== true) reasons.add("READINESS_COMPLETENESS_CATCH_TO_EMPTY_PRESENT");
    if (completeness.postReadFilteringAbsent !== true) reasons.add("READINESS_COMPLETENESS_POST_FILTER_PRESENT");
  }

  const consistentRead = input.consistentRead;
  if (consistentRead) {
    requireTrue(consistentRead.readBoundaryProtocolDefined, "READINESS_CONSISTENCY_PROTOCOL_MISSING", reasons);
    requireTrue(consistentRead.crossSourceBoundaryProven, "READINESS_CONSISTENCY_BOUNDARY_UNPROVEN", reasons);
    requireTrue(consistentRead.concurrentChangeInvalidatesSnapshot, "READINESS_CONSISTENCY_CONCURRENT_CHANGE_UNSAFE", reasons);
  }

  const pagination = input.pagination;
  if (pagination) {
    requireTrue(pagination.deterministicOrderingProven, "READINESS_PAGINATION_ORDER_UNPROVEN", reasons);
    requireTrue(pagination.cursorProgressionProven, "READINESS_PAGINATION_CURSOR_UNPROVEN", reasons);
    requireTrue(pagination.capFailsClosed, "READINESS_PAGINATION_CAP_FAIL_CLOSED_UNPROVEN", reasons);
    if (pagination.ambiguousCapHandling !== false) reasons.add("READINESS_PAGINATION_CAP_AMBIGUOUS");
  }

  const unsafeFields = input.unsafeFieldExclusion;
  if (unsafeFields) {
    requireTrue(unsafeFields.allowlistProjectionProven, "READINESS_UNSAFE_FIELD_ALLOWLIST_UNPROVEN", reasons);
    requireTrue(unsafeFields.restrictedFieldsExcluded, "READINESS_UNSAFE_FIELD_EXCLUSION_UNPROVEN", reasons);
    requireTrue(unsafeFields.safeLoggingProven, "READINESS_SAFE_LOGGING_UNPROVEN", reasons);
  }

  const rollout = input.rollout;
  if (rollout) {
    requireTrue(rollout.orderedGatesDefined, "READINESS_ROLLOUT_ORDER_AMBIGUOUS", reasons);
    requireTrue(rollout.defaultOffUntilVerified, "READINESS_ROLLOUT_DEFAULT_OFF_UNPROVEN", reasons);
    if (rollout.productionMutationDeferred !== true) reasons.add("READINESS_ROLLOUT_MUTATION_NOT_DEFERRED");
    requireTrue(rollout.operatorApprovalGatesDefined, "READINESS_ROLLOUT_APPROVAL_GATES_MISSING", reasons);
  }

  const rollback = input.rollback;
  if (rollback) {
    requireTrue(rollback.phaseSpecificRollbackDefined, "READINESS_ROLLBACK_PLAN_MISSING", reasons);
    requireTrue(rollback.appendSafeHistoryProtected, "READINESS_ROLLBACK_APPEND_SAFETY_UNPROVEN", reasons);
    if (rollback.broaderIdentityFallbackProhibited !== true) reasons.add("READINESS_ROLLBACK_BROAD_IDENTITY_FALLBACK_ALLOWED");
  }

  const verification = input.verification;
  if (verification) {
    requireTrue(verification.automatedTestsDefined, "READINESS_VERIFICATION_AUTOMATION_MISSING", reasons);
    requireTrue(verification.negativePermissionTestsDefined, "READINESS_VERIFICATION_NEGATIVE_PERMISSION_MISSING", reasons);
    requireTrue(verification.productionSafetyChecksDefined, "READINESS_VERIFICATION_PRODUCTION_SAFETY_MISSING", reasons);
    requireTrue(verification.postChangeVerificationDefined, "READINESS_VERIFICATION_POST_CHANGE_MISSING", reasons);
  }

  const reasonCodes = [...reasons].sort();
  const status = readinessStatus(reasonCodes);
  return {
    ok: status === "ready",
    readinessStatus: status,
    phase: RECEIVABLES_SCHEMA_READINESS_PHASE,
    classifierVersion: RECEIVABLES_SCHEMA_READINESS_CLASSIFIER_VERSION,
    reasonCodes,
    warnings: status === "ready" ? [] : ["Future source-adapter planning remains gated."],
    checkedAt: timestamp,
    requiredNextSteps: nextSteps(reasonCodes),
  };
}
