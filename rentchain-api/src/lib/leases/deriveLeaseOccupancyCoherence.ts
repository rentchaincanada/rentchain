export type LeaseExecutionCoherenceState =
  | "not_started"
  | "in_progress"
  | "executed"
  | "blocked"
  | "unknown";

export type LeaseOperationalCoherenceState =
  | "draft"
  | "pending_execution"
  | "executed_future"
  | "active"
  | "notice_period"
  | "past"
  | "archived"
  | "review_required"
  | "unknown";

export type OccupancyCoherenceState =
  | "occupied"
  | "vacant"
  | "upcoming"
  | "notice_period"
  | "review_required"
  | "unknown";

export type TenantOperationalCoherenceState =
  | "applicant"
  | "pending_activation"
  | "active"
  | "past"
  | "archived"
  | "review_required"
  | "unknown";

export type PaymentReadinessCoherenceState =
  | "not_started"
  | "provider_pending"
  | "provider_paid"
  | "recorded_activity_present"
  | "ready_to_configure"
  | "not_ready"
  | "blocked"
  | "review_required"
  | "unknown";

export type LeaseOccupancyCoherence = {
  coherenceStatus: "coherent" | "review_required" | "unknown";
  coherenceLabel: string;
  coherenceReason: string;
  leaseExecutionState: LeaseExecutionCoherenceState;
  leaseOperationalState: LeaseOperationalCoherenceState;
  occupancyState: OccupancyCoherenceState;
  tenantOperationalState: TenantOperationalCoherenceState;
  paymentReadinessState: PaymentReadinessCoherenceState;
  sourceFields: {
    leaseStatus?: string | null;
    leaseLifecycleState?: string | null;
    leaseExecutionStatus?: string | null;
    unitStatus?: string | null;
    occupancyStatus?: string | null;
    tenancyStatus?: string | null;
    tenantStatus?: string | null;
    tenantLifecycleState?: string | null;
    paymentReadinessStatus?: string | null;
    rentPaymentStatus?: string | null;
    ledgerPaymentCount?: number;
  };
  flags: {
    leaseMarkedActiveBeforeExecution: boolean;
    activeLeaseOnVacantUnit: boolean;
    occupiedUnitWithoutActiveExecutedLease: boolean;
    tenantActiveWithoutExecutedOccupancy: boolean;
    paymentActivityWithoutProviderSetup: boolean;
    hasStateConflict: boolean;
    requiresReview: boolean;
  };
};

type DeriveLeaseOccupancyCoherenceInput = {
  leaseStatus?: unknown;
  leaseLifecycleState?: unknown;
  leaseExecutionStatus?: unknown;
  unitStatus?: unknown;
  occupancyStatus?: unknown;
  tenancyStatus?: unknown;
  tenantStatus?: unknown;
  tenantLifecycleState?: unknown;
  isArchived?: unknown;
  archivedAt?: unknown;
  paymentReadinessStatus?: unknown;
  rentPaymentStatus?: unknown;
  ledgerPaymentCount?: unknown;
};

const ACTIVE_LEASE_STATUSES = new Set([
  "active",
  "current",
  "notice_pending",
  "renewal_pending",
  "renewal_accepted",
  "move_out_pending",
]);
const PAST_LEASE_STATUSES = new Set(["past", "ended", "expired", "terminated"]);
const ARCHIVED_STATUSES = new Set(["archived", "deleted"]);
const NOTICE_STATUSES = new Set(["notice_pending", "move_out_pending", "notice_period", "ending"]);
const ACTIVE_TENANT_STATUSES = new Set(["active", "current"]);
const PAST_TENANT_STATUSES = new Set(["past", "former", "inactive", "ended"]);

