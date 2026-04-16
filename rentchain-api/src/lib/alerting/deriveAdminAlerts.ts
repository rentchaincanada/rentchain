import crypto from "crypto";
import type { AssignmentRecordV1 } from "../assignment/assignmentTypes";
import type { PortfolioScoreTrendV1 } from "../portfolioScoreHistory/portfolioScoreHistoryTypes";
import type { ResolutionRecordV1 } from "../resolution/resolutionTypes";
import type { AdminTriageItemV1 } from "../triage/triageTypes";
import type { WatchlistEntryV1 } from "../watchlist/watchlistTypes";
import {
  PORTFOLIO_SCORE_DECLINE_ALERT_THRESHOLD,
  REPEATED_EXCEPTION_THRESHOLD,
  RESOLUTION_STALE_CRITICAL_THRESHOLD_MS,
  RESOLUTION_STALE_HIGH_THRESHOLD_MS,
} from "./alertingConstants";
import type { AdminAlertV1, AlertCategory, AlertSeverity } from "./alertingTypes";
import type { AdminAlertStateRecord } from "./loadAlertStates";

type DeriveAdminAlertsInput = {
  triageItems?: AdminTriageItemV1[];
  portfolioTrends?: PortfolioScoreTrendV1[];
  resolutions?: ResolutionRecordV1[];
  assignments?: AssignmentRecordV1[];
  alertStates?: AdminAlertStateRecord[];
  watchlist?: WatchlistEntryV1[];
  now?: number;
};

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function parseTimestamp(value: unknown) {
  const raw = asString(value, 200);
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function supportConsolePath(resourceType: string, resourceId: string) {
  return `/admin/support-console?resourceType=${encodeURIComponent(resourceType)}&resourceId=${encodeURIComponent(resourceId)}`;
}

function triagePath(resourceType: string) {
  return `/admin/triage?resourceType=${encodeURIComponent(resourceType)}`;
}

function portfolioScorePath(portfolioId?: string | null) {
  return portfolioId ? `/admin/portfolio-score?portfolioId=${encodeURIComponent(portfolioId)}` : null;
}

function alertId(category: AlertCategory, reasonCode: string, resourceType: string, resourceId: string) {
  return crypto
    .createHash("sha256")
    .update(`${category}:${reasonCode}:${resourceType}:${resourceId}`)
    .digest("hex");
}

function severityRank(severity: AlertSeverity) {
  return { critical: 4, high: 3, medium: 2, low: 1 }[severity];
}

function buildAlert(input: {
  category: AlertCategory;
  severity: AlertSeverity;
  resource: AdminAlertV1["resource"];
  reason: AdminAlertV1["reason"];
  signals?: AdminAlertV1["signals"];
  createdAt: string;
  lastSeenAt?: string | null;
  watchlist?: WatchlistEntryV1[];
  alertState?: AdminAlertStateRecord | null;
  assignment?: AssignmentRecordV1 | null;
  tags?: string[];
}): AdminAlertV1 {
  const id = alertId(input.category, input.reason.code, input.resource.type, input.resource.id);
  const state = input.alertState || null;
  const watched = (input.watchlist || []).some(
    (entry) =>
      entry.isActive &&
      entry.target.type === input.resource.type &&
      entry.target.id === input.resource.id
  );
  return {
    version: "v1",
    id,
    category: input.category,
    severity: input.severity,
    resource: input.resource,
    reason: input.reason,
    signals: input.signals || {},
    state: {
      isActive: true,
      isAcknowledged: Boolean(state?.acknowledged),
      acknowledgedAt: state?.acknowledgedAt || null,
      acknowledgedBy: state?.acknowledgedBy || null,
    },
    timestamps: {
      createdAt: input.createdAt,
      updatedAt: state?.updatedAt || input.createdAt,
      lastSeenAt: input.lastSeenAt || null,
    },
    navigation: {
      supportConsolePath:
        input.resource.type === "portfolio" ? undefined : supportConsolePath(input.resource.type, input.resource.id),
      triagePath:
        input.resource.type === "portfolio" ? undefined : triagePath(input.resource.type),
      portfolioScorePath: portfolioScorePath(input.resource.portfolioId || input.resource.id),
    },
    assignment: input.assignment
      ? {
          ownerId: asString(input.assignment.currentOwner?.ownerId, 240) || null,
          ownerLabel: asString(input.assignment.currentOwner?.ownerLabel, 240) || null,
        }
      : null,
    tags: [...(input.tags || []), ...(watched ? ["watched"] : [])],
  };
}

export function deriveAdminAlerts(input: DeriveAdminAlertsInput): AdminAlertV1[] {
  const now = typeof input.now === "number" ? input.now : Date.now();
  const triageItems = input.triageItems || [];
  const assignments = input.assignments || [];
  const alertStatesById = new Map((input.alertStates || []).map((item) => [item.id, item]));
  const watchlist = input.watchlist || [];
  const alerts: AdminAlertV1[] = [];

  for (const item of triageItems) {
    let category: AlertCategory | null = null;
    let severity: AlertSeverity = item.severity;
    let reasonCode = "";
    let reasonSummary = item.reason.summary;

    if (item.category === "screening_reconciliation") {
      category = "screening_reconciliation";
      if (item.reason.code === "TRIAGE_PAID_NOT_FULFILLED") reasonCode = "ALERT_PAID_NOT_FULFILLED";
      else if (item.reason.code === "TRIAGE_SCREENING_MISMATCH") reasonCode = "ALERT_SCREENING_MISMATCH";
      else if (item.reason.code === "TRIAGE_DUPLICATE_RISK") reasonCode = "ALERT_DUPLICATE_RISK";
      else if (item.reason.code === "TRIAGE_BLOCKED_WORKFLOW") reasonCode = "ALERT_BLOCKED_WORKFLOW";
      else if (item.reason.code === "TRIAGE_ABANDONED_CHECKOUT") reasonCode = "ALERT_WORKFLOW_STALLED";
      else reasonCode = "ALERT_SCREENING_NEEDS_REVIEW";
    } else if (item.category === "policy_review") {
      category = "policy_exception";
      reasonCode = item.reason.code === "TRIAGE_POLICY_BLOCKED" ? "ALERT_POLICY_BLOCK_REPEAT" : "ALERT_POLICY_REVIEW_REQUIRED";
    } else if (item.category === "automation_exception") {
      category = "automation_exception";
      reasonCode = "ALERT_AUTOMATION_SKIP_REPEAT";
    } else if (item.category === "maintenance_friction") {
      category = "maintenance_friction";
      reasonCode = "ALERT_MAINTENANCE_REOPENED";
    } else if (item.category === "workflow_stall") {
      category = item.resource.type === "maintenance" ? "maintenance_friction" : "resolution_attention";
      reasonCode = "ALERT_WORKFLOW_STALLED";
    }

    if (!category) continue;

    const assignment =
      assignments.find(
        (record) =>
          asString(record.resource?.type, 120) === item.resource.type &&
          asString(record.resource?.id, 240) === item.resource.id
      ) || null;
    const id = alertId(category, reasonCode, item.resource.type, item.resource.id);
    alerts.push(
      {
        ...buildAlert({
          category,
          severity,
          resource: {
            ...item.resource,
            portfolioId: item.resource.type === "application" || item.resource.type === "maintenance" || item.resource.type === "lease" ? null : null,
          },
          reason: {
            code: reasonCode,
            summary: reasonSummary,
            details: item.reason.details || null,
          },
          signals: {
            reconciliationStatus: item.signals.reconciliationStatus || null,
            triageCategory: item.category,
            triageSeverity: item.severity,
            policyOutcome: item.signals.policyOutcome || null,
            automationAction: item.signals.automationAction || null,
            automationExecuted: item.signals.automationExecuted ?? null,
            resolutionStatus: item.resolution?.status || null,
            inactivityMs: item.signals.inactivityMs ?? null,
          },
          createdAt: item.timestamps.surfacedAt,
          lastSeenAt: item.timestamps.lastSeenAt || item.timestamps.surfacedAt,
          watchlist,
          alertState: alertStatesById.get(id) || null,
          assignment,
          tags: item.tags || [],
        }),
        id,
      }
    );
  }

  for (const trend of input.portfolioTrends || []) {
    const latest = trend.latest;
    if (!latest) continue;
    const gradeDropped = Boolean(trend.deltaGrade && trend.deltaGrade.includes("->"));
    const severeDecline = typeof trend.deltaScore === "number" && trend.deltaScore <= -PORTFOLIO_SCORE_DECLINE_ALERT_THRESHOLD;
    const atRisk = latest.status === "at_risk";
    if (!gradeDropped && !severeDecline && !atRisk) continue;

    const severity: AlertSeverity = atRisk ? "high" : severeDecline ? "high" : "medium";
    const reasonCode = atRisk
      ? "ALERT_PORTFOLIO_AT_RISK"
      : gradeDropped
      ? "ALERT_PORTFOLIO_GRADE_DROP"
      : "ALERT_PORTFOLIO_SCORE_DROP";
    const id = alertId("portfolio_score_change", reasonCode, "portfolio", trend.portfolioId);
    alerts.push(
      {
        ...buildAlert({
          category: "portfolio_score_change",
          severity,
          resource: {
            type: "portfolio",
            id: trend.portfolioId,
            portfolioId: trend.portfolioId,
            title: `Portfolio ${trend.portfolioId}`,
            subtitle: null,
            status: latest.status,
          },
          reason: {
            code: reasonCode,
            summary: trend.summary.headline,
            details: trend.summary.notes.join(" "),
          },
          signals: {
            portfolioScore: latest.score,
            portfolioScoreDelta: trend.deltaScore,
          },
          createdAt: latest.snapshotAt,
          lastSeenAt: latest.snapshotAt,
          watchlist,
          alertState: alertStatesById.get(id) || null,
          assignment: null,
          tags: ["portfolio"],
        }),
        id,
      }
    );
  }

  const repeatedByResource = new Map<string, number>();
  for (const alert of alerts) {
    const key = `${alert.category}:${alert.resource.type}:${alert.resource.id}`;
    repeatedByResource.set(key, (repeatedByResource.get(key) || 0) + 1);
  }

  for (const resolution of input.resolutions || []) {
    if (!["open", "acknowledged"].includes(resolution.status)) continue;
    const ageMs = Math.max(0, now - parseTimestamp(resolution.updatedAt || resolution.createdAt));
    if (ageMs < RESOLUTION_STALE_HIGH_THRESHOLD_MS) continue;
    const triageSeverity = asString(resolution.triage?.severity, 40).toLowerCase();
    const severity: AlertSeverity =
      ageMs >= RESOLUTION_STALE_CRITICAL_THRESHOLD_MS && (triageSeverity === "high" || triageSeverity === "critical")
        ? "critical"
        : "high";
    const reasonCode = "ALERT_RESOLUTION_STALE";
    const assignment =
      assignments.find(
        (record) =>
          asString(record.resource?.type, 120) === resolution.resource.type &&
          asString(record.resource?.id, 240) === resolution.resource.id
      ) || null;
    const id = alertId("resolution_attention", reasonCode, resolution.resource.type, resolution.resource.id);
    alerts.push(
      {
        ...buildAlert({
          category: "resolution_attention",
          severity,
          resource: {
            type: resolution.resource.type,
            id: resolution.resource.id,
            title: `${resolution.resource.type} ${resolution.resource.id}`,
            status: resolution.status,
          },
          reason: {
            code: reasonCode,
            summary: "Resolution is still open and needs renewed attention.",
            details: "Review the operational history and decide whether to progress or close the issue.",
          },
          signals: {
            resolutionStatus: resolution.status,
            inactivityMs: ageMs,
          },
          createdAt: resolution.createdAt,
          lastSeenAt: resolution.updatedAt,
          watchlist,
          alertState: alertStatesById.get(id) || null,
          assignment,
          tags: ["resolution"],
        }),
        id,
      }
    );
  }

  const deduped = new Map<string, AdminAlertV1>();
  for (const alert of alerts) {
    const existing = deduped.get(alert.id);
    if (!existing) {
      deduped.set(alert.id, alert);
      continue;
    }
    if (severityRank(alert.severity) > severityRank(existing.severity)) {
      deduped.set(alert.id, alert);
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const severityDelta = severityRank(b.severity) - severityRank(a.severity);
    if (severityDelta !== 0) return severityDelta;
    return parseTimestamp(b.timestamps.createdAt) - parseTimestamp(a.timestamps.createdAt);
  });
}
