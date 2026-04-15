import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";

type Audience = "tenant" | "landlord";

export type MaintenanceReopenState =
  | "not_applicable"
  | "follow_up_needed"
  | "reopened"
  | "resolved"
  | "closed"
  | "needs_attention";

export type MaintenanceEscalationState = "not_escalated" | "escalated" | "needs_attention";

export type MaintenanceReopenTenantVisibleState =
  | "not_applicable"
  | "still_needs_attention"
  | "reopened"
  | "escalated"
  | "resolved"
  | "closed"
  | "needs_attention";

export type MaintenanceReopenTimelineEvent = {
  key: string;
  kind: "request_reopened" | "follow_up_needed" | "request_escalated" | "resolved_after_follow_up";
  label: string;
  timestamp: number;
};

export type MaintenanceReopenEscalationView = {
  reopenState: MaintenanceReopenState;
  reopenLabel: string;
  escalationState: MaintenanceEscalationState;
  escalationLabel: string;
  tenantVisibleState: MaintenanceReopenTenantVisibleState;
  tenantVisibleLabel: string;
  readinessState: MaintenanceReopenState;
  readinessLabel: string;
  summary: string;
  blockers: string[];
  nextActions: string[];
  timelineEvents: MaintenanceReopenTimelineEvent[];
  canTenantReopen: boolean;
};

function statusOf(item: MaintenanceWorkflowItem) {
  return String(item.status || "").trim().toLowerCase();
}

function hasClosureRecord(item: MaintenanceWorkflowItem) {
  return (
    typeof item.finalResolvedAt === "number" ||
    item.resolutionStatus === "resolved" ||
    item.tenantSignoffStatus === "accepted" ||
    item.reworkReview?.status === "closed" ||
    item.reworkReview?.tenantSignoffStatus === "accepted"
  );
}

function hasFollowUp(item: MaintenanceWorkflowItem) {
  return (
    item.resolutionStatus === "follow_up_required" ||
    item.followUpRequired === true ||
    item.tenantSignoffStatus === "declined" ||
    item.reworkReview?.status === "follow_up_required" ||
    item.reworkReview?.tenantSignoffStatus === "declined"
  );
}

function hasReopenedMarker(item: MaintenanceWorkflowItem) {
  return typeof item.reopenedAt === "number" || Boolean(String(item.reopenReason || "").trim());
}

function followUpCycleCount(item: MaintenanceWorkflowItem) {
  const historyCount = Array.isArray(item.reworkHistory) ? item.reworkHistory.length : 0;
  const activeCycleCount = item.reworkCycle ? 1 : 0;
  return historyCount + activeCycleCount;
}

function isEscalated(item: MaintenanceWorkflowItem) {
  if (!hasFollowUp(item)) return false;
  if (item.reworkReview?.status === "follow_up_required") return true;
  if (followUpCycleCount(item) > 1) return true;
  if (hasReopenedMarker(item) && followUpCycleCount(item) > 0) return true;
  return false;
}

function canTenantReopen(item: MaintenanceWorkflowItem) {
  const status = statusOf(item);
  if (status !== "completed") return false;
  if (!hasClosureRecord(item)) return false;
  if (hasFollowUp(item)) return false;
  if (item.resolutionStatus === "tenant_pending_signoff") return false;
  if (item.reworkReview?.status === "tenant_pending_signoff") return false;
  if (item.reworkCycle && item.reworkCycle.status !== "completed" && item.reworkCycle.status !== "cancelled") return false;
  return true;
}

