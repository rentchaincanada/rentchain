export type SecurityTelemetryRetentionClass = "security_session_internal";

export type SecurityTelemetryLifecycleState =
  | "active"
  | "archived"
  | "retention_expired"
  | "purge_pending"
  | "purged";

export type SecurityTelemetryRetentionPolicy = {
  schemaVersion: "security_telemetry_retention_policy.v1";
  policyVersion: "security_telemetry_retention.v1";
  classification: SecurityTelemetryRetentionClass;
  activeRetentionDays: number;
  archiveAfterDays: number;
  purgeAfterDays: number;
  purgePendingGraceDays: number;
  internalOnly: true;
  nonPortable: true;
  nonExportable: true;
  supportSafe: true;
};

export type SecurityTelemetryRetentionDecision = {
  schemaVersion: "security_telemetry_retention_decision.v1";
  policyVersion: SecurityTelemetryRetentionPolicy["policyVersion"];
  classification: SecurityTelemetryRetentionClass;
  lifecycleState: SecurityTelemetryLifecycleState;
  reason:
    | "within_active_retention"
    | "archive_window_reached"
    | "retention_window_expired"
    | "purge_grace_elapsed"
    | "already_purged"
    | "invalid_recorded_at";
  recordedAt: string | null;
  evaluatedAt: string;
  archiveAfter: string | null;
  purgeAfter: string | null;
  purgePendingAfter: string | null;
  activeSupportSignalsIncluded: boolean;
  forensicChainIncluded: boolean;
  supportSummaryIncluded: boolean;
  purgeEligible: boolean;
  internalOnly: true;
  nonPortable: true;
  nonExportable: true;
};

export type SecurityTelemetryRetentionCounts = {
  activeCount: number;
  archivedCount: number;
  retentionExpiredCount: number;
  purgePendingCount: number;
  purgedCount: number;
  totalEvaluatedCount: number;
};

export type SecurityTelemetryRetentionSummary = SecurityTelemetryRetentionCounts & {
  schemaVersion: "security_telemetry_retention_summary.v1";
  policyVersion: SecurityTelemetryRetentionPolicy["policyVersion"];
  classification: SecurityTelemetryRetentionClass;
  activeRetentionDays: number;
  archiveAfterDays: number;
  purgeAfterDays: number;
  purgePendingGraceDays: number;
  evaluatedAt: string;
  nonPortable: true;
  nonExportable: true;
  internalOnly: true;
  destructivePurgeJobImplemented: false;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const SECURITY_TELEMETRY_RETENTION_POLICY: SecurityTelemetryRetentionPolicy = {
  schemaVersion: "security_telemetry_retention_policy.v1",
  policyVersion: "security_telemetry_retention.v1",
  classification: "security_session_internal",
  activeRetentionDays: 180,
  archiveAfterDays: 180,
  purgeAfterDays: 365,
  purgePendingGraceDays: 30,
  internalOnly: true,
  nonPortable: true,
  nonExportable: true,
  supportSafe: true,
};

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS).toISOString();
}

function parseTimestamp(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time) : null;
}

