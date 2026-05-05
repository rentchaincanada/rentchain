export type LeaseLifecycleState =
  | "draft"
  | "pending_signature"
  | "signed_future"
  | "active"
  | "notice_period"
  | "expired"
  | "renewed"
  | "terminated"
  | "cancelled"
  | "unknown";

export type UnitOccupancyState = "occupied" | "notice_period" | "upcoming" | "vacant" | "review_required";

export interface LeaseLifecycleInput {
  leaseId?: string | null;
  id?: string | null;
  status?: string | null;
  startDate?: unknown;
  leaseStartDate?: unknown;
  leaseStart?: unknown;
  endDate?: unknown;
  leaseEndDate?: unknown;
  leaseEnd?: unknown;
  signedAt?: unknown;
  sentAt?: unknown;
  activatedAt?: unknown;
  cancelledAt?: unknown;
  terminatedAt?: unknown;
  terminationDate?: unknown;
  moveOutDate?: unknown;
  noticeGivenAt?: unknown;
  noticeEffectiveDate?: unknown;
  noticeDate?: unknown;
  noticeAt?: unknown;
  renewalLeaseId?: string | null;
  renewedByLeaseId?: string | null;
  successorLeaseId?: string | null;
  replacedByLeaseId?: string | null;
  isRenewal?: boolean | null;
  tenantSignedAt?: unknown;
  landlordSignedAt?: unknown;
  signatureStatus?: string | null;
  leaseExecution?: {
    executionStatus?: string | null;
    completedAt?: unknown;
  } | null;
  leaseLifecycleSummary?: {
    lifecycleStatus?: string | null;
    renewalOutcome?: string | null;
  } | null;
  hasSignedSuccessorLease?: boolean | null;
  hasActiveSuccessorLease?: boolean | null;
  hasRenewalLease?: boolean | null;
}

export interface LeaseLifecycleResult {
  state: LeaseLifecycleState;
  reasons: string[];
  effectiveStartDate?: string;
  effectiveEndDate?: string;
  isCurrent: boolean;
  isTerminal: boolean;
  isOccupancyActive: boolean;
  isRenewalProtected: boolean;
  requiresReview: boolean;
}

