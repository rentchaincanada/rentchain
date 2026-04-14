type TenantPropertyProjection = {
  propertyId: string;
  rc_prop_id: string | null;
  street1: string | null;
  street2: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
  features: string[];
};

type TenantLeaseProjection = {
  leaseId: string;
  startDate: string | null;
  endDate: string | null;
  monthlyRent: number | null;
  status: string | null;
  documentUrl: string | null;
};

type TenantApplicationProjection = {
  applicationId: string;
  status: string | null;
  missingSteps: string[];
  nextActions: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

type TenantMaintenanceProjection = {
  requestId: string;
  status: string | null;
  category: string | null;
  priority: string | null;
  title: string | null;
  summary: string | null;
  assignedContractorName: string | null;
  contractorStatus: string | null;
  serviceWindowStartAt: number | null;
  serviceWindowEndAt: number | null;
  accessRequired: boolean | null;
  tenantConfirmationStatus: "confirmed" | "needs_schedule_change" | null;
  tenantConfirmationUpdatedAt: number | null;
  accessAcknowledgedAt: number | null;
  resolutionStatus:
    | "completed_pending_review"
    | "landlord_approved"
    | "tenant_pending_signoff"
    | "resolved"
    | "follow_up_required"
    | null;
  landlordApprovedAt: number | null;
  tenantSignoffStatus: "pending" | "accepted" | "declined" | null;
  tenantSignedOffAt: number | null;
  tenantDeclinedAt: number | null;
  tenantDeclineReason: string | null;
  followUpRequired: boolean | null;
  followUpReason: string | null;
  finalResolvedAt: number | null;
  reworkCycle: {
    cycleNumber: number;
    status: "not_started" | "assigned" | "in_progress" | "completed" | "cancelled";
    createdAt: number | null;
    assignedAt: number | null;
    startedAt: number | null;
    completedAt: number | null;
    completionSummary: string | null;
    schedule: {
      scheduledFor: number | null;
      timeWindowStart: number | null;
      timeWindowEnd: number | null;
      status: "not_scheduled" | "scheduled" | "contractor_confirmed" | "tenant_pending" | "confirmed" | "reschedule_requested" | "cancelled" | null;
      requiresTenantAccess: boolean | null;
      tenantAccessStatus: "pending" | "confirmed" | "denied" | "not_required" | null;
      tenantAccessNote: string | null;
    } | null;
  } | null;
  reworkHistory: Array<{
    cycleNumber: number;
    startedAt: number | null;
    completedAt: number | null;
    outcome: "resolved" | "failed" | "partial" | null;
    notes: string | null;
  }>;
  reworkReview: {
    status: "pending_review" | "landlord_approved" | "tenant_pending_signoff" | "closed" | "follow_up_required" | null;
    reviewedAt: number | null;
    tenantSignoffStatus: "pending" | "accepted" | "declined" | null;
    tenantSignedOffAt: number | null;
    tenantDeclinedAt: number | null;
    tenantDeclineReason: string | null;
    closureOutcome: "resolved" | "partial" | "needs_more_followup" | null;
    closedAt: number | null;
  } | null;
  notifications: {
    tenant: {
      requiresAccessConfirmation: boolean;
      requiresSignoff: boolean;
      requiresReworkAwareness: boolean;
    };
  };
  evidence: Array<{
    id: string;
    url: string | null;
    filename: string | null;
    contentType: string | null;
    uploadedAt: number | null;
    uploadedByActorRole: string | null;
    evidenceType: string | null;
    caption: string | null;
    visibility: "tenant_safe";
  }>;
  createdAt: number | null;
  updatedAt: number | null;
  statusHistory: Array<{
    status: string | null;
    actorRole: string | null;
    message: string | null;
    createdAt: number | null;
  }>;
};

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function asNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.seconds === "number") return value.seconds * 1000;
  return null;
}

function toIso(value: any): string | null {
  const millis = toMillis(value);
  return millis ? new Date(millis).toISOString() : asString(value);
}

function projectFeatureList(input: any): string[] {
  const list = Array.isArray(input) ? input : Array.isArray(input?.selected) ? input.selected : [];
  return list
    .map((value: unknown) => asString(value))
    .filter((value: string | null): value is string => Boolean(value))
    .slice(0, 8);
}

export function projectTenantProperty(recordId: string, data: any): TenantPropertyProjection {
  return {
    propertyId: recordId,
    rc_prop_id: asString(data?.rc_prop_id) || asString(data?.propertyId) || recordId,
    street1: asString(data?.street1) || asString(data?.addressLine1) || asString(data?.address),
    street2: asString(data?.street2) || asString(data?.addressLine2),
    city: asString(data?.city) || asString(data?.municipality),
    province: asString(data?.province),
    postalCode: asString(data?.postalCode) || asString(data?.postal_code),
    features: projectFeatureList(data?.features || data?.amenities),
  };
}

