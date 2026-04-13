import { type MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";

export type MaintenanceSchedulingState =
  | "awaiting_schedule"
  | "scheduled"
  | "access_coordination_needed"
  | "ready_for_service"
  | "in_progress"
  | "completed"
  | "needs_attention";

export type MaintenanceAccessState = "needed" | "not_needed" | "not_set";

export type MaintenanceSchedulingAudience = "landlord" | "tenant";

export type MaintenanceSchedulingCalendarEvent = {
  requestId: string;
  title: string;
  startAt: number;
  endAt: number | null;
  priority: MaintenanceWorkflowItem["priority"];
  status: MaintenanceWorkflowItem["status"];
};

export type MaintenanceSchedulingAccessView = {
  schedulingState: MaintenanceSchedulingState;
  schedulingLabel: string;
  serviceWindowSummary: string;
  accessState: MaintenanceAccessState;
  accessLabel: string;
  tenantVisibleLabel: string;
  summary: string;
  blockers: string[];
  nextActions: string[];
  calendarEvent: MaintenanceSchedulingCalendarEvent | null;
};

function formatDateTime(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function findScheduledTimestamp(item: MaintenanceWorkflowItem) {
  const history = Array.isArray(item.statusHistory) ? item.statusHistory : [];
  const latestScheduled = [...history]
    .filter((entry) => String(entry?.status || "").toLowerCase() === "scheduled")
    .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0))[0];
  return typeof latestScheduled?.createdAt === "number" ? latestScheduled.createdAt : null;
}

function getServiceWindow(item: MaintenanceWorkflowItem) {
  const startAt =
    typeof item.serviceWindowStartAt === "number"
      ? item.serviceWindowStartAt
      : findScheduledTimestamp(item);
  const endAt = typeof item.serviceWindowEndAt === "number" ? item.serviceWindowEndAt : null;
  return {
    startAt,
    endAt: endAt && startAt && endAt >= startAt ? endAt : endAt,
  };
}

function getServiceWindowSummary(startAt: number | null, endAt: number | null) {
  if (!startAt && !endAt) {
    return "No service window has been confirmed yet.";
  }
  if (startAt && endAt) {
    return `${formatDateTime(startAt)} to ${formatDateTime(endAt)}`;
  }
  if (startAt) {
    return formatDateTime(startAt);
  }
  return "A service window update was recorded without a confirmed start time.";
}

function getAccessState(item: MaintenanceWorkflowItem): MaintenanceAccessState {
  if (item.accessRequired === true) return "needed";
  if (item.accessRequired === false) return "not_needed";
  return "not_set";
}