function buildTimelineEvents(item: MaintenanceWorkflowItem): MaintenanceReopenTimelineEvent[] {
  const events: MaintenanceReopenTimelineEvent[] = [];
  if (typeof item.reopenedAt === "number") {
    events.push({
      key: "request_reopened",
      kind: "request_reopened",
      label: "Request reopened",
      timestamp: item.reopenedAt,
    });
  }
  if (typeof item.tenantDeclinedAt === "number" || typeof item.reworkReview?.tenantDeclinedAt === "number") {
    const timestamp = Math.max(item.tenantDeclinedAt || 0, item.reworkReview?.tenantDeclinedAt || 0);
    events.push({
      key: "follow_up_needed",
      kind: "follow_up_needed",
      label: "Follow-up needed",
      timestamp,
    });
  }
  if (isEscalated(item)) {
    const escalationTimestamp =
      item.reworkReview?.tenantDeclinedAt ||
      item.reworkCycle?.completedAt ||
      item.reopenedAt ||
      item.tenantDeclinedAt ||
      item.updatedAt ||
      null;
    if (typeof escalationTimestamp === "number") {
      events.push({
        key: "request_escalated",
        kind: "request_escalated",
        label: "Escalation recorded",
        timestamp: escalationTimestamp,
      });
    }
  }
  if (typeof item.finalResolvedAt === "number" && followUpCycleCount(item) > 0) {
    events.push({
      key: "resolved_after_follow_up",
      kind: "resolved_after_follow_up",
      label: "Resolved after follow-up",
      timestamp: item.finalResolvedAt,
    });
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

function reopenLabel(state: MaintenanceReopenState) {
  switch (state) {
    case "follow_up_needed":
      return "Follow-up needed";
    case "reopened":
      return "Reopened";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    case "needs_attention":
      return "Needs attention";
    case "not_applicable":
    default:
      return "Not applicable yet";
  }
}

function escalationLabel(state: MaintenanceEscalationState) {
  switch (state) {
    case "escalated":
      return "Escalated";
    case "needs_attention":
      return "Needs attention";
    case "not_escalated":
    default:
      return "Not escalated";
  }
}

function tenantVisibleLabel(state: MaintenanceReopenTenantVisibleState) {
  switch (state) {
    case "still_needs_attention":
      return "Still needs attention";
    case "reopened":
      return "Reopened";
    case "escalated":
      return "Escalated";
    case "resolved":
      return "Resolved";
    case "closed":
      return "Closed";
    case "needs_attention":
      return "Needs attention";
    case "not_applicable":
    default:
      return "No follow-up recorded";
  }
}

export function buildMaintenanceReopenEscalationView(
  item: MaintenanceWorkflowItem,
  audience: Audience
): MaintenanceReopenEscalationView {
  const blockers: string[] = [];
  const nextActions: string[] = [];
  const closed = typeof item.finalResolvedAt === "number";
  const followUp = hasFollowUp(item);
  const reopened = hasReopenedMarker(item);
  const escalated = isEscalated(item);
  const resolvedAfterFollowUp = followUpCycleCount(item) > 0 && hasClosureRecord(item) && !followUp;

  let reopenState: MaintenanceReopenState = "not_applicable";
  let escalationState: MaintenanceEscalationState = "not_escalated";
  let tenantState: MaintenanceReopenTenantVisibleState = "not_applicable";
  let summary =
    audience === "landlord"
      ? "This request has not entered the reopen or follow-up recovery stage."
      : "This request has not entered the reopen or follow-up recovery stage.";

  if (statusOf(item) === "cancelled") {
    reopenState = "needs_attention";
    escalationState = "needs_attention";
    tenantState = "needs_attention";
    blockers.push(
      audience === "landlord"
        ? "This request is cancelled, so any post-closure recovery should be reviewed carefully."
        : "This request is cancelled, so post-closure follow-up needs a fresh review."
    );
  } else if (escalated) {
    reopenState = reopened ? "reopened" : "follow_up_needed";
    escalationState = "escalated";
    tenantState = "escalated";
    summary =
      audience === "landlord"
        ? "This request came back after a prior closure attempt and now needs escalated follow-up."
        : "This issue came back after a prior closure attempt, so it is now in an escalated follow-up state.";
    blockers.push(
      audience === "landlord"
        ? "Repeated attention is still needed before this request can be treated as resolved again."
        : "Your landlord still needs to coordinate another follow-up step."
    );
  } else if (followUp) {
    reopenState = reopened ? "reopened" : "follow_up_needed";
    escalationState = "not_escalated";
    tenantState = reopened ? "reopened" : "still_needs_attention";
    summary =
      audience === "landlord"
        ? reopened
          ? "The request has been reopened and is back in an active follow-up cycle."
          : "The request still needs follow-up before it can return to a closed state."
        : reopened
        ? "Your request has been reopened so the issue can be worked again without starting from scratch."
        : "This request still needs follow-up before it can return to a closed state.";
    blockers.push(
      audience === "landlord"
        ? "Follow-up work is still required."
        : "Follow-up work is still required."
    );
  } else if (closed) {
    reopenState = "closed";
    escalationState = "not_escalated";
    tenantState = "closed";
    summary =
      audience === "landlord"
        ? resolvedAfterFollowUp
          ? "The request was resolved after follow-up and is now closed again."
          : "The request is closed, but it can still be reopened if the issue returns."
        : resolvedAfterFollowUp
        ? "The issue was resolved after follow-up and is now closed again."
        : "This request is closed, but you can still report if the issue comes back.";
  } else if (hasClosureRecord(item)) {
    reopenState = "resolved";
    escalationState = "not_escalated";
    tenantState = "resolved";
    summary =
      audience === "landlord"
        ? "The issue is currently resolved with no active follow-up recorded."
        : "The issue is currently resolved with no active follow-up recorded.";
  }

  if (followUp) {
    nextActions.push(
      audience === "landlord"
        ? escalated
          ? "Review the repeated issue history and decide the next recovery step."
          : "Review the tenant follow-up note and coordinate the next service step."
        : escalated
        ? "Watch for the next escalated follow-up update from your landlord."
        : "Watch for the next follow-up update from your landlord."
    );
  }
  if (canTenantReopen(item)) {
    nextActions.push(
      audience === "landlord"
        ? "Keep the request in closed history unless the tenant reports that it still needs attention."
        : "Use the request detail if the issue comes back and still needs attention."
    );
  }
  if (nextActions.length === 0) {
    nextActions.push(
      audience === "landlord"
        ? "Use the request detail for the next reopen or follow-up update."
        : "Use the request detail for the latest follow-up update."
    );
  }

  return {
    reopenState,
    reopenLabel: reopenLabel(reopenState),
    escalationState,
    escalationLabel: escalationLabel(escalationState),
    tenantVisibleState: tenantState,
    tenantVisibleLabel: tenantVisibleLabel(tenantState),
    readinessState: reopenState,
    readinessLabel: reopenLabel(reopenState),
    summary,
    blockers,
    nextActions,
    timelineEvents: buildTimelineEvents(item),
    canTenantReopen: audience === "tenant" ? canTenantReopen(item) : false,
  };
}
