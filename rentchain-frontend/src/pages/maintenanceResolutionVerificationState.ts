import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";

type Audience = "tenant" | "landlord";

export type MaintenanceResolutionVerificationState =
  | "not_ready"
  | "awaiting_verification"
  | "resolved"
  | "needs_follow_up"
  | "needs_attention";

export type MaintenanceResolutionClosureState = "open" | "ready_to_close" | "closed" | "needs_attention";

export type MaintenanceResolutionTenantVisibleState =
  | "not_ready"
  | "awaiting_your_verification"
  | "resolved"
  | "still_needs_attention"
  | "closed"
  | "needs_attention";

export type MaintenanceResolutionTimelineEvent = {
  key: string;
  kind: "awaiting_verification" | "resolution_verified" | "follow_up_needed" | "request_closed";
  label: string;
  timestamp: number;
};

export type MaintenanceResolutionVerificationView = {
  verificationState: MaintenanceResolutionVerificationState;
  verificationLabel: string;
  closureState: MaintenanceResolutionClosureState;
  closureLabel: string;
  tenantVisibleState: MaintenanceResolutionTenantVisibleState;
  tenantVisibleLabel: string;
  readinessState: MaintenanceResolutionVerificationState;
  readinessLabel: string;
  summary: string;
  blockers: string[];
  nextActions: string[];
  timelineEvents: MaintenanceResolutionTimelineEvent[];
};

function statusOf(item: MaintenanceWorkflowItem) {
  return String(item.status || "").trim().toLowerCase();
}

function isCompleted(item: MaintenanceWorkflowItem) {
  return statusOf(item) === "completed" || typeof item.serviceCompletedAt === "number";
}

function isAwaitingVerification(item: MaintenanceWorkflowItem) {
  return (
    isCompleted(item) &&
    (item.resolutionStatus === "completed_pending_review" ||
      item.resolutionStatus === "landlord_approved" ||
      item.resolutionStatus === "tenant_pending_signoff")
  );
}

function isResolved(item: MaintenanceWorkflowItem) {
  return item.resolutionStatus === "resolved" || item.tenantSignoffStatus === "accepted";
}

function needsFollowUp(item: MaintenanceWorkflowItem) {
  return (
    item.resolutionStatus === "follow_up_required" ||
    item.followUpRequired === true ||
    item.tenantSignoffStatus === "declined"
  );
}

function isClosed(item: MaintenanceWorkflowItem) {
  return typeof item.finalResolvedAt === "number" && isResolved(item);
}

