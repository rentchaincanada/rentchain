import type { MaintenanceWorkflowItem } from "../api/maintenanceWorkflowApi";

export type MaintenanceLifecycleState =
  | "submitted"
  | "acknowledged"
  | "in_progress"
  | "completed"
  | "needs_attention";

export type MaintenanceLifecycleView = {
  id: string;
  title: string;
  lifecycleState: MaintenanceLifecycleState;
  lifecycleLabel: string;
  statusLabel: string;
  summary: string;
  nextSteps: string[];
  needsAttention: boolean;
};

export type MaintenanceWorkspaceView = {
  totalCount: number;
  openCount: number;
  counts: Record<MaintenanceLifecycleState, number>;
  summaryTitle: string;
  summaryDescription: string;
  nextSteps: string[];
  requestViews: MaintenanceLifecycleView[];
};

type Audience = "tenant" | "landlord";

function pretty(value?: string | null) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Unknown";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeLifecycleState(item: MaintenanceWorkflowItem): MaintenanceLifecycleState {
  switch (String(item.status || "").trim().toLowerCase()) {
    case "completed":
      return "completed";
    case "cancelled":
      return "needs_attention";
    case "in_progress":
      return "in_progress";
    case "assigned":
    case "scheduled":
    case "reviewed":
      return "acknowledged";
    case "submitted":
    default:
      return "submitted";
  }
}

function buildSummary(item: MaintenanceWorkflowItem, audience: Audience, lifecycleState: MaintenanceLifecycleState) {
  const category = pretty(item.category);
  const priority = pretty(item.priority);
  switch (lifecycleState) {
    case "completed":
      return audience === "tenant"
        ? `This ${category.toLowerCase()} request is marked completed. Review the work and keep the record for future reference if anything else comes up.`
        : `This ${category.toLowerCase()} request is marked completed and is ready to stay in the closed history unless follow-up is needed.`;
    case "needs_attention":
      return audience === "tenant"
        ? `This request needs attention before it can move forward normally. Review the latest update and use communications if the issue still needs support.`
        : `This request needs attention because the current workflow is no longer progressing normally. Review the history before closing or reopening the work.`;
    case "in_progress":
      return audience === "tenant"
        ? `Work is actively underway on this ${priority.toLowerCase()} request. Keep access details and follow-up context ready in case the property side needs them.`
        : `This ${priority.toLowerCase()} request is active. Track the current work and confirm when it is ready to move to completion.`;
    case "acknowledged":
      return audience === "tenant"
        ? `The request has been reviewed and is moving through the service workflow. Watch for assignment, scheduling, or progress updates.`
        : `The request has been acknowledged and can now be assigned, scheduled, or advanced depending on the current service plan.`;
    case "submitted":
    default:
      return audience === "tenant"
        ? `Your request has been submitted and is waiting for landlord review. The issue is now visible in the maintenance workspace.`
        : `A tenant has submitted a new request. Review the issue details and decide how it should move into the service workflow.`;
  }
}

function buildNextSteps(item: MaintenanceWorkflowItem, audience: Audience, lifecycleState: MaintenanceLifecycleState) {
  switch (lifecycleState) {
    case "completed":
      return audience === "tenant"
        ? ["Review the completed request details.", "Use communications if any follow-up is still needed."]
        : ["Confirm the work is fully resolved.", "Leave the request in completed history unless follow-up is needed."];
    case "needs_attention":
      return audience === "tenant"
        ? ["Review the latest request update.", "Message the property side if this issue still needs help."]
        : ["Review the status history and notes.", "Decide whether to cancel, reopen, or complete the request."];
    case "in_progress":
      return audience === "tenant"
        ? ["Keep any property-access details ready.", "Watch the request timeline for the next update."]
        : ["Track the active work and latest note.", "Mark the request completed once the job is finished."];
    case "acknowledged":
      if (audience === "tenant") {
        return [
          "Watch for assignment or scheduling updates.",
          "Open the request detail view if you need the current workflow history.",
        ];
      }
      if (String(item.status || "").trim().toLowerCase() === "reviewed") {
        return ["Assign the request or confirm the next operational step.", "Use the request detail to record the next landlord note."];
      }
      if (String(item.status || "").trim().toLowerCase() === "assigned") {
        return ["Confirm the contractor or internal assignee.", "Move the request to scheduled once the visit is set."];
      }
      return ["Confirm the scheduled visit or next operational step.", "Advance the request to in progress when work starts."];
    case "submitted":
    default:
      return audience === "tenant"
        ? ["Wait for landlord review.", "Open the request detail view to keep the issue summary handy."]
        : ["Review the request details.", "Mark the request reviewed once it is triaged."];
  }
}

