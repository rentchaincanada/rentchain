export type TenantLifecycleState =
  | "applicant"
  | "screening_pending"
  | "screening_in_progress"
  | "screening_completed"
  | "approved"
  | "lease_pending"
  | "lease_sent"
  | "lease_signed"
  | "active"
  | "notice_pending"
  | "moving_out"
  | "past"
  | "archived"
  | "rejected"
  | "withdrawn"
  | "unknown";

export type TenantLifecycleConfidence = "high" | "medium" | "low";

export interface TenantLifecycleSourceFields {
  tenantStatus?: string;
  applicantStatus?: string;
  screeningStatus?: string;
  leaseStatus?: string;
  occupancyStatus?: string;
}

export interface TenantLifecycleFlags {
  hasActiveLease: boolean;
  hasPendingLease: boolean;
  hasCompletedScreening: boolean;
  isArchived: boolean;
  isPastTenant: boolean;
  hasStateConflict: boolean;
}

export interface TenantLifecycleResult {
  lifecycleState: TenantLifecycleState;
  lifecycleLabel: string;
  lifecycleReason: string;
  confidence: TenantLifecycleConfidence;
  sourceFields: TenantLifecycleSourceFields;
  flags: TenantLifecycleFlags;
}

export interface TenantLifecycleInput {
  tenantStatus?: unknown;
  applicantStatus?: unknown;
  applicationStatus?: unknown;
  screeningStatus?: unknown;
  leaseStatus?: unknown;
  occupancyStatus?: unknown;
  currentLeaseId?: unknown;
  leaseId?: unknown;
  applicationId?: unknown;
  convertedTenantId?: unknown;
  tenantId?: unknown;
  source?: unknown;
  archivedAt?: unknown;
  isArchived?: unknown;
  hiddenFromActiveLists?: unknown;
  hasActiveLease?: boolean;
  hasPendingLease?: boolean;
  hasCompletedScreening?: boolean;
  hasMoveOutDate?: boolean;
}

const LABELS: Record<TenantLifecycleState, string> = {
  applicant: "Applicant",
  screening_pending: "Screening pending",
  screening_in_progress: "Screening in progress",
  screening_completed: "Screening completed",
  approved: "Approved",
  lease_pending: "Lease pending",
  lease_sent: "Lease sent",
  lease_signed: "Lease signed",
  active: "Active",
  notice_pending: "Notice pending",
  moving_out: "Moving out",
  past: "Past",
  archived: "Archived",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  unknown: "Unknown",
};

const TENANT_ACTIVE = new Set(["active", "current"]);
const TENANT_PAST = new Set(["past", "former", "inactive", "vacated", "terminated"]);
const TENANT_ARCHIVED = new Set(["archived"]);
const APPLICANT_ACTIVE = new Set(["new", "draft", "submitted", "in_review", "review", "pending"]);
const APPLICANT_APPROVED = new Set(["approved", "conditional_cosigner", "conditional_deposit"]);
const APPLICANT_REJECTED = new Set(["rejected", "declined", "denied"]);
const APPLICANT_WITHDRAWN = new Set(["withdrawn", "cancelled", "canceled"]);
const SCREENING_PENDING = new Set(["requested", "unpaid", "pending", "queued", "not_started", "external_pending"]);
const SCREENING_IN_PROGRESS = new Set(["paid", "processing", "in_progress", "running", "manual_review"]);
const SCREENING_COMPLETED = new Set(["complete", "completed"]);
const LEASE_PENDING = new Set(["draft", "created", "prepared", "pending", "lease_pending"]);
const LEASE_SENT = new Set([
  "sent",
  "pending_signature",
  "ready_for_tenant_signature",
  "tenant_signed",
  "ready_for_landlord_signature",
  "landlord_signed",
]);
const LEASE_SIGNED = new Set(["signed", "signed_future", "fully_executed"]);
const LEASE_ACTIVE = new Set(["active", "current", "renewal_pending", "renewal_accepted"]);
const LEASE_NOTICE = new Set(["notice_pending", "notice_period"]);
const LEASE_MOVING_OUT = new Set(["move_out_pending", "moving_out", "ending"]);
const LEASE_PAST = new Set(["ended", "expired", "terminated", "ended_early", "cancelled", "canceled", "archived"]);
const OCCUPANCY_ACTIVE = new Set(["active", "occupied"]);
const OCCUPANCY_NOTICE = new Set(["notice", "notice_period", "notice_pending"]);
const OCCUPANCY_MOVING_OUT = new Set(["moving_out", "move_out_pending"]);
const OCCUPANCY_PAST = new Set(["inactive", "vacant", "past", "moved_out", "vacated"]);

