import { apiFetch } from "./apiFetch";
import {
  createTenantWorkspaceMaintenance,
  getTenantWorkspaceMaintenance,
  listTenantWorkspaceMaintenance,
  updateTenantWorkspaceMaintenanceConfirmation,
  updateTenantWorkspaceReworkAccess,
  updateTenantWorkspaceReworkSignoff,
  updateTenantWorkspaceMaintenanceSignoff,
} from "./tenantPortal";

export type MaintenanceWorkflowStatus =
  | "submitted"
  | "reviewed"
  | "assigned"
  | "scheduled"
  | "blocked"
  | "in_progress"
  | "completed"
  | "cancelled";

export type MaintenanceWorkflowItem = {
  id: string;
  tenantId: string;
  landlordId: string;
  propertyId: string | null;
  unitId: string | null;
  tenantName?: string | null;
  propertyLabel?: string | null;
  unitLabel?: string | null;
  title: string;
  description: string;
  notes?: string | null;
  category: string;
  priority: "low" | "normal" | "urgent";
  status: MaintenanceWorkflowStatus;
  assignedContractorId?: string | null;
  assignedContractorName?: string | null;
  contractorStatus?: string | null;
  contractorLastUpdate?: string | null;
  scheduledFor?: number | null;
  serviceStartedAt?: number | null;
  serviceCompletedAt?: number | null;
  lastExecutionUpdateAt?: number | null;
  executionBlockedReason?: string | null;
  completionSummary?: string | null;
  completionOutcome?: "completed" | "partially_completed" | "follow_up_required" | null;
  completionConfirmedByLandlordAt?: number | null;
  completionConfirmedByLandlordBy?: string | null;
  completedByActorRole?: "contractor" | "landlord" | "admin" | null;
  completedByActorId?: string | null;
  reopenedAt?: number | null;
  reopenedByActorId?: string | null;
  reopenedByActorRole?: "landlord" | "admin" | null;
  reopenReason?: string | null;
  evidence?: WorkOrderEvidenceItem[];
  serviceWindowStartAt?: number | null;
  serviceWindowEndAt?: number | null;
  accessRequired?: boolean | null;
  tenantConfirmationStatus?: "confirmed" | "needs_schedule_change" | null;
  tenantConfirmationUpdatedAt?: number | null;
  accessAcknowledgedAt?: number | null;
  resolutionStatus?: "completed_pending_review" | "landlord_approved" | "tenant_pending_signoff" | "resolved" | "follow_up_required" | null;
  landlordApprovedAt?: number | null;
  tenantSignoffStatus?: "pending" | "accepted" | "declined" | null;
  tenantSignedOffAt?: number | null;
  tenantDeclinedAt?: number | null;
  tenantDeclineReason?: string | null;
  followUpRequired?: boolean | null;
  followUpReason?: string | null;
  finalResolvedAt?: number | null;
  reworkCycle?: {
    cycleNumber: number;
    status: "not_started" | "assigned" | "in_progress" | "completed" | "cancelled";
    createdAt: number;
    createdBy: string;
    assignedContractorId?: string | null;
    assignedAt?: number | null;
    startedAt?: number | null;
    completedAt?: number | null;
    completionSummary?: string | null;
    evidenceSnapshot?: string[] | null;
    schedule?: {
      scheduledFor?: number | null;
      timeWindowStart?: number | null;
      timeWindowEnd?: number | null;
      status?: "not_scheduled" | "scheduled" | "contractor_confirmed" | "tenant_pending" | "confirmed" | "reschedule_requested" | "cancelled" | null;
      requiresTenantAccess?: boolean | null;
      tenantAccessStatus?: "pending" | "confirmed" | "denied" | "not_required" | null;
      contractorScheduleStatus?: "pending" | "confirmed" | "unavailable" | null;
      scheduledBy?: string | null;
      scheduledAt?: number | null;
      rescheduleReason?: string | null;
      tenantAccessNote?: string | null;
      contractorAvailabilityNote?: string | null;
      lastUpdatedAt?: number | null;
    } | null;
  } | null;
  reworkHistory?: Array<{
    cycleNumber: number;
    startedAt?: number;
    completedAt?: number;
    outcome?: "resolved" | "failed" | "partial";
    notes?: string;
  }>;
  reworkReview?: {
    status?: "pending_review" | "landlord_approved" | "tenant_pending_signoff" | "closed" | "follow_up_required" | null;
    reviewedAt?: number | null;
    tenantSignoffStatus?: "pending" | "accepted" | "declined" | null;
    tenantSignedOffAt?: number | null;
    tenantDeclinedAt?: number | null;
    tenantDeclineReason?: string | null;
    closureOutcome?: "resolved" | "partial" | "needs_more_followup" | null;
    closedAt?: number | null;
  } | null;
  notifications?: {
    landlord?: {
      requiresReview?: boolean;
      requiresReschedule?: boolean;
      lastNotifiedAt?: number | null;
    };
    contractor?: {
      requiresScheduleConfirmation?: boolean;
      requiresExecutionStart?: boolean;
      lastNotifiedAt?: number | null;
    };
    tenant?: {
      requiresAccessConfirmation?: boolean;
      requiresSignoff?: boolean;
      requiresReworkAwareness?: boolean;
    };
  };
  cost?: {
    estimatedCostCents?: number | null;
    actualCostCents?: number | null;
    currency?: string | null;
    submittedByRole?: "contractor" | "landlord" | "admin" | null;
    submittedById?: string | null;
    submittedAt?: number | null;
    reviewedBy?: string | null;
    reviewedAt?: number | null;
    reviewStatus?: "pending_review" | "approved" | "rejected" | null;
    reviewNote?: string | null;
  } | null;
  costLineItems?: Array<{
    id: string;
    label: string;
    amountCents: number;
    category?: "labor" | "materials" | "inspection" | "other";
  }>;
  costAttachments?: Array<{
    id: string;
    url?: string | null;
    fileName?: string | null;
    contentType?: string | null;
    uploadedAt: number;
    uploadedByRole: "contractor" | "landlord" | "admin";
    uploadedById: string;
    visibility: "internal" | "landlord_only";
  }>;
  landlordNote?: string | null;
  createdAt: number;
  updatedAt: number;
  statusHistory?: Array<{
    status: string;
    actorRole: string;
    actorId?: string | null;
    message?: string | null;
    createdAt?: number;
  }>;
};

