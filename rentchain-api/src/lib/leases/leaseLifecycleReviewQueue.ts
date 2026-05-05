import { deriveLeaseLifecycleState, type LeaseLifecycleResult, type LeaseLifecycleState } from "./leaseLifecycle";

export type LeaseLifecycleReviewSeverity = "info" | "warning" | "critical";

export type LeaseLifecycleReviewCategory =
  | "unknown_lifecycle"
  | "missing_dates"
  | "contradictory_status"
  | "expired_occupancy_conflict"
  | "renewal_ambiguity"
  | "termination_conflict"
  | "notice_conflict";

export type LeaseLifecycleReviewItem = {
  id: string;
  leaseId: string;
  propertyId: string | null;
  unitId: string | null;
  landlordId: string | null;
  tenantId?: string | null;
  derivedLifecycleState: LeaseLifecycleState;
  derivedLifecycleReasons: string[];
  severity: LeaseLifecycleReviewSeverity;
  category: LeaseLifecycleReviewCategory;
  title: string;
  description: string;
  recommendedAction: string;
  createdFrom: "lease_lifecycle_review_queue_v1";
  detectedAt: string;
};

export type LeaseLifecycleReviewQueueResult = {
  items: LeaseLifecycleReviewItem[];
  summary: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
};

export type LeaseLifecycleReviewQueueInput = {
  leases: unknown[];
  units?: unknown[];
  today?: unknown;
  detectedAt?: string;
};

const SEVERITY_RANK: Record<LeaseLifecycleReviewSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

function asString(value: unknown, max = 240): string {
  return String(value || "").trim().slice(0, max);
}