export function evaluateSecurityTelemetryRetention(input: {
  recordedAt?: string | null;
  evaluatedAt?: string | Date | null;
  lifecycleState?: SecurityTelemetryLifecycleState | null;
}): SecurityTelemetryRetentionDecision {
  const evaluatedAtDate = parseTimestamp(input.evaluatedAt) || new Date();
  const evaluatedAt = evaluatedAtDate.toISOString();
  const recordedAtDate = parseTimestamp(input.recordedAt);
  const recordedAt = recordedAtDate?.toISOString() || null;
  const policy = SECURITY_TELEMETRY_RETENTION_POLICY;

  if (input.lifecycleState === "purged") {
    return {
      schemaVersion: "security_telemetry_retention_decision.v1",
      policyVersion: policy.policyVersion,
      classification: policy.classification,
      lifecycleState: "purged",
      reason: "already_purged",
      recordedAt,
      evaluatedAt,
      archiveAfter: recordedAtDate ? addDays(recordedAtDate, policy.archiveAfterDays) : null,
      purgeAfter: recordedAtDate ? addDays(recordedAtDate, policy.purgeAfterDays) : null,
      purgePendingAfter: recordedAtDate ? addDays(recordedAtDate, policy.purgeAfterDays + policy.purgePendingGraceDays) : null,
      activeSupportSignalsIncluded: false,
      forensicChainIncluded: false,
      supportSummaryIncluded: false,
      purgeEligible: false,
      internalOnly: true,
      nonPortable: true,
      nonExportable: true,
    };
  }

  if (!recordedAtDate) {
    return {
      schemaVersion: "security_telemetry_retention_decision.v1",
      policyVersion: policy.policyVersion,
      classification: policy.classification,
      lifecycleState: "retention_expired",
      reason: "invalid_recorded_at",
      recordedAt: null,
      evaluatedAt,
      archiveAfter: null,
      purgeAfter: null,
      purgePendingAfter: null,
      activeSupportSignalsIncluded: false,
      forensicChainIncluded: false,
      supportSummaryIncluded: false,
      purgeEligible: true,
      internalOnly: true,
      nonPortable: true,
      nonExportable: true,
    };
  }

  const ageMs = Math.max(0, evaluatedAtDate.getTime() - recordedAtDate.getTime());
  const activeMs = policy.activeRetentionDays * DAY_MS;
  const purgeMs = policy.purgeAfterDays * DAY_MS;
  const purgePendingMs = (policy.purgeAfterDays + policy.purgePendingGraceDays) * DAY_MS;

  let lifecycleState: SecurityTelemetryLifecycleState = "active";
  let reason: SecurityTelemetryRetentionDecision["reason"] = "within_active_retention";
  if (ageMs >= purgePendingMs) {
    lifecycleState = "purge_pending";
    reason = "purge_grace_elapsed";
  } else if (ageMs >= purgeMs) {
    lifecycleState = "retention_expired";
    reason = "retention_window_expired";
  } else if (ageMs >= activeMs) {
    lifecycleState = "archived";
    reason = "archive_window_reached";
  }

  const active = lifecycleState === "active";
  const archived = lifecycleState === "archived";
  return {
    schemaVersion: "security_telemetry_retention_decision.v1",
    policyVersion: policy.policyVersion,
    classification: policy.classification,
    lifecycleState,
    reason,
    recordedAt,
    evaluatedAt,
    archiveAfter: addDays(recordedAtDate, policy.archiveAfterDays),
    purgeAfter: addDays(recordedAtDate, policy.purgeAfterDays),
    purgePendingAfter: addDays(recordedAtDate, policy.purgeAfterDays + policy.purgePendingGraceDays),
    activeSupportSignalsIncluded: active,
    forensicChainIncluded: active || archived,
    supportSummaryIncluded: active || archived,
    purgeEligible: lifecycleState === "retention_expired" || lifecycleState === "purge_pending",
    internalOnly: true,
    nonPortable: true,
    nonExportable: true,
  };
}

export function summarizeSecurityTelemetryRetention(
  decisions: SecurityTelemetryRetentionDecision[],
  evaluatedAt: string | Date | null = null
): SecurityTelemetryRetentionSummary {
  const policy = SECURITY_TELEMETRY_RETENTION_POLICY;
  const evaluatedAtDate = parseTimestamp(evaluatedAt) || new Date();
  return {
    schemaVersion: "security_telemetry_retention_summary.v1",
    policyVersion: policy.policyVersion,
    classification: policy.classification,
    activeRetentionDays: policy.activeRetentionDays,
    archiveAfterDays: policy.archiveAfterDays,
    purgeAfterDays: policy.purgeAfterDays,
    purgePendingGraceDays: policy.purgePendingGraceDays,
    evaluatedAt: evaluatedAtDate.toISOString(),
    activeCount: decisions.filter((decision) => decision.lifecycleState === "active").length,
    archivedCount: decisions.filter((decision) => decision.lifecycleState === "archived").length,
    retentionExpiredCount: decisions.filter((decision) => decision.lifecycleState === "retention_expired").length,
    purgePendingCount: decisions.filter((decision) => decision.lifecycleState === "purge_pending").length,
    purgedCount: decisions.filter((decision) => decision.lifecycleState === "purged").length,
    totalEvaluatedCount: decisions.length,
    nonPortable: true,
    nonExportable: true,
    internalOnly: true,
    destructivePurgeJobImplemented: false,
  };
}
