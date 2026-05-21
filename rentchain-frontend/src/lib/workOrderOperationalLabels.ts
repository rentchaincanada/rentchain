export type WorkOrderAudience = "tenant" | "operator" | "review" | "vendor";

function normalizeKey(value?: string | null) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function titleCase(value?: string | null) {
  const normalized = normalizeKey(value);
  if (!normalized) return "Unknown";
  return normalized.replace(/_/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

export function workOrderEntityLabel(audience: WorkOrderAudience = "operator") {
  if (audience === "tenant") return "Maintenance request";
  if (audience === "review") return "Operational work order";
  if (audience === "vendor") return "Service task";
  return "Work order";
}

export function workOrderCollectionLabel(audience: WorkOrderAudience = "operator") {
  if (audience === "tenant") return "Maintenance requests";
  if (audience === "review") return "Operational work orders";
  if (audience === "vendor") return "Service tasks";
  return "Work orders";
}

export function workOrderStatusLabel(value?: string | null, audience: WorkOrderAudience = "operator") {
  const status = normalizeKey(value);
  switch (status) {
    case "submitted":
      return audience === "tenant" ? "Submitted" : "Needs review";
    case "reviewed":
      return audience === "tenant" ? "Acknowledged" : "Open";
    case "assigned":
      return "Assigned";
    case "scheduled":
      return audience === "tenant" ? "Scheduled" : "Assigned";
    case "in_progress":
    case "started":
      return "In progress";
    case "waiting_on_tenant":
    case "tenant_pending_signoff":
      return "Waiting on tenant";
    case "waiting_on_vendor":
    case "contractor_pending":
      return "Waiting on vendor";
    case "completed":
    case "resolved":
      return "Completed";
    case "closed":
      return "Closed";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    case "blocked":
      return "Needs review";
    default:
      return titleCase(status || "open");
  }
}

export function workOrderPriorityLabel(value?: string | null) {
  return titleCase(value || "normal");
}

export function workOrderCategoryLabel(value?: string | null) {
  const category = normalizeKey(value);
  if (!category) return "General";
  if (category === "hvac") return "HVAC";
  if (category === "pest") return "Pest";
  return titleCase(category);
}

export function isMachineStyleWorkOrderLabel(value?: string | null) {
  const raw = String(value || "");
  return /[a-z]+_[a-z_]+/.test(raw) || /\b(?:workOrder|maintenanceRequest)Id\b/.test(raw);
}
