import {
  RECEIVABLES_SCHEMA_READINESS_EVIDENCE_VERSION,
  type ClassifyReceivablesSchemaReadinessInput,
  type ReceivablesReadinessEvidenceBase,
} from "../receivablesSchemaReadinessTypes";

const readyBase = (): ReceivablesReadinessEvidenceBase => ({
  evidenceVersion: RECEIVABLES_SCHEMA_READINESS_EVIDENCE_VERSION,
  state: "ready",
  confirmed: true,
  conflictsDetected: false,
});

export const completeReceivablesSchemaReadinessFixture: ClassifyReceivablesSchemaReadinessInput = {
  checkedAt: "2026-07-19T12:00:00.000Z",
  evidenceManifestVersion: RECEIVABLES_SCHEMA_READINESS_EVIDENCE_VERSION,
  schema: {
    ...readyBase(),
    requiredCollectionsCovered: true,
    supportedSchemaVersionsOnly: true,
    canonicalOwnershipFieldsPresent: true,
    canonicalMappingFieldsPresent: true,
    sourceRevisionFieldsPresent: true,
  },
  indexes: {
    ...readyBase(),
    requiredIndexCount: 6,
    readyIndexCount: 6,
    exactQueryCoverageProven: true,
    deployedIndexesReady: true,
  },
  iam: {
    ...readyBase(),
    dedicatedIdentityPresent: true,
    readOnlyAccessProven: true,
    writeAccessDenied: true,
    privilegedAccessDenied: true,
    longLivedKeysAbsent: true,
    environmentBindingProven: true,
  },
  completeness: {
    ...readyBase(),
    exactScopeQueriesProven: true,
    exhaustionProven: true,
    catchToEmptyAbsent: true,
    postReadFilteringAbsent: true,
  },
  consistentRead: {
    ...readyBase(),
    readBoundaryProtocolDefined: true,
    crossSourceBoundaryProven: true,
    concurrentChangeInvalidatesSnapshot: true,
  },
  pagination: {
    ...readyBase(),
    deterministicOrderingProven: true,
    cursorProgressionProven: true,
    capFailsClosed: true,
    ambiguousCapHandling: false,
  },
  unsafeFieldExclusion: {
    ...readyBase(),
    allowlistProjectionProven: true,
    restrictedFieldsExcluded: true,
    safeLoggingProven: true,
  },
  rollout: {
    ...readyBase(),
    orderedGatesDefined: true,
    defaultOffUntilVerified: true,
    productionMutationDeferred: true,
    operatorApprovalGatesDefined: true,
  },
  rollback: {
    ...readyBase(),
    phaseSpecificRollbackDefined: true,
    appendSafeHistoryProtected: true,
    broaderIdentityFallbackProhibited: true,
  },
  verification: {
    ...readyBase(),
    automatedTestsDefined: true,
    negativePermissionTestsDefined: true,
    productionSafetyChecksDefined: true,
    postChangeVerificationDefined: true,
  },
};
