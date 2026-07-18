import type { ReceivablesShadowReasonCode } from "./receivablesShadowComparatorTypes";
import type {
  ReceivablesSourceSnapshotAdapterInput,
  ReceivablesSourceSnapshotReasonCode,
} from "./receivablesSourceSnapshotTypes";

export const RECEIVABLES_DIAGNOSTIC_RUNNER_VERSION = "receivables_diagnostic_runner_v1" as const;

export type ReceivablesDiagnosticScope = {
  landlordId: unknown;
  leaseId: unknown;
  context: unknown;
};

export type ReceivablesDiagnosticAllowlistDecision = ReceivablesDiagnosticScope & {
  approved: unknown;
  reason: unknown;
  expiresOn?: unknown;
};

export type ReceivablesDiagnosticOperatorIntent = ReceivablesDiagnosticScope & {
  intentType: unknown;
  operatorIdentifier: unknown;
  operatorDisplayName: unknown;
  reason: unknown;
};

export type ReceivablesDiagnosticRunMetadata = {
  checkedAt: unknown;
};

export type RunReceivablesDiagnosticInput = {
  diagnosticConfig?: {
    enabled: unknown;
  };
  target?: ReceivablesDiagnosticScope;
  allowlistDecision?: ReceivablesDiagnosticAllowlistDecision;
  operatorIntent?: ReceivablesDiagnosticOperatorIntent;
  sourceSnapshotInput?: ReceivablesSourceSnapshotAdapterInput;
  asOfDate: unknown;
  diagnosticRunMetadata?: ReceivablesDiagnosticRunMetadata;
  expectedComparatorVersion?: unknown;
};

export type ReceivablesDiagnosticRunnerReasonCode =
  | "DIAGNOSTIC_DISABLED"
  | "DIAGNOSTIC_TARGET_INVALID"
  | "DIAGNOSTIC_ALLOWLIST_MISSING"
  | "DIAGNOSTIC_ALLOWLIST_NOT_APPROVED"
  | "DIAGNOSTIC_ALLOWLIST_SCOPE_MISMATCH"
  | "DIAGNOSTIC_ALLOWLIST_REASON_MISSING"
  | "DIAGNOSTIC_ALLOWLIST_EXPIRED"
  | "DIAGNOSTIC_OPERATOR_INTENT_MISSING"
  | "DIAGNOSTIC_OPERATOR_IDENTITY_MISSING"
  | "DIAGNOSTIC_OPERATOR_REASON_MISSING"
  | "DIAGNOSTIC_OPERATOR_SCOPE_MISMATCH"
  | "DIAGNOSTIC_OPERATOR_INTENT_INVALID"
  | "DIAGNOSTIC_METADATA_INVALID"
  | "DIAGNOSTIC_AS_OF_DATE_INVALID"
  | "DIAGNOSTIC_SNAPSHOT_INPUT_MISSING"
  | "DIAGNOSTIC_SNAPSHOT_SCOPE_MISMATCH"
  | "DIAGNOSTIC_COMPARATOR_VERSION_MISMATCH"
  | ReceivablesSourceSnapshotReasonCode
  | ReceivablesShadowReasonCode;

export type ReceivablesDiagnosticRunnerStatus = "rejected" | "equivalent";

export type ReceivablesDiagnosticRunnerResult = {
  ok: boolean;
  status: ReceivablesDiagnosticRunnerStatus;
  reasonCodes: ReceivablesDiagnosticRunnerReasonCode[];
  warnings: string[];
  diagnosticVersion: typeof RECEIVABLES_DIAGNOSTIC_RUNNER_VERSION;
  snapshotVersion: string;
  comparatorVersion: string;
  checkedAt: string;
};
