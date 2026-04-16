import type { EscalationLevel, SlaStage } from "./slaTypes";

export type SlaThresholdProfileKey = "low" | "medium" | "high";

export const SLA_THRESHOLD_PROFILES: Record<
  SlaThresholdProfileKey,
  { aging: number; dueSoon: number; overdue: number; escalated: number }
> = {
  low: {
    aging: 24,
    dueSoon: 48,
    overdue: 72,
    escalated: 96,
  },
  medium: {
    aging: 12,
    dueSoon: 24,
    overdue: 48,
    escalated: 72,
  },
  high: {
    aging: 6,
    dueSoon: 12,
    overdue: 24,
    escalated: 36,
  },
};

export const SLA_REASON_CODES = {
  fresh: "SLA_FRESH",
  aging: "SLA_AGING",
  dueSoon: "SLA_DUE_SOON",
  overdue: "SLA_OVERDUE",
  escalated: "SLA_ESCALATED",
  unassignedOverdue: "SLA_UNASSIGNED_OVERDUE",
  unresolvedCritical: "SLA_UNRESOLVED_CRITICAL",
  assignmentPresentButStale: "SLA_ASSIGNMENT_PRESENT_BUT_STALE",
} as const;

export function profileForUrgency(input: {
  triageSeverity?: string | null;
  triageCategory?: string | null;
}): SlaThresholdProfileKey {
  const severity = String(input.triageSeverity || "").toLowerCase();
  if (severity === "critical" || severity === "high") return "high";
  if (severity === "medium") return "medium";
  if (input.triageCategory === "screening_reconciliation") return "high";
  return "low";
}

export function escalationLevelForStage(stage: SlaStage): EscalationLevel {
  if (stage === "fresh" || stage === "aging") return "none";
  if (stage === "due_soon") return "low";
  if (stage === "overdue") return "high";
  return "critical";
}
