import { deriveCanonicalLeaseTermState, type CanonicalLeaseStateInput } from "./canonicalLeaseOccupancyState";

export type RenewalContinuityReason =
  | "RENEWAL_LINK_MISSING"
  | "RENEWAL_LINK_CONFLICT"
  | "RENEWAL_CONTEXT_MISMATCH"
  | "RENEWAL_TERM_NOT_CONTIGUOUS"
  | "RENEWAL_TOO_EARLY"
  | "RENEWAL_EXECUTION_INCOMPLETE"
  | "RENEWAL_PARTICIPANTS_MISMATCH"
  | "RENEWAL_PREDECESSOR_NOT_CURRENT"
  | "RENEWAL_SUCCESSOR_INELIGIBLE"
  | "RENEWAL_SUCCESSOR_SUPERSEDED"
  | "MULTIPLE_RENEWAL_SUCCESSORS"
  | "MULTIPLE_CURRENT_LEASES"
  | "RENEWAL_PROJECTION_MISMATCH";

export type RenewalContinuityLease = CanonicalLeaseStateInput & {
  tenantIds?: unknown;
  renewalLeaseId?: unknown;
  replacedByLeaseId?: unknown;
  predecessorLeaseId?: unknown;
  occupancyEffective?: unknown;
  occupancyDisposition?: { status?: unknown } | null;
};

export type RenewalContinuityEvaluation = {
  eligible: boolean;
  reasons: RenewalContinuityReason[];
  predecessorLeaseId: string;
  successorLeaseId: string;
  participantIds: string[];
  effectiveStartDate: string | null;
  predecessorEndDate: string | null;
  contiguous: boolean;
  predecessorCanonicalState: string;
  successorCanonicalState: string;
};