export function buildMaintenanceSchedulingAccessView(
  item: MaintenanceWorkflowItem,
  audience: MaintenanceSchedulingAudience
): MaintenanceSchedulingAccessView {
  const status = String(item.status || "").toLowerCase();
  const { startAt, endAt } = getServiceWindow(item);
  const hasWindow = Boolean(startAt);
  const accessState = getAccessState(item);
  const blockers: string[] = [];
  const nextActions: string[] = [];

  let schedulingState: MaintenanceSchedulingState = "awaiting_schedule";
  let schedulingLabel = "Awaiting schedule";
  let tenantVisibleLabel = "Awaiting schedule";
  let summary = "This request is waiting for a service window to be confirmed.";

  if (status === "completed") {
    schedulingState = "completed";
    schedulingLabel = "Completed";
    tenantVisibleLabel = "Completed";
    summary = "Service work is marked complete for this request.";
  } else if (status === "cancelled") {
    schedulingState = "needs_attention";
    schedulingLabel = "Needs attention";
    tenantVisibleLabel = "Needs attention";
    summary = "This request is no longer moving through the normal service workflow.";
    blockers.push("The request is cancelled and needs manual review before any new visit is coordinated.");
  } else if (status === "in_progress") {
    schedulingState = "in_progress";
    schedulingLabel = "In progress";
    tenantVisibleLabel = "Service in progress";
    summary = "Service is currently underway for this request.";
  } else if (accessState === "needed" && ["assigned", "scheduled"].includes(status)) {
    schedulingState = "access_coordination_needed";
    schedulingLabel = "Access coordination needed";
    tenantVisibleLabel = "Access coordination needed";
    summary =
      audience === "landlord"
        ? "This request needs unit-access coordination before or during the service visit."
        : "This request needs access coordination before the service visit can go smoothly.";
  } else if (status === "scheduled" && hasWindow) {
    schedulingState = accessState === "not_needed" ? "ready_for_service" : "scheduled";
    schedulingLabel = accessState === "not_needed" ? "Ready for service" : "Scheduled";
    tenantVisibleLabel = "Service scheduled";
    summary =
      accessState === "not_needed"
        ? "A service window is confirmed and no tenant access requirement is currently recorded."
        : "A service window has been recorded for this request.";
  } else if (hasWindow && ["assigned", "scheduled"].includes(status)) {
    schedulingState = "scheduled";
    schedulingLabel = "Scheduled";
    tenantVisibleLabel = "Service scheduled";
    summary = "A service window has been recorded and this request is moving toward service.";
  }

  if (schedulingState === "awaiting_schedule") {
    nextActions.push(
      audience === "landlord"
        ? "Confirm a service window once the assigned handler is ready to attend."
        : "Watch for a confirmed service window from your landlord or service handler."
    );
    if (!["assigned", "scheduled", "in_progress", "completed"].includes(status)) {
      blockers.push(
        audience === "landlord"
          ? "Assignment should be confirmed before a service window is scheduled."
          : "Scheduling usually happens after the request has been assigned for handling."
      );
    }
  }

  if (schedulingState === "access_coordination_needed") {
    nextActions.push(
      audience === "landlord"
        ? "Confirm how unit access will be provided for the visit."
        : "Be ready to provide unit access or follow the access instructions shared with you."
    );
  }

  if (schedulingState === "scheduled" || schedulingState === "ready_for_service") {
    nextActions.push(
      audience === "landlord"
        ? "Keep the tenant informed if the service window changes."
        : "Keep an eye on this request in case the service window changes."
    );
  }

  if (schedulingState === "in_progress") {
    nextActions.push(
      audience === "landlord"
        ? "Capture any major on-site update and close the request when work is complete."
        : "Wait for the service update and completion confirmation after the visit."
    );
  }

  if (schedulingState === "completed") {
    nextActions.push(
      audience === "landlord"
        ? "Review any follow-up notes and reopen only if more work is required."
        : "Review the completed request details and report a follow-up issue only if something still needs attention."
    );
  }

  if (schedulingState === "needs_attention" && blockers.length === 0) {
    blockers.push("This request needs a manual review before the next service step is clear.");
  }
  if (nextActions.length === 0) {
    nextActions.push(
      audience === "landlord"
        ? "Review the current request details before making another service update."
        : "Review the current request details for the latest service information."
    );
  }

  const serviceWindowSummary = getServiceWindowSummary(startAt, endAt);
  const accessLabel =
    accessState === "needed"
      ? "Access needed"
      : accessState === "not_needed"
      ? "Access not needed"
      : "Access requirement not set";

  return {
    schedulingState,
    schedulingLabel,
    serviceWindowSummary,
    accessState,
    accessLabel,
    tenantVisibleLabel,
    summary,
    blockers,
    nextActions,
    calendarEvent:
      status === "scheduled" && startAt
        ? {
            requestId: item.id,
            title: item.title || "Maintenance request",
            startAt,
            endAt,
            priority: item.priority,
            status: item.status,
          }
        : null,
  };
}

export function buildMaintenanceSchedulingCalendarEvents(items: MaintenanceWorkflowItem[]) {
  return items
    .map((item) => buildMaintenanceSchedulingAccessView(item, "landlord").calendarEvent)
    .filter((item): item is MaintenanceSchedulingCalendarEvent => Boolean(item))
    .sort((a, b) => a.startAt - b.startAt);
}