function normalize(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function displaySource(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function asCount(value: unknown): number {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
}

function hasValue(value: unknown): boolean {
  return value != null && value !== "";
}

function deriveExecutionState(executionStatus: string): LeaseExecutionCoherenceState {
  if (!executionStatus) return "unknown";
  if (executionStatus === "fully_executed") return "executed";
  if (executionStatus === "blocked") return "blocked";
  if (executionStatus === "draft") return "not_started";
  if (
    [
      "ready_for_tenant_signature",
      "tenant_signed",
      "ready_for_landlord_signature",
      "landlord_signed",
    ].includes(executionStatus)
  ) {
    return "in_progress";
  }
  return "unknown";
}

function deriveLeaseOperationalState(input: {
  leaseStatus: string;
  leaseLifecycleState: string;
  executionState: LeaseExecutionCoherenceState;
  archived: boolean;
}): LeaseOperationalCoherenceState {
  if (input.archived || ARCHIVED_STATUSES.has(input.leaseStatus)) return "archived";
  if (PAST_LEASE_STATUSES.has(input.leaseStatus) || ["expired", "terminated", "cancelled"].includes(input.leaseLifecycleState)) {
    return "past";
  }
  if (input.executionState === "blocked") return "review_required";
  if (input.executionState === "not_started") return "draft";
  if (input.executionState === "in_progress") return "pending_execution";
  if (input.executionState === "executed") {
    if (NOTICE_STATUSES.has(input.leaseStatus) || input.leaseLifecycleState === "notice_period") return "notice_period";
    if (input.leaseLifecycleState === "signed_future") return "executed_future";
    if (ACTIVE_LEASE_STATUSES.has(input.leaseStatus) || input.leaseLifecycleState === "active") return "active";
    return "review_required";
  }
  if (ACTIVE_LEASE_STATUSES.has(input.leaseStatus)) return "review_required";
  return input.leaseStatus || input.leaseLifecycleState ? "unknown" : "unknown";
}

function deriveOccupancyState(input: {
  unitStatus: string;
  occupancyStatus: string;
  tenancyStatus: string;
  leaseOperationalState: LeaseOperationalCoherenceState;
}): OccupancyCoherenceState {
  const occupancy = input.occupancyStatus || input.unitStatus || input.tenancyStatus;
  if (["notice", "notice_pending", "notice_period", "move_out_pending"].includes(occupancy)) return "notice_period";
  if (["vacant", "available"].includes(occupancy)) {
    if (input.leaseOperationalState === "active" || input.leaseOperationalState === "notice_period") return "review_required";
    if (input.leaseOperationalState === "executed_future") return "upcoming";
    return "vacant";
  }
  if (["occupied", "active", "current"].includes(occupancy)) {
    if (input.leaseOperationalState === "active") return "occupied";
    if (input.leaseOperationalState === "notice_period") return "notice_period";
    if (input.leaseOperationalState === "executed_future") return "upcoming";
    return "review_required";
  }
  if (input.leaseOperationalState === "active") return "occupied";
  if (input.leaseOperationalState === "notice_period") return "notice_period";
  if (input.leaseOperationalState === "executed_future") return "upcoming";
  if (input.leaseOperationalState === "past" || input.leaseOperationalState === "archived") return "vacant";
  return "unknown";
}

function deriveTenantOperationalState(input: {
  tenantStatus: string;
  tenantLifecycleState: string;
  leaseOperationalState: LeaseOperationalCoherenceState;
  occupancyState: OccupancyCoherenceState;
  archived: boolean;
}): TenantOperationalCoherenceState {
  if (input.archived || input.tenantLifecycleState === "archived") return "archived";
  if (input.tenantLifecycleState === "applicant") return "applicant";
  if (PAST_TENANT_STATUSES.has(input.tenantStatus) || input.tenantLifecycleState === "past") return "past";
  if (input.leaseOperationalState === "active" && input.occupancyState === "occupied") return "active";
  if (input.leaseOperationalState === "notice_period") return "active";
  if (input.leaseOperationalState === "pending_execution" || input.leaseOperationalState === "executed_future") {
    return "pending_activation";
  }
  if (ACTIVE_TENANT_STATUSES.has(input.tenantStatus) || input.tenantLifecycleState === "active") return "review_required";
  if (input.leaseOperationalState === "past") return "past";
  return "unknown";
}

function derivePaymentState(input: {
  paymentReadinessStatus: string;
  rentPaymentStatus: string;
  ledgerPaymentCount: number;
}): PaymentReadinessCoherenceState {
  if (input.ledgerPaymentCount > 0 && !input.rentPaymentStatus) return "recorded_activity_present";
  if (["checkout_created", "payment_pending"].includes(input.rentPaymentStatus)) return "provider_pending";
  if (input.rentPaymentStatus === "paid") return "provider_paid";
  if (input.paymentReadinessStatus === "ready_to_configure") return "ready_to_configure";
  if (input.paymentReadinessStatus === "not_ready") return "not_ready";
  if (input.paymentReadinessStatus === "blocked") return "blocked";
  if (!input.rentPaymentStatus && input.ledgerPaymentCount === 0) return "not_started";
  return "unknown";
}

export function deriveLeaseOccupancyCoherence(
  input: DeriveLeaseOccupancyCoherenceInput
): LeaseOccupancyCoherence {
  const leaseStatus = normalize(input.leaseStatus);
  const leaseLifecycleState = normalize(input.leaseLifecycleState);
  const leaseExecutionStatus = normalize(input.leaseExecutionStatus);
  const unitStatus = normalize(input.unitStatus);
  const occupancyStatus = normalize(input.occupancyStatus);
  const tenancyStatus = normalize(input.tenancyStatus);
  const tenantStatus = normalize(input.tenantStatus);
  const tenantLifecycleState = normalize(input.tenantLifecycleState);
  const paymentReadinessStatus = normalize(input.paymentReadinessStatus);
  const rentPaymentStatus = normalize(input.rentPaymentStatus);
  const ledgerPaymentCount = asCount(input.ledgerPaymentCount);
  const archived = input.isArchived === true || hasValue(input.archivedAt) || ARCHIVED_STATUSES.has(leaseStatus);

  const leaseExecutionState = deriveExecutionState(leaseExecutionStatus);
  const leaseOperationalState = deriveLeaseOperationalState({
    leaseStatus,
    leaseLifecycleState,
    executionState: leaseExecutionState,
    archived,
  });
  const occupancyState = deriveOccupancyState({
    unitStatus,
    occupancyStatus,
    tenancyStatus,
    leaseOperationalState,
  });
  const tenantOperationalState = deriveTenantOperationalState({
    tenantStatus,
    tenantLifecycleState,
    leaseOperationalState,
    occupancyState,
    archived,
  });
  const paymentReadinessState = derivePaymentState({
    paymentReadinessStatus,
    rentPaymentStatus,
    ledgerPaymentCount,
  });

  const leaseMarkedActiveBeforeExecution =
    ACTIVE_LEASE_STATUSES.has(leaseStatus) &&
    leaseExecutionState !== "executed" &&
    leaseOperationalState !== "archived";
  const activeLeaseOnVacantUnit =
    leaseOperationalState === "active" && ["vacant", "review_required"].includes(occupancyState);
  const occupiedUnitWithoutActiveExecutedLease =
    occupancyState === "review_required" &&
    ["occupied", "active", "current"].includes(occupancyStatus || unitStatus || tenancyStatus) &&
    leaseOperationalState !== "active" &&
    leaseOperationalState !== "notice_period";
  const tenantActiveWithoutExecutedOccupancy =
    (ACTIVE_TENANT_STATUSES.has(tenantStatus) || tenantLifecycleState === "active") &&
    leaseOperationalState !== "active" &&
    leaseOperationalState !== "notice_period";
  const paymentActivityWithoutProviderSetup =
    ledgerPaymentCount > 0 &&
    !rentPaymentStatus &&
    (paymentReadinessStatus === "ready_to_configure" ||
      paymentReadinessStatus === "not_ready" ||
      paymentReadinessStatus === "blocked");

  const hasStateConflict = Boolean(
    leaseMarkedActiveBeforeExecution ||
      activeLeaseOnVacantUnit ||
      occupiedUnitWithoutActiveExecutedLease ||
      tenantActiveWithoutExecutedOccupancy ||
      paymentActivityWithoutProviderSetup ||
      leaseOperationalState === "review_required" ||
      occupancyState === "review_required"
  );
  const requiresReview = hasStateConflict || leaseExecutionState === "blocked";
  const coherenceStatus: LeaseOccupancyCoherence["coherenceStatus"] = requiresReview
    ? "review_required"
    : leaseOperationalState === "unknown" && occupancyState === "unknown" && tenantOperationalState === "unknown"
    ? "unknown"
    : "coherent";

  const coherenceReason = leaseMarkedActiveBeforeExecution
    ? "lease_status_active_but_execution_incomplete"
    : activeLeaseOnVacantUnit
    ? "active_lease_conflicts_with_vacant_occupancy"
    : occupiedUnitWithoutActiveExecutedLease
    ? "occupied_unit_without_active_executed_lease"
    : tenantActiveWithoutExecutedOccupancy
    ? "tenant_active_without_executed_occupancy"
    : paymentActivityWithoutProviderSetup
    ? "ledger_payment_activity_without_provider_payment_setup"
    : coherenceStatus === "coherent"
    ? "states_are_coherent_from_current_read_models"
    : "insufficient_state_signals";

  return {
    coherenceStatus,
    coherenceLabel: coherenceStatus === "review_required" ? "Needs review" : coherenceStatus === "coherent" ? "Coherent" : "Unknown",
    coherenceReason,
    leaseExecutionState,
    leaseOperationalState,
    occupancyState,
    tenantOperationalState,
    paymentReadinessState,
    sourceFields: {
      leaseStatus: displaySource(input.leaseStatus),
      leaseLifecycleState: displaySource(input.leaseLifecycleState),
      leaseExecutionStatus: displaySource(input.leaseExecutionStatus),
      unitStatus: displaySource(input.unitStatus),
      occupancyStatus: displaySource(input.occupancyStatus),
      tenancyStatus: displaySource(input.tenancyStatus),
      tenantStatus: displaySource(input.tenantStatus),
      tenantLifecycleState: displaySource(input.tenantLifecycleState),
      paymentReadinessStatus: displaySource(input.paymentReadinessStatus),
      rentPaymentStatus: displaySource(input.rentPaymentStatus),
      ledgerPaymentCount,
    },
    flags: {
      leaseMarkedActiveBeforeExecution,
      activeLeaseOnVacantUnit,
      occupiedUnitWithoutActiveExecutedLease,
      tenantActiveWithoutExecutedOccupancy,
      paymentActivityWithoutProviderSetup,
      hasStateConflict,
      requiresReview,
    },
  };
}
