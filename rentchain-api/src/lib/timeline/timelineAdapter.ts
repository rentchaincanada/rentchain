import type { CanonicalEventDomain, CanonicalEventV1 } from "../events/eventTypes";

export type TimelineItem = {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  domain: string;
  status?: string;
  actor?: string;
  details?: string[];
};

const TITLE_BY_TYPE: Record<string, string> = {
  "decision.appeared": "Appeared",
  "decision.reviewed": "Reviewed",
  "decision.snoozed": "Snoozed",
  "decision.dismissed": "Dismissed",
  "decision.execution_requested": "Execution requested",
  "decision.executed": "Executed",
  "decision.execution_failed": "Execution failed",
  "controlled_automation.previewed": "Automation preview opened",
  "controlled_automation.confirmed": "Automation confirmed",
  "controlled_automation.executed": "Automation executed",
  "controlled_automation.failed": "Automation failed",
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

function metadataString(value: unknown, max = 240) {
  return String(value || "").trim().slice(0, max);
}

function controlledAutomationDetails(event: CanonicalEventV1) {
  const type = String(event.type || "").trim();
  if (!type.startsWith("controlled_automation.")) return undefined;

  const metadata = event.metadata || {};
  const details: string[] = [];
  const actionLabel = metadataString(metadata.actionLabel, 240);
  const actionKey = metadataString(metadata.actionKey, 120);
  const workflowCategory = metadataString(metadata.workflowCategory, 120);
  const executionGuardKey = metadataString(metadata.executionGuardKey, 240);
  const failureReason = metadataString(metadata.failureReason, 240);

  if (actionLabel) {
    details.push(`Action: ${actionLabel}`);
  } else if (actionKey) {
    details.push(`Action key: ${actionKey}`);
  }

  if (workflowCategory) {
    details.push(`Workflow: ${startCase(workflowCategory)}`);
  }

  if (metadata.duplicateGuardActive === true) {
    details.push("Duplicate protection active");
  }

  if (executionGuardKey) {
    details.push(`Guard key: ${executionGuardKey}`);
  }

  if (type === "controlled_automation.failed" && failureReason) {
    details.push(`Failure reason: ${failureReason}`);
  }

  return details.length ? details : undefined;
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
    details: controlledAutomationDetails(event),
  };
}
