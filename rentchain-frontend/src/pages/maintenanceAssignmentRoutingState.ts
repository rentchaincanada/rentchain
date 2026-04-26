import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";

type Audience = "tenant" | "landlord";

export type MaintenanceAssignmentState =
  | "unassigned"
  | "assigned_internal"
  | "routed_for_service"
  | "in_progress"
  | "completed"
  | "needs_attention";

export type TenantHandlingState =
  | "awaiting_assignment"
  | "being_handled"
  | "service_in_progress"
  | "completed"
  | "needs_attention";

export type MaintenanceAssignmentRoutingView = {
  id: string;
  title: string;
  assignmentState: MaintenanceAssignmentState;
  assignmentLabel: string;
  tenantVisibleState: TenantHandlingState;
  tenantVisibleLabel: string;
  ownerSummary: string;
  routingSummary: string;
  summary: string;
  blockers: string[];
  nextActions: string[];
  needsAttention: boolean;
};

function pretty(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Unknown";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeStatus(item: MaintenanceWorkflowItem) {
  return String(item.status || "").trim().toLowerCase();
}

function normalizeContractorStatus(item: MaintenanceWorkflowItem) {
  return String(item.contractorStatus || "").trim().toLowerCase();
}

function resolveAssignmentState(item: MaintenanceWorkflowItem): MaintenanceAssignmentState {
  const status = normalizeStatus(item);
  const contractorStatus = normalizeContractorStatus(item);
  const hasExternalHandler = Boolean(String(item.assignedContractorId || "").trim() || String(item.assignedContractorName || "").trim());

  if (status === "completed") return "completed";
  if (status === "cancelled" || contractorStatus === "cancelled" || contractorStatus === "declined") {
    return "needs_attention";
  }
  if (status === "in_progress") return "in_progress";
  if (hasExternalHandler && ["assigned", "scheduled", "reviewed", "submitted"].includes(status)) {
    return "routed_for_service";
  }
  if (!hasExternalHandler && ["assigned", "scheduled"].includes(status)) {
    return "assigned_internal";
  }
  return "unassigned";
}

function resolveTenantVisibleState(state: MaintenanceAssignmentState): TenantHandlingState {
  switch (state) {
    case "completed":
      return "completed";
    case "needs_attention":
      return "needs_attention";
    case "in_progress":
      return "service_in_progress";
    case "assigned_internal":
    case "routed_for_service":
      return "being_handled";
    case "unassigned":
    default:
      return "awaiting_assignment";
  }
}

function buildOwnerSummary(item: MaintenanceWorkflowItem, state: MaintenanceAssignmentState, audience: Audience) {
  const contractorName = String(item.assignedContractorName || "").trim();
  switch (state) {
    case "completed":
      return audience === "tenant"
        ? "This request is marked complete in your maintenance workspace."
        : contractorName
        ? `Completed with ${contractorName} recorded as the assigned service partner.`
        : "Completed without an external service partner recorded.";
    case "needs_attention":
      return audience === "tenant"
        ? "This request needs a follow-up review before normal handling can continue."
        : "Assignment or service handling needs follow-up before the request can move forward cleanly.";
    case "in_progress":
      return audience === "tenant"
        ? "Your request is actively being handled."
        : contractorName
        ? `${contractorName} is currently handling this request.`
        : "The request is currently being handled in-house.";
    case "routed_for_service":
      return audience === "tenant"
        ? "Your request has been sent into the service workflow."
        : contractorName
        ? `Routed to ${contractorName} for service handling.`
        : "Routed outward for service handling.";
    case "assigned_internal":
      return audience === "tenant"
        ? "The property team has taken ownership of this request."
        : "This request is currently assigned for internal handling.";
    case "unassigned":
    default:
      return audience === "tenant"
        ? "This request is waiting to be assigned for handling."
        : "No handler has been assigned to this request yet.";
  }
}

