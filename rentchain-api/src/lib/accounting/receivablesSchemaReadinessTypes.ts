export const RECEIVABLES_SCHEMA_READINESS_CLASSIFIER_VERSION = "receivables_schema_readiness_classifier_v1" as const;
export const RECEIVABLES_SCHEMA_READINESS_EVIDENCE_VERSION = "receivables_schema_readiness_evidence_v1" as const;
export const RECEIVABLES_SCHEMA_READINESS_PHASE = "phase_0r" as const;

export type ReceivablesSchemaReadinessEvidenceState =
  | "ready"
  | "not_ready"
  | "partial"
  | "ambiguous"
  | "unsafe";

export type ReceivablesSchemaReadinessStatus = "ready" | "not_ready" | "partial" | "blocked" | "ambiguous";

export type ReceivablesReadinessEvidenceBase = {
  evidenceVersion: unknown;
  state: ReceivablesSchemaReadinessEvidenceState | string;
  confirmed: unknown;
  conflictsDetected: unknown;
};

export type ReceivablesSchemaEvidence = ReceivablesReadinessEvidenceBase & {
  requiredCollectionsCovered: unknown;
  supportedSchemaVersionsOnly: unknown;
  canonicalOwnershipFieldsPresent: unknown;
  canonicalMappingFieldsPresent: unknown;
  sourceRevisionFieldsPresent: unknown;
};

export type ReceivablesIndexEvidence = ReceivablesReadinessEvidenceBase & {
  requiredIndexCount: unknown;
  readyIndexCount: unknown;
  exactQueryCoverageProven: unknown;
  deployedIndexesReady: unknown;
};

export type ReceivablesIamEvidence = ReceivablesReadinessEvidenceBase & {
  dedicatedIdentityPresent: unknown;
  readOnlyAccessProven: unknown;
  writeAccessDenied: unknown;
  privilegedAccessDenied: unknown;
  longLivedKeysAbsent: unknown;
  environmentBindingProven: unknown;
};

export type ReceivablesCompletenessEvidence = ReceivablesReadinessEvidenceBase & {
  exactScopeQueriesProven: unknown;
  exhaustionProven: unknown;
  catchToEmptyAbsent: unknown;
  postReadFilteringAbsent: unknown;
};

export type ReceivablesConsistentReadEvidence = ReceivablesReadinessEvidenceBase & {
  readBoundaryProtocolDefined: unknown;
  crossSourceBoundaryProven: unknown;
  concurrentChangeInvalidatesSnapshot: unknown;
};

export type ReceivablesPaginationEvidence = ReceivablesReadinessEvidenceBase & {
  deterministicOrderingProven: unknown;
  cursorProgressionProven: unknown;
  capFailsClosed: unknown;
  ambiguousCapHandling: unknown;
};

export type ReceivablesUnsafeFieldEvidence = ReceivablesReadinessEvidenceBase & {
  allowlistProjectionProven: unknown;
  restrictedFieldsExcluded: unknown;
  safeLoggingProven: unknown;
};

export type ReceivablesRolloutEvidence = ReceivablesReadinessEvidenceBase & {
  orderedGatesDefined: unknown;
  defaultOffUntilVerified: unknown;
  productionMutationDeferred: unknown;
  operatorApprovalGatesDefined: unknown;
};

export type ReceivablesRollbackEvidence = ReceivablesReadinessEvidenceBase & {
  phaseSpecificRollbackDefined: unknown;
  appendSafeHistoryProtected: unknown;
  broaderIdentityFallbackProhibited: unknown;
};

export type ReceivablesVerificationEvidence = ReceivablesReadinessEvidenceBase & {
  automatedTestsDefined: unknown;
  negativePermissionTestsDefined: unknown;
  productionSafetyChecksDefined: unknown;
  postChangeVerificationDefined: unknown;
};

export type ClassifyReceivablesSchemaReadinessInput = {
  checkedAt: unknown;
  evidenceManifestVersion: unknown;
  schema?: ReceivablesSchemaEvidence;
  indexes?: ReceivablesIndexEvidence;
  iam?: ReceivablesIamEvidence;
  completeness?: ReceivablesCompletenessEvidence;
  consistentRead?: ReceivablesConsistentReadEvidence;
  pagination?: ReceivablesPaginationEvidence;
  unsafeFieldExclusion?: ReceivablesUnsafeFieldEvidence;
  rollout?: ReceivablesRolloutEvidence;
  rollback?: ReceivablesRollbackEvidence;
  verification?: ReceivablesVerificationEvidence;
};