export function buildMaintenanceLifecycleView(
  item: MaintenanceWorkflowItem,
  audience: Audience
): MaintenanceLifecycleView {
  const lifecycleState = normalizeLifecycleState(item);
  return {
    id: item.id,
    title: item.title || "Maintenance request",
    lifecycleState,
    lifecycleLabel: pretty(lifecycleState),
    statusLabel: pretty(item.status),
    summary: buildSummary(item, audience, lifecycleState),
    nextSteps: buildNextSteps(item, audience, lifecycleState),
    needsAttention: lifecycleState === "needs_attention",
  };
}

export function buildMaintenanceWorkspaceState(
  items: MaintenanceWorkflowItem[],
  audience: Audience
): MaintenanceWorkspaceView {
  const requestViews = items.map((item) => buildMaintenanceLifecycleView(item, audience));
  const counts: Record<MaintenanceLifecycleState, number> = {
    submitted: 0,
    acknowledged: 0,
    in_progress: 0,
    completed: 0,
    needs_attention: 0,
  };

  requestViews.forEach((item) => {
    counts[item.lifecycleState] += 1;
  });

  const openCount = requestViews.filter((item) => item.lifecycleState !== "completed").length;

  if (!requestViews.length) {
    return {
      totalCount: 0,
      openCount: 0,
      counts,
      summaryTitle: audience === "tenant" ? "No maintenance requests yet" : "No maintenance requests in view",
      summaryDescription:
        audience === "tenant"
          ? "When something needs attention in the property, you can submit a request here and track the workflow from review to resolution."
          : "Tenant maintenance requests will appear here once they are submitted and visible in the landlord workspace.",
      nextSteps:
        audience === "tenant"
          ? ["Submit a new maintenance request when an issue needs attention."]
          : ["Refresh this workspace when new tenant requests are expected."],
      requestViews,
    };
  }

  const mostUrgentState: MaintenanceLifecycleState =
    counts.needs_attention > 0
      ? "needs_attention"
      : counts.submitted > 0
      ? "submitted"
      : counts.acknowledged > 0
      ? "acknowledged"
      : counts.in_progress > 0
      ? "in_progress"
      : "completed";

  return {
    totalCount: requestViews.length,
    openCount,
    counts,
    summaryTitle:
      audience === "tenant"
        ? mostUrgentState === "needs_attention"
          ? "A maintenance request needs attention"
          : mostUrgentState === "submitted"
          ? "A maintenance request is waiting for review"
          : mostUrgentState === "acknowledged"
          ? "A maintenance request is moving forward"
          : mostUrgentState === "in_progress"
          ? "Maintenance work is in progress"
          : "Your maintenance requests are completed"
        : mostUrgentState === "needs_attention"
        ? "A request needs attention"
        : mostUrgentState === "submitted"
        ? "A request is waiting for review"
        : mostUrgentState === "acknowledged"
        ? "Requests are moving through the workflow"
        : mostUrgentState === "in_progress"
        ? "Active service work is underway"
        : "Visible requests are completed",
    summaryDescription:
      audience === "tenant"
        ? `${openCount} request${openCount === 1 ? "" : "s"} currently remain active in your tenant workspace.`
        : `${counts.submitted} awaiting review, ${counts.acknowledged + counts.in_progress} in service flow, and ${counts.completed} completed.`,
    nextSteps:
      audience === "tenant"
        ? mostUrgentState === "needs_attention"
          ? ["Open the request that needs attention and review the latest update.", "Use communications if the issue still needs help."]
          : ["Open a request to view its current status history.", "Submit a new request when something in the property needs attention."]
        : mostUrgentState === "submitted"
        ? ["Review newly submitted requests first.", "Advance each request into review, assignment, or completion as needed."]
        : ["Use the selected request detail to update status, notes, and assignments.", "Keep completed requests visible as a clean service record."],
    requestViews,
  };
}
