export type CanonicalLeaseTermState =
  | "draft"
  | "upcoming"
  | "active"
  | "past"
  | "ended"
  | "terminated"
  | "unknown";

export type CanonicalOccupancyState = "vacant" | "occupied" | "review_needed";
export type CanonicalTenantRelationshipState = "current_occupant" | "past_tenant" | "occupancy_unresolved";

export type CanonicalLeaseConflictReason =
  | "MULTIPLE_CURRENT_LEASES"
  | "INVALID_LEASE_DATE_RANGE"
  | "CURRENT_LEASE_CONTEXT_MISMATCH"
  | "DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY"
  | "UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY"
  | "PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY"
  | "ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY"
  | "LEASE_EXECUTION_INCOMPLETE"
  | "OCCUPIED_WITHOUT_CURRENT_LEASE"
  | "VACANT_WITH_CURRENT_LEASE"
  | "STALE_CURRENT_LEASE_POINTER"
  | "TENANT_CURRENT_WITHOUT_CURRENT_LEASE";

export type CanonicalLeaseStateInput = {
  id: string;
  landlordId?: unknown;
  propertyId?: unknown;
  unitId?: unknown;
  tenantId?: unknown;
  primaryTenantId?: unknown;
  tenantIds?: unknown;
  status?: unknown;
  startDate?: unknown;
  leaseStartDate?: unknown;
  leaseStart?: unknown;
  endDate?: unknown;
  leaseEndDate?: unknown;
  leaseEnd?: unknown;
  executionState?: unknown;
  executionStatus?: unknown;
  endedAt?: unknown;
  terminatedAt?: unknown;
  terminationDate?: unknown;
  successorLeaseId?: unknown;
  renewedByLeaseId?: unknown;
  updatedAt?: unknown;
  createdAt?: unknown;
  occupancyDisposition?: unknown;
};

export type CanonicalLeaseTermResult = {
  state: CanonicalLeaseTermState;
  effectiveStartDate: string | null;
  effectiveEndDate: string | null;
  supportsCurrentOccupancy: boolean;
  reasons: CanonicalLeaseConflictReason[];
};

export type CanonicalLeaseSelectorContext = {
  landlordId?: unknown;
  propertyId?: unknown;
  unitId?: unknown;
  tenantId?: unknown;
  asOfDate?: unknown;
};

export type CanonicalLeaseSelection = {
  lease: CanonicalLeaseStateInput | null;
  lifecycle: CanonicalLeaseTermResult | null;
  candidates: Array<{ lease: CanonicalLeaseStateInput; lifecycle: CanonicalLeaseTermResult }>;
  reasons: CanonicalLeaseConflictReason[];
};

const DRAFT_STATUSES = new Set(["draft", "created", "prepared", "pending", "pending_signature", "sent"]);
const ENDED_STATUSES = new Set(["ended", "expired", "past", "archived", "renewed", "superseded"]);
const TERMINATED_STATUSES = new Set(["terminated", "ended_early", "cancelled", "canceled", "void", "abandoned"]);
const INCOMPLETE_EXECUTION = new Set([
  "draft",
  "not_started",
  "in_progress",
  "ready_for_tenant_signature",
  "tenant_signed",
  "ready_for_landlord_signature",
  "landlord_signed",
]);
const OCCUPIED_STATUSES = new Set(["occupied", "active", "current", "leased", "rented"]);
const VACANT_STATUSES = new Set(["vacant", "available"]);
const PAST_TENANT_STATUSES = new Set(["past", "former", "inactive", "ended", "vacated"]);