export type ReceivablesSchemaReadinessReasonCode =
  | "READINESS_MANIFEST_VERSION_MISMATCH"
  | "READINESS_CHECKED_AT_INVALID"
  | "READINESS_EVIDENCE_MISSING"
  | "READINESS_EVIDENCE_VERSION_MISMATCH"
  | "READINESS_EVIDENCE_UNCONFIRMED"
  | "READINESS_EVIDENCE_STATE_INVALID"
  | "READINESS_EVIDENCE_NOT_READY"
  | "READINESS_EVIDENCE_PARTIAL"
  | "READINESS_EVIDENCE_AMBIGUOUS"
  | "READINESS_EVIDENCE_UNSAFE"
  | "READINESS_EVIDENCE_CONFLICT"
  | "READINESS_SCHEMA_COLLECTION_COVERAGE_MISSING"
  | "READINESS_SCHEMA_VERSION_UNSUPPORTED"
  | "READINESS_SCHEMA_OWNERSHIP_FIELDS_MISSING"
  | "READINESS_SCHEMA_MAPPING_FIELDS_MISSING"
  | "READINESS_SCHEMA_SOURCE_REVISION_MISSING"
  | "READINESS_INDEX_COUNT_INVALID"
  | "READINESS_INDEX_COVERAGE_INCOMPLETE"
  | "READINESS_INDEX_EXACT_QUERY_UNPROVEN"
  | "READINESS_INDEX_DEPLOYMENT_UNREADY"
  | "READINESS_IAM_IDENTITY_MISSING"
  | "READINESS_IAM_READ_ONLY_UNPROVEN"
  | "READINESS_IAM_WRITE_CAPABLE"
  | "READINESS_IAM_PRIVILEGED_ACCESS_PRESENT"
  | "READINESS_IAM_LONG_LIVED_KEY_PRESENT"
  | "READINESS_IAM_ENVIRONMENT_BINDING_UNPROVEN"
  | "READINESS_COMPLETENESS_EXACT_SCOPE_UNPROVEN"
  | "READINESS_COMPLETENESS_EXHAUSTION_UNPROVEN"
  | "READINESS_COMPLETENESS_CATCH_TO_EMPTY_PRESENT"
  | "READINESS_COMPLETENESS_POST_FILTER_PRESENT"
  | "READINESS_CONSISTENCY_PROTOCOL_MISSING"
  | "READINESS_CONSISTENCY_BOUNDARY_UNPROVEN"
  | "READINESS_CONSISTENCY_CONCURRENT_CHANGE_UNSAFE"
  | "READINESS_PAGINATION_ORDER_UNPROVEN"
  | "READINESS_PAGINATION_CURSOR_UNPROVEN"
  | "READINESS_PAGINATION_CAP_FAIL_CLOSED_UNPROVEN"
  | "READINESS_PAGINATION_CAP_AMBIGUOUS"
  | "READINESS_UNSAFE_FIELD_ALLOWLIST_UNPROVEN"
  | "READINESS_UNSAFE_FIELD_EXCLUSION_UNPROVEN"
  | "READINESS_SAFE_LOGGING_UNPROVEN"
  | "READINESS_ROLLOUT_ORDER_AMBIGUOUS"
  | "READINESS_ROLLOUT_DEFAULT_OFF_UNPROVEN"
  | "READINESS_ROLLOUT_MUTATION_NOT_DEFERRED"
  | "READINESS_ROLLOUT_APPROVAL_GATES_MISSING"
  | "READINESS_ROLLBACK_PLAN_MISSING"
  | "READINESS_ROLLBACK_APPEND_SAFETY_UNPROVEN"
  | "READINESS_ROLLBACK_BROAD_IDENTITY_FALLBACK_ALLOWED"
  | "READINESS_VERIFICATION_AUTOMATION_MISSING"
  | "READINESS_VERIFICATION_NEGATIVE_PERMISSION_MISSING"
  | "READINESS_VERIFICATION_PRODUCTION_SAFETY_MISSING"
  | "READINESS_VERIFICATION_POST_CHANGE_MISSING";

export type ReceivablesSchemaReadinessResult = {
  ok: boolean;
  readinessStatus: ReceivablesSchemaReadinessStatus;
  phase: typeof RECEIVABLES_SCHEMA_READINESS_PHASE;
  classifierVersion: typeof RECEIVABLES_SCHEMA_READINESS_CLASSIFIER_VERSION;
  reasonCodes: ReceivablesSchemaReadinessReasonCode[];
  warnings: string[];
  checkedAt: string | null;
  requiredNextSteps: string[];
};
