import { compareReceivablesShadow } from "./receivablesShadowComparator";
import { RECEIVABLES_SHADOW_COMPARISON_VERSION } from "./receivablesShadowComparatorTypes";
import {
  RECEIVABLES_DIAGNOSTIC_RUNNER_VERSION,
  type ReceivablesDiagnosticRunnerReasonCode,
  type ReceivablesDiagnosticRunnerResult,
  type ReceivablesDiagnosticScope,
  type RunReceivablesDiagnosticInput,
} from "./receivablesDiagnosticRunnerTypes";
import { buildReceivablesSourceSnapshot } from "./receivablesSourceSnapshotAdapter";
import { RECEIVABLES_SOURCE_SNAPSHOT_VERSION } from "./receivablesSourceSnapshotTypes";
import { cleanAccountingString, parseDateOnly } from "./receivablesTypes";

function normalizedScope(scope: ReceivablesDiagnosticScope | undefined) {
  return {
    landlordId: cleanAccountingString(scope?.landlordId),
    leaseId: cleanAccountingString(scope?.leaseId),
    context: cleanAccountingString(scope?.context),
  };
}

function scopesMatch(left: ReceivablesDiagnosticScope | undefined, right: ReceivablesDiagnosticScope | undefined): boolean {
  const a = normalizedScope(left);
  const b = normalizedScope(right);
  return Boolean(
    a.landlordId && a.leaseId && a.context &&
    a.landlordId === b.landlordId && a.leaseId === b.leaseId && a.context === b.context
  );
}

function checkedAt(value: unknown): string | null {
  const normalized = cleanAccountingString(value, 80);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(normalized)) return null;
  return Number.isNaN(Date.parse(normalized)) ? null : normalized;
}

function rejected(
  reasonCodes: readonly ReceivablesDiagnosticRunnerReasonCode[],
  timestamp: string
): ReceivablesDiagnosticRunnerResult {
  return {
    ok: false,
    status: "rejected",
    reasonCodes: [...new Set(reasonCodes)].sort(),
    warnings: [],
    diagnosticVersion: RECEIVABLES_DIAGNOSTIC_RUNNER_VERSION,
    snapshotVersion: RECEIVABLES_SOURCE_SNAPSHOT_VERSION,
    comparatorVersion: RECEIVABLES_SHADOW_COMPARISON_VERSION,
    checkedAt: timestamp,
  };
}

export function runReceivablesDiagnostic(
  input: RunReceivablesDiagnosticInput
): ReceivablesDiagnosticRunnerResult {
  const timestamp = checkedAt(input.diagnosticRunMetadata?.checkedAt);
  if (!timestamp) return rejected(["DIAGNOSTIC_METADATA_INVALID"], "");
  if (input.diagnosticConfig?.enabled !== true) return rejected(["DIAGNOSTIC_DISABLED"], timestamp);

  const target = normalizedScope(input.target);
  if (!target.landlordId || !target.leaseId || !target.context) {
    return rejected(["DIAGNOSTIC_TARGET_INVALID"], timestamp);
  }

  if (!input.allowlistDecision) return rejected(["DIAGNOSTIC_ALLOWLIST_MISSING"], timestamp);
  if (input.allowlistDecision.approved !== true) {
    return rejected(["DIAGNOSTIC_ALLOWLIST_NOT_APPROVED"], timestamp);
  }
  if (!scopesMatch(input.target, input.allowlistDecision)) {
    return rejected(["DIAGNOSTIC_ALLOWLIST_SCOPE_MISMATCH"], timestamp);
  }
  if (!cleanAccountingString(input.allowlistDecision.reason)) {
    return rejected(["DIAGNOSTIC_ALLOWLIST_REASON_MISSING"], timestamp);
  }
  if (input.allowlistDecision.expiresOn !== undefined) {
    const expiry = parseDateOnly(input.allowlistDecision.expiresOn);
    const runDate = parseDateOnly(timestamp.slice(0, 10));
    if (!expiry || !runDate || expiry.epochDay < runDate.epochDay) {
      return rejected(["DIAGNOSTIC_ALLOWLIST_EXPIRED"], timestamp);
    }
  }

  if (!input.operatorIntent) return rejected(["DIAGNOSTIC_OPERATOR_INTENT_MISSING"], timestamp);
  if (
    !cleanAccountingString(input.operatorIntent.operatorIdentifier) ||
    !cleanAccountingString(input.operatorIntent.operatorDisplayName)
  ) return rejected(["DIAGNOSTIC_OPERATOR_IDENTITY_MISSING"], timestamp);
  if (!cleanAccountingString(input.operatorIntent.reason)) {
    return rejected(["DIAGNOSTIC_OPERATOR_REASON_MISSING"], timestamp);
  }
  if (!scopesMatch(input.target, input.operatorIntent)) {
    return rejected(["DIAGNOSTIC_OPERATOR_SCOPE_MISMATCH"], timestamp);
  }
  if (input.operatorIntent.intentType !== "receivables_diagnostic") {
    return rejected(["DIAGNOSTIC_OPERATOR_INTENT_INVALID"], timestamp);
  }

  const asOf = parseDateOnly(input.asOfDate);
  if (!asOf) return rejected(["DIAGNOSTIC_AS_OF_DATE_INVALID"], timestamp);
  if (!input.sourceSnapshotInput) return rejected(["DIAGNOSTIC_SNAPSHOT_INPUT_MISSING"], timestamp);
  if (
    cleanAccountingString(input.sourceSnapshotInput.asOfDate) !== asOf.value ||
    cleanAccountingString(input.sourceSnapshotInput.lease?.landlordId) !== target.landlordId ||
    cleanAccountingString(input.sourceSnapshotInput.lease?.leaseId) !== target.leaseId
  ) return rejected(["DIAGNOSTIC_SNAPSHOT_SCOPE_MISMATCH"], timestamp);

  if (
    input.expectedComparatorVersion !== undefined &&
    cleanAccountingString(input.expectedComparatorVersion) !== RECEIVABLES_SHADOW_COMPARISON_VERSION
  ) return rejected(["DIAGNOSTIC_COMPARATOR_VERSION_MISMATCH"], timestamp);

  const snapshot = buildReceivablesSourceSnapshot(input.sourceSnapshotInput);
  if (snapshot.status !== "ready" || !snapshot.comparatorInput) {
    return rejected(snapshot.reasonCodes.length ? snapshot.reasonCodes : ["DIAGNOSTIC_SNAPSHOT_INPUT_MISSING"], timestamp);
  }

  const comparison = compareReceivablesShadow(snapshot.comparatorInput);
  if (!comparison.ok || comparison.status !== "equivalent" || comparison.reasonCode !== "SHADOW_EQUIVALENT") {
    return rejected([comparison.reasonCode], timestamp);
  }

  return {
    ok: true,
    status: "equivalent",
    reasonCodes: ["SHADOW_EQUIVALENT"],
    warnings: [],
    diagnosticVersion: RECEIVABLES_DIAGNOSTIC_RUNNER_VERSION,
    snapshotVersion: snapshot.snapshotVersion,
    comparatorVersion: comparison.comparisonVersion,
    checkedAt: timestamp,
  };
}
