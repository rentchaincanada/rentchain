import { db } from "../../firebase";
import {
  evaluateRenewalContinuity,
  renewalParticipantIds,
  renewalSuccessorLinks,
  type RenewalContinuityEvaluation,
  type RenewalContinuityLease,
} from "../../lib/leases/renewalContinuity";
import { leaseStartDeterministicId, leaseStartHash } from "./leaseStartExpectedState";

export type RenewalContinuityContext = {
  expectedStateToken: string;
  evaluationInstant: string;
  predecessorLeaseId: string;
  successorLeaseId: string;
  propertyId: string;
  unitId: string;
  participantIds: string[];
  predecessorCanonicalState: string;
  successorCanonicalState: string;
  termContinuity: boolean;
  executionReady: boolean;
  handoffEligible: boolean;
  blockingReasons: RenewalContinuityEvaluation["reasons"];
};

export type RenewalContinuityResult = {
  outcome: "renewal_handoff_completed" | "idempotent_replay";
  predecessorLeaseId: string;
  successorLeaseId: string;
  expectedStateToken: string;
  auditEventIds: string[];
  idempotency: { key: string; replay: boolean; resultId: string };
};

export type RenewalContinuityErrorCode =
  | "renewal_context_ambiguous"
  | "renewal_handoff_ineligible"
  | "renewal_state_stale"
  | "renewal_idempotency_key_reused"
  | "renewal_postcondition_failed";

export class RenewalContinuityServiceError extends Error {
  constructor(
    public code: RenewalContinuityErrorCode,
    public freshContext?: RenewalContinuityContext,
    public reasons: RenewalContinuityEvaluation["reasons"] = []
  ) {
    super(code);
  }
}

type RenewalContextInput = {
  landlordId: string;
  successorLeaseId: string;
  evaluationInstant: string;
  firestore?: any;
};