function buildTimelineEvents(item: MaintenanceWorkflowItem): MaintenanceResolutionTimelineEvent[] {
  const events: MaintenanceResolutionTimelineEvent[] = [];
  if (typeof item.completionConfirmedByLandlordAt === "number" && isAwaitingVerification(item)) {
    events.push({
      key: "awaiting_verification",
      kind: "awaiting_verification",
      label: "Awaiting tenant verification",
      timestamp: item.completionConfirmedByLandlordAt,
    });
  }
  if (typeof item.tenantSignedOffAt === "number") {
    events.push({
      key: "resolution_verified",
      kind: "resolution_verified",
      label: "Resolution verified",
      timestamp: item.tenantSignedOffAt,
    });
  }
  if (typeof item.tenantDeclinedAt === "number") {
    events.push({
      key: "follow_up_needed",
      kind: "follow_up_needed",
      label: "Follow-up needed",
      timestamp: item.tenantDeclinedAt,
    });
  }
  if (typeof item.finalResolvedAt === "number") {
    events.push({
      key: "request_closed",
      kind: "request_closed",
      label: "Request closed",
      timestamp: item.finalResolvedAt,
    });
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

function verificationLabel(state: MaintenanceResolutionVerificationState) {
  switch (state) {
    case "awaiting_verification":
      return "Awaiting verification";
    case "resolved":
      return "Resolved";
    case "needs_follow_up":
      return "Still needs attention";
    case "needs_attention":
      return "Needs attention";
    case "not_ready":
    default:
      return "Not ready";
  }
}

function closureLabel(state: MaintenanceResolutionClosureState) {
  switch (state) {
    case "ready_to_close":
      return "Ready to close";
    case "closed":
      return "Closed";
    case "needs_attention":
      return "Needs attention";
    case "open":
    default:
      return "Open";
  }
}

function tenantVisibleLabel(state: MaintenanceResolutionTenantVisibleState) {
  switch (state) {
    case "awaiting_your_verification":
      return "Awaiting your verification";
    case "resolved":
      return "Resolved";
    case "still_needs_attention":
      return "Still needs attention";
    case "closed":
      return "Closed";
    case "needs_attention":
      return "Needs attention";
    case "not_ready":
    default:
      return "Not ready";
  }
}

export function buildMaintenanceResolutionVerificationView(
  item: MaintenanceWorkflowItem,
  audience: Audience
): MaintenanceResolutionVerificationView {
  const blockers: string[] = [];
  const nextActions: string[] = [];

  let verificationState: MaintenanceResolutionVerificationState = "not_ready";
  let closureState: MaintenanceResolutionClosureState = "open";
  let tenantState: MaintenanceResolutionTenantVisibleState = "not_ready";
  let summary =
    audience === "landlord"
      ? "This request is not yet in the resolution-verification stage."
      : "This request is not yet in the resolution-verification stage.";

  if (statusOf(item) === "cancelled") {
    verificationState = "needs_attention";
    closureState = "needs_attention";
    tenantState = "needs_attention";
    blockers.push(
      audience === "landlord"
        ? "This request is cancelled and needs review before it can be treated as closed."
        : "This request is cancelled and needs a new update before it can be treated as closed."
    );
  } else if (!isCompleted(item)) {
    verificationState = "not_ready";
    closureState = "open";
    tenantState = "not_ready";
    blockers.push(
      audience === "landlord"
        ? "Tenant verification is not available until service completion is recorded."
        : "Verification becomes available after service completion is recorded."
    );
  } else if (needsFollowUp(item)) {
    verificationState = "needs_follow_up";
    closureState = "needs_attention";
    tenantState = "still_needs_attention";
    summary =
      audience === "landlord"
        ? "The tenant reported that the issue still needs attention, so this request is not closed."
        : "You reported that the issue still needs attention, so this request stays open for follow-up.";
    blockers.push(
      audience === "landlord"
        ? "Follow-up is still required before this request can close."
        : "Your landlord still needs to coordinate follow-up before this request can close."
    );
  } else if (isClosed(item)) {
    verificationState = "resolved";
    closureState = "closed";
    tenantState = "closed";
    summary =
      audience === "landlord"
        ? "The tenant confirmed resolution and the request now has a verified closure state."
        : "You confirmed the issue was resolved and the request is now closed.";
  } else if (isResolved(item)) {
    verificationState = "resolved";
    closureState = "ready_to_close";
    tenantState = "resolved";
    summary =
      audience === "landlord"
        ? "The issue has been marked resolved and is ready to be treated as closed."
        : "The issue has been marked resolved.";
  } else if (isAwaitingVerification(item)) {
    verificationState = "awaiting_verification";
    closureState = "open";
    tenantState = "awaiting_your_verification";
    summary =
      audience === "landlord"
        ? "Completed work is waiting for tenant verification before the request can be clearly closed."
        : "Completed work is waiting for your verification before the request can be clearly closed.";
    blockers.push(
      audience === "landlord"
        ? "Tenant verification is still pending."
        : "Your verification is still needed."
    );
  } else {
    verificationState = "needs_attention";
    closureState = "needs_attention";
    tenantState = "needs_attention";
    blockers.push(
      audience === "landlord"
        ? "The closure state is ambiguous and should be reviewed."
        : "The closure state is ambiguous and should be reviewed."
    );
  }

  if (verificationState === "awaiting_verification") {
    nextActions.push(
      audience === "landlord"
        ? "Wait for the tenant to confirm whether the issue is resolved."
        : "Confirm whether the issue is resolved or still needs attention."
    );
  }
  if (verificationState === "needs_follow_up") {
    nextActions.push(
      audience === "landlord"
        ? "Review the tenant follow-up note and decide the next service step."
        : "Watch for the next follow-up update from your landlord."
    );
  }
  if (closureState === "closed") {
    nextActions.push(
      audience === "landlord"
        ? "Keep this request in closed history unless a new follow-up cycle is needed."
        : "Keep this request in your history for future reference."
    );
  }
  if (nextActions.length === 0) {
    nextActions.push(
      audience === "landlord"
        ? "Use the request detail for the next closure update."
        : "Use the request detail for the latest closure update."
    );
  }

  return {
    verificationState,
    verificationLabel: verificationLabel(verificationState),
    closureState,
    closureLabel: closureLabel(closureState),
    tenantVisibleState: tenantState,
    tenantVisibleLabel: tenantVisibleLabel(tenantState),
    readinessState: verificationState,
    readinessLabel: verificationLabel(verificationState),
    summary,
    blockers,
    nextActions,
    timelineEvents: buildTimelineEvents(item),
  };
}