const TERMINAL = new Set(["ended", "terminated", "expired", "archived", "cancelled", "canceled", "void", "superseded"]);

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalized(value: unknown): string {
  return text(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function utcDay(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
}

function isoDay(value: unknown): string | null {
  const day = utcDay(value);
  return day == null ? null : new Date(day).toISOString().slice(0, 10);
}

function participantIds(lease: RenewalContinuityLease): string[] {
  const values = [
    ...(Array.isArray(lease.tenantIds) ? lease.tenantIds : []),
    lease.tenantId,
    lease.primaryTenantId,
  ];
  return [...new Set(values.map(text).filter(Boolean))].sort();
}

function successorLinks(lease: RenewalContinuityLease): string[] {
  return [...new Set([
    lease.renewedByLeaseId,
    lease.renewalLeaseId,
    lease.successorLeaseId,
    lease.replacedByLeaseId,
  ].map(text).filter(Boolean))].sort();
}

/**
 * Returns whether one authoritative lease snapshot participates in the
 * durable renewal-continuity linkage governed by this module. This is link
 * detection only; renewal eligibility remains exclusively owned by
 * evaluateRenewalContinuity().
 */
export function hasRenewalContinuityLink(lease: Record<string, unknown>): boolean {
  return Boolean(
    text(lease.predecessorLeaseId) ||
    successorLinks(lease as RenewalContinuityLease).length > 0
  );
}

function sameValues(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function orderedReasons(reasons: RenewalContinuityReason[]): RenewalContinuityReason[] {
  return [...new Set(reasons)];
}

export function evaluateRenewalContinuity(input: {
  predecessor: RenewalContinuityLease;
  successor: RenewalContinuityLease;
  contextLeases: RenewalContinuityLease[];
  evaluationInstant: unknown;
  standaloneUnit: Record<string, unknown>;
  embeddedUnit: Record<string, unknown>;
  tenant: Record<string, unknown>;
}): RenewalContinuityEvaluation {
  const predecessorId = text(input.predecessor.id);
  const successorId = text(input.successor.id);
  const reasons: RenewalContinuityReason[] = [];
  const links = successorLinks(input.predecessor);
  const inverse = text(input.successor.predecessorLeaseId);
  const predecessorParticipants = participantIds(input.predecessor);
  const successorParticipants = participantIds(input.successor);
  const predecessorTerm = deriveCanonicalLeaseTermState(input.predecessor, input.evaluationInstant);
  const successorTerm = deriveCanonicalLeaseTermState(input.successor, input.evaluationInstant);
  const predecessorEnd = utcDay(input.predecessor.endDate ?? input.predecessor.leaseEndDate ?? input.predecessor.leaseEnd);
  const successorStart = utcDay(input.successor.startDate ?? input.successor.leaseStartDate ?? input.successor.leaseStart);
  const contiguous = predecessorEnd != null && successorStart != null && successorStart === predecessorEnd + 86_400_000;

  if (!predecessorId || !successorId || links.length === 0 || !links.includes(successorId) || !inverse) {
    reasons.push("RENEWAL_LINK_MISSING");
  }
  if (links.length > 1 || (inverse && inverse !== predecessorId)) reasons.push("RENEWAL_LINK_CONFLICT");
  const linkedSuccessors = [input.successor, ...input.contextLeases]
    .filter((lease) => text(lease.predecessorLeaseId) === predecessorId)
    .map((lease) => text(lease.id))
    .filter(Boolean);
  if (new Set(linkedSuccessors).size > 1) reasons.push("MULTIPLE_RENEWAL_SUCCESSORS");
  if (
    text(input.predecessor.landlordId) !== text(input.successor.landlordId) ||
    text(input.predecessor.propertyId) !== text(input.successor.propertyId) ||
    text(input.predecessor.unitId) !== text(input.successor.unitId)
  ) reasons.push("RENEWAL_CONTEXT_MISMATCH");
  if (!contiguous) reasons.push("RENEWAL_TERM_NOT_CONTIGUOUS");
  if (!sameValues(predecessorParticipants, successorParticipants) || successorParticipants.length === 0) {
    reasons.push("RENEWAL_PARTICIPANTS_MISMATCH");
  }
  if (successorTerm.state === "upcoming") reasons.push("RENEWAL_TOO_EARLY");
  if (normalized(input.successor.executionState || input.successor.executionStatus) !== "fully_executed") {
    reasons.push("RENEWAL_EXECUTION_INCOMPLETE");
  }
  if (successorTerm.state !== "active" || TERMINAL.has(normalized(input.successor.status)) || input.successor.occupancyEffective === true ||
      normalized(input.successor.occupancyDisposition?.status) === "excluded_from_current_occupancy_by_resolution") {
    reasons.push("RENEWAL_SUCCESSOR_INELIGIBLE");
  }
  if (successorLinks(input.successor).length > 0) reasons.push("RENEWAL_SUCCESSOR_SUPERSEDED");

  const current = [input.predecessor, input.successor, ...input.contextLeases]
    .filter((lease, index, leases) => leases.findIndex((candidate) => text(candidate.id) === text(lease.id)) === index)
    .filter((lease) => deriveCanonicalLeaseTermState(lease, input.evaluationInstant).supportsCurrentOccupancy)
    .filter((lease) => normalized(lease.executionState || lease.executionStatus) === "fully_executed");
  if (current.length > 1) reasons.push("MULTIPLE_CURRENT_LEASES");
  if (!["active", "past"].includes(predecessorTerm.state) || input.predecessor.occupancyEffective !== true) {
    reasons.push("RENEWAL_PREDECESSOR_NOT_CURRENT");
  }

  const unitPointers = [input.standaloneUnit, input.embeddedUnit].flatMap((unit) => [text(unit.currentLeaseId), text(unit.leaseId)]).filter(Boolean);
  const tenantPointer = text(input.tenant.currentLeaseId);
  if (unitPointers.some((id) => id !== predecessorId) || (tenantPointer && tenantPointer !== predecessorId)) {
    reasons.push("RENEWAL_PROJECTION_MISMATCH");
  }

  return {
    eligible: reasons.length === 0,
    reasons: orderedReasons(reasons),
    predecessorLeaseId: predecessorId,
    successorLeaseId: successorId,
    participantIds: successorParticipants,
    effectiveStartDate: isoDay(input.successor.startDate ?? input.successor.leaseStartDate ?? input.successor.leaseStart),
    predecessorEndDate: isoDay(input.predecessor.endDate ?? input.predecessor.leaseEndDate ?? input.predecessor.leaseEnd),
    contiguous,
    predecessorCanonicalState: predecessorTerm.state,
    successorCanonicalState: successorTerm.state,
  };
}

export function renewalParticipantIds(lease: RenewalContinuityLease): string[] {
  return participantIds(lease);
}

export function renewalSuccessorLinks(lease: RenewalContinuityLease): string[] {
  return successorLinks(lease);
}