function normalize(value: unknown): string {
  return asString(value).toLowerCase();
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
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDay(value: unknown): number | null {
  const date = toDate(value);
  if (!date) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function todayDay(today: unknown): number {
  return toDay(today) ?? toDay(new Date()) ?? Date.now();
}

function hasAnyDate(...values: unknown[]): boolean {
  return values.some((value) => toDay(value) != null);
}

function hasValue(value: unknown): boolean {
  return asString(value).length > 0;
}

function tenantId(raw: Record<string, unknown>): string | null {
  const fromArray = Array.isArray(raw.tenantIds) ? asString(raw.tenantIds[0]) : "";
  return asString(raw.tenantId || raw.primaryTenantId || fromArray) || null;
}

function criticalDateValues(raw: Record<string, unknown>) {
  return {
    startValue: firstValue(raw.startDate, raw.leaseStartDate, raw.leaseStart),
    endValue: firstValue(raw.endDate, raw.leaseEndDate, raw.leaseEnd),
    terminationValue: firstValue(raw.terminatedAt, raw.terminationDate),
    noticeValue: firstValue(raw.noticeGivenAt, raw.noticeEffectiveDate, raw.noticeDate, raw.noticeAt),
  };
}

function buildUnitLookup(units: unknown[] | undefined) {
  const out = new Map<string, Record<string, unknown>>();
  for (const unit of Array.isArray(units) ? units : []) {
    const raw = (unit || {}) as Record<string, unknown>;
    const keys = [
      raw.id,
      raw.unitId,
      raw.uid,
      raw.unitNumber,
      raw.label,
      raw.name,
      raw.unit,
    ]
      .map((value) => normalize(value))
      .filter(Boolean);
    for (const key of keys) out.set(key, raw);
  }
  return out;
}

function unitForLease(lease: Record<string, unknown>, unitsByKey: Map<string, Record<string, unknown>>) {
  const keys = [lease.unitId, lease.unitNumber, lease.unitLabel, lease.unit]
    .map((value) => normalize(value))
    .filter(Boolean);
  for (const key of keys) {
    const unit = unitsByKey.get(key);
    if (unit) return unit;
  }
  return null;
}

function hasManualOccupant(unit: Record<string, unknown> | null): boolean {
  if (!unit) return false;
  if (hasValue(unit.occupantName) || hasValue(unit.tenantName)) return true;
  return Array.isArray(unit.occupants) && unit.occupants.some((value) => hasValue(value));
}

function hasCurrentManualOccupancy(unit: Record<string, unknown> | null, today: unknown): boolean {
  if (!unit) return false;
  const status = normalize(unit.occupancyStatus || unit.status);
  if (status !== "occupied") return false;
  if (!hasManualOccupant(unit)) return false;
  const endDay = toDay(firstValue(unit.leaseEndDate, unit.leaseEnd));
  return endDay != null && endDay >= todayDay(today);
}

function hasRenewalAmbiguity(raw: Record<string, unknown>) {
  const links = [raw.renewalLeaseId, raw.renewedByLeaseId, raw.successorLeaseId, raw.replacedByLeaseId]
    .map((value) => asString(value))
    .filter(Boolean);
  if (links.length > 1 && new Set(links).size > 1) return true;
  return Boolean((raw.renewalLeaseId || raw.successorLeaseId || raw.replacedByLeaseId) && raw.hasRenewalLease === false);
}

function hasTerminationConflict(raw: Record<string, unknown>, lifecycle: LeaseLifecycleResult, today: unknown) {
  const status = normalize(raw.status);
  const terminationDate = toDay(firstValue(raw.terminatedAt, raw.terminationDate));
  if (terminationDate != null && (lifecycle.state === "active" || lifecycle.state === "notice_period")) return true;
  return (status === "active" || status === "current") && terminationDate != null && terminationDate > todayDay(today);
}

function hasNoticeConflict(raw: Record<string, unknown>, lifecycle: LeaseLifecycleResult) {
  const status = normalize(raw.status);
  const noticeExists = hasAnyDate(raw.noticeGivenAt, raw.noticeEffectiveDate, raw.noticeDate, raw.noticeAt, raw.moveOutDate);
  if (!noticeExists) return false;
  if (lifecycle.state === "terminated" || lifecycle.state === "cancelled" || lifecycle.state === "renewed") return true;
  return status === "expired";
}

function hasMissingDates(raw: Record<string, unknown>, lifecycle: LeaseLifecycleResult) {
  const { startValue, endValue } = criticalDateValues(raw);
  const status = normalize(raw.status);
  const needsDates =
    lifecycle.state === "active" ||
    lifecycle.state === "notice_period" ||
    lifecycle.state === "signed_future" ||
    status === "active" ||
    status === "current";
  return needsDates && (!toDay(startValue) || !toDay(endValue));
}

function classifyReviewItem(params: {
  raw: Record<string, unknown>;
  lifecycle: LeaseLifecycleResult;
  unit: Record<string, unknown> | null;
  today: unknown;
}): Omit<LeaseLifecycleReviewItem, "id" | "leaseId" | "propertyId" | "unitId" | "landlordId" | "tenantId" | "derivedLifecycleState" | "derivedLifecycleReasons" | "createdFrom" | "detectedAt"> | null {
  const { raw, lifecycle, unit, today } = params;
  const status = normalize(raw.status);
  const { startValue, endValue, terminationValue, noticeValue } = criticalDateValues(raw);

  if (lifecycle.state === "unknown" || lifecycle.requiresReview) {
    return {
      severity: "critical",
      category: "unknown_lifecycle",
      title: "Lease lifecycle needs review",
      description: "Canonical lifecycle derivation could not safely classify this lease.",
      recommendedAction: "Open lease record",
    };
  }

  if (toDay(startValue) != null && toDay(endValue) != null && toDay(startValue)! > toDay(endValue)!) {
    return {
      severity: "critical",
      category: "contradictory_status",
      title: "Lease date range is invalid",
      description: "The lease start date is after the lease end date.",
      recommendedAction: "Review lease dates",
    };
  }

  if (hasMissingDates(raw, lifecycle)) {
    return {
      severity: "critical",
      category: "missing_dates",
      title: "Lease is missing critical dates",
      description: "The lease appears current or signed but is missing a usable start or end date.",
      recommendedAction: "Review lease dates",
    };
  }

  if ((status === "active" || status === "current") && lifecycle.state === "expired") {
    if (hasCurrentManualOccupancy(unit, today)) {
      return {
        severity: "warning",
        category: "expired_occupancy_conflict",
        title: "Expired lease conflicts with manual occupancy",
        description: "The lease is expired, but the unit has current manual occupied data.",
        recommendedAction: "Confirm occupancy manually",
      };
    }
    return {
      severity: "warning",
      category: "contradictory_status",
      title: "Stored lease status conflicts with end date",
      description: "Stored status appears active, but the canonical lifecycle is expired.",
      recommendedAction: "Review lease dates",
    };
  }

  if (hasRenewalAmbiguity(raw)) {
    return {
      severity: "warning",
      category: "renewal_ambiguity",
      title: "Renewal or successor link is ambiguous",
      description: "The lease has multiple or incomplete renewal/successor signals.",
      recommendedAction: "Review renewal link",
    };
  }

  if (hasTerminationConflict(raw, lifecycle, today) || (toDay(terminationValue) != null && toDay(noticeValue) != null && lifecycle.state === "active")) {
    return {
      severity: "warning",
      category: "termination_conflict",
      title: "Termination data needs review",
      description: "Termination fields conflict with the current lifecycle interpretation.",
      recommendedAction: "Review termination notice",
    };
  }

  if (hasNoticeConflict(raw, lifecycle)) {
    return {
      severity: "info",
      category: "notice_conflict",
      title: "Notice data needs review",
      description: "Notice or move-out fields conflict with the current lifecycle interpretation.",
      recommendedAction: "Review termination notice",
    };
  }

  return null;
}

export function deriveLeaseLifecycleReviewItem(input: {
  lease: unknown;
  unit?: unknown;
  today?: unknown;
  detectedAt?: string;
}): LeaseLifecycleReviewItem | null {
  const raw = (input.lease || {}) as Record<string, unknown>;
  const leaseId = asString(raw.id || raw.leaseId);
  if (!leaseId) return null;
  const today = input.today ?? new Date();
  const lifecycle = deriveLeaseLifecycleState({ id: leaseId, ...(raw as any) }, today);
  const classification = classifyReviewItem({
    raw,
    lifecycle,
    unit: input.unit ? ((input.unit || {}) as Record<string, unknown>) : null,
    today,
  });
  if (!classification) return null;

  return {
    id: `lease_lifecycle:${leaseId}:${classification.category}`,
    leaseId,
    propertyId: asString(raw.propertyId) || null,
    unitId: asString(raw.unitId) || null,
    landlordId: asString(raw.landlordId) || null,
    tenantId: tenantId(raw),
    derivedLifecycleState: lifecycle.state,
    derivedLifecycleReasons: lifecycle.reasons,
    ...classification,
    createdFrom: "lease_lifecycle_review_queue_v1",
    detectedAt: input.detectedAt || new Date().toISOString(),
  };
}

export function deriveLeaseLifecycleReviewQueue(input: LeaseLifecycleReviewQueueInput): LeaseLifecycleReviewQueueResult {
  const unitsByKey = buildUnitLookup(input.units);
  const items = (Array.isArray(input.leases) ? input.leases : [])
    .map((lease) => {
      const raw = (lease || {}) as Record<string, unknown>;
      return deriveLeaseLifecycleReviewItem({
        lease,
        unit: unitForLease(raw, unitsByKey) || undefined,
        today: input.today,
        detectedAt: input.detectedAt,
      });
    })
    .filter(Boolean) as LeaseLifecycleReviewItem[];

  items.sort((a, b) => {
    const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severityDiff !== 0) return severityDiff;
    const dateDiff = String(b.detectedAt).localeCompare(String(a.detectedAt));
    if (dateDiff !== 0) return dateDiff;
    return a.id.localeCompare(b.id);
  });

  return {
    items,
    summary: {
      total: items.length,
      critical: items.filter((item) => item.severity === "critical").length,
      warning: items.filter((item) => item.severity === "warning").length,
      info: items.filter((item) => item.severity === "info").length,
    },
  };
}