export function projectTenantLease(recordId: string, data: any): TenantLeaseProjection {
  return {
    leaseId: recordId,
    startDate: asString(data?.startDate) || asString(data?.leaseStart),
    endDate: asString(data?.endDate) || asString(data?.leaseEnd),
    monthlyRent:
      asNumber(data?.monthlyRent) ??
      asNumber(data?.rentAmount) ??
      (typeof data?.rentCents === "number" ? Math.round(data.rentCents) / 100 : null),
    status: asString(data?.status),
    documentUrl: asString(data?.documentUrl) || asString(data?.approvedDocumentUrl) || asString(data?.documentRef),
  };
}

export function projectTenantApplication(recordId: string, data: any): TenantApplicationProjection {
  const missingSteps = Array.isArray(data?.missingSteps)
    ? data.missingSteps.map((value: unknown) => asString(value)).filter((value: string | null): value is string => Boolean(value))
    : [];
  const nextActions = Array.isArray(data?.nextActions)
    ? data.nextActions.map((value: unknown) => asString(value)).filter((value: string | null): value is string => Boolean(value))
    : [];

  return {
    applicationId: recordId,
    status: asString(data?.status),
    missingSteps,
    nextActions,
    createdAt: toIso(data?.createdAt) || toIso(data?.submittedAt),
    updatedAt: toIso(data?.updatedAt) || toIso(data?.updatedAtServer),
  };
}

