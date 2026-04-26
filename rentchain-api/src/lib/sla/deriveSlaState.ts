import { SLA_REASON_CODES, SLA_THRESHOLD_PROFILES, escalationLevelForStage, profileForUrgency } from "./slaConstants";
import type { SlaEvaluationV1, SlaStage } from "./slaTypes";

function asString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function parseTimestamp(value: unknown) {
  const raw = asString(value, 200);
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function stageForAge(
  ageHours: number,
  thresholds: { aging: number; dueSoon: number; overdue: number; escalated: number }
): SlaStage {
  if (ageHours >= thresholds.escalated) return "escalated";
  if (ageHours >= thresholds.overdue) return "overdue";
  if (ageHours >= thresholds.dueSoon) return "due_soon";
  if (ageHours >= thresholds.aging) return "aging";
  return "fresh";
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}

export function deriveSlaState(input: {
  resourceType: string;
  resourceId: string;
  triageCategory?: string | null;
  triageSeverity?: string | null;
  resolutionStatus?: string | null;
  assignmentOwnerId?: string | null;
  assignmentOwnerLabel?: string | null;
  firstSeenAt?: string | null;
  lastSeenAt?: string | null;
  now?: number;
}): SlaEvaluationV1 {
  const nowMs = typeof input.now === "number" && Number.isFinite(input.now) ? input.now : Date.now();
  const firstSeenMs = parseTimestamp(input.firstSeenAt);
  const lastSeenMs = parseTimestamp(input.lastSeenAt);
  const anchorMs = firstSeenMs ?? lastSeenMs ?? nowMs;
  const ageMs = Math.max(0, nowMs - anchorMs);
  const ageHours = roundHours(ageMs / (60 * 60 * 1000));

  const profile = profileForUrgency({
    triageSeverity: input.triageSeverity,
    triageCategory: input.triageCategory,
  });
  const thresholds = SLA_THRESHOLD_PROFILES[profile];
  const stage = stageForAge(ageHours, thresholds);
  const escalationLevel = escalationLevelForStage(stage);

  const hasOwner = Boolean(asString(input.assignmentOwnerId, 240));
  const severity = asString(input.triageSeverity, 40).toLowerCase();
  let code: string = SLA_REASON_CODES.fresh;
  let summary = "This issue is within the initial response window.";
  let details: string | null = null;

  if (stage === "aging") {
    code = SLA_REASON_CODES.aging;
    summary = "This issue is aging and should be reviewed soon.";
  } else if (stage === "due_soon") {
    code = SLA_REASON_CODES.dueSoon;
    summary = "This issue is approaching the overdue threshold.";
  } else if ((stage === "overdue" || stage === "escalated") && !hasOwner) {
    code = SLA_REASON_CODES.unassignedOverdue;
    summary = "This issue is overdue and still has no current owner.";
    details = "Assign an owner or confirm why the issue remains unassigned.";
  } else if (
    (stage === "overdue" || stage === "escalated") &&
    (severity === "critical" || severity === "high") &&
    ["open", "acknowledged", "in_progress", ""].includes(asString(input.resolutionStatus, 40).toLowerCase())
  ) {
    code = SLA_REASON_CODES.unresolvedCritical;
    summary = "A high-urgency issue remains unresolved beyond its SLA window.";
    details = "Review ownership, current handling state, and whether escalation is needed now.";
  } else if ((stage === "overdue" || stage === "escalated") && hasOwner) {
    code = SLA_REASON_CODES.assignmentPresentButStale;
    summary = "This issue has an owner but is still aging past the expected response window.";
    details = "Review whether the assigned owner still has the right context and capacity.";
  } else if (stage === "overdue") {
    code = SLA_REASON_CODES.overdue;
    summary = "This issue is now overdue for operational follow-through.";
  } else if (stage === "escalated") {
    code = SLA_REASON_CODES.escalated;
    summary = "This issue has crossed the escalation threshold and needs immediate attention.";
    details = "Treat this as an escalation candidate in the admin operations flow.";
  }

  return {
    version: "v1",
    resource: {
      type: asString(input.resourceType, 120),
      id: asString(input.resourceId, 240),
    },
    context: {
      triageCategory: asString(input.triageCategory, 120) || null,
      triageSeverity: asString(input.triageSeverity, 40) || null,
      resolutionStatus: asString(input.resolutionStatus, 40) || null,
      assignmentOwnerId: asString(input.assignmentOwnerId, 240) || null,
      assignmentOwnerLabel: asString(input.assignmentOwnerLabel, 240) || null,
    },
    age: {
      firstSeenAt: input.firstSeenAt || null,
      lastSeenAt: input.lastSeenAt || null,
      ageMs,
      ageHours,
    },
    sla: {
      stage,
      escalationLevel,
      thresholdHours: thresholds,
    },
    reason: {
      code,
      summary,
      details,
    },
    evaluatedAt: new Date(nowMs).toISOString(),
  };
}
