export type LeaseLifecycleStatus =
  | "draft"
  | "pending_signature"
  | "signed_future"
  | "active"
  | "notice_period"
  | "expired"
  | "renewed"
  | "terminated"
  | "cancelled"
  | "archived"
  | "unknown";

export type UnitOccupancyStatus = "vacant" | "occupied" | "upcoming" | "archived" | "review_required";

export type UnitOccupancy = {
  status: UnitOccupancyStatus;
  label: "Vacant" | "Occupied" | "Upcoming" | "Archived" | "Review needed";
  lease: LeaseLike | null;
  reason?: string | null;
};

export type LeaseLike = {
  id?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;
  status?: string | null;
  monthlyRent?: number | null;
  startDate?: string | number | null;
  leaseStartDate?: string | number | null;
  endDate?: string | number | null;
  leaseEndDate?: string | number | null;
  moveOutDate?: string | number | null;
  terminationDate?: string | number | null;
  noticeDate?: string | number | null;
  noticeAt?: string | number | null;
  renewedByLeaseId?: string | null;
  renewalLeaseId?: string | null;
  replacedByLeaseId?: string | null;
  signatureStatus?: string | null;
  leaseExecution?: {
    executionStatus?: string | null;
    completedAt?: string | number | null;
  } | null;
  leaseLifecycleSummary?: {
    lifecycleStatus?: string | null;
    renewalOutcome?: string | null;
  } | null;
  derivedLifecycleState?: string | null;
  derivedLifecycleReasons?: string[] | null;
  derivedLifecycleRequiresReview?: boolean | null;
};