type RenewalHandoffInput = RenewalContextInput & {
  expectedStateToken: string;
  idempotencyKey: string;
  actorId: string;
  source: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function state(value: unknown): string {
  return text(value).toLowerCase().replace(/[\s-]+/g, "_");
}

function instant(value: unknown): string | null {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function docData(snapshot: any): any {
  return snapshot?.exists ? { id: snapshot.id, ...(snapshot.data() || {}) } : null;
}

function matchesEmbeddedUnit(unit: any, unitId: string, unitNumber: string): boolean {
  return [unit?.id, unit?.unitId, unit?.unitNumber].map(text).includes(unitId) || (Boolean(unitNumber) && text(unit?.unitNumber) === unitNumber);
}

function canonicalLease(lease: any): RenewalContinuityLease {
  return {
    ...lease,
    id: text(lease?.id),
    executionState: lease?.executionState || lease?.executionStatus || lease?.leaseExecutionState || lease?.leaseExecution?.executionStatus,
    executionStatus: lease?.executionStatus || lease?.executionState || lease?.leaseExecutionState || lease?.leaseExecution?.executionStatus,
  };
}

function contextToken(records: any, evaluation: RenewalContinuityEvaluation, evaluationInstant: string): string {
  const tenancyMaterial = records.tenancies.map((tenancy: any) => ({
    id: tenancy.id,
    landlordId: tenancy.landlordId ?? null,
    propertyId: tenancy.propertyId ?? null,
    unitId: tenancy.unitId ?? null,
    tenantId: tenancy.tenantId ?? null,
    leaseId: tenancy.leaseId ?? null,
    status: tenancy.status ?? null,
    moveOutAt: tenancy.moveOutAt ?? null,
    updatedAt: tenancy.updatedAt ?? null,
  })).sort((left: any, right: any) => left.id.localeCompare(right.id));
  return leaseStartHash({
    version: "renewal_continuity_expected_state_v1",
    evaluationInstant,
    evaluation,
    predecessor: records.predecessor,
    successor: records.successor,
    contextLeases: records.contextLeases,
    unit: records.unit,
    embedded: records.embedded,
    tenant: records.tenant,
    tenancies: tenancyMaterial,
    propertyUpdatedAt: records.property.updatedAt ?? null,
  });
}

async function readRenewalContext(reader: any, input: RenewalContextInput) {
  const firestore = input.firestore || db;
  const successorRef = firestore.collection("leases").doc(input.successorLeaseId);
  const get = (target: any) => reader?.get ? reader.get(target) : target.get();
  const successorSnap = await get(successorRef);
  const successor = canonicalLease(docData(successorSnap));
  if (!successor.id || text(successor.landlordId) !== input.landlordId) throw new RenewalContinuityServiceError("renewal_context_ambiguous");
  const predecessorId = text(successor.predecessorLeaseId);
  if (!predecessorId) throw new RenewalContinuityServiceError("renewal_context_ambiguous", undefined, ["RENEWAL_LINK_MISSING"]);

  const propertyId = text(successor.propertyId);
  const unitId = text(successor.unitId);
  if (!propertyId || !unitId) throw new RenewalContinuityServiceError("renewal_context_ambiguous");
  const predecessorRef = firestore.collection("leases").doc(predecessorId);
  const propertyRef = firestore.collection("properties").doc(propertyId);
  const unitRef = firestore.collection("units").doc(unitId);
  const leasesQuery = firestore.collection("leases").where("landlordId", "==", input.landlordId).where("propertyId", "==", propertyId);
  const tenanciesQuery = firestore.collection("tenancies").where("propertyId", "==", propertyId);
  const [predecessorSnap, propertySnap, unitSnap, leasesSnap, tenanciesSnap] = await Promise.all([
    get(predecessorRef), get(propertyRef), get(unitRef), get(leasesQuery), get(tenanciesQuery),
  ]);
  const predecessor = canonicalLease(docData(predecessorSnap));
  const property = docData(propertySnap);
  const unit = docData(unitSnap);
  if (!predecessor.id || !property || !unit || text(predecessor.landlordId) !== input.landlordId ||
      text(property.landlordId || property.ownerId || property.owner) !== input.landlordId ||
      text(unit.landlordId) !== input.landlordId || text(unit.propertyId) !== propertyId) {
    throw new RenewalContinuityServiceError("renewal_context_ambiguous");
  }

  const unitNumber = text(unit.unitNumber);
  const embeddedUnits = Array.isArray(property.units) ? property.units : [];
  const embeddedMatches = embeddedUnits.map((entry: any, index: number) => ({ entry, index }))
    .filter(({ entry }: any) => matchesEmbeddedUnit(entry, unitId, unitNumber));
  if (embeddedMatches.length !== 1) throw new RenewalContinuityServiceError("renewal_context_ambiguous");
  const embedded = { ...embeddedMatches[0].entry, id: text(embeddedMatches[0].entry.id || embeddedMatches[0].entry.unitId || unitId) };
  const contextLeases = (leasesSnap.docs || []).map(docData).filter((lease: any) => lease && text(lease.unitId) === unitId)
    .map(canonicalLease).filter((lease: RenewalContinuityLease) => lease.id !== predecessorId && lease.id !== input.successorLeaseId);
  const participantIds = renewalParticipantIds(successor);
  const pointerIds = [unit.currentTenantId, unit.tenantId, embedded.currentTenantId, embedded.tenantId].map(text).filter(Boolean);
  const occupantIds = [...new Set(pointerIds)];
  if (occupantIds.length !== 1 || !participantIds.includes(occupantIds[0])) throw new RenewalContinuityServiceError("renewal_context_ambiguous");
  const tenantId = occupantIds[0];
  const tenantRef = firestore.collection("tenants").doc(tenantId);
  const tenantSnap = await get(tenantRef);
  const tenant = docData(tenantSnap);
  if (!tenant || text(tenant.landlordId) !== input.landlordId) throw new RenewalContinuityServiceError("renewal_context_ambiguous");
  const tenancies = (tenanciesSnap.docs || []).map(docData).filter((tenancy: any) => tenancy && text(tenancy.unitId) === unitId);
  const evaluation = evaluateRenewalContinuity({ predecessor, successor, contextLeases, evaluationInstant: input.evaluationInstant, standaloneUnit: unit, embeddedUnit: embedded, tenant });
  const records = {
    predecessorRef, successorRef, propertyRef, unitRef, tenantRef, predecessor, successor, property, unit, embedded,
    embeddedUnits, embeddedIndex: embeddedMatches[0].index, contextLeases, tenant, tenantId, tenancies,
  };
  const context: RenewalContinuityContext = {
    expectedStateToken: contextToken(records, evaluation, input.evaluationInstant),
    evaluationInstant: input.evaluationInstant,
    predecessorLeaseId: predecessorId,
    successorLeaseId: input.successorLeaseId,
    propertyId,
    unitId,
    participantIds,
    predecessorCanonicalState: evaluation.predecessorCanonicalState,
    successorCanonicalState: evaluation.successorCanonicalState,
    termContinuity: evaluation.contiguous,
    executionReady: state(successor.executionState || successor.executionStatus) === "fully_executed",
    handoffEligible: evaluation.eligible,
    blockingReasons: evaluation.reasons,
  };
  return { context, records, evaluation };
}

export async function getRenewalContinuityContext(input: RenewalContextInput): Promise<RenewalContinuityContext> {
  const evaluationInstant = instant(input.evaluationInstant);
  if (!evaluationInstant) throw new RenewalContinuityServiceError("renewal_context_ambiguous");
  return (await readRenewalContext(input.firestore || db, { ...input, evaluationInstant })).context;
}

export async function handoffRenewalContinuity(input: RenewalHandoffInput): Promise<RenewalContinuityResult> {
  const firestore = input.firestore || db;
  const evaluationInstant = instant(input.evaluationInstant);
  if (!evaluationInstant || !text(input.idempotencyKey) || input.idempotencyKey.length > 160 || !text(input.expectedStateToken)) {
    throw new RenewalContinuityServiceError("renewal_state_stale");
  }
  const requestId = leaseStartDeterministicId("renewal_handoff", [input.landlordId, input.idempotencyKey]);
  const requestRef = firestore.collection("leaseStartRequests").doc(requestId);
  const payloadHash = leaseStartHash({
    landlordId: input.landlordId,
    successorLeaseId: input.successorLeaseId,
    expectedStateToken: input.expectedStateToken,
    idempotencyKey: input.idempotencyKey,
    actorId: input.actorId,
    source: input.source,
    evaluationInstant,
  });

  return firestore.runTransaction(async (transaction: any) => {
    const prior = await transaction.get(requestRef);
    if (prior.exists) {
      const data = prior.data() || {};
      if (data.payloadHash !== payloadHash) throw new RenewalContinuityServiceError("renewal_idempotency_key_reused");
      return { ...data.result, outcome: "idempotent_replay", idempotency: { ...data.result.idempotency, replay: true } };
    }
    const loaded = await readRenewalContext(transaction, { ...input, evaluationInstant, firestore });
    if (loaded.context.expectedStateToken !== input.expectedStateToken) {
      throw new RenewalContinuityServiceError("renewal_state_stale", loaded.context);
    }
    if (!loaded.evaluation.eligible) {
      throw new RenewalContinuityServiceError("renewal_handoff_ineligible", loaded.context, loaded.evaluation.reasons);
    }
    const predecessorTenancies = loaded.records.tenancies.filter((tenancy: any) =>
      text(tenancy.leaseId) === loaded.context.predecessorLeaseId &&
      text(tenancy.tenantId) === loaded.records.tenantId &&
      ["active", "current", "occupied"].includes(state(tenancy.status)) && !text(tenancy.moveOutAt)
    );
    const successorTenancies = loaded.records.tenancies.filter((tenancy: any) =>
      text(tenancy.leaseId) === loaded.context.successorLeaseId && ["active", "current", "occupied"].includes(state(tenancy.status)) && !text(tenancy.moveOutAt)
    );
    const unrelatedActiveTenancies = loaded.records.tenancies.filter((tenancy: any) =>
      ["active", "current", "occupied"].includes(state(tenancy.status)) && !text(tenancy.moveOutAt) &&
      text(tenancy.leaseId) !== loaded.context.predecessorLeaseId
    );
    if (predecessorTenancies.length !== 1 || successorTenancies.length !== 0 || unrelatedActiveTenancies.length !== 0) {
      throw new RenewalContinuityServiceError("renewal_handoff_ineligible", loaded.context, ["RENEWAL_PROJECTION_MISMATCH"]);
    }

    const nextUnit = {
      ...loaded.records.unit,
      status: "occupied", occupancyStatus: "occupied",
      tenantId: loaded.records.tenantId, currentTenantId: loaded.records.tenantId,
      leaseId: loaded.context.successorLeaseId, currentLeaseId: loaded.context.successorLeaseId,
      occupancySource: "canonical_renewal_handoff", occupancyUpdatedAt: evaluationInstant, updatedAt: evaluationInstant,
    };
    const nextEmbedded = {
      ...loaded.records.embedded,
      status: "occupied", occupancyStatus: "occupied",
      tenantId: loaded.records.tenantId, currentTenantId: loaded.records.tenantId,
      leaseId: loaded.context.successorLeaseId, currentLeaseId: loaded.context.successorLeaseId,
      occupancySource: "canonical_renewal_handoff", occupancyUpdatedAt: evaluationInstant, updatedAt: evaluationInstant,
    };
    if (Object.prototype.hasOwnProperty.call(loaded.records.unit, "occupied")) nextUnit.occupied = true;
    if (Object.prototype.hasOwnProperty.call(loaded.records.unit, "isOccupied")) nextUnit.isOccupied = true;
    if (Object.prototype.hasOwnProperty.call(loaded.records.embedded, "occupied")) nextEmbedded.occupied = true;
    if (Object.prototype.hasOwnProperty.call(loaded.records.embedded, "isOccupied")) nextEmbedded.isOccupied = true;
    const nextEmbeddedUnits = loaded.records.embeddedUnits.map((entry: any, index: number) => index === loaded.records.embeddedIndex ? nextEmbedded : entry);
    const predecessorTenancy = predecessorTenancies[0];
    const predecessorTenancyRef = firestore.collection("tenancies").doc(predecessorTenancy.id);
    const successorTenancyId = leaseStartDeterministicId("tenancy", [input.landlordId, loaded.context.propertyId, loaded.context.unitId, loaded.records.tenantId, loaded.context.successorLeaseId]);
    const successorTenancyRef = firestore.collection("tenancies").doc(successorTenancyId);
    const successorTenancy = {
      id: successorTenancyId,
      landlordId: input.landlordId,
      propertyId: loaded.context.propertyId,
      unitId: loaded.context.unitId,
      tenantId: loaded.records.tenantId,
      leaseId: loaded.context.successorLeaseId,
      status: "active",
      moveInAt: evaluationInstant,
      moveOutAt: null,
      createdAt: evaluationInstant,
      updatedAt: evaluationInstant,
      source: "renewal_handoff",
    };
    if (
      text(nextUnit.currentLeaseId) !== loaded.context.successorLeaseId ||
      text(nextEmbedded.currentLeaseId) !== loaded.context.successorLeaseId ||
      text(nextUnit.currentTenantId) !== loaded.records.tenantId ||
      text(nextEmbedded.currentTenantId) !== loaded.records.tenantId ||
      state(nextUnit.status) !== "occupied" ||
      state(nextEmbedded.status) !== "occupied" ||
      successorTenancy.leaseId !== loaded.context.successorLeaseId ||
      successorTenancy.status !== "active"
    ) throw new RenewalContinuityServiceError("renewal_postcondition_failed", loaded.context);
    const eventId = leaseStartDeterministicId("renewal_occupancy_handoff", [input.landlordId, input.idempotencyKey, loaded.context.predecessorLeaseId, loaded.context.successorLeaseId]);
    const result: RenewalContinuityResult = {
      outcome: "renewal_handoff_completed",
      predecessorLeaseId: loaded.context.predecessorLeaseId,
      successorLeaseId: loaded.context.successorLeaseId,
      expectedStateToken: leaseStartHash({ prior: loaded.context.expectedStateToken, completedAt: evaluationInstant, successorLeaseId: loaded.context.successorLeaseId }),
      auditEventIds: [eventId],
      idempotency: { key: input.idempotencyKey, replay: false, resultId: requestId },
    };

    transaction.set(loaded.records.successorRef, { occupancyEffective: true, occupancyEffectiveAt: evaluationInstant, updatedAt: evaluationInstant }, { merge: true });
    transaction.set(loaded.records.propertyRef, { units: nextEmbeddedUnits, updatedAt: evaluationInstant }, { merge: true });
    transaction.set(loaded.records.unitRef, nextUnit, { merge: true });
    transaction.set(loaded.records.tenantRef, { currentLeaseId: loaded.context.successorLeaseId, status: "current", updatedAt: evaluationInstant }, { merge: true });
    transaction.set(predecessorTenancyRef, { status: "inactive", moveOutAt: evaluationInstant, updatedAt: evaluationInstant }, { merge: true });
    transaction.create(successorTenancyRef, successorTenancy);
    transaction.create(firestore.collection("canonicalEvents").doc(eventId), {
      id: eventId, version: "v1", type: "lease.renewal_occupancy_handoff", domain: "lease", action: "renewal_occupancy_handoff", status: "succeeded",
      actor: { type: "landlord", id: leaseStartDeterministicId("actor", [input.actorId]), role: "landlord", displayName: null },
      resource: { type: "lease", id: leaseStartDeterministicId("lease", [loaded.context.successorLeaseId]), parentType: "property", parentId: leaseStartDeterministicId("property", [loaded.context.propertyId]) },
      occurredAt: evaluationInstant, recordedAt: evaluationInstant, visibility: "internal", summary: "Canonical renewal occupancy handoff completed.",
      metadata: {
        landlordRef: leaseStartDeterministicId("landlord", [input.landlordId]),
        tenantRef: leaseStartDeterministicId("tenant", [loaded.records.tenantId]),
        unitRef: leaseStartDeterministicId("unit", [loaded.context.unitId]),
        predecessorLeaseRef: leaseStartDeterministicId("lease", [loaded.context.predecessorLeaseId]),
        successorLeaseRef: leaseStartDeterministicId("lease", [loaded.context.successorLeaseId]),
        requestRef: leaseStartDeterministicId("request", [requestId]),
        source: input.source, legalDetermination: false,
      },
      tags: ["lease_start", "renewal_handoff"], appendOnly: true, immutable: true,
    });
    transaction.create(requestRef, {
      landlordId: input.landlordId, operationKind: "renewal_handoff", idempotencyKey: input.idempotencyKey,
      payloadHash, leaseId: loaded.context.successorLeaseId, predecessorLeaseId: loaded.context.predecessorLeaseId,
      canonicalEventIds: [eventId], committedAt: evaluationInstant, result,
    });
    return result;
  });
}

export function renewalLinkIsAuthoritative(predecessor: RenewalContinuityLease, successor: RenewalContinuityLease): boolean {
  const links = renewalSuccessorLinks(predecessor);
  return links.length === 1 && links[0] === text(successor.id) && text(successor.predecessorLeaseId) === text(predecessor.id);
}
