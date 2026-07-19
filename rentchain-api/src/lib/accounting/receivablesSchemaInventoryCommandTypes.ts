export const RECEIVABLES_SCHEMA_INVENTORY_COMMAND_CORE_VERSION =
  "receivables_schema_inventory_command_core_v1" as const;
export const RECEIVABLES_SCHEMA_INVENTORY_RECEIPT_VERSION =
  "receivables_schema_inventory_receipt_v1" as const;
export const RECEIVABLES_SCHEMA_INVENTORY_PHASE = "phase_0u" as const;
export const RECEIVABLES_SCHEMA_INVENTORY_CLAIM_SCOPE = "next_audit_only" as const;

export type ReceivablesSchemaInventoryReceiptState =
  | "ready"
  | "not_ready"
  | "partial"
  | "ambiguous"
  | "unsafe";

export type ReceivablesSchemaInventoryStatus =
  | "ready_for_next_audit"
  | "not_ready"
  | "partial"
  | "blocked"
  | "ambiguous";

export type ReceivablesSchemaInventoryReceiptBase = {
  receiptVersion: unknown;
  state: ReceivablesSchemaInventoryReceiptState | string;
  confirmed: unknown;
  conflictsDetected: unknown;
  claimScope: unknown;
};

export type ReceivablesSchemaInventorySchemaReceipt = ReceivablesSchemaInventoryReceiptBase & {
  requiredSourcesCovered: unknown;
  supportedVersionsOnly: unknown;
  canonicalOwnershipPresent: unknown;
  canonicalMappingsPresent: unknown;
  sourceRevisionsPresent: unknown;
};

export type ReceivablesSchemaInventoryIndexReceipt = ReceivablesSchemaInventoryReceiptBase & {
  requiredCount: unknown;
  attestedReadyCount: unknown;
  exactQueryCoverageAttested: unknown;
  targetStateAttested: unknown;
};

export type ReceivablesSchemaInventoryIamReceipt = ReceivablesSchemaInventoryReceiptBase & {
  dedicatedIdentityAttested: unknown;
  shortLivedIdentityAttested: unknown;
  readOnlyAttested: unknown;
  writeDeniedAttested: unknown;
  privilegedAccessDeniedAttested: unknown;
  environmentBindingAttested: unknown;
};

export type ReceivablesSchemaInventoryCompletenessReceipt = ReceivablesSchemaInventoryReceiptBase & {
  exactScopeAttested: unknown;
  exhaustionAttested: unknown;
  catchToEmptyAbsent: unknown;
  postReadFilteringAbsent: unknown;
};

export type ReceivablesSchemaInventoryConsistencyReceipt = ReceivablesSchemaInventoryReceiptBase & {
  boundaryProtocolAttested: unknown;
  crossSourceBoundaryAttested: unknown;
  concurrentChangeInvalidates: unknown;
};

export type ReceivablesSchemaInventoryPaginationReceipt = ReceivablesSchemaInventoryReceiptBase & {
  deterministicOrderingAttested: unknown;
  cursorProgressionAttested: unknown;
  capFailsClosed: unknown;
  capHandlingAmbiguous: unknown;
};

export type ReceivablesSchemaInventoryUnsafeFieldReceipt = ReceivablesSchemaInventoryReceiptBase & {
  allowlistProjectionAttested: unknown;
  restrictedFieldsExcluded: unknown;
  safeOutputAttested: unknown;
};

export type ReceivablesSchemaInventoryRolloutReceipt = ReceivablesSchemaInventoryReceiptBase & {
  orderedGatesAttested: unknown;
  defaultOffAttested: unknown;
  mutationDeferred: unknown;
  operatorApprovalRequired: unknown;
};

export type ReceivablesSchemaInventoryRollbackReceipt = ReceivablesSchemaInventoryReceiptBase & {
  rollbackPlanAttested: unknown;
  appendSafeHistoryProtected: unknown;
  broaderIdentityFallbackProhibited: unknown;
};

export type ReceivablesSchemaInventoryVerificationReceipt = ReceivablesSchemaInventoryReceiptBase & {
  automatedTestsAttested: unknown;
  negativePermissionTestsAttested: unknown;
  controlledContextChecksAttested: unknown;
  postChangeChecksAttested: unknown;
};

export type RunReceivablesSchemaInventoryCommandInput = {
  checkedAt: unknown;
  receiptManifestVersion: unknown;
  schema?: ReceivablesSchemaInventorySchemaReceipt;
  indexes?: ReceivablesSchemaInventoryIndexReceipt;
  iam?: ReceivablesSchemaInventoryIamReceipt;
  completeness?: ReceivablesSchemaInventoryCompletenessReceipt;
  consistency?: ReceivablesSchemaInventoryConsistencyReceipt;
  pagination?: ReceivablesSchemaInventoryPaginationReceipt;
  unsafeFieldExclusion?: ReceivablesSchemaInventoryUnsafeFieldReceipt;
  rollout?: ReceivablesSchemaInventoryRolloutReceipt;
  rollback?: ReceivablesSchemaInventoryRollbackReceipt;
  verification?: ReceivablesSchemaInventoryVerificationReceipt;
};