type UnitLike = {
  id?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;
  label?: string | null;
  name?: string | null;
  status?: string | null;
  occupancyStatus?: string | null;
  occupantName?: string | null;
  tenantName?: string | null;
  occupants?: string[] | null;
  leaseEndDate?: string | number | Date | null;
  leaseEnd?: string | number | Date | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const ACTIVE_STATUSES = new Set(["active", "renewal_pending", "renewal_accepted"]);
const NOTICE_STATUSES = new Set(["notice_pending", "move_out_pending", "ending"]);
const EXPIRED_STATUSES = new Set(["expired", "ended", "archived"]);
const TERMINATED_STATUSES = new Set(["terminated", "ended_early"]);
const CANCELLED_STATUSES = new Set(["cancelled", "canceled", "void", "abandoned"]);
const DRAFT_STATUSES = new Set(["draft"]);
const PENDING_SIGNATURE_STATUSES = new Set([
  "pending_signature",
  "ready_for_tenant_signature",
  "tenant_signed",
  "ready_for_landlord_signature",
  "landlord_signed",
]);

const CANONICAL_LIFECYCLE_STATUSES = new Set<LeaseLifecycleStatus>([
  "draft",
  "pending_signature",
  "signed_future",
  "active",
  "notice_period",
  "expired",
  "renewed",
  "terminated",
  "cancelled",
  "archived",
  "unknown",
]);

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function toDay(value: string | number | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function todayDay(today: string | number | Date = new Date()): number {
  return toDay(today) ?? toDay(new Date()) ?? Date.now();
}

function leaseStartDay(lease: LeaseLike): number | null {
  return toDay(lease.startDate ?? lease.leaseStartDate);
}

function leaseEndDay(lease: LeaseLike): number | null {
  return toDay(lease.endDate ?? lease.leaseEndDate);
}

function hasNoticeSignal(lease: LeaseLike): boolean {
  const status = normalize(lease.status);
  const lifecycleStatus = normalize(lease.leaseLifecycleSummary?.lifecycleStatus);
  const renewalOutcome = normalize(lease.leaseLifecycleSummary?.renewalOutcome);
  return (
    NOTICE_STATUSES.has(status) ||
    NOTICE_STATUSES.has(lifecycleStatus) ||
    renewalOutcome === "tenant_quitting" ||
    Boolean(lease.noticeDate || lease.noticeAt || lease.moveOutDate)
  );
}

function hasSignedSignal(lease: LeaseLike): boolean {
  const status = normalize(lease.status);
  const executionStatus = normalize(lease.leaseExecution?.executionStatus);
  const signatureStatus = normalize(lease.signatureStatus);
  return (
    ACTIVE_STATUSES.has(status) ||
    NOTICE_STATUSES.has(status) ||
    signatureStatus === "signed" ||
    executionStatus === "fully_executed" ||
    Boolean(lease.leaseExecution?.completedAt)
  );
}

function hasRenewalReplacement(lease: LeaseLike): boolean {
  const status = normalize(lease.status);
  const lifecycleStatus = normalize(lease.leaseLifecycleSummary?.lifecycleStatus);
  const renewalOutcome = normalize(lease.leaseLifecycleSummary?.renewalOutcome);
  return (
    Boolean(lease.renewedByLeaseId || lease.renewalLeaseId || lease.replacedByLeaseId) ||
    lifecycleStatus === "renewed" ||
    renewalOutcome === "renewed" ||
    status === "renewed"
  );
}

function backendDerivedLifecycleStatus(lease: LeaseLike): LeaseLifecycleStatus | null {
  const derived = normalize(lease.derivedLifecycleState);
  return CANONICAL_LIFECYCLE_STATUSES.has(derived as LeaseLifecycleStatus)
    ? (derived as LeaseLifecycleStatus)
    : null;
}

export function deriveLeaseLifecycleStatus(
  lease: LeaseLike | null | undefined,
  today: string | number | Date = new Date()
): LeaseLifecycleStatus {
  if (!lease) return "draft";
  const derived = backendDerivedLifecycleStatus(lease);
  if (derived) return derived;

  const status = normalize(lease.status);
  const lifecycleStatus = normalize(lease.leaseLifecycleSummary?.lifecycleStatus);
  const executionStatus = normalize(lease.leaseExecution?.executionStatus);
  const currentDay = todayDay(today);
  const startDay = leaseStartDay(lease);
  const endDay = leaseEndDay(lease);

  if (CANCELLED_STATUSES.has(status)) return "cancelled";
  if (status === "archived" || lifecycleStatus === "archived") return "archived";
  if (TERMINATED_STATUSES.has(status) || (lease.terminationDate && (toDay(lease.terminationDate) ?? Infinity) <= currentDay)) {
    return "terminated";
  }

  const withinTerm = (startDay == null || startDay <= currentDay) && (endDay == null || endDay >= currentDay);
  if (withinTerm && hasNoticeSignal(lease)) return "notice_period";
  if (withinTerm && (ACTIVE_STATUSES.has(status) || hasSignedSignal(lease))) return "active";

  if (startDay != null && startDay > currentDay && hasSignedSignal(lease)) return "signed_future";
  if (endDay != null && endDay < currentDay) {
    return hasRenewalReplacement(lease) ? "renewed" : "expired";
  }
  if (hasRenewalReplacement(lease) && !withinTerm) return "renewed";
  if (EXPIRED_STATUSES.has(status) || lifecycleStatus === "expired") return "expired";
  if (DRAFT_STATUSES.has(status) || executionStatus === "draft") return "draft";
  if (PENDING_SIGNATURE_STATUSES.has(status) || PENDING_SIGNATURE_STATUSES.has(executionStatus)) return "pending_signature";
  if (hasSignedSignal(lease)) return startDay != null && startDay > currentDay ? "signed_future" : "active";

  return "draft";
}

export function isLeaseCurrentlyActive(lease: LeaseLike | null | undefined, today: string | number | Date = new Date()) {
  const status = deriveLeaseLifecycleStatus(lease, today);
  return status === "active" || status === "notice_period";
}

export function isLeaseExpired(lease: LeaseLike | null | undefined, today: string | number | Date = new Date()) {
  return deriveLeaseLifecycleStatus(lease, today) === "expired";
}

function unitIdentifiers(unit: UnitLike): string[] {
  return Array.from(
    new Set(
      [unit.id, unit.unitId, unit.unitNumber, unit.label, unit.name]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function leaseIdentifiers(lease: LeaseLike): string[] {
  return Array.from(
    new Set(
      [lease.unitId, lease.unitNumber]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

function hasManualOccupant(unit: UnitLike): boolean {
  return Boolean(
    String(unit.occupantName || unit.tenantName || "").trim() ||
      (Array.isArray(unit.occupants) && unit.occupants.some((value) => String(value || "").trim()))
  );
}

function hasCurrentManualLeaseEnd(unit: UnitLike, today: string | number | Date): boolean {
  const endDay = toDay(unit.leaseEndDate ?? unit.leaseEnd);
  if (endDay == null) return false;
  return endDay >= todayDay(today);
}

function hasManualCurrentOccupancy(unit: UnitLike, today: string | number | Date): boolean {
  const status = normalize(unit.occupancyStatus || unit.status);
  return status === "occupied" && hasManualOccupant(unit) && hasCurrentManualLeaseEnd(unit, today);
}

function hasUnitArchivedSignal(unit: UnitLike): boolean {
  const status = normalize(unit.occupancyStatus || unit.status);
  return status === "archived" || status === "deleted" || status === "inactive";
}

function hasLeaseArchivedSignal(lease: LeaseLike): boolean {
  return deriveLeaseLifecycleStatus(lease) === "archived";
}

export function leasesForUnit(unit: UnitLike, leases: LeaseLike[]): LeaseLike[] {
  const ids = new Set(unitIdentifiers(unit));
  if (!ids.size) return [];
  return (Array.isArray(leases) ? leases : []).filter((lease) =>
    leaseIdentifiers(lease).some((identifier) => ids.has(identifier))
  );
}

export function deriveUnitOccupancyFromLeases(
  unit: UnitLike,
  leases: LeaseLike[],
  today: string | number | Date = new Date()
): UnitOccupancy {
  const matchedLeases = leasesForUnit(unit, leases);
  const withLifecycle = matchedLeases.map((lease) => ({
    lease,
    status: deriveLeaseLifecycleStatus(lease, today),
  }));

  const review = withLifecycle.find((item) => item.status === "unknown" || item.lease.derivedLifecycleRequiresReview === true);
  if (review) {
    return {
      status: "review_required",
      label: "Review needed",
      lease: review.lease,
      reason: Array.isArray(review.lease.derivedLifecycleReasons) && review.lease.derivedLifecycleReasons.length
        ? review.lease.derivedLifecycleReasons.join(", ")
        : "Lifecycle data needs review.",
    };
  }

  const currentLeases = withLifecycle.filter((item) => item.status === "active" || item.status === "notice_period");
  if (currentLeases.length > 1) {
    return {
      status: "review_required",
      label: "Review needed",
      lease: currentLeases[0]?.lease ?? null,
      reason: "Multiple current leases match this unit.",
    };
  }

  const active = currentLeases[0];
  if (active) return { status: "occupied", label: "Occupied", lease: active.lease };

  const upcoming = withLifecycle.find((item) => item.status === "signed_future");
  if (upcoming) return { status: "upcoming", label: "Upcoming", lease: upcoming.lease };

  if (hasManualCurrentOccupancy(unit, today)) {
    return { status: "occupied", label: "Occupied", lease: null };
  }

  if (hasUnitArchivedSignal(unit) || matchedLeases.some(hasLeaseArchivedSignal)) {
    return { status: "archived", label: "Archived", lease: matchedLeases[0] ?? null };
  }

  return { status: "vacant", label: "Vacant", lease: null };
}

export function getExpiringSoonLeases(
  leases: LeaseLike[],
  today: string | number | Date = new Date(),
  thresholdDays = 60
): LeaseLike[] {
  const currentDay = todayDay(today);
  return (Array.isArray(leases) ? leases : []).filter((lease) => {
    const lifecycle = deriveLeaseLifecycleStatus(lease, today);
    if (lifecycle !== "active" && lifecycle !== "notice_period") return false;
    const endDay = leaseEndDay(lease);
    if (endDay == null || endDay < currentDay) return false;
    const daysUntilEnd = Math.floor((endDay - currentDay) / DAY_MS);
    return daysUntilEnd <= thresholdDays;
  });
}