export interface UnitOccupancyLifecycleResult {
  state: UnitOccupancyState;
  reasons: string[];
  leaseLifecycleState?: LeaseLifecycleState;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const DRAFT_STATUSES = new Set(["draft", "created"]);
const PENDING_SIGNATURE_STATUSES = new Set([
  "pending_signature",
  "sent",
  "prepared",
  "ready_for_tenant_signature",
  "tenant_signed",
  "ready_for_landlord_signature",
  "landlord_signed",
]);
const SIGNED_STATUSES = new Set([
  "signed",
  "active",
  "current",
  "renewal_pending",
  "renewal_accepted",
  "notice_pending",
  "move_out_pending",
  "ending",
]);
const NOTICE_STATUSES = new Set(["notice_period", "notice_pending", "move_out_pending", "ending"]);
const EXPIRED_STATUSES = new Set(["expired", "ended", "archived"]);
const TERMINATED_STATUSES = new Set(["terminated", "ended_early"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "void", "abandoned"]);
const RENEWED_STATUSES = new Set(["renewed", "superseded"]);

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function firstValue(...values: unknown[]): unknown {
  return values.find((value) => value != null && value !== "");
}

function toDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof (value as any)?.toDate === "function") {
    try {
      const date = (value as any).toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }
  if (typeof (value as any)?.toMillis === "function") {
    try {
      const date = new Date((value as any).toMillis());
      return Number.isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }
  if (typeof (value as any)?.seconds === "number") {
    const date = new Date((value as any).seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDay(value: unknown): number | null {
  const date = toDate(value);
  if (!date) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function toIsoDay(value: unknown): string | undefined {
  const day = toDay(value);
  return day == null ? undefined : new Date(day).toISOString().slice(0, 10);
}

function todayDay(today: unknown): number {
  return toDay(today) ?? toDay(new Date()) ?? Date.now();
}

function hasAnyDate(...values: unknown[]): boolean {
  return values.some((value) => toDay(value) != null);
}

function hasRenewalLink(input: LeaseLifecycleInput): boolean {
  return Boolean(
    input.renewalLeaseId ||
      input.renewedByLeaseId ||
      input.successorLeaseId ||
      input.replacedByLeaseId ||
      input.hasRenewalLease ||
      input.hasSignedSuccessorLease ||
      input.hasActiveSuccessorLease
  );
}

function hasSignedSuccessor(input: LeaseLifecycleInput): boolean {
  return Boolean(
    input.hasSignedSuccessorLease ||
      input.hasActiveSuccessorLease ||
      ((input.renewalLeaseId || input.renewedByLeaseId || input.successorLeaseId || input.replacedByLeaseId) &&
        input.hasRenewalLease)
  );
}

function hasNoticeSignal(input: LeaseLifecycleInput, status: string, lifecycleStatus: string): boolean {
  const renewalOutcome = normalize(input.leaseLifecycleSummary?.renewalOutcome);
  return (
    NOTICE_STATUSES.has(status) ||
    NOTICE_STATUSES.has(lifecycleStatus) ||
    renewalOutcome === "tenant_quitting" ||
    hasAnyDate(input.noticeGivenAt, input.noticeEffectiveDate, input.noticeDate, input.noticeAt, input.moveOutDate)
  );
}

function hasSentSignal(input: LeaseLifecycleInput, status: string, executionStatus: string): boolean {
  return Boolean(
    hasAnyDate(input.sentAt) ||
      PENDING_SIGNATURE_STATUSES.has(status) ||
      PENDING_SIGNATURE_STATUSES.has(executionStatus)
  );
}

function hasFullySignedSignal(input: LeaseLifecycleInput, status: string, executionStatus: string): boolean {
  const signatureStatus = normalize(input.signatureStatus);
  return Boolean(
    hasAnyDate(input.signedAt, input.activatedAt, input.leaseExecution?.completedAt) ||
      (hasAnyDate(input.tenantSignedAt) && hasAnyDate(input.landlordSignedAt)) ||
      signatureStatus === "signed" ||
      executionStatus === "fully_executed" ||
      SIGNED_STATUSES.has(status)
  );
}

function result(
  state: LeaseLifecycleState,
  reasons: string[],
  options: {
    input: LeaseLifecycleInput;
    startValue: unknown;
    endValue: unknown;
    renewalProtected?: boolean;
    requiresReview?: boolean;
  }
): LeaseLifecycleResult {
  const isCurrent = state === "active" || state === "notice_period";
  const isTerminal = state === "expired" || state === "renewed" || state === "terminated" || state === "cancelled";
  return {
    state,
    reasons,
    effectiveStartDate: toIsoDay(options.startValue),
    effectiveEndDate: toIsoDay(options.endValue),
    isCurrent,
    isTerminal,
    isOccupancyActive: isCurrent,
    isRenewalProtected: Boolean(options.renewalProtected || hasRenewalLink(options.input) || state === "renewed"),
    requiresReview: Boolean(options.requiresReview || state === "unknown"),
  };
}

export function deriveLeaseLifecycleState(
  input: LeaseLifecycleInput | null | undefined,
  today: unknown = new Date()
): LeaseLifecycleResult {
  if (!input) {
    return result("unknown", ["lease_missing"], {
      input: {},
      startValue: null,
      endValue: null,
      requiresReview: true,
    });
  }

  const status = normalize(input.status);
  const lifecycleStatus = normalize(input.leaseLifecycleSummary?.lifecycleStatus);
  const executionStatus = normalize(input.leaseExecution?.executionStatus);
  const currentDay = todayDay(today);
  const startValue = firstValue(input.startDate, input.leaseStartDate, input.leaseStart);
  const endValue = firstValue(input.endDate, input.leaseEndDate, input.leaseEnd);
  const startDay = toDay(startValue);
  const endDay = toDay(endValue);
  const terminationDay = toDay(firstValue(input.terminatedAt, input.terminationDate));
  const cancelledDay = toDay(input.cancelledAt);
  const hasSigned = hasFullySignedSignal(input, status, executionStatus);
  const hasSent = hasSentSignal(input, status, executionStatus);
  const hasNotice = hasNoticeSignal(input, status, lifecycleStatus);
  const renewalProtected = hasRenewalLink(input);

  if (startDay != null && endDay != null && startDay > endDay) {
    return result("unknown", ["date_range_invalid"], {
      input,
      startValue,
      endValue,
      renewalProtected,
      requiresReview: true,
    });
  }

  if (cancelledDay != null || CANCELLED_STATUSES.has(status)) {
    return result("cancelled", [cancelledDay != null ? "cancelled_at_present" : "status_cancelled"], {
      input,
      startValue,
      endValue,
      renewalProtected,
    });
  }

  if (terminationDay != null && terminationDay <= currentDay) {
    return result("terminated", ["termination_effective"], {
      input,
      startValue,
      endValue: firstValue(input.terminationDate, input.terminatedAt, endValue),
      renewalProtected,
    });
  }

  if (TERMINATED_STATUSES.has(status)) {
    return result("terminated", ["status_terminated"], {
      input,
      startValue,
      endValue: firstValue(input.terminationDate, input.terminatedAt, endValue),
      renewalProtected,
    });
  }

  if (hasSignedSuccessor(input) || (RENEWED_STATUSES.has(status) && renewalProtected)) {
    return result("renewed", ["signed_successor_present"], {
      input,
      startValue,
      endValue,
      renewalProtected: true,
    });
  }

  if (!startDay && !endDay && (DRAFT_STATUSES.has(status) || executionStatus === "draft" || !status)) {
    return result("draft", ["draft_without_term_dates"], {
      input,
      startValue,
      endValue,
      renewalProtected,
    });
  }

  if (hasSent && !hasSigned) {
    return result("pending_signature", ["sent_not_fully_signed"], {
      input,
      startValue,
      endValue,
      renewalProtected,
    });
  }

  if (hasSigned && startDay != null && startDay > currentDay) {
    return result("signed_future", ["signed_before_start_date"], {
      input,
      startValue,
      endValue,
      renewalProtected,
    });
  }

  const isWithinTerm =
    hasSigned &&
    (startDay == null || startDay <= currentDay) &&
    (endDay == null || endDay >= currentDay) &&
    (startDay != null || endDay != null || status === "active" || status === "current");

  if (isWithinTerm && hasNotice) {
    return result("notice_period", ["active_notice_signal"], {
      input,
      startValue,
      endValue: firstValue(input.noticeEffectiveDate, input.moveOutDate, endValue),
      renewalProtected,
    });
  }

  if (isWithinTerm) {
    return result("active", ["signed_current_term"], {
      input,
      startValue,
      endValue,
      renewalProtected,
    });
  }

  if (endDay != null && endDay < currentDay) {
    if (renewalProtected || RENEWED_STATUSES.has(status) || lifecycleStatus === "renewed") {
      return result("renewed", ["ended_with_successor_or_renewal"], {
        input,
        startValue,
        endValue,
        renewalProtected: true,
      });
    }
    return result("expired", ["end_date_past"], {
      input,
      startValue,
      endValue,
      renewalProtected,
    });
  }

  if (EXPIRED_STATUSES.has(status) || lifecycleStatus === "expired") {
    return result("expired", ["status_expired"], {
      input,
      startValue,
      endValue,
      renewalProtected,
    });
  }

  if (DRAFT_STATUSES.has(status) || executionStatus === "draft") {
    return result("draft", ["status_draft"], {
      input,
      startValue,
      endValue,
      renewalProtected,
    });
  }

  return result("unknown", ["insufficient_or_contradictory_lifecycle_data"], {
    input,
    startValue,
    endValue,
    renewalProtected,
    requiresReview: true,
  });
}

export function deriveUnitOccupancyFromLeaseLifecycle(
  input: LeaseLifecycleResult | LeaseLifecycleInput | Array<LeaseLifecycleResult | LeaseLifecycleInput> | null | undefined,
  today: unknown = new Date()
): UnitOccupancyLifecycleResult {
  const items = Array.isArray(input) ? input : input ? [input] : [];
  if (!items.length) return { state: "vacant", reasons: ["no_lease"] };

  const lifecycles = items.map((item) =>
    typeof (item as LeaseLifecycleResult).state === "string"
      ? (item as LeaseLifecycleResult)
      : deriveLeaseLifecycleState(item as LeaseLifecycleInput, today)
  );

  const review = lifecycles.find((entry) => entry.state === "unknown" || entry.requiresReview);
  if (review) {
    return { state: "review_required", reasons: review.reasons, leaseLifecycleState: review.state };
  }

  const notice = lifecycles.find((entry) => entry.state === "notice_period");
  if (notice) return { state: "notice_period", reasons: notice.reasons, leaseLifecycleState: notice.state };

  const active = lifecycles.find((entry) => entry.state === "active");
  if (active) return { state: "occupied", reasons: active.reasons, leaseLifecycleState: active.state };

  const future = lifecycles.find((entry) => entry.state === "signed_future");
  if (future) return { state: "upcoming", reasons: future.reasons, leaseLifecycleState: future.state };

  return { state: "vacant", reasons: ["no_current_or_upcoming_lease"] };
}

export function isLeaseExpiringSoon(
  resultOrLease: LeaseLifecycleResult | LeaseLifecycleInput | null | undefined,
  today: unknown = new Date(),
  thresholdDays = 60
): boolean {
  if (!resultOrLease) return false;
  const lifecycle =
    typeof (resultOrLease as LeaseLifecycleResult).state === "string"
      ? (resultOrLease as LeaseLifecycleResult)
      : deriveLeaseLifecycleState(resultOrLease as LeaseLifecycleInput, today);
  if (lifecycle.state !== "active" && lifecycle.state !== "notice_period") return false;
  if (!lifecycle.effectiveEndDate) return false;
  const currentDay = todayDay(today);
  const endDay = toDay(lifecycle.effectiveEndDate);
  if (endDay == null || endDay < currentDay) return false;
  const daysUntilEnd = Math.floor((endDay - currentDay) / DAY_MS);
  return daysUntilEnd <= thresholdDays;
}