export type ReceivablesSchemaInventoryReasonCode =
  | "INVENTORY_MANIFEST_VERSION_MISMATCH"
  | "INVENTORY_CHECKED_AT_INVALID"
  | "INVENTORY_RECEIPT_MISSING"
  | "INVENTORY_RECEIPT_VERSION_MISMATCH"
  | "INVENTORY_RECEIPT_UNCONFIRMED"
  | "INVENTORY_RECEIPT_STATE_INVALID"
  | "INVENTORY_RECEIPT_NOT_READY"
  | "INVENTORY_RECEIPT_PARTIAL"
  | "INVENTORY_RECEIPT_AMBIGUOUS"
  | "INVENTORY_RECEIPT_UNSAFE"
  | "INVENTORY_RECEIPT_CONTRADICTORY"
  | "INVENTORY_OPERATIONAL_CLAIM_REJECTED"
  | "INVENTORY_SCHEMA_SOURCE_COVERAGE_MISSING"
  | "INVENTORY_SCHEMA_VERSION_UNSUPPORTED"
  | "INVENTORY_SCHEMA_OWNERSHIP_MISSING"
  | "INVENTORY_SCHEMA_MAPPING_MISSING"
  | "INVENTORY_SCHEMA_REVISION_MISSING"
  | "INVENTORY_INDEX_COUNT_INVALID"
  | "INVENTORY_INDEX_COVERAGE_INCOMPLETE"
  | "INVENTORY_INDEX_QUERY_ATTESTATION_MISSING"
  | "INVENTORY_INDEX_TARGET_ATTESTATION_MISSING"
  | "INVENTORY_IAM_IDENTITY_MISSING"
  | "INVENTORY_IAM_SHORT_LIVED_UNPROVEN"
  | "INVENTORY_IAM_READ_ONLY_UNPROVEN"
  | "INVENTORY_IAM_WRITE_CAPABLE"
  | "INVENTORY_IAM_PRIVILEGED_ACCESS_PRESENT"
  | "INVENTORY_IAM_ENVIRONMENT_BINDING_UNPROVEN"
  | "INVENTORY_COMPLETENESS_EXACT_SCOPE_UNPROVEN"
  | "INVENTORY_COMPLETENESS_EXHAUSTION_UNPROVEN"
  | "INVENTORY_COMPLETENESS_CATCH_TO_EMPTY_PRESENT"
  | "INVENTORY_COMPLETENESS_POST_FILTER_PRESENT"
  | "INVENTORY_CONSISTENCY_PROTOCOL_MISSING"
  | "INVENTORY_CONSISTENCY_BOUNDARY_UNPROVEN"
  | "INVENTORY_CONSISTENCY_CONCURRENT_CHANGE_UNSAFE"
  | "INVENTORY_PAGINATION_ORDER_UNPROVEN"
  | "INVENTORY_PAGINATION_CURSOR_UNPROVEN"
  | "INVENTORY_PAGINATION_CAP_FAIL_CLOSED_UNPROVEN"
  | "INVENTORY_PAGINATION_CAP_AMBIGUOUS"
  | "INVENTORY_UNSAFE_FIELD_ALLOWLIST_UNPROVEN"
  | "INVENTORY_UNSAFE_FIELD_EXCLUSION_UNPROVEN"
  | "INVENTORY_SAFE_OUTPUT_UNPROVEN"
  | "INVENTORY_ROLLOUT_ORDER_UNPROVEN"
  | "INVENTORY_ROLLOUT_DEFAULT_OFF_UNPROVEN"
  | "INVENTORY_ROLLOUT_MUTATION_NOT_DEFERRED"
  | "INVENTORY_ROLLOUT_APPROVAL_MISSING"
  | "INVENTORY_ROLLBACK_PLAN_MISSING"
  | "INVENTORY_ROLLBACK_APPEND_SAFETY_UNPROVEN"
  | "INVENTORY_ROLLBACK_BROAD_IDENTITY_FALLBACK_ALLOWED"
  | "INVENTORY_VERIFICATION_AUTOMATION_MISSING"
  | "INVENTORY_VERIFICATION_NEGATIVE_PERMISSION_MISSING"
  | "INVENTORY_VERIFICATION_CONTROLLED_CONTEXT_MISSING"
  | "INVENTORY_VERIFICATION_POST_CHANGE_MISSING";

export type ReceivablesSchemaInventoryReceiptSummary = {
  required: number;
  received: number;
  ready: number;
  notReady: number;
  partial: number;
  ambiguous: number;
  unsafe: number;
};

export type ReceivablesSchemaInventoryCommandResult = {
  ok: boolean;
  inventoryStatus: ReceivablesSchemaInventoryStatus;
  commandCoreVersion: typeof RECEIVABLES_SCHEMA_INVENTORY_COMMAND_CORE_VERSION;
  phase: typeof RECEIVABLES_SCHEMA_INVENTORY_PHASE;
  reasonCodes: ReceivablesSchemaInventoryReasonCode[];
  warnings: string[];
  checkedAt: string | null;
  requiredNextSteps: string[];
  receiptSummary: ReceivablesSchemaInventoryReceiptSummary;
};