export function projectTenantMaintenance(recordId: string, data: any): TenantMaintenanceProjection {
  const statusHistory = Array.isArray(data?.statusHistory)
    ? data.statusHistory
        .map((entry: any) => ({
          status: asString(entry?.status),
          actorRole: asString(entry?.actorRole),
          message: asString(entry?.message),
          createdAt: toMillis(entry?.createdAt),
        }))
        .filter(
          (entry: { status: string | null; actorRole: string | null; message: string | null; createdAt: number | null }) =>
            Boolean(entry.status || entry.actorRole || entry.message || entry.createdAt)
        )
    : [];

  return {
    requestId: recordId,
    status: asString(data?.status),
    category: asString(data?.category),
    priority: asString(data?.priority),
    title: asString(data?.title),
    summary: asString(data?.summary) || asString(data?.description),
    assignedContractorName: asString(data?.assignedContractorName),
    contractorStatus: asString(data?.contractorStatus),
    serviceWindowStartAt: toMillis(data?.serviceWindowStartAt),
    serviceWindowEndAt: toMillis(data?.serviceWindowEndAt),
    accessRequired: typeof data?.accessRequired === "boolean" ? data.accessRequired : null,
    tenantConfirmationStatus:
      data?.tenantConfirmationStatus === "confirmed" || data?.tenantConfirmationStatus === "needs_schedule_change"
        ? data.tenantConfirmationStatus
        : null,
    tenantConfirmationUpdatedAt: toMillis(data?.tenantConfirmationUpdatedAt),
    accessAcknowledgedAt: toMillis(data?.accessAcknowledgedAt),
    resolutionStatus:
      data?.resolutionStatus === "completed_pending_review" ||
      data?.resolutionStatus === "landlord_approved" ||
      data?.resolutionStatus === "tenant_pending_signoff" ||
      data?.resolutionStatus === "resolved" ||
      data?.resolutionStatus === "follow_up_required"
        ? data.resolutionStatus
        : null,
    landlordApprovedAt: toMillis(data?.landlordApprovedAt),
    tenantSignoffStatus:
      data?.tenantSignoffStatus === "pending" ||
      data?.tenantSignoffStatus === "accepted" ||
      data?.tenantSignoffStatus === "declined"
        ? data.tenantSignoffStatus
        : null,
    tenantSignedOffAt: toMillis(data?.tenantSignedOffAt),
    tenantDeclinedAt: toMillis(data?.tenantDeclinedAt),
    tenantDeclineReason: asString(data?.tenantDeclineReason),
    followUpRequired: typeof data?.followUpRequired === "boolean" ? data.followUpRequired : null,
    followUpReason: asString(data?.followUpReason),
    finalResolvedAt: toMillis(data?.finalResolvedAt),
    reworkCycle:
      data?.reworkCycle && typeof data.reworkCycle === "object"
        ? {
            cycleNumber: Number(data.reworkCycle.cycleNumber || 1),
            status:
              data.reworkCycle.status === "not_started" ||
              data.reworkCycle.status === "assigned" ||
              data.reworkCycle.status === "in_progress" ||
              data.reworkCycle.status === "completed" ||
              data.reworkCycle.status === "cancelled"
                ? data.reworkCycle.status
                : "not_started",
            createdAt: toMillis(data.reworkCycle.createdAt),
            assignedAt: toMillis(data.reworkCycle.assignedAt),
            startedAt: toMillis(data.reworkCycle.startedAt),
            completedAt: toMillis(data.reworkCycle.completedAt),
            completionSummary: asString(data.reworkCycle.completionSummary),
            schedule:
              data.reworkCycle.schedule && typeof data.reworkCycle.schedule === "object"
                ? {
                    scheduledFor: toMillis(data.reworkCycle.schedule.scheduledFor),
                    timeWindowStart: toMillis(data.reworkCycle.schedule.timeWindowStart),
                    timeWindowEnd: toMillis(data.reworkCycle.schedule.timeWindowEnd),
                    status:
                      data.reworkCycle.schedule.status === "not_scheduled" ||
                      data.reworkCycle.schedule.status === "scheduled" ||
                      data.reworkCycle.schedule.status === "contractor_confirmed" ||
                      data.reworkCycle.schedule.status === "tenant_pending" ||
                      data.reworkCycle.schedule.status === "confirmed" ||
                      data.reworkCycle.schedule.status === "reschedule_requested" ||
                      data.reworkCycle.schedule.status === "cancelled"
                        ? data.reworkCycle.schedule.status
                        : null,
                    requiresTenantAccess:
                      typeof data.reworkCycle.schedule.requiresTenantAccess === "boolean"
                        ? data.reworkCycle.schedule.requiresTenantAccess
                        : null,
                    tenantAccessStatus:
                      data.reworkCycle.schedule.tenantAccessStatus === "pending" ||
                      data.reworkCycle.schedule.tenantAccessStatus === "confirmed" ||
                      data.reworkCycle.schedule.tenantAccessStatus === "denied" ||
                      data.reworkCycle.schedule.tenantAccessStatus === "not_required"
                        ? data.reworkCycle.schedule.tenantAccessStatus
                        : null,
                    tenantAccessNote: asString(data.reworkCycle.schedule.tenantAccessNote),
                  }
                : null,
          }
        : null,
    reworkHistory: Array.isArray(data?.reworkHistory)
      ? data.reworkHistory.map((entry: any) => ({
          cycleNumber: Number(entry?.cycleNumber || 1),
          startedAt: toMillis(entry?.startedAt),
          completedAt: toMillis(entry?.completedAt),
          outcome:
            entry?.outcome === "resolved" || entry?.outcome === "failed" || entry?.outcome === "partial"
              ? entry.outcome
              : null,
          notes: asString(entry?.notes),
        }))
      : [],
    reworkReview:
      data?.reworkReview && typeof data.reworkReview === "object"
        ? {
            status:
              data.reworkReview.status === "pending_review" ||
              data.reworkReview.status === "landlord_approved" ||
              data.reworkReview.status === "tenant_pending_signoff" ||
              data.reworkReview.status === "closed" ||
              data.reworkReview.status === "follow_up_required"
                ? data.reworkReview.status
                : null,
            reviewedAt: toMillis(data.reworkReview.reviewedAt),
            tenantSignoffStatus:
              data.reworkReview.tenantSignoffStatus === "pending" ||
              data.reworkReview.tenantSignoffStatus === "accepted" ||
              data.reworkReview.tenantSignoffStatus === "declined"
                ? data.reworkReview.tenantSignoffStatus
                : null,
            tenantSignedOffAt: toMillis(data.reworkReview.tenantSignedOffAt),
            tenantDeclinedAt: toMillis(data.reworkReview.tenantDeclinedAt),
            tenantDeclineReason: asString(data.reworkReview.tenantDeclineReason),
            closureOutcome:
              data.reworkReview.closureOutcome === "resolved" ||
              data.reworkReview.closureOutcome === "partial" ||
              data.reworkReview.closureOutcome === "needs_more_followup"
                ? data.reworkReview.closureOutcome
                : null,
            closedAt: toMillis(data.reworkReview.closedAt),
          }
        : null,
    notifications: {
      tenant: {
        requiresAccessConfirmation: data?.notifications?.tenant?.requiresAccessConfirmation === true,
        requiresSignoff: data?.notifications?.tenant?.requiresSignoff === true,
        requiresReworkAwareness: data?.notifications?.tenant?.requiresReworkAwareness === true,
      },
    },
    evidence: Array.isArray(data?.evidence)
      ? data.evidence
          .map((entry: any) => ({
            id: asString(entry?.id),
            url: asString(entry?.url),
            filename: asString(entry?.filename),
            contentType: asString(entry?.contentType),
            uploadedAt: toMillis(entry?.uploadedAt),
            uploadedByActorRole: asString(entry?.uploadedByActorRole),
            evidenceType: asString(entry?.evidenceType),
            caption: asString(entry?.caption),
            visibility: entry?.visibility === "tenant_safe" ? "tenant_safe" : null,
          }))
          .filter((entry: any) => entry.id && entry.visibility === "tenant_safe")
      : [],
    createdAt: toMillis(data?.createdAt),
    updatedAt: toMillis(data?.updatedAt),
    statusHistory,
  };
}
