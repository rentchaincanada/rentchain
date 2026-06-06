import { resolveLeaseNoticeRule, type LeaseNoticeType } from "../config/leaseNoticeRules";
import type { LeaseNoticePreviewInput, LeaseWorkflowLease } from "./leaseNoticeWorkflowService";

export type NoticeValidationRuleCode =
  | "lease_state_allowed"
  | "tenant_context_present"
  | "landlord_context_present"
  | "lease_property_context_present"
  | "rent_terms_present"
  | "jurisdiction_supported"
  | "notice_type_allowed"
  | "term_dates_present"
  | "response_deadline_present";

export type NoticeValidationFailure = {
  code: NoticeValidationRuleCode;
  message: string;
};

export type NoticeValidationResult = {
  ok: boolean;
  checkedRules: NoticeValidationRuleCode[];
  failedRules: NoticeValidationFailure[];
};

const ALLOWED_GENERATION_STATES = new Set(["active", "notice_pending", "renewal_pending"]);
const BLOCKED_GENERATION_STATES = new Set(["ended", "archived", "terminated", "disputed"]);

function addFailure(
  failures: NoticeValidationFailure[],
  code: NoticeValidationRuleCode,
  message: string,
  condition: boolean
) {
  if (!condition) failures.push({ code, message });
}

function hasPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasDateOnly(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeNoticeType(value: unknown): LeaseNoticeType | null {
  const raw = String(value || "").trim().toLowerCase();
  if (
    raw === "renewal_offer" ||
    raw === "end_of_term_notice" ||
    raw === "non_renewal" ||
    raw === "month_to_month_notice"
  ) {
    return raw;
  }
  return null;
}

function defaultNoticeType(lease: LeaseWorkflowLease): LeaseNoticeType {
  return lease.leaseType === "month_to_month" ? "month_to_month_notice" : "renewal_offer";
}

export function validateNoticeAutomationPrerequisites(input: {
  lease: LeaseWorkflowLease;
  previewInput: LeaseNoticePreviewInput;
}): NoticeValidationResult {
  const { lease, previewInput } = input;
  const checkedRules: NoticeValidationRuleCode[] = [
    "lease_state_allowed",
    "tenant_context_present",
    "landlord_context_present",
    "lease_property_context_present",
    "rent_terms_present",
    "jurisdiction_supported",
    "notice_type_allowed",
    "term_dates_present",
    "response_deadline_present",
  ];
  const failedRules: NoticeValidationFailure[] = [];
  const status = String(lease.status || "").trim().toLowerCase();
  const rule = resolveLeaseNoticeRule({ province: lease.province, leaseType: lease.leaseType });
  const noticeType = normalizeNoticeType(previewInput.noticeType) || defaultNoticeType(lease);

  addFailure(
    failedRules,
    "lease_state_allowed",
    "Lease must be in an active notice workflow state.",
    ALLOWED_GENERATION_STATES.has(status) && !BLOCKED_GENERATION_STATES.has(status)
  );
  addFailure(
    failedRules,
    "tenant_context_present",
    "Lease must include tenant context before a notice can be generated.",
    Boolean(String(lease.tenantId || "").trim())
  );
  addFailure(
    failedRules,
    "landlord_context_present",
    "Lease must include landlord context before a notice can be generated.",
    Boolean(String(lease.landlordId || "").trim())
  );
  addFailure(
    failedRules,
    "lease_property_context_present",
    "Lease must include property and unit context before a notice can be generated.",
    Boolean(String(lease.propertyId || "").trim() && String(lease.unitId || "").trim())
  );
  addFailure(
    failedRules,
    "rent_terms_present",
    "Lease must include valid rent terms before a notice can be generated.",
    hasPositiveNumber(lease.currentRent) && Boolean(String(lease.currency || "").trim())
  );
  addFailure(
    failedRules,
    "jurisdiction_supported",
    "Lease jurisdiction and lease type must resolve to a supported notice rule.",
    Boolean(rule)
  );
  addFailure(
    failedRules,
    "notice_type_allowed",
    "Notice type must be allowed for the resolved jurisdiction rule.",
    Boolean(rule?.allowedNoticeTypes.includes(noticeType))
  );
  addFailure(
    failedRules,
    "term_dates_present",
    "Lease term dates and next-term dates must satisfy the resolved notice rule.",
    Boolean(
      hasDateOnly(lease.leaseStartDate) &&
        (lease.leaseType === "month_to_month" || hasDateOnly(lease.leaseEndDate)) &&
        hasDateOnly(previewInput.newLeaseStartDate) &&
        (!rule?.requireTermDates || hasDateOnly(previewInput.newLeaseEndDate))
    )
  );
  addFailure(
    failedRules,
    "response_deadline_present",
    "Notice response deadline must be present and valid.",
    hasPositiveNumber(previewInput.responseDeadlineAt)
  );

  return {
    ok: failedRules.length === 0,
    checkedRules,
    failedRules,
  };
}

/**
 * Validates the renewal/eviction-style notice generation path before any notice document is created.
 */
export function canGenerateEvictionNotice(lease: LeaseWorkflowLease, previewInput: LeaseNoticePreviewInput) {
  return validateNoticeAutomationPrerequisites({ lease, previewInput });
}

/**
 * Validates cure notice prerequisites without adding cure-specific provider or delivery side effects.
 */
export function canGenerateCureNotice(lease: LeaseWorkflowLease, previewInput: LeaseNoticePreviewInput) {
  return validateNoticeAutomationPrerequisites({ lease, previewInput });
}

/**
 * Validates end-of-term and non-renewal notice prerequisites for deterministic service-layer gating.
 */
export function canGenerateTerminationNotice(lease: LeaseWorkflowLease, previewInput: LeaseNoticePreviewInput) {
  return validateNoticeAutomationPrerequisites({ lease, previewInput });
}