export type WorkOrderEvidenceType = "before" | "during" | "after" | "completion" | "inspection" | "damage" | "other";
export type WorkOrderEvidenceVisibility = "internal" | "landlord_contractor" | "tenant_safe";
export type WorkOrderEvidenceItem = {
  id: string;
  url?: string | null;
  filename?: string | null;
  contentType?: string | null;
  uploadedAt: number;
  uploadedByActorRole: "contractor" | "landlord" | "admin";
  uploadedByActorId: string;
  evidenceType: WorkOrderEvidenceType;
  caption?: string | null;
  visibility: WorkOrderEvidenceVisibility;
};

export type LandlordMaintenanceContractor = {
  id: string;
  businessName?: string | null;
  contactName?: string | null;
  email?: string | null;
};

function mapReworkCycle(value: any): MaintenanceWorkflowItem["reworkCycle"] {
  if (!value || typeof value !== "object") return null;
  const status =
    value.status === "not_started" ||
    value.status === "assigned" ||
    value.status === "in_progress" ||
    value.status === "completed" ||
    value.status === "cancelled"
      ? value.status
      : "not_started";
  return {
    cycleNumber: typeof value.cycleNumber === "number" ? value.cycleNumber : 1,
    status,
    createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now(),
    createdBy: typeof value.createdBy === "string" ? value.createdBy : "",
    assignedContractorId: typeof value.assignedContractorId === "string" ? value.assignedContractorId : null,
    assignedAt: typeof value.assignedAt === "number" ? value.assignedAt : null,
    startedAt: typeof value.startedAt === "number" ? value.startedAt : null,
    completedAt: typeof value.completedAt === "number" ? value.completedAt : null,
    completionSummary: typeof value.completionSummary === "string" ? value.completionSummary : null,
    evidenceSnapshot: Array.isArray(value.evidenceSnapshot)
      ? value.evidenceSnapshot.filter((entry: unknown): entry is string => typeof entry === "string")
      : null,
    schedule:
      value.schedule && typeof value.schedule === "object"
        ? {
            scheduledFor: typeof value.schedule.scheduledFor === "number" ? value.schedule.scheduledFor : null,
            timeWindowStart: typeof value.schedule.timeWindowStart === "number" ? value.schedule.timeWindowStart : null,
            timeWindowEnd: typeof value.schedule.timeWindowEnd === "number" ? value.schedule.timeWindowEnd : null,
            status:
              value.schedule.status === "not_scheduled" ||
              value.schedule.status === "scheduled" ||
              value.schedule.status === "contractor_confirmed" ||
              value.schedule.status === "tenant_pending" ||
              value.schedule.status === "confirmed" ||
              value.schedule.status === "reschedule_requested" ||
              value.schedule.status === "cancelled"
                ? value.schedule.status
                : null,
            requiresTenantAccess:
              typeof value.schedule.requiresTenantAccess === "boolean" ? value.schedule.requiresTenantAccess : null,
            tenantAccessStatus:
              value.schedule.tenantAccessStatus === "pending" ||
              value.schedule.tenantAccessStatus === "confirmed" ||
              value.schedule.tenantAccessStatus === "denied" ||
              value.schedule.tenantAccessStatus === "not_required"
                ? value.schedule.tenantAccessStatus
                : null,
            contractorScheduleStatus:
              value.schedule.contractorScheduleStatus === "pending" ||
              value.schedule.contractorScheduleStatus === "confirmed" ||
              value.schedule.contractorScheduleStatus === "unavailable"
                ? value.schedule.contractorScheduleStatus
                : null,
            scheduledBy: typeof value.schedule.scheduledBy === "string" ? value.schedule.scheduledBy : null,
            scheduledAt: typeof value.schedule.scheduledAt === "number" ? value.schedule.scheduledAt : null,
            rescheduleReason: typeof value.schedule.rescheduleReason === "string" ? value.schedule.rescheduleReason : null,
            tenantAccessNote: typeof value.schedule.tenantAccessNote === "string" ? value.schedule.tenantAccessNote : null,
            contractorAvailabilityNote:
              typeof value.schedule.contractorAvailabilityNote === "string" ? value.schedule.contractorAvailabilityNote : null,
            lastUpdatedAt: typeof value.schedule.lastUpdatedAt === "number" ? value.schedule.lastUpdatedAt : null,
          }
        : null,
  };
}

function mapReworkHistory(value: any): MaintenanceWorkflowItem["reworkHistory"] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => ({
    cycleNumber: typeof entry?.cycleNumber === "number" ? entry.cycleNumber : 1,
    startedAt: typeof entry?.startedAt === "number" ? entry.startedAt : undefined,
    completedAt: typeof entry?.completedAt === "number" ? entry.completedAt : undefined,
    outcome:
      entry?.outcome === "resolved" || entry?.outcome === "failed" || entry?.outcome === "partial"
        ? entry.outcome
        : undefined,
    notes: typeof entry?.notes === "string" ? entry.notes : undefined,
  }));
}

