import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";

export type MaintenanceConfirmationState =
  | "awaiting_confirmation"
  | "confirmed"
  | "needs_schedule_change"
  | "in_progress"
  | "completed"
  | "needs_attention";

export type MaintenanceConfirmationAccessState =
  | "access_not_needed"
  | "access_required"
  | "access_acknowledged"
  | "access_not_set";

export type MaintenanceServiceReadinessState =
  | "not_ready"
  | "ready_for_service"
  | "in_progress"
  | "completed"
  | "needs_attention";

export type MaintenanceConfirmationAudience = "landlord" | "tenant";

export type MaintenanceConfirmationAccessView = {
  confirmationState: MaintenanceConfirmationState;
  confirmationLabel: string;
  accessState: MaintenanceConfirmationAccessState;
  accessLabel: string;
  readinessState: MaintenanceServiceReadinessState;
  readinessLabel: string;
  tenantVisibleState: string;
  summary: string;
  blockers: string[];
  nextActions: string[];
};

function hasScheduledWindow(item: MaintenanceWorkflowItem) {
  return typeof item.serviceWindowStartAt === "number";
}

function hasAccessAcknowledged(item: MaintenanceWorkflowItem) {
  return typeof item.accessAcknowledgedAt === "number";
}

function isConfirmationStatus(value: string | null | undefined): value is "confirmed" | "needs_schedule_change" {
  return value === "confirmed" || value === "needs_schedule_change";
}

