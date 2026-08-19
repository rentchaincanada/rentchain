import {
  deriveCanonicalLeaseTermState,
  type CanonicalLeaseConflictReason,
  type CanonicalLeaseStateInput,
} from "./canonicalLeaseOccupancyState";

export type CanonicalLeaseStartOutcome =
  | "created_without_occupancy"
  | "occupancy_effective"
  | "already_coherent"
  | "rejected";

export type CanonicalLeaseStartUnitInput = {
  id?: unknown;
  landlordId?: unknown;
  propertyId?: unknown;
  status?: unknown;
  occupancyStatus?: unknown;
  tenantId?: unknown;
  currentTenantId?: unknown;
  leaseId?: unknown;
  currentLeaseId?: unknown;
  occupied?: unknown;
  isOccupied?: unknown;
};

export type CanonicalLeaseStartTenantInput = {
  id?: unknown;
  landlordId?: unknown;
  currentLeaseId?: unknown;
  status?: unknown;
};

export type CanonicalLeaseStartTenancyInput = {
  id: string;
  landlordId?: unknown;
  propertyId?: unknown;
  unitId?: unknown;
  tenantId?: unknown;
  leaseId?: unknown;
  status?: unknown;
  moveInAt?: unknown;
  moveOutAt?: unknown;
};

export type CanonicalLeaseStartInput = {
  landlordId: unknown;
  propertyId: unknown;
  unitId: unknown;
  tenantId: unknown;
  evaluationInstant: unknown;
  candidateLease: CanonicalLeaseStateInput & { tenantIds?: unknown };
  contextLeases: CanonicalLeaseStateInput[];
  standaloneUnits: CanonicalLeaseStartUnitInput[];
  embeddedUnits: CanonicalLeaseStartUnitInput[];
  tenant: CanonicalLeaseStartTenantInput | null;
  tenancies: CanonicalLeaseStartTenancyInput[];
};

export type CanonicalLeaseStartUnitPostcondition = {
  status: "occupied";
  occupancyStatus: "occupied";
  tenantId: string;
  currentTenantId: string;
  leaseId: string;
  currentLeaseId: string;
  occupancySource: "canonical_lease_start";
  occupancyUpdatedAt: string;
  updatedAt: string;
  occupied?: true;
  isOccupied?: true;
};

export type CanonicalLeaseStartPostcondition = {
  lease: { id: string; occupancyEffective: true };
  embeddedPropertyUnit: CanonicalLeaseStartUnitPostcondition;
  standaloneUnit: CanonicalLeaseStartUnitPostcondition;
  tenant: { id: string; currentLeaseId: string; status: "current" };
  tenancy: {
    action: "create" | "reuse" | "reconcile";
    id: string | null;
    landlordId: string;
    propertyId: string;
    unitId: string;
    tenantId: string;
    leaseId: string;
    status: "active";
    moveInAt: string;
  };
  canonicalEvent: { type: "lease.occupancy_started"; leaseId: string; occurredAt: string };
  idempotencyResult: { operation: "canonical_lease_start"; leaseId: string };
};

export type CanonicalLeaseStartContext = {
  evaluationInstant: string;
  candidateLeaseId: string | null;
  eligibleCurrentLeaseIds: string[];
  standaloneUnitIds: string[];
  embeddedUnitIds: string[];
  tenancyIds: string[];
};

export type CanonicalLeaseStartResult = {
  outcome: CanonicalLeaseStartOutcome;
  occupancyEffective: boolean;
  reasons: CanonicalLeaseConflictReason[];
  postcondition: CanonicalLeaseStartPostcondition | null;
  context: CanonicalLeaseStartContext;
};

const REASON_ORDER: CanonicalLeaseConflictReason[] = [
  "INVALID_LEASE_DATE_RANGE",
  "CURRENT_LEASE_CONTEXT_MISMATCH",
  "DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY",
  "UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY",
  "PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY",
  "ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY",
  "LEASE_EXECUTION_INCOMPLETE",
  "MULTIPLE_CURRENT_LEASES",
  "OCCUPIED_WITHOUT_CURRENT_LEASE",
  "VACANT_WITH_CURRENT_LEASE",
  "STALE_CURRENT_LEASE_POINTER",
  "TENANT_CURRENT_WITHOUT_CURRENT_LEASE",
];
const OCCUPIED = new Set(["occupied", "active", "current", "leased", "rented"]);
const ACTIVE_TENANCY = new Set(["active", "current", "occupied"]);