function mapReworkReview(value: any): MaintenanceWorkflowItem["reworkReview"] {
  if (!value || typeof value !== "object") return null;
  return {
    status:
      value.status === "pending_review" ||
      value.status === "landlord_approved" ||
      value.status === "tenant_pending_signoff" ||
      value.status === "closed" ||
      value.status === "follow_up_required"
        ? value.status
        : null,
    reviewedAt: typeof value.reviewedAt === "number" ? value.reviewedAt : null,
    tenantSignoffStatus:
      value.tenantSignoffStatus === "pending" ||
      value.tenantSignoffStatus === "accepted" ||
      value.tenantSignoffStatus === "declined"
        ? value.tenantSignoffStatus
        : null,
    tenantSignedOffAt: typeof value.tenantSignedOffAt === "number" ? value.tenantSignedOffAt : null,
    tenantDeclinedAt: typeof value.tenantDeclinedAt === "number" ? value.tenantDeclinedAt : null,
    tenantDeclineReason: typeof value.tenantDeclineReason === "string" ? value.tenantDeclineReason : null,
    closureOutcome:
      value.closureOutcome === "resolved" ||
      value.closureOutcome === "partial" ||
      value.closureOutcome === "needs_more_followup"
        ? value.closureOutcome
        : null,
    closedAt: typeof value.closedAt === "number" ? value.closedAt : null,
  };
}

function mapNotifications(value: any): MaintenanceWorkflowItem["notifications"] {
  if (!value || typeof value !== "object") return undefined;
  return {
    landlord:
      value.landlord && typeof value.landlord === "object"
        ? {
            requiresReview: value.landlord.requiresReview === true,
            requiresReschedule: value.landlord.requiresReschedule === true,
            lastNotifiedAt: typeof value.landlord.lastNotifiedAt === "number" ? value.landlord.lastNotifiedAt : null,
          }
        : undefined,
    contractor:
      value.contractor && typeof value.contractor === "object"
        ? {
            requiresScheduleConfirmation: value.contractor.requiresScheduleConfirmation === true,
            requiresExecutionStart: value.contractor.requiresExecutionStart === true,
            lastNotifiedAt:
              typeof value.contractor.lastNotifiedAt === "number" ? value.contractor.lastNotifiedAt : null,
          }
        : undefined,
    tenant:
      value.tenant && typeof value.tenant === "object"
        ? {
            requiresAccessConfirmation: value.tenant.requiresAccessConfirmation === true,
            requiresSignoff: value.tenant.requiresSignoff === true,
            requiresReworkAwareness: value.tenant.requiresReworkAwareness === true,
          }
        : undefined,
  };
}