function pretty(value: string) {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildMaintenanceConfirmationAccessView(
  item: MaintenanceWorkflowItem,
  audience: MaintenanceConfirmationAudience
): MaintenanceConfirmationAccessView {
  const status = String(item.status || "").toLowerCase();
  const confirmationStatus = isConfirmationStatus(item.tenantConfirmationStatus)
    ? item.tenantConfirmationStatus
    : null;
  const accessRequired = item.accessRequired === true;
  const accessAcknowledged = hasAccessAcknowledged(item);
  const hasWindow = hasScheduledWindow(item);
  const blockers: string[] = [];
  const nextActions: string[] = [];

  let confirmationState: MaintenanceConfirmationState = "awaiting_confirmation";
  let confirmationLabel = "Awaiting confirmation";
  let accessState: MaintenanceConfirmationAccessState = accessRequired
    ? accessAcknowledged
      ? "access_acknowledged"
      : "access_required"
    : item.accessRequired === false
    ? "access_not_needed"
    : "access_not_set";
  let accessLabel =
    accessState === "access_acknowledged"
      ? "Access acknowledged"
      : accessState === "access_required"
      ? "Access required"
      : accessState === "access_not_needed"
      ? "Access not needed"
      : "Access requirement not set";
  let readinessState: MaintenanceServiceReadinessState = "not_ready";
  let readinessLabel = "Not ready for service";
  let tenantVisibleState = "Awaiting confirmation";
  let summary = "A scheduled service window still needs tenant confirmation before it is clearly ready to proceed.";

  if (status === "completed") {
    confirmationState = "completed";
    confirmationLabel = "Completed";
    readinessState = "completed";
    readinessLabel = "Completed";
    tenantVisibleState = "Completed";
    summary = "This request is marked complete.";
  } else if (status === "in_progress") {
    confirmationState = "in_progress";
    confirmationLabel = "In progress";
    readinessState = "in_progress";
    readinessLabel = "In progress";
    tenantVisibleState = "Service in progress";
    summary = "Service is already underway for this request.";
  } else if (status === "cancelled") {
    confirmationState = "needs_attention";
    confirmationLabel = "Needs attention";
    readinessState = "needs_attention";
    readinessLabel = "Needs attention";
    tenantVisibleState = "Needs attention";
    summary = "This request is not currently in a normal confirmation workflow.";
    blockers.push("The request is cancelled and will need manual review before service can proceed.");
  } else if (!hasWindow || !["assigned", "scheduled"].includes(status)) {
    confirmationState = "needs_attention";
    confirmationLabel = "Needs attention";
    readinessState = "not_ready";
    readinessLabel = "Not ready for service";
    tenantVisibleState = "Not ready";
    summary =
      audience === "landlord"
        ? "A confirmed service window is required before tenant confirmation can be resolved."
        : "Your landlord needs to confirm the service window before this request can move into confirmation.";
    blockers.push(
      audience === "landlord"
        ? "Set or update the service window before using the confirmation workflow."
        : "Wait for a confirmed service window before taking the next step."
    );
  } else if (confirmationStatus === "needs_schedule_change") {
    confirmationState = "needs_schedule_change";
    confirmationLabel = "Needs schedule change";
    readinessState = "needs_attention";
    readinessLabel = "Needs attention";
    tenantVisibleState = "Needs schedule change";
    summary =
      audience === "landlord"
        ? "The tenant flagged this service window as needing a change before the visit should proceed."
        : "You flagged this service window as needing a change.";
    blockers.push(
      audience === "landlord"
        ? "Update the service window or follow up with the tenant before treating this request as ready."
        : "Wait for an updated service window from your landlord."
    );
  } else if (confirmationStatus === "confirmed" && (!accessRequired || accessAcknowledged)) {
    confirmationState = "confirmed";
    confirmationLabel = "Confirmed";
    readinessState = "ready_for_service";
    readinessLabel = "Ready for service";
    tenantVisibleState = "Ready for service";
    summary =
      accessRequired && accessAcknowledged
        ? "The tenant has confirmed the service window and acknowledged the access requirement."
        : "The tenant has confirmed the current service window.";
  } else if (confirmationStatus === "confirmed") {
    confirmationState = "confirmed";
    confirmationLabel = "Confirmed";
    readinessState = "not_ready";
    readinessLabel = "Awaiting access acknowledgement";
    tenantVisibleState = "Confirmed";
    summary = "The service window is confirmed, but access still needs to be acknowledged before the request is ready.";
    blockers.push(
      audience === "landlord"
        ? "Access is required but has not been acknowledged by the tenant yet."
        : "Access is required before this service visit can be treated as ready."
    );
  } else {
    confirmationState = "awaiting_confirmation";
    confirmationLabel = "Awaiting confirmation";
    readinessState = "not_ready";
    readinessLabel = "Awaiting tenant confirmation";
    tenantVisibleState = "Awaiting your confirmation";
    summary =
      audience === "landlord"
        ? "The scheduled service window is waiting on tenant confirmation."
        : "Please review the scheduled service window and confirm whether it works for you.";
    blockers.push(
      audience === "landlord"
        ? "Tenant confirmation is still pending for this service window."
        : "This service window has not been confirmed yet."
    );
  }

  if (confirmationState === "awaiting_confirmation") {
    nextActions.push(
      audience === "landlord"
        ? "Wait for the tenant to confirm or request a schedule change."
        : "Confirm the service window or flag that you need a schedule change."
    );
  }

  if (confirmationState === "needs_schedule_change") {
    nextActions.push(
      audience === "landlord"
        ? "Adjust the service window and ask the tenant to re-confirm it."
        : "Watch for an updated service window from your landlord."
    );
  }

  if (confirmationState === "confirmed" && accessRequired && !accessAcknowledged) {
    nextActions.push(
      audience === "landlord"
        ? "Wait for access acknowledgement before treating the visit as fully ready."
        : "Acknowledge the access requirement if you are comfortable with the current plan."
    );
  }

  if (readinessState === "ready_for_service") {
    nextActions.push(
      audience === "landlord"
        ? "Keep the request detail updated if the visit timing changes."
        : "Watch this request for any last-minute service window updates."
    );
  }

  if (confirmationState === "needs_attention" && nextActions.length === 0) {
    nextActions.push(
      audience === "landlord"
        ? "Review the request detail and scheduling history before making the next update."
        : "Review the request detail for the latest service update."
    );
  }

  if (nextActions.length === 0) {
    nextActions.push(
      audience === "landlord"
        ? "Review the request detail for the next operational step."
        : "Use this request detail for the latest confirmation and access updates."
    );
  }

  return {
    confirmationState,
    confirmationLabel,
    accessState,
    accessLabel,
    readinessState,
    readinessLabel,
    tenantVisibleState,
    summary,
    blockers,
    nextActions,
  };
}

export function getMaintenanceConfirmationBadgeLabel(item: MaintenanceWorkflowItem) {
  return pretty(
    isConfirmationStatus(item.tenantConfirmationStatus) ? item.tenantConfirmationStatus : "awaiting_confirmation"
  );
}