function normalize(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function value(value: unknown): string | null {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function firstValue(...values: unknown[]): unknown {
  return values.find((candidate) => candidate != null && candidate !== "");
}

// The existing backend lifecycle contract uses UTC calendar days. Date-only
// values therefore remain active through their named end day and become past
// on the following UTC day, independent of the server's local timezone.
function toUtcDay(valueToParse: unknown): number | null {
  if (valueToParse == null || valueToParse === "") return null;
  let parsed: Date;
  if (valueToParse instanceof Date) parsed = valueToParse;
  else if (typeof valueToParse === "number") parsed = new Date(valueToParse);
  else if (typeof (valueToParse as any)?.toDate === "function") parsed = (valueToParse as any).toDate();
  else if (typeof (valueToParse as any)?.toMillis === "function") parsed = new Date((valueToParse as any).toMillis());
  else if (typeof (valueToParse as any)?.seconds === "number") parsed = new Date((valueToParse as any).seconds * 1000);
  else parsed = new Date(String(valueToParse));
  if (!(parsed instanceof Date) || Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function isoDay(day: number | null): string | null {
  return day == null ? null : new Date(day).toISOString().slice(0, 10);
}

function executionState(input: CanonicalLeaseStateInput): string {
  return normalize(input.executionState || input.executionStatus);
}

export const MULTIPLE_CURRENT_OCCUPANCY_EXCLUSION = "excluded_from_current_occupancy_by_resolution" as const;

export function hasValidCurrentOccupancyExclusion(input: CanonicalLeaseStateInput): boolean {
  const disposition = input.occupancyDisposition;
  if (!disposition || typeof disposition !== "object" || Array.isArray(disposition)) return false;
  const record = disposition as Record<string, unknown>;
  const selectedLeaseId = value(record.selectedLeaseId);
  return normalize(record.status) === MULTIPLE_CURRENT_OCCUPANCY_EXCLUSION
    && normalize(record.reason) === "multiple_current_resolution"
    && Boolean(value(record.resolutionEventId)?.startsWith("occupancy_resolution:"))
    && Boolean(selectedLeaseId)
    && selectedLeaseId !== value(input.id)
    && toUtcDay(record.excludedAt) != null;
}

export function deriveCanonicalLeaseTermState(
  input: CanonicalLeaseStateInput,
  asOfDate: unknown = new Date()
): CanonicalLeaseTermResult {
  const status = normalize(input.status);
  const execution = executionState(input);
  const currentDay = toUtcDay(asOfDate) ?? toUtcDay(new Date())!;
  const startDay = toUtcDay(firstValue(input.startDate, input.leaseStartDate, input.leaseStart));
  const endDay = toUtcDay(firstValue(input.endDate, input.leaseEndDate, input.leaseEnd));
  const terminatedDay = toUtcDay(firstValue(input.terminationDate, input.terminatedAt));

  const base = (state: CanonicalLeaseTermState, reasons: CanonicalLeaseConflictReason[] = []): CanonicalLeaseTermResult => ({
    state,
    effectiveStartDate: isoDay(startDay),
    effectiveEndDate: isoDay(endDay),
    supportsCurrentOccupancy: state === "active" && !INCOMPLETE_EXECUTION.has(execution) && !hasValidCurrentOccupancyExclusion(input),
    reasons,
  });

  if (startDay != null && endDay != null && startDay > endDay) {
    return base("unknown", ["INVALID_LEASE_DATE_RANGE"]);
  }
  if (TERMINATED_STATUSES.has(status) || (terminatedDay != null && terminatedDay <= currentDay)) {
    return base("terminated", ["ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY"]);
  }
  if (ENDED_STATUSES.has(status) || input.endedAt) {
    return base("ended", ["ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY"]);
  }
  if (DRAFT_STATUSES.has(status) || execution === "draft" || execution === "not_started") {
    return base("draft", ["DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY"]);
  }
  if (startDay != null && startDay > currentDay) {
    return base("upcoming", ["UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY"]);
  }
  if (endDay != null && endDay < currentDay) {
    return base("past", ["PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY"]);
  }
  if (startDay == null || endDay == null) return base("unknown");
  if (INCOMPLETE_EXECUTION.has(execution)) return base("active", ["LEASE_EXECUTION_INCOMPLETE"]);
  return base("active");
}

function contextMatches(lease: CanonicalLeaseStateInput, context: CanonicalLeaseSelectorContext): boolean {
  return (["landlordId", "propertyId", "unitId", "tenantId"] as const).every((key) => {
    const expected = value(context[key]);
    if (!expected) return true;
    if (key !== "tenantId") return value(lease[key]) === expected;
    const participants = [lease.tenantId, lease.primaryTenantId, ...(Array.isArray(lease.tenantIds) ? lease.tenantIds : [])]
      .map(value)
      .filter((candidate): candidate is string => Boolean(candidate));
    return new Set(participants).has(expected);
  });
}

function timeValue(valueToParse: unknown): number {
  if (valueToParse == null || valueToParse === "") return 0;
  if (typeof valueToParse === "number" && Number.isFinite(valueToParse)) return valueToParse;
  if (typeof (valueToParse as any)?.toMillis === "function") return Number((valueToParse as any).toMillis()) || 0;
  const parsed = Date.parse(String(valueToParse));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function selectCanonicalCurrentLease(
  leases: CanonicalLeaseStateInput[],
  context: CanonicalLeaseSelectorContext = {}
): CanonicalLeaseSelection {
  const scoped = leases.filter((lease) => contextMatches(lease, context));
  const candidates = scoped
    .map((lease) => ({ lease, lifecycle: deriveCanonicalLeaseTermState(lease, context.asOfDate) }))
    .filter(({ lifecycle }) => lifecycle.supportsCurrentOccupancy)
    .sort((left, right) => {
      const updated = timeValue(right.lease.updatedAt) - timeValue(left.lease.updatedAt);
      if (updated !== 0) return updated;
      const created = timeValue(right.lease.createdAt) - timeValue(left.lease.createdAt);
      if (created !== 0) return created;
      return left.lease.id.localeCompare(right.lease.id);
    });

  if (candidates.length > 1) {
    return { lease: null, lifecycle: null, candidates, reasons: ["MULTIPLE_CURRENT_LEASES"] };
  }
  if (candidates.length === 1) {
    return { lease: candidates[0].lease, lifecycle: candidates[0].lifecycle, candidates, reasons: [] };
  }

  const hasContextMismatch = leases.length > 0 && scoped.length === 0;
  const reasons = hasContextMismatch
    ? (["CURRENT_LEASE_CONTEXT_MISMATCH"] as CanonicalLeaseConflictReason[])
    : Array.from(new Set(scoped.flatMap((lease) => deriveCanonicalLeaseTermState(lease, context.asOfDate).reasons)));
  return { lease: null, lifecycle: null, candidates, reasons };
}

export function evaluateCanonicalOccupancy(input: {
  persistedUnitOccupancy?: unknown;
  persistedTenancyStatus?: unknown;
  currentLeasePointerId?: unknown;
  selection: CanonicalLeaseSelection;
}): { occupancyState: CanonicalOccupancyState; supportingLeaseId: string | null; reasons: CanonicalLeaseConflictReason[] } {
  const unitOccupancy = normalize(input.persistedUnitOccupancy);
  const tenancyStatus = normalize(input.persistedTenancyStatus);
  const persistedOccupied = OCCUPIED_STATUSES.has(unitOccupancy) || OCCUPIED_STATUSES.has(tenancyStatus);
  const persistedVacant = VACANT_STATUSES.has(unitOccupancy) || VACANT_STATUSES.has(tenancyStatus);
  const pointer = value(input.currentLeasePointerId);
  const selectedId = input.selection.lease?.id || null;
  const reasons = [...input.selection.reasons];

  if (pointer && pointer !== selectedId) reasons.push("STALE_CURRENT_LEASE_POINTER");
  if (reasons.includes("MULTIPLE_CURRENT_LEASES")) {
    return { occupancyState: "review_needed", supportingLeaseId: null, reasons: Array.from(new Set(reasons)) };
  }
  if (selectedId && persistedVacant) reasons.push("VACANT_WITH_CURRENT_LEASE");
  if (!selectedId && persistedOccupied) reasons.push("OCCUPIED_WITHOUT_CURRENT_LEASE");
  if (reasons.includes("STALE_CURRENT_LEASE_POINTER") || reasons.includes("VACANT_WITH_CURRENT_LEASE") || reasons.includes("OCCUPIED_WITHOUT_CURRENT_LEASE")) {
    return { occupancyState: "review_needed", supportingLeaseId: selectedId, reasons: Array.from(new Set(reasons)) };
  }
  if (selectedId) return { occupancyState: "occupied", supportingLeaseId: selectedId, reasons: [] };
  return { occupancyState: "vacant", supportingLeaseId: null, reasons: Array.from(new Set(reasons)) };
}

export function evaluateCanonicalTenantRelationship(input: {
  tenantId?: unknown;
  persistedTenantStatus?: unknown;
  currentLeasePointerId?: unknown;
  selection: CanonicalLeaseSelection;
  occupancy: ReturnType<typeof evaluateCanonicalOccupancy>;
}): { relationshipState: CanonicalTenantRelationshipState; supportingLeaseId: string | null; reasons: CanonicalLeaseConflictReason[] } {
  const reasons = [...input.occupancy.reasons];
  const tenantId = value(input.tenantId);
  const selected = input.selection.lease;
  if (selected && tenantId && !contextMatches(selected, { tenantId })) reasons.push("CURRENT_LEASE_CONTEXT_MISMATCH");
  if (input.occupancy.occupancyState === "occupied" && selected && !reasons.length) {
    return { relationshipState: "current_occupant", supportingLeaseId: selected.id, reasons: [] };
  }
  const tenantStatus = normalize(input.persistedTenantStatus);
  if (OCCUPIED_STATUSES.has(tenantStatus) && !selected) reasons.push("TENANT_CURRENT_WITHOUT_CURRENT_LEASE");
  const unresolvedReasons = new Set<CanonicalLeaseConflictReason>([
    "MULTIPLE_CURRENT_LEASES",
    "INVALID_LEASE_DATE_RANGE",
    "CURRENT_LEASE_CONTEXT_MISMATCH",
    "OCCUPIED_WITHOUT_CURRENT_LEASE",
    "VACANT_WITH_CURRENT_LEASE",
    "STALE_CURRENT_LEASE_POINTER",
    "TENANT_CURRENT_WITHOUT_CURRENT_LEASE",
  ]);
  if (reasons.some((reason) => unresolvedReasons.has(reason)) || input.occupancy.occupancyState === "review_needed") {
    return { relationshipState: "occupancy_unresolved", supportingLeaseId: selected?.id || null, reasons: Array.from(new Set(reasons)) };
  }
  if (PAST_TENANT_STATUSES.has(tenantStatus) || !selected) {
    return { relationshipState: "past_tenant", supportingLeaseId: null, reasons: Array.from(new Set(reasons)) };
  }
  return { relationshipState: "occupancy_unresolved", supportingLeaseId: selected.id, reasons };
}