function buildRoutingSummary(item: MaintenanceWorkflowItem, state: MaintenanceAssignmentState, audience: Audience) {
  const contractorName = String(item.assignedContractorName || "").trim();
  switch (state) {
    case "routed_for_service":
      return audience === "tenant"
        ? "You will continue to see high-level updates here as the request moves through service."
        : contractorName
        ? `${contractorName} is the current external routing target.`
        : "The request has been sent outward for service, but no external label is available.";
    case "assigned_internal":
      return audience === "tenant"
        ? "The request is being handled by the property side."
        : "The request is staying with internal handling rather than an external contractor.";
    case "in_progress":
      return audience === "tenant"
        ? "Work is underway and the next update should appear in the request timeline."
        : "Use the request timeline and note history to keep the active work visible.";
    case "completed":
      return audience === "tenant"
        ? "Keep this request in your history in case follow-up is needed."
        : "The request can stay in completed history unless follow-up is needed.";
    case "needs_attention":
      return audience === "tenant"
        ? "Review the latest update if the request still needs support."
        : "Review the routing and status history before reassigning or closing the request.";
    case "unassigned":
    default:
      return audience === "tenant"
        ? "A handling owner has not been confirmed yet."
        : "Choose whether this request should be handled in-house or routed to a service partner.";
  }
}

function buildBlockers(item: MaintenanceWorkflowItem, state: MaintenanceAssignmentState, audience: Audience) {
  const status = normalizeStatus(item);
  const contractorStatus = normalizeContractorStatus(item);
  const blockers: string[] = [];

  if (state === "unassigned" && status !== "submitted") {
    blockers.push(
      audience === "tenant"
        ? "A handling owner has not been confirmed yet."
        : "No internal owner or external service partner is assigned yet."
    );
  }
  if (state === "unassigned" && status === "submitted") {
    blockers.push(
      audience === "tenant"
        ? "The request is still waiting for initial review and assignment."
        : "The request still needs review before assignment can move forward."
    );
  }
  if (state === "needs_attention" && contractorStatus === "declined") {
    blockers.push(
      audience === "tenant"
        ? "Service handling changed and the request needs a new routing update."
        : "The assigned contractor declined the work and the request needs to be rerouted."
    );
  }
  if (state === "needs_attention" && contractorStatus === "cancelled") {
    blockers.push(
      audience === "tenant"
        ? "This request was cancelled and may need follow-up if the issue is unresolved."
        : "The service routing was cancelled and may need reassignment or closure."
    );
  }

  return blockers;
}

function buildNextActions(item: MaintenanceWorkflowItem, state: MaintenanceAssignmentState, audience: Audience) {
  switch (state) {
    case "completed":
      return audience === "tenant"
        ? ["Review the completed request details.", "Use communications if the issue still needs follow-up."]
        : ["Confirm the work is fully resolved.", "Keep the record in completed history unless follow-up is needed."];
    case "needs_attention":
      return audience === "tenant"
        ? ["Review the latest status update.", "Use communications if the issue still needs help."]
        : ["Review the assignment and status history.", "Reassign, reopen, or close the request based on the latest update."];
    case "in_progress":
      return audience === "tenant"
        ? ["Watch for the next update in the request detail view.", "Keep any access details ready if the property side needs them."]
        : ["Track the active work from the request timeline.", "Mark the request completed once the work is finished."];
    case "routed_for_service":
      return audience === "tenant"
        ? ["Watch for the next service update in this request.", "Use communications if access details or follow-up are needed."]
        : ["Confirm the external service owner has the right context.", "Move the request to scheduled or in progress as updates arrive."];
    case "assigned_internal":
      return audience === "tenant"
        ? ["Watch for the next property-side update.", "Open the request detail view when you need the latest status."]
        : ["Record the next handling update in the request.", "Move the request forward once internal work starts."];
    case "unassigned":
    default:
      return audience === "tenant"
        ? ["Wait for the property side to assign handling.", "Open the request detail view if you need the current status."]
        : ["Assign the request to an internal owner or external service partner.", "Use the landlord note field to capture the next service plan."];
  }
}

export function buildMaintenanceAssignmentRoutingView(
  item: MaintenanceWorkflowItem,
  audience: Audience
): MaintenanceAssignmentRoutingView {
  const assignmentState = resolveAssignmentState(item);
  const tenantVisibleState = resolveTenantVisibleState(assignmentState);

  return {
    id: item.id,
    title: item.title || "Maintenance request",
    assignmentState,
    assignmentLabel: pretty(assignmentState),
    tenantVisibleState,
    tenantVisibleLabel: pretty(tenantVisibleState),
    ownerSummary: buildOwnerSummary(item, assignmentState, audience),
    routingSummary: buildRoutingSummary(item, assignmentState, audience),
    summary: buildOwnerSummary(item, assignmentState, audience),
    blockers: buildBlockers(item, assignmentState, audience),
    nextActions: buildNextActions(item, assignmentState, audience),
    needsAttention: assignmentState === "needs_attention",
  };
}
