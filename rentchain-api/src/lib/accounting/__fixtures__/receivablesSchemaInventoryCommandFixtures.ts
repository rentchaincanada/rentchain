import {
  RECEIVABLES_SCHEMA_INVENTORY_CLAIM_SCOPE,
  RECEIVABLES_SCHEMA_INVENTORY_RECEIPT_VERSION,
  type ReceivablesSchemaInventoryReceiptBase,
  type RunReceivablesSchemaInventoryCommandInput,
} from "../receivablesSchemaInventoryCommandTypes";

const readyBase = (): ReceivablesSchemaInventoryReceiptBase => ({
  receiptVersion: RECEIVABLES_SCHEMA_INVENTORY_RECEIPT_VERSION,
  state: "ready",
  confirmed: true,
  conflictsDetected: false,
  claimScope: RECEIVABLES_SCHEMA_INVENTORY_CLAIM_SCOPE,
});

export const completeReceivablesSchemaInventoryCommandFixture: RunReceivablesSchemaInventoryCommandInput = {
  checkedAt: "2026-07-20T12:00:00.000Z",
  receiptManifestVersion: RECEIVABLES_SCHEMA_INVENTORY_RECEIPT_VERSION,
  schema: {
    ...readyBase(),
    requiredSourcesCovered: true,
    supportedVersionsOnly: true,
    canonicalOwnershipPresent: true,
    canonicalMappingsPresent: true,
    sourceRevisionsPresent: true,
  },
  indexes: {
    ...readyBase(),
    requiredCount: 6,
    attestedReadyCount: 6,
    exactQueryCoverageAttested: true,
    targetStateAttested: true,
  },
  iam: {
    ...readyBase(),
    dedicatedIdentityAttested: true,
    shortLivedIdentityAttested: true,
    readOnlyAttested: true,
    writeDeniedAttested: true,
    privilegedAccessDeniedAttested: true,
    environmentBindingAttested: true,
  },
  completeness: {
    ...readyBase(),
    exactScopeAttested: true,
    exhaustionAttested: true,
    catchToEmptyAbsent: true,
    postReadFilteringAbsent: true,
  },
  consistency: {
    ...readyBase(),
    boundaryProtocolAttested: true,
    crossSourceBoundaryAttested: true,
    concurrentChangeInvalidates: true,
  },
  pagination: {
    ...readyBase(),
    deterministicOrderingAttested: true,
    cursorProgressionAttested: true,
    capFailsClosed: true,
    capHandlingAmbiguous: false,
  },
  unsafeFieldExclusion: {
    ...readyBase(),
    allowlistProjectionAttested: true,
    restrictedFieldsExcluded: true,
    safeOutputAttested: true,
  },
  rollout: {
    ...readyBase(),
    orderedGatesAttested: true,
    defaultOffAttested: true,
    mutationDeferred: true,
    operatorApprovalRequired: true,
  },
  rollback: {
    ...readyBase(),
    rollbackPlanAttested: true,
    appendSafeHistoryProtected: true,
    broaderIdentityFallbackProhibited: true,
  },
  verification: {
    ...readyBase(),
    automatedTestsAttested: true,
    negativePermissionTestsAttested: true,
    controlledContextChecksAttested: true,
    postChangeChecksAttested: true,
  },
};
