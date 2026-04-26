import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";

type Audience = "tenant" | "landlord";

export type MaintenanceServiceExecutionState =
  | "not_ready"
  | "ready_for_service"
  | "in_progress"
  | "completed"
  | "needs_attention";

export type MaintenanceServiceCompletionState =
  | "not_started"
  | "awaiting_completion"
  | "completed"
  | "completion_needs_attention";

export type MaintenanceServiceTenantVisibleState =
  | "not_ready"
  | "ready_for_service"
  | "work_in_progress"
  | "service_completed"
  | "needs_attention";

export type MaintenanceServiceTimelineEvent = {
  key: string;
  kind: "service_started" | "service_completed" | "completion_recorded";
  label: string;
  timestamp: number;
};

export type MaintenanceServiceExecutionView = {
  executionState: MaintenanceServiceExecutionState;
  executionLabel: string;
  completionState: MaintenanceServiceCompletionState;
  completionLabel: string;
  tenantVisibleState: MaintenanceServiceTenantVisibleState;
  tenantVisibleLabel: string;
  readinessState: MaintenanceServiceExecutionState;
  readinessLabel: string;
  summary: string;
  blockers: string[];
  nextActions: string[];
  timelineEvents: MaintenanceServiceTimelineEvent[];
};

function statusOf(item: MaintenanceWorkflowItem) {
  return String(item.status || "").trim().toLowerCase();
}

function hasServiceWindow(item: MaintenanceWorkflowItem) {
  return typeof item.serviceWindowStartAt === "number";
}

function hasConfirmedAccess(item: MaintenanceWorkflowItem) {
  if (item.accessRequired !== true) return true;
  return typeof item.accessAcknowledgedAt === "number";
}

function isReadyForService(item: MaintenanceWorkflowItem) {
  return (
    statusOf(item) === "scheduled" &&
    hasServiceWindow(item) &&
    item.tenantConfirmationStatus === "confirmed" &&
    hasConfirmedAccess(item)
  );
}

function hasStarted(item: MaintenanceWorkflowItem) {
  return typeof item.serviceStartedAt === "number" || ["in_progress", "completed"].includes(statusOf(item));
}

function hasCompleted(item: MaintenanceWorkflowItem) {
  return typeof item.serviceCompletedAt === "number" || statusOf(item) === "completed";
}

function hasCompletionAttention(item: MaintenanceWorkflowItem) {
  return (
    item.followUpRequired === true ||
    item.resolutionStatus === "follow_up_required" ||
    item.tenantSignoffStatus === "declined"
  );
}

function buildTimelineEvents(item: MaintenanceWorkflowItem): MaintenanceServiceTimelineEvent[] {
  const events: MaintenanceServiceTimelineEvent[] = [];
  if (typeof item.serviceStartedAt === "number") {
    events.push({
      key: "service_started",
      kind: "service_started",
      label: "Service started",
      timestamp: item.serviceStartedAt,
    });
  }
  if (typeof item.serviceCompletedAt === "number") {
    events.push({
      key: "service_completed",
      kind: "service_completed",
      label: "Service completed",
      timestamp: item.serviceCompletedAt,
    });
  }
  if (typeof item.completionConfirmedByLandlordAt === "number") {
    events.push({
      key: "completion_recorded",
      kind: "completion_recorded",
      label: "Completion recorded",
      timestamp: item.completionConfirmedByLandlordAt,
    });
  }
  return events.sort((a, b) => b.timestamp - a.timestamp);
}

function executionLabel(state: MaintenanceServiceExecutionState) {
  switch (state) {
    case "ready_for_service":
      return "Ready for service";
    case "in_progress":
      return "Work in progress";
    case "completed":
      return "Service completed";
    case "needs_attention":
      return "Needs attention";
    case "not_ready":
    default:
      return "Not ready";
  }
}

function completionLabel(state: MaintenanceServiceCompletionState) {
  switch (state) {
    case "awaiting_completion":
      return "Awaiting completion";
    case "completed":
      return "Completed";
    case "completion_needs_attention":
      return "Completion needs attention";
    case "not_started":
    default:
      return "Not started";
  }
}

function tenantVisibleLabel(state: MaintenanceServiceTenantVisibleState) {
  switch (state) {
    case "ready_for_service":
      return "Ready for service";
    case "work_in_progress":
      return "Work in progress";
    case "service_completed":
      return "Service completed";
    case "needs_attention":
      return "Needs attention";
    case "not_ready":
    default:
      return "Not ready";
  }
}