function text(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function state(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function explicitInstant(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function orderedReasons(reasons: CanonicalLeaseConflictReason[]): CanonicalLeaseConflictReason[] {
  const unique = new Set(reasons);
  return REASON_ORDER.filter((reason) => unique.has(reason));
}

function idMatches(value: unknown, expected: string): boolean {
  return text(value) === expected;
}

function canonicalParty(lease: CanonicalLeaseStartInput["candidateLease"], tenantId: string): boolean {
  if (idMatches(lease.tenantId, tenantId)) return true;
  return Array.isArray(lease.tenantIds) && lease.tenantIds.some((id) => idMatches(id, tenantId));
}

function isAffirmativelyExecuted(lease: CanonicalLeaseStateInput): boolean {
  return state(lease.executionState || lease.executionStatus) === "fully_executed";
}

function sameContext(lease: CanonicalLeaseStateInput, landlordId: string, propertyId: string, unitId: string): boolean {
  return idMatches(lease.landlordId, landlordId) && idMatches(lease.propertyId, propertyId) && idMatches(lease.unitId, unitId);
}

function isOccupied(unit: CanonicalLeaseStartUnitInput): boolean {
  return OCCUPIED.has(state(unit.occupancyStatus)) || OCCUPIED.has(state(unit.status)) || unit.occupied === true || unit.isOccupied === true;
}

function pointerConflict(unit: CanonicalLeaseStartUnitInput, leaseId: string, tenantId: string): boolean {
  const leasePointers = [text(unit.leaseId), text(unit.currentLeaseId)].filter(Boolean) as string[];
  const tenantPointers = [text(unit.tenantId), text(unit.currentTenantId)].filter(Boolean) as string[];
  return leasePointers.some((id) => id !== leaseId) || tenantPointers.some((id) => id !== tenantId);
}

function occupiedWithoutTenantIdentity(unit: CanonicalLeaseStartUnitInput, tenantId: string): boolean {
  if (!isOccupied(unit)) return false;
  return ![text(unit.tenantId), text(unit.currentTenantId)].some((id) => id === tenantId);
}

function unitCoherent(unit: CanonicalLeaseStartUnitInput, leaseId: string, tenantId: string): boolean {
  return state(unit.status) === "occupied" && state(unit.occupancyStatus) === "occupied" &&
    idMatches(unit.tenantId, tenantId) && idMatches(unit.currentTenantId, tenantId) &&
    idMatches(unit.leaseId, leaseId) && idMatches(unit.currentLeaseId, leaseId);
}

export function evaluateCanonicalLeaseStart(input: CanonicalLeaseStartInput): CanonicalLeaseStartResult {
  const landlordId = text(input.landlordId);
  const propertyId = text(input.propertyId);
  const unitId = text(input.unitId);
  const tenantId = text(input.tenantId);
  const leaseId = text(input.candidateLease?.id);
  const instant = explicitInstant(input.evaluationInstant);
  const context: CanonicalLeaseStartContext = {
    evaluationInstant: instant || "",
    candidateLeaseId: leaseId,
    eligibleCurrentLeaseIds: [],
    standaloneUnitIds: input.standaloneUnits.map((unit) => text(unit.id) || "").sort(),
    embeddedUnitIds: input.embeddedUnits.map((unit) => text(unit.id) || "").sort(),
    tenancyIds: input.tenancies.map((tenancy) => tenancy.id).sort(),
  };
  const result = (
    outcome: CanonicalLeaseStartOutcome,
    reasons: CanonicalLeaseConflictReason[] = [],
    postcondition: CanonicalLeaseStartPostcondition | null = null
  ): CanonicalLeaseStartResult => ({ outcome, occupancyEffective: outcome === "occupancy_effective" || outcome === "already_coherent", reasons: orderedReasons(reasons), postcondition, context });

  if (!landlordId || !propertyId || !unitId || !tenantId || !leaseId || !instant) {
    return result("rejected", ["CURRENT_LEASE_CONTEXT_MISMATCH"]);
  }
  if (!sameContext(input.candidateLease, landlordId, propertyId, unitId) || !idMatches(input.candidateLease.tenantId, tenantId) ||
      !input.tenant || !idMatches(input.tenant.id, tenantId) || !idMatches(input.tenant.landlordId, landlordId)) {
    return result("rejected", ["CURRENT_LEASE_CONTEXT_MISMATCH"]);
  }
  if (input.standaloneUnits.length !== 1 || input.embeddedUnits.length !== 1) {
    return result("rejected", ["CURRENT_LEASE_CONTEXT_MISMATCH"]);
  }
  const standalone = input.standaloneUnits[0];
  const embedded = input.embeddedUnits[0];
  if (!idMatches(standalone.id, unitId) || !idMatches(standalone.landlordId, landlordId) || !idMatches(standalone.propertyId, propertyId) ||
      !idMatches(embedded.id, unitId) || !idMatches(embedded.landlordId, landlordId) || !idMatches(embedded.propertyId, propertyId)) {
    return result("rejected", ["CURRENT_LEASE_CONTEXT_MISMATCH"]);
  }

  const lifecycle = deriveCanonicalLeaseTermState(input.candidateLease, instant);
  if (lifecycle.reasons.includes("INVALID_LEASE_DATE_RANGE") || lifecycle.state === "unknown") {
    return result("rejected", lifecycle.reasons.length ? lifecycle.reasons : ["INVALID_LEASE_DATE_RANGE"]);
  }
  if (["draft", "upcoming", "past", "ended", "terminated"].includes(lifecycle.state)) {
    return result("created_without_occupancy", lifecycle.reasons);
  }
  if (!isAffirmativelyExecuted(input.candidateLease)) {
    return result("created_without_occupancy", ["LEASE_EXECUTION_INCOMPLETE"]);
  }
  if (!canonicalParty(input.candidateLease, tenantId)) {
    return result("rejected", ["CURRENT_LEASE_CONTEXT_MISMATCH"]);
  }

  const eligible = [input.candidateLease, ...input.contextLeases]
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .filter((lease, index, leases) => leases.findIndex((candidate) => candidate.id === lease.id) === index)
    .filter((lease) => sameContext(lease, landlordId, propertyId, unitId))
    .filter((lease) => deriveCanonicalLeaseTermState(lease, instant).state === "active" && isAffirmativelyExecuted(lease))
    .map((lease) => lease.id)
    .sort();
  context.eligibleCurrentLeaseIds = eligible;
  if (eligible.length !== 1 || eligible[0] !== leaseId) {
    return result("rejected", eligible.length > 1 ? ["MULTIPLE_CURRENT_LEASES"] : ["CURRENT_LEASE_CONTEXT_MISMATCH"]);
  }

  if ((isOccupied(standalone) && pointerConflict(standalone, leaseId, tenantId)) ||
      (isOccupied(embedded) && pointerConflict(embedded, leaseId, tenantId))) {
    return result("rejected", ["OCCUPIED_WITHOUT_CURRENT_LEASE", "STALE_CURRENT_LEASE_POINTER"]);
  }
  if (occupiedWithoutTenantIdentity(standalone, tenantId) || occupiedWithoutTenantIdentity(embedded, tenantId)) {
    return result("rejected", ["OCCUPIED_WITHOUT_CURRENT_LEASE"]);
  }
  if (pointerConflict(standalone, leaseId, tenantId) || pointerConflict(embedded, leaseId, tenantId)) {
    return result("rejected", ["STALE_CURRENT_LEASE_POINTER"]);
  }
  const tenantPointer = text(input.tenant.currentLeaseId);
  if (tenantPointer && tenantPointer !== leaseId) return result("rejected", ["STALE_CURRENT_LEASE_POINTER"]);

  const relevantTenancies = input.tenancies.filter((tenancy) => idMatches(tenancy.tenantId, tenantId) && idMatches(tenancy.propertyId, propertyId) && idMatches(tenancy.unitId, unitId));
  const unrelatedActive = input.tenancies.some((tenancy) => ACTIVE_TENANCY.has(state(tenancy.status)) && !relevantTenancies.includes(tenancy));
  const active = relevantTenancies.filter((tenancy) => ACTIVE_TENANCY.has(state(tenancy.status)) && !text(tenancy.moveOutAt));
  if (unrelatedActive || active.length > 1 || relevantTenancies.length > 1) {
    return result("rejected", ["CURRENT_LEASE_CONTEXT_MISMATCH"]);
  }
  const tenancy = active[0] || relevantTenancies[0] || null;
  if (tenancy && (!idMatches(tenancy.landlordId, landlordId) || (text(tenancy.leaseId) && !idMatches(tenancy.leaseId, leaseId)))) {
    return result("rejected", ["CURRENT_LEASE_CONTEXT_MISMATCH"]);
  }

  const tenancyCoherent = Boolean(tenancy && active.length === 1 && idMatches(tenancy.leaseId, leaseId));
  if (unitCoherent(standalone, leaseId, tenantId) && unitCoherent(embedded, leaseId, tenantId) && tenantPointer === leaseId && tenancyCoherent) {
    return result("already_coherent");
  }

  const unitDesired = (unit: CanonicalLeaseStartUnitInput): CanonicalLeaseStartUnitPostcondition => ({
    status: "occupied",
    occupancyStatus: "occupied",
    tenantId,
    currentTenantId: tenantId,
    leaseId,
    currentLeaseId: leaseId,
    occupancySource: "canonical_lease_start",
    occupancyUpdatedAt: instant,
    updatedAt: instant,
    ...(Object.prototype.hasOwnProperty.call(unit, "occupied") ? { occupied: true as const } : {}),
    ...(Object.prototype.hasOwnProperty.call(unit, "isOccupied") ? { isOccupied: true as const } : {}),
  });
  const verifiedMoveInAt = tenancy ? explicitInstant(tenancy.moveInAt) : null;
  const postcondition: CanonicalLeaseStartPostcondition = {
    lease: { id: leaseId, occupancyEffective: true },
    embeddedPropertyUnit: unitDesired(embedded),
    standaloneUnit: unitDesired(standalone),
    tenant: { id: tenantId, currentLeaseId: leaseId, status: "current" },
    tenancy: {
      action: !tenancy ? "create" : active.length === 1 ? "reuse" : "reconcile",
      id: tenancy?.id || null,
      landlordId,
      propertyId,
      unitId,
      tenantId,
      leaseId,
      status: "active",
      moveInAt: verifiedMoveInAt && verifiedMoveInAt < instant ? verifiedMoveInAt : instant,
    },
    canonicalEvent: { type: "lease.occupancy_started", leaseId, occurredAt: instant },
    idempotencyResult: { operation: "canonical_lease_start", leaseId },
  };
  return result("occupancy_effective", [], postcondition);
}