export async function createTenantMaintenance(payload: {
  title: string;
  description: string;
  category: string;
  priority: "low" | "normal" | "urgent";
  notes?: string;
  photoUploadPending?: boolean;
}) {
  const data = await createTenantWorkspaceMaintenance({
    title: payload.title,
    description: payload.description,
    category: payload.category,
    priority: payload.priority.toUpperCase(),
  });
  return {
    ok: true,
    requestId: data?.requestId || data?.id || "",
    status: String(data?.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
    data: {
      id: data?.requestId || data?.id || "",
      tenantId: "",
      landlordId: "",
      propertyId: null,
      unitId: null,
      title: data?.title || payload.title,
      description: data?.summary || payload.description,
      category: String(data?.category || payload.category),
      priority: String(data?.priority || payload.priority).toLowerCase() as "low" | "normal" | "urgent",
      status: String(data?.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
      createdAt: data?.createdAt || Date.now(),
      updatedAt: data?.updatedAt || Date.now(),
    },
  };
}

export async function listTenantMaintenance() {
  const items = await listTenantWorkspaceMaintenance();
  const mapped: MaintenanceWorkflowItem[] = items.map((item) => ({
    id: item.requestId,
    tenantId: "",
    landlordId: "",
    propertyId: null,
    unitId: null,
    title: item.title || "Maintenance request",
    description: item.summary || "",
    category: String(item.category || "GENERAL"),
    priority: String(item.priority || "normal").toLowerCase() as "low" | "normal" | "urgent",
    status: String(item.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
    assignedContractorName: item.assignedContractorName || null,
    contractorStatus: item.contractorStatus || null,
    serviceWindowStartAt: typeof item.serviceWindowStartAt === "number" ? item.serviceWindowStartAt : null,
    serviceWindowEndAt: typeof item.serviceWindowEndAt === "number" ? item.serviceWindowEndAt : null,
    scheduledFor: typeof (item as any).scheduledFor === "number" ? (item as any).scheduledFor : null,
    serviceStartedAt: typeof (item as any).serviceStartedAt === "number" ? (item as any).serviceStartedAt : null,
    serviceCompletedAt: typeof (item as any).serviceCompletedAt === "number" ? (item as any).serviceCompletedAt : null,
    lastExecutionUpdateAt:
      typeof (item as any).lastExecutionUpdateAt === "number" ? (item as any).lastExecutionUpdateAt : null,
    executionBlockedReason: typeof (item as any).executionBlockedReason === "string" ? (item as any).executionBlockedReason : null,
    completionSummary: typeof (item as any).completionSummary === "string" ? (item as any).completionSummary : null,
    completionOutcome:
      (item as any).completionOutcome === "completed" ||
      (item as any).completionOutcome === "partially_completed" ||
      (item as any).completionOutcome === "follow_up_required"
        ? (item as any).completionOutcome
        : null,
    completionConfirmedByLandlordAt:
      typeof (item as any).completionConfirmedByLandlordAt === "number"
        ? (item as any).completionConfirmedByLandlordAt
        : null,
    completionConfirmedByLandlordBy:
      typeof (item as any).completionConfirmedByLandlordBy === "string"
        ? (item as any).completionConfirmedByLandlordBy
        : null,
    completedByActorRole:
      (item as any).completedByActorRole === "contractor" ||
      (item as any).completedByActorRole === "landlord" ||
      (item as any).completedByActorRole === "admin"
        ? (item as any).completedByActorRole
        : null,
    completedByActorId: typeof (item as any).completedByActorId === "string" ? (item as any).completedByActorId : null,
    reopenedAt: typeof (item as any).reopenedAt === "number" ? (item as any).reopenedAt : null,
    reopenedByActorId: typeof (item as any).reopenedByActorId === "string" ? (item as any).reopenedByActorId : null,
    reopenedByActorRole:
      (item as any).reopenedByActorRole === "landlord" || (item as any).reopenedByActorRole === "admin"
        ? (item as any).reopenedByActorRole
        : null,
    reopenReason: typeof (item as any).reopenReason === "string" ? (item as any).reopenReason : null,
    evidence: Array.isArray((item as any).evidence) ? (item as any).evidence : [],
    accessRequired: typeof item.accessRequired === "boolean" ? item.accessRequired : null,
    tenantConfirmationStatus:
      item.tenantConfirmationStatus === "confirmed" || item.tenantConfirmationStatus === "needs_schedule_change"
        ? item.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt:
      typeof item.tenantConfirmationUpdatedAt === "number" ? item.tenantConfirmationUpdatedAt : null,
    accessAcknowledgedAt: typeof item.accessAcknowledgedAt === "number" ? item.accessAcknowledgedAt : null,
    reworkCycle: mapReworkCycle((item as any).reworkCycle),
    reworkHistory: mapReworkHistory((item as any).reworkHistory),
    createdAt: item.createdAt || Date.now(),
    updatedAt: item.updatedAt || item.createdAt || Date.now(),
    statusHistory: Array.isArray(item.statusHistory)
      ? item.statusHistory.map((entry) => ({
          status: String(entry?.status || ""),
          actorRole: String(entry?.actorRole || ""),
          actorId: entry?.actorId ? String(entry.actorId) : null,
          message: entry?.message ? String(entry.message) : null,
          createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : undefined,
        }))
      : [],
  }));
  return { ok: true, items: mapped, data: mapped };
}

export async function getTenantMaintenance(id: string) {
  const item = await getTenantWorkspaceMaintenance(id);
  const mapped: MaintenanceWorkflowItem = {
    id: item?.requestId || id,
    tenantId: "",
    landlordId: "",
    propertyId: null,
    unitId: null,
    title: item?.title || "Maintenance request",
    description: item?.summary || "",
    category: String(item?.category || "GENERAL"),
    priority: String(item?.priority || "normal").toLowerCase() as "low" | "normal" | "urgent",
    status: String(item?.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
    assignedContractorName: item?.assignedContractorName || null,
    contractorStatus: item?.contractorStatus || null,
    serviceWindowStartAt: typeof item?.serviceWindowStartAt === "number" ? item.serviceWindowStartAt : null,
    serviceWindowEndAt: typeof item?.serviceWindowEndAt === "number" ? item.serviceWindowEndAt : null,
    scheduledFor: typeof (item as any)?.scheduledFor === "number" ? (item as any).scheduledFor : null,
    serviceStartedAt: typeof (item as any)?.serviceStartedAt === "number" ? (item as any).serviceStartedAt : null,
    serviceCompletedAt: typeof (item as any)?.serviceCompletedAt === "number" ? (item as any).serviceCompletedAt : null,
    lastExecutionUpdateAt:
      typeof (item as any)?.lastExecutionUpdateAt === "number" ? (item as any).lastExecutionUpdateAt : null,
    executionBlockedReason:
      typeof (item as any)?.executionBlockedReason === "string" ? (item as any).executionBlockedReason : null,
    completionSummary: typeof (item as any)?.completionSummary === "string" ? (item as any).completionSummary : null,
    completionOutcome:
      (item as any)?.completionOutcome === "completed" ||
      (item as any)?.completionOutcome === "partially_completed" ||
      (item as any)?.completionOutcome === "follow_up_required"
        ? (item as any).completionOutcome
        : null,
    completionConfirmedByLandlordAt:
      typeof (item as any)?.completionConfirmedByLandlordAt === "number"
        ? (item as any).completionConfirmedByLandlordAt
        : null,
    completionConfirmedByLandlordBy:
      typeof (item as any)?.completionConfirmedByLandlordBy === "string"
        ? (item as any).completionConfirmedByLandlordBy
        : null,
    completedByActorRole:
      (item as any)?.completedByActorRole === "contractor" ||
      (item as any)?.completedByActorRole === "landlord" ||
      (item as any)?.completedByActorRole === "admin"
        ? (item as any).completedByActorRole
        : null,
    completedByActorId:
      typeof (item as any)?.completedByActorId === "string" ? (item as any).completedByActorId : null,
    reopenedAt: typeof (item as any)?.reopenedAt === "number" ? (item as any).reopenedAt : null,
    reopenedByActorId:
      typeof (item as any)?.reopenedByActorId === "string" ? (item as any).reopenedByActorId : null,
    reopenedByActorRole:
      (item as any)?.reopenedByActorRole === "landlord" || (item as any)?.reopenedByActorRole === "admin"
        ? (item as any).reopenedByActorRole
        : null,
    reopenReason: typeof (item as any)?.reopenReason === "string" ? (item as any).reopenReason : null,
    evidence: Array.isArray((item as any)?.evidence) ? (item as any).evidence : [],
    accessRequired: typeof item?.accessRequired === "boolean" ? item.accessRequired : null,
    tenantConfirmationStatus:
      item?.tenantConfirmationStatus === "confirmed" || item?.tenantConfirmationStatus === "needs_schedule_change"
        ? item.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt:
      typeof item?.tenantConfirmationUpdatedAt === "number" ? item.tenantConfirmationUpdatedAt : null,
    accessAcknowledgedAt: typeof item?.accessAcknowledgedAt === "number" ? item.accessAcknowledgedAt : null,
    resolutionStatus:
      item?.resolutionStatus === "completed_pending_review" ||
      item?.resolutionStatus === "landlord_approved" ||
      item?.resolutionStatus === "tenant_pending_signoff" ||
      item?.resolutionStatus === "resolved" ||
      item?.resolutionStatus === "follow_up_required"
        ? item.resolutionStatus
        : null,
    landlordApprovedAt: typeof item?.landlordApprovedAt === "number" ? item.landlordApprovedAt : null,
    tenantSignoffStatus:
      item?.tenantSignoffStatus === "pending" ||
      item?.tenantSignoffStatus === "accepted" ||
      item?.tenantSignoffStatus === "declined"
        ? item.tenantSignoffStatus
        : null,
    tenantSignedOffAt: typeof item?.tenantSignedOffAt === "number" ? item.tenantSignedOffAt : null,
    tenantDeclinedAt: typeof item?.tenantDeclinedAt === "number" ? item.tenantDeclinedAt : null,
    tenantDeclineReason: item?.tenantDeclineReason ? String(item.tenantDeclineReason) : null,
    followUpRequired: typeof item?.followUpRequired === "boolean" ? item.followUpRequired : null,
    followUpReason: item?.followUpReason ? String(item.followUpReason) : null,
    finalResolvedAt: typeof item?.finalResolvedAt === "number" ? item.finalResolvedAt : null,
    notifications: mapNotifications((item as any)?.notifications),
    reworkCycle: mapReworkCycle((item as any)?.reworkCycle),
    reworkHistory: mapReworkHistory((item as any)?.reworkHistory),
    reworkReview: mapReworkReview((item as any)?.reworkReview),
    createdAt: item?.createdAt || Date.now(),
    updatedAt: item?.updatedAt || item?.createdAt || Date.now(),
    statusHistory: Array.isArray(item?.statusHistory)
      ? item.statusHistory.map((entry) => ({
          status: String(entry?.status || ""),
          actorRole: String(entry?.actorRole || ""),
          actorId: entry?.actorId ? String(entry.actorId) : null,
          message: entry?.message ? String(entry.message) : null,
          createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : undefined,
        }))
      : [],
  };
  return { ok: true, item: mapped, data: mapped };
}

export async function updateTenantMaintenanceConfirmation(
  id: string,
  payload: {
    confirmationStatus?: "confirmed" | "needs_schedule_change";
    acknowledgeAccess?: boolean;
  }
) {
  const item = await updateTenantWorkspaceMaintenanceConfirmation(id, payload);
  const mapped: MaintenanceWorkflowItem = {
    id: item?.requestId || id,
    tenantId: "",
    landlordId: "",
    propertyId: null,
    unitId: null,
    title: item?.title || "Maintenance request",
    description: item?.summary || "",
    category: String(item?.category || "GENERAL"),
    priority: String(item?.priority || "normal").toLowerCase() as "low" | "normal" | "urgent",
    status: String(item?.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
    assignedContractorName: item?.assignedContractorName || null,
    contractorStatus: item?.contractorStatus || null,
    serviceWindowStartAt: typeof item?.serviceWindowStartAt === "number" ? item.serviceWindowStartAt : null,
    serviceWindowEndAt: typeof item?.serviceWindowEndAt === "number" ? item.serviceWindowEndAt : null,
    accessRequired: typeof item?.accessRequired === "boolean" ? item.accessRequired : null,
    tenantConfirmationStatus:
      item?.tenantConfirmationStatus === "confirmed" || item?.tenantConfirmationStatus === "needs_schedule_change"
        ? item.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt:
      typeof item?.tenantConfirmationUpdatedAt === "number" ? item.tenantConfirmationUpdatedAt : null,
    accessAcknowledgedAt: typeof item?.accessAcknowledgedAt === "number" ? item.accessAcknowledgedAt : null,
    resolutionStatus:
      item?.resolutionStatus === "completed_pending_review" ||
      item?.resolutionStatus === "landlord_approved" ||
      item?.resolutionStatus === "tenant_pending_signoff" ||
      item?.resolutionStatus === "resolved" ||
      item?.resolutionStatus === "follow_up_required"
        ? item.resolutionStatus
        : null,
    landlordApprovedAt: typeof item?.landlordApprovedAt === "number" ? item.landlordApprovedAt : null,
    tenantSignoffStatus:
      item?.tenantSignoffStatus === "pending" ||
      item?.tenantSignoffStatus === "accepted" ||
      item?.tenantSignoffStatus === "declined"
        ? item.tenantSignoffStatus
        : null,
    tenantSignedOffAt: typeof item?.tenantSignedOffAt === "number" ? item.tenantSignedOffAt : null,
    tenantDeclinedAt: typeof item?.tenantDeclinedAt === "number" ? item.tenantDeclinedAt : null,
    tenantDeclineReason: item?.tenantDeclineReason ? String(item.tenantDeclineReason) : null,
    followUpRequired: typeof item?.followUpRequired === "boolean" ? item.followUpRequired : null,
    followUpReason: item?.followUpReason ? String(item.followUpReason) : null,
    finalResolvedAt: typeof item?.finalResolvedAt === "number" ? item.finalResolvedAt : null,
    notifications: mapNotifications((item as any)?.notifications),
    evidence: Array.isArray((item as any)?.evidence) ? (item as any).evidence : [],
    reworkCycle: mapReworkCycle((item as any)?.reworkCycle),
    reworkHistory: mapReworkHistory((item as any)?.reworkHistory),
    reworkReview: mapReworkReview((item as any)?.reworkReview),
    createdAt: item?.createdAt || Date.now(),
    updatedAt: item?.updatedAt || item?.createdAt || Date.now(),
    statusHistory: Array.isArray(item?.statusHistory)
      ? item.statusHistory.map((entry) => ({
          status: String(entry?.status || ""),
          actorRole: String(entry?.actorRole || ""),
          actorId: entry?.actorId ? String(entry.actorId) : null,
          message: entry?.message ? String(entry.message) : null,
          createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : undefined,
        }))
      : [],
  };
  return { ok: true, item: mapped, data: mapped };
}

export async function updateTenantMaintenanceSignoff(
  id: string,
  payload: {
    decision: "resolved" | "not_resolved";
    reason?: string;
  }
) {
  const item = await updateTenantWorkspaceMaintenanceSignoff(id, payload);
  const mapped: MaintenanceWorkflowItem = {
    id: item?.requestId || id,
    tenantId: "",
    landlordId: "",
    propertyId: null,
    unitId: null,
    title: item?.title || "Maintenance request",
    description: item?.summary || "",
    category: String(item?.category || "GENERAL"),
    priority: String(item?.priority || "normal").toLowerCase() as "low" | "normal" | "urgent",
    status: String(item?.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
    assignedContractorName: item?.assignedContractorName || null,
    contractorStatus: item?.contractorStatus || null,
    serviceWindowStartAt: typeof item?.serviceWindowStartAt === "number" ? item.serviceWindowStartAt : null,
    serviceWindowEndAt: typeof item?.serviceWindowEndAt === "number" ? item.serviceWindowEndAt : null,
    accessRequired: typeof item?.accessRequired === "boolean" ? item.accessRequired : null,
    tenantConfirmationStatus:
      item?.tenantConfirmationStatus === "confirmed" || item?.tenantConfirmationStatus === "needs_schedule_change"
        ? item.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt:
      typeof item?.tenantConfirmationUpdatedAt === "number" ? item.tenantConfirmationUpdatedAt : null,
    accessAcknowledgedAt: typeof item?.accessAcknowledgedAt === "number" ? item.accessAcknowledgedAt : null,
    resolutionStatus:
      item?.resolutionStatus === "completed_pending_review" ||
      item?.resolutionStatus === "landlord_approved" ||
      item?.resolutionStatus === "tenant_pending_signoff" ||
      item?.resolutionStatus === "resolved" ||
      item?.resolutionStatus === "follow_up_required"
        ? item.resolutionStatus
        : null,
    landlordApprovedAt: typeof item?.landlordApprovedAt === "number" ? item.landlordApprovedAt : null,
    tenantSignoffStatus:
      item?.tenantSignoffStatus === "pending" ||
      item?.tenantSignoffStatus === "accepted" ||
      item?.tenantSignoffStatus === "declined"
        ? item.tenantSignoffStatus
        : null,
    tenantSignedOffAt: typeof item?.tenantSignedOffAt === "number" ? item.tenantSignedOffAt : null,
    tenantDeclinedAt: typeof item?.tenantDeclinedAt === "number" ? item.tenantDeclinedAt : null,
    tenantDeclineReason: item?.tenantDeclineReason ? String(item.tenantDeclineReason) : null,
    followUpRequired: typeof item?.followUpRequired === "boolean" ? item.followUpRequired : null,
    followUpReason: item?.followUpReason ? String(item.followUpReason) : null,
    finalResolvedAt: typeof item?.finalResolvedAt === "number" ? item.finalResolvedAt : null,
    notifications: mapNotifications((item as any)?.notifications),
    reworkCycle: mapReworkCycle((item as any)?.reworkCycle),
    reworkHistory: mapReworkHistory((item as any)?.reworkHistory),
    reworkReview: mapReworkReview((item as any)?.reworkReview),
    createdAt: item?.createdAt || Date.now(),
    updatedAt: item?.updatedAt || item?.createdAt || Date.now(),
    statusHistory: Array.isArray(item?.statusHistory)
      ? item.statusHistory.map((entry) => ({
          status: String(entry?.status || ""),
          actorRole: String(entry?.actorRole || ""),
          actorId: entry?.actorId ? String(entry.actorId) : null,
          message: entry?.message ? String(entry.message) : null,
          createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : undefined,
        }))
      : [],
  };
  return { ok: true, item: mapped, data: mapped };
}

export async function updateTenantMaintenanceReworkAccess(
  id: string,
  payload: {
    decision: "confirm" | "deny";
    note?: string;
  }
) {
  const item = await updateTenantWorkspaceReworkAccess(id, payload);
  const mapped: MaintenanceWorkflowItem = {
    id: item?.requestId || id,
    tenantId: "",
    landlordId: "",
    propertyId: null,
    unitId: null,
    title: item?.title || "Maintenance request",
    description: item?.summary || "",
    category: String(item?.category || "GENERAL"),
    priority: String(item?.priority || "normal").toLowerCase() as "low" | "normal" | "urgent",
    status: String(item?.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
    assignedContractorName: item?.assignedContractorName || null,
    contractorStatus: item?.contractorStatus || null,
    serviceWindowStartAt: typeof item?.serviceWindowStartAt === "number" ? item.serviceWindowStartAt : null,
    serviceWindowEndAt: typeof item?.serviceWindowEndAt === "number" ? item.serviceWindowEndAt : null,
    accessRequired: typeof item?.accessRequired === "boolean" ? item.accessRequired : null,
    tenantConfirmationStatus:
      item?.tenantConfirmationStatus === "confirmed" || item?.tenantConfirmationStatus === "needs_schedule_change"
        ? item.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt:
      typeof item?.tenantConfirmationUpdatedAt === "number" ? item.tenantConfirmationUpdatedAt : null,
    accessAcknowledgedAt: typeof item?.accessAcknowledgedAt === "number" ? item.accessAcknowledgedAt : null,
    resolutionStatus:
      item?.resolutionStatus === "completed_pending_review" ||
      item?.resolutionStatus === "landlord_approved" ||
      item?.resolutionStatus === "tenant_pending_signoff" ||
      item?.resolutionStatus === "resolved" ||
      item?.resolutionStatus === "follow_up_required"
        ? item.resolutionStatus
        : null,
    reworkCycle: mapReworkCycle((item as any)?.reworkCycle),
    reworkHistory: mapReworkHistory((item as any)?.reworkHistory),
    reworkReview: mapReworkReview((item as any)?.reworkReview),
    evidence: Array.isArray((item as any)?.evidence) ? (item as any).evidence : [],
    createdAt: item?.createdAt || Date.now(),
    updatedAt: item?.updatedAt || item?.createdAt || Date.now(),
    statusHistory: Array.isArray(item?.statusHistory)
      ? item.statusHistory.map((entry) => ({
          status: String(entry?.status || ""),
          actorRole: String(entry?.actorRole || ""),
          actorId: entry?.actorId ? String(entry.actorId) : null,
          message: entry?.message ? String(entry.message) : null,
          createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : undefined,
        }))
      : [],
  };
  return { ok: true, item: mapped, data: mapped };
}

export async function updateTenantMaintenanceReworkSignoff(
  id: string,
  payload: {
    decision: "resolved" | "not_resolved";
    reason?: string;
  }
) {
  const item = await updateTenantWorkspaceReworkSignoff(id, payload);
  const mapped: MaintenanceWorkflowItem = {
    id: item?.requestId || id,
    tenantId: "",
    landlordId: "",
    propertyId: null,
    unitId: null,
    title: item?.title || "Maintenance request",
    description: item?.summary || "",
    category: String(item?.category || "GENERAL"),
    priority: String(item?.priority || "normal").toLowerCase() as "low" | "normal" | "urgent",
    status: String(item?.status || "submitted").toLowerCase() as MaintenanceWorkflowStatus,
    assignedContractorName: item?.assignedContractorName || null,
    contractorStatus: item?.contractorStatus || null,
    serviceWindowStartAt: typeof item?.serviceWindowStartAt === "number" ? item.serviceWindowStartAt : null,
    serviceWindowEndAt: typeof item?.serviceWindowEndAt === "number" ? item.serviceWindowEndAt : null,
    accessRequired: typeof item?.accessRequired === "boolean" ? item.accessRequired : null,
    tenantConfirmationStatus:
      item?.tenantConfirmationStatus === "confirmed" || item?.tenantConfirmationStatus === "needs_schedule_change"
        ? item.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt:
      typeof item?.tenantConfirmationUpdatedAt === "number" ? item.tenantConfirmationUpdatedAt : null,
    accessAcknowledgedAt: typeof item?.accessAcknowledgedAt === "number" ? item.accessAcknowledgedAt : null,
    resolutionStatus:
      item?.resolutionStatus === "completed_pending_review" ||
      item?.resolutionStatus === "landlord_approved" ||
      item?.resolutionStatus === "tenant_pending_signoff" ||
      item?.resolutionStatus === "resolved" ||
      item?.resolutionStatus === "follow_up_required"
        ? item.resolutionStatus
        : null,
    landlordApprovedAt: typeof item?.landlordApprovedAt === "number" ? item.landlordApprovedAt : null,
    tenantSignoffStatus:
      item?.tenantSignoffStatus === "pending" ||
      item?.tenantSignoffStatus === "accepted" ||
      item?.tenantSignoffStatus === "declined"
        ? item.tenantSignoffStatus
        : null,
    tenantSignedOffAt: typeof item?.tenantSignedOffAt === "number" ? item.tenantSignedOffAt : null,
    tenantDeclinedAt: typeof item?.tenantDeclinedAt === "number" ? item.tenantDeclinedAt : null,
    tenantDeclineReason: item?.tenantDeclineReason ? String(item.tenantDeclineReason) : null,
    followUpRequired: typeof item?.followUpRequired === "boolean" ? item.followUpRequired : null,
    followUpReason: item?.followUpReason ? String(item.followUpReason) : null,
    finalResolvedAt: typeof item?.finalResolvedAt === "number" ? item.finalResolvedAt : null,
    notifications: mapNotifications((item as any)?.notifications),
    reworkCycle: mapReworkCycle((item as any)?.reworkCycle),
    reworkHistory: mapReworkHistory((item as any)?.reworkHistory),
    reworkReview: mapReworkReview((item as any)?.reworkReview),
    evidence: Array.isArray((item as any)?.evidence) ? (item as any).evidence : [],
    createdAt: item?.createdAt || Date.now(),
    updatedAt: item?.updatedAt || item?.createdAt || Date.now(),
    statusHistory: Array.isArray(item?.statusHistory)
      ? item.statusHistory.map((entry) => ({
          status: String(entry?.status || ""),
          actorRole: String(entry?.actorRole || ""),
          actorId: entry?.actorId ? String(entry.actorId) : null,
          message: entry?.message ? String(entry.message) : null,
          createdAt: typeof entry?.createdAt === "number" ? entry.createdAt : undefined,
        }))
      : [],
  };
  return { ok: true, item: mapped, data: mapped };
}

export async function listLandlordMaintenance(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<{ ok: boolean; items: MaintenanceWorkflowItem[]; data?: MaintenanceWorkflowItem[] }>(
    `/landlord/maintenance${query}`
  );
}

export async function listLandlordMaintenanceContractors() {
  return apiFetch<{ ok: boolean; items: LandlordMaintenanceContractor[]; data?: LandlordMaintenanceContractor[] }>(
    "/landlord/maintenance/contractors"
  );
}

export async function patchLandlordMaintenance(
  id: string,
  payload: {
    status?: MaintenanceWorkflowStatus;
    priority?: "low" | "normal" | "urgent";
    landlordNote?: string | null;
    serviceWindowStartAt?: number | null;
    serviceWindowEndAt?: number | null;
    accessRequired?: boolean | null;
    message?: string;
  }
) {
  return apiFetch<{ ok: boolean; item: MaintenanceWorkflowItem; data?: MaintenanceWorkflowItem }>(
    `/landlord/maintenance/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: payload,
    }
  );
}

export async function assignLandlordMaintenance(id: string, contractorId: string) {
  return apiFetch<{ ok: boolean; item: MaintenanceWorkflowItem; data?: MaintenanceWorkflowItem }>(
    `/landlord/maintenance/${encodeURIComponent(id)}/assign`,
    {
      method: "POST",
      body: { contractorId },
    }
  );
}

export async function listContractorMaintenanceJobs(status?: string) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<{ ok: boolean; items: MaintenanceWorkflowItem[]; data?: MaintenanceWorkflowItem[] }>(
    `/contractor/jobs${query}`
  );
}

export async function patchContractorMaintenanceJobStatus(
  id: string,
  payload: {
    status: "assigned" | "scheduled" | "blocked" | "in_progress" | "completed";
    message?: string;
    scheduledFor?: number | null;
    blockedReason?: string;
    completionSummary?: string;
    completionOutcome?: "completed" | "partially_completed" | "follow_up_required";
  }
) {
  return apiFetch<{ ok: boolean; item: MaintenanceWorkflowItem; data?: MaintenanceWorkflowItem }>(
    `/contractor/jobs/${encodeURIComponent(id)}/status`,
    {
      method: "PATCH",
      body: payload,
    }
  );
}

export async function patchContractorMaintenanceReworkStatus(
  id: string,
  payload: {
    status: "in_progress" | "completed";
    completionSummary?: string;
  }
) {
  return apiFetch<{ ok: boolean; item: MaintenanceWorkflowItem; data?: MaintenanceWorkflowItem }>(
    `/contractor/jobs/${encodeURIComponent(id)}/rework-status`,
    {
      method: "PATCH",
      body: payload,
    }
  );
}

export async function confirmContractorMaintenanceReworkSchedule(
  id: string,
  payload: {
    decision: "confirm" | "unavailable";
    note?: string;
  }
) {
  return apiFetch<{ ok: boolean; item: MaintenanceWorkflowItem; data?: MaintenanceWorkflowItem }>(
    `/contractor/jobs/${encodeURIComponent(id)}/confirm-rework-schedule`,
    {
      method: "POST",
      body: payload,
    }
  );
}

export async function uploadContractorMaintenanceEvidence(
  maintenanceRequestId: string,
  payload: {
    file: File;
    evidenceType: Extract<WorkOrderEvidenceType, "before" | "during" | "after" | "completion" | "other">;
    caption?: string;
  }
) {
  const form = new FormData();
  form.append("file", payload.file);
  form.append("evidenceType", payload.evidenceType);
  if (payload.caption) form.append("caption", payload.caption);
  const res = await apiFetch<{ ok: boolean; item: MaintenanceWorkflowItem }>(
    `/contractor/jobs/${encodeURIComponent(maintenanceRequestId)}/evidence`,
    {
      method: "POST",
      body: form,
    }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to upload maintenance evidence");
  return res.item;
}

export async function submitContractorMaintenanceCost(
  maintenanceRequestId: string,
  payload: {
    actualCostCents: number;
    currency?: string;
    lineItems?: Array<{
      id?: string;
      label: string;
      amountCents: number;
      category?: "labor" | "materials" | "inspection" | "other";
    }>;
  }
) {
  const res = await apiFetch<{ ok: boolean; item: MaintenanceWorkflowItem }>(
    `/contractor/jobs/${encodeURIComponent(maintenanceRequestId)}/submit-cost`,
    {
      method: "POST",
      body: payload,
    }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to submit maintenance cost");
  return res.item;
}

export async function uploadContractorMaintenanceCostAttachment(
  maintenanceRequestId: string,
  payload: { file: File }
) {
  const form = new FormData();
  form.append("file", payload.file);
  const res = await apiFetch<{ ok: boolean; item: MaintenanceWorkflowItem }>(
    `/contractor/jobs/${encodeURIComponent(maintenanceRequestId)}/cost-attachment`,
    {
      method: "POST",
      body: form,
    }
  );
  if (!res?.ok || !res.item) throw new Error("Failed to upload maintenance cost attachment");
  return res.item;
}