export function buildMaintenanceServiceExecutionView(
  item: MaintenanceWorkflowItem,
  audience: Audience
): MaintenanceServiceExecutionView {
  const status = statusOf(item);
  const blockers: string[] = [];
  const nextActions: string[] = [];
  const started = hasStarted(item);
  const completed = hasCompleted(item);
  const ready = isReadyForService(item);
  const completionNeedsAttention = hasCompletionAttention(item);

  let executionState: MaintenanceServiceExecutionState = "not_ready";
  let completionState: MaintenanceServiceCompletionState = "not_started";
  let tenantState: MaintenanceServiceTenantVisibleState = "not_ready";
  let summary =
    audience === "landlord"
      ? "This request is still moving through setup and is not yet clearly ready to begin service."
      : "This request is still moving through setup and is not yet clearly ready for service.";

  if (status === "cancelled") {
    executionState = "needs_attention";
    completionState = "completion_needs_attention";
    tenantState = "needs_attention";
    blockers.push(
      audience === "landlord"
        ? "This request is cancelled and needs review before service can continue."
        : "This request is cancelled and needs a new property-side update before service can continue."
    );
    summary =
      audience === "landlord"
        ? "This request is not in an active service path right now."
        : "This request is not in an active service path right now.";
  } else if (completed) {
    executionState = completionNeedsAttention ? "needs_attention" : "completed";
    completionState = completionNeedsAttention ? "completion_needs_attention" : "completed";
    tenantState = completionNeedsAttention ? "needs_attention" : "service_completed";
    if (!item.completionSummary) {
      blockers.push(
        audience === "landlord"
          ? "A completion note has not been recorded yet."
          : "A detailed completion note has not been shared yet."
      );
    }
    if (completionNeedsAttention) {
      blockers.push(
        audience === "landlord"
          ? "Follow-up is still open, so this request is not operationally closed yet."
          : "Follow-up is still open, so this request is not fully closed yet."
      );
      summary =
        audience === "landlord"
          ? "Service completion was recorded, but the request still needs follow-up before closure."
          : "Service completion was recorded, but the request still needs follow-up before closure.";
    } else {
      summary =
        audience === "landlord"
          ? "Service completion has been recorded and the request now has a clear closure state."
          : "Service completion has been recorded so you can see that the service visit finished.";
    }
  } else if (started) {
    executionState = "in_progress";
    completionState = "awaiting_completion";
    tenantState = "work_in_progress";
    summary =
      audience === "landlord"
        ? "Service has started and is still open until completion is recorded."
        : "Service is underway and the request will stay active until completion is recorded.";
  } else if (item.tenantConfirmationStatus === "needs_schedule_change") {
    executionState = "needs_attention";
    completionState = "not_started";
    tenantState = "needs_attention";
    blockers.push(
      audience === "landlord"
        ? "The tenant asked for a schedule change before service begins."
        : "You asked for a schedule change before service begins."
    );
    summary =
      audience === "landlord"
        ? "This request is paused at scheduling because the current service window needs attention."
        : "This request is paused at scheduling because the current service window needs attention.";
  } else if (ready) {
    executionState = "ready_for_service";
    completionState = "not_started";
    tenantState = "ready_for_service";
    summary =
      audience === "landlord"
        ? "This request is ready for service and can be marked in progress when work begins."
        : "This request is ready for service and should move to work in progress once the visit begins.";
  } else {
    if (!hasServiceWindow(item) && ["assigned", "scheduled"].includes(status)) {
      blockers.push(
        audience === "landlord"
          ? "A confirmed service window is still missing."
          : "A confirmed service window is still missing."
      );
    }
    if (status === "scheduled" && item.tenantConfirmationStatus !== "confirmed") {
      blockers.push(
        audience === "landlord"
          ? "Tenant confirmation is still pending."
          : "Tenant confirmation is still pending."
      );
    }
    if (item.accessRequired === true && !hasConfirmedAccess(item)) {
      blockers.push(
        audience === "landlord"
          ? "Access still needs to be acknowledged before service is clearly ready."
          : "Access still needs to be acknowledged before service is clearly ready."
      );
    }
  }

  if (executionState === "ready_for_service") {
    nextActions.push(
      audience === "landlord"
        ? "Mark service started when the visit begins."
        : "Watch this request for the service-start update."
    );
  }
  if (executionState === "in_progress") {
    nextActions.push(
      audience === "landlord"
        ? "Record completion when the work is done."
        : "Watch this request for the completion update."
    );
  }
  if (completionState === "completion_needs_attention") {
    nextActions.push(
      audience === "landlord"
        ? "Review the follow-up state before treating this request as closed."
        : "Review the latest follow-up update from your landlord."
    );
  }
  if (nextActions.length === 0) {
    nextActions.push(
      audience === "landlord"
        ? "Use the request detail to keep the service state current."
        : "Use the request detail for the latest service update."
    );
  }

  return {
    executionState,
    executionLabel: executionLabel(executionState),
    completionState,
    completionLabel: completionLabel(completionState),
    tenantVisibleState: tenantState,
    tenantVisibleLabel: tenantVisibleLabel(tenantState),
    readinessState: executionState,
    readinessLabel: executionLabel(executionState),
    summary,
    blockers,
    nextActions,
    timelineEvents: buildTimelineEvents(item),
  };
}
