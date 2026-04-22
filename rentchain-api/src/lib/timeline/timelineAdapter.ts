import type { CanonicalEventDomain, CanonicalEventV1 } from "../events/eventTypes";

export type TimelineItem = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  domain: string;
  status?: string;
  actor?: string;
};

const TITLE_BY_TYPE: Record<string, string> = {
  "decision.appeared": "Appeared",
  "decision.reviewed": "Reviewed",
  "decision.snoozed": "Snoozed",
  "decision.dismissed": "Dismissed",
  "decision.execution_requested": "Execution requested",
  "decision.executed": "Executed",
  "decision.execution_failed": "Execution failed",
  "application.created": "Application created",
  "application.submitted": "Application submitted",
  "screening.quote_generated": "Screening quote generated",
  "screening.checkout_created": "Screening checkout started",
  "screening.paid": "Screening payment completed",
  "screening.completed": "Screening completed",
  "screening.blocked": "Screening blocked",
  "maintenance.request_created": "Maintenance request submitted",
  "maintenance.assigned": "Maintenance assigned",
  "maintenance.completed": "Maintenance completed",
  "maintenance.approval_requested": "Maintenance approval requested",
  "expense.created": "Expense created",
  "expense.linked": "Expense linked",
  "expense.approved": "Expense approved",
  "lease.created": "Lease created",
  "lease.activated": "Lease activated",
  "policy.evaluated": "Policy evaluated",
};

function startCase(value: string) {
  return value
    .split(/[_\s.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fallbackTitle(domain: CanonicalEventDomain, action: string) {
  return `${startCase(domain)} ${startCase(action)}`;
}

function actorLabel(event: CanonicalEventV1) {
  const displayName = String(event.actor?.displayName || "").trim();
  if (displayName) return displayName;
  const role = String(event.actor?.role || "").trim();
  if (role) return startCase(role);
  const type = String(event.actor?.type || "").trim();
  return type ? startCase(type) : undefined;
}

export function canonicalEventToTimelineItem(event: CanonicalEventV1): TimelineItem {
  const type = String(event.type || "").trim();
  return {
    id: event.id,
    title: TITLE_BY_TYPE[type] || fallbackTitle(event.domain, event.action),
    description: String(event.summary || "").trim(),
    timestamp: event.occurredAt || event.recordedAt,
    domain: event.domain,
    status: event.status || undefined,
    actor: actorLabel(event),
  };
}