function normalized(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function sourceValue(value: unknown): string | undefined {
  const raw = String(value || "").trim();
  return raw || undefined;
}

function hasValue(value: unknown): boolean {
  return String(value || "").trim().length > 0;
}

function makeResult(
  lifecycleState: TenantLifecycleState,
  lifecycleReason: string,
  confidence: TenantLifecycleConfidence,
  sourceFields: TenantLifecycleSourceFields,
  flags: TenantLifecycleFlags
): TenantLifecycleResult {
  return {
    lifecycleState,
    lifecycleLabel: LABELS[lifecycleState],
    lifecycleReason,
    confidence: flags.hasStateConflict && confidence === "high" ? "medium" : confidence,
    sourceFields,
    flags,
  };
}

export function deriveTenantLifecycle(input: TenantLifecycleInput = {}): TenantLifecycleResult {
  const tenantStatus = normalized(input.tenantStatus);
  const applicantStatus = normalized(input.applicantStatus ?? input.applicationStatus);
  const screeningStatus = normalized(input.screeningStatus);
  const leaseStatus = normalized(input.leaseStatus);
  const occupancyStatus = normalized(input.occupancyStatus);
  const hasLeasePointer = hasValue(input.currentLeaseId) || hasValue(input.leaseId);
  const hasApplicationPointer = hasValue(input.applicationId);

  const sourceFields: TenantLifecycleSourceFields = {
    ...(sourceValue(input.tenantStatus) ? { tenantStatus: sourceValue(input.tenantStatus) } : {}),
    ...(sourceValue(input.applicantStatus ?? input.applicationStatus)
      ? { applicantStatus: sourceValue(input.applicantStatus ?? input.applicationStatus) }
      : {}),
    ...(sourceValue(input.screeningStatus) ? { screeningStatus: sourceValue(input.screeningStatus) } : {}),
    ...(sourceValue(input.leaseStatus) ? { leaseStatus: sourceValue(input.leaseStatus) } : {}),
    ...(sourceValue(input.occupancyStatus) ? { occupancyStatus: sourceValue(input.occupancyStatus) } : {}),
  };

  const hasActiveLease = Boolean(
    input.hasActiveLease ||
      LEASE_ACTIVE.has(leaseStatus) ||
      LEASE_NOTICE.has(leaseStatus) ||
      LEASE_MOVING_OUT.has(leaseStatus)
  );
  const hasPendingLease = Boolean(input.hasPendingLease || LEASE_PENDING.has(leaseStatus) || LEASE_SENT.has(leaseStatus));
  const hasCompletedScreening = Boolean(input.hasCompletedScreening || SCREENING_COMPLETED.has(screeningStatus));
  const isArchived = Boolean(input.isArchived || input.archivedAt || TENANT_ARCHIVED.has(tenantStatus));
  const isPastTenant = Boolean(
    TENANT_PAST.has(tenantStatus) ||
      LEASE_PAST.has(leaseStatus) ||
      OCCUPANCY_PAST.has(occupancyStatus) ||
      input.hasMoveOutDate
  );
  const hasActiveOccupancy = OCCUPANCY_ACTIVE.has(occupancyStatus);
  const hasTerminalApplicant = APPLICANT_REJECTED.has(applicantStatus) || APPLICANT_WITHDRAWN.has(applicantStatus);
  const hasStateConflict = Boolean(
    (isArchived && (hasActiveLease || hasActiveOccupancy || TENANT_ACTIVE.has(tenantStatus))) ||
      (isPastTenant && (hasActiveLease || hasActiveOccupancy)) ||
      (hasTerminalApplicant && (hasActiveLease || hasActiveOccupancy || hasValue(input.convertedTenantId) || hasValue(input.tenantId)))
  );

  const flags: TenantLifecycleFlags = {
    hasActiveLease,
    hasPendingLease,
    hasCompletedScreening,
    isArchived,
    isPastTenant,
    hasStateConflict,
  };

  if (isArchived) return makeResult("archived", "archived_signal_present", "high", sourceFields, flags);
  if (APPLICANT_WITHDRAWN.has(applicantStatus)) return makeResult("withdrawn", "applicant_withdrawn", "high", sourceFields, flags);
  if (APPLICANT_REJECTED.has(applicantStatus)) return makeResult("rejected", "applicant_rejected", "high", sourceFields, flags);
  if (LEASE_MOVING_OUT.has(leaseStatus) || OCCUPANCY_MOVING_OUT.has(occupancyStatus)) {
    return makeResult("moving_out", "move_out_signal_present", "high", sourceFields, flags);
  }
  if (LEASE_NOTICE.has(leaseStatus) || OCCUPANCY_NOTICE.has(occupancyStatus)) {
    return makeResult("notice_pending", "notice_signal_present", "high", sourceFields, flags);
  }
  if (hasActiveLease || hasActiveOccupancy || TENANT_ACTIVE.has(tenantStatus)) {
    return makeResult("active", "active_tenancy_or_lease_signal", hasActiveLease || hasActiveOccupancy ? "high" : "medium", sourceFields, flags);
  }
  if (isPastTenant) return makeResult("past", "past_or_inactive_signal_present", "high", sourceFields, flags);
  if (LEASE_SIGNED.has(leaseStatus)) return makeResult("lease_signed", "lease_signed_signal_present", "high", sourceFields, flags);
  if (LEASE_SENT.has(leaseStatus)) return makeResult("lease_sent", "lease_sent_or_signature_pending", "high", sourceFields, flags);
  if (hasPendingLease) return makeResult("lease_pending", "lease_pending_signal_present", "high", sourceFields, flags);
  if (APPLICANT_APPROVED.has(applicantStatus)) return makeResult("approved", "application_approved", "high", sourceFields, flags);
  if (hasCompletedScreening) return makeResult("screening_completed", "screening_completed", "high", sourceFields, flags);
  if (SCREENING_IN_PROGRESS.has(screeningStatus)) return makeResult("screening_in_progress", "screening_in_progress", "high", sourceFields, flags);
  if (SCREENING_PENDING.has(screeningStatus)) return makeResult("screening_pending", "screening_pending", "high", sourceFields, flags);
  if (APPLICANT_ACTIVE.has(applicantStatus) || hasApplicationPointer) {
    return makeResult("applicant", "application_or_applicant_signal_present", applicantStatus ? "high" : "medium", sourceFields, flags);
  }
  if (hasLeasePointer) return makeResult("lease_pending", "lease_pointer_without_resolved_status", "low", sourceFields, flags);

  return makeResult("unknown", "insufficient_lifecycle_data", "low", sourceFields, flags);
}
