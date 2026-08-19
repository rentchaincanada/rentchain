import { db } from "../../firebase";
import {
  evaluateCanonicalLeaseStart,
  type CanonicalLeaseStartInput,
  type CanonicalLeaseStartOutcome,
  type CanonicalLeaseStartResult,
} from "../../lib/leases/canonicalLeaseStart";
import type { CanonicalLeaseConflictReason, CanonicalLeaseStateInput } from "../../lib/leases/canonicalLeaseOccupancyState";
import { buildLeaseStartExpectedStateToken, leaseStartDeterministicId, leaseStartHash } from "./leaseStartExpectedState";

export type LeaseStartOperationKind =
  | "direct_create"
  | "draft_activation"
  | "signing_completion"
  | "date_transition"
  | "explicit_start"
  | "conversion";

export type LeaseStartTrigger = LeaseStartOperationKind;
export type LeaseStartServiceOutcome = CanonicalLeaseStartOutcome | "idempotent_replay";
export type LeaseStartErrorCode =
  | "lease_start_state_stale"
  | "lease_start_idempotency_key_reused"
  | "lease_start_postcondition_failed"
  | "lease_start_context_ambiguous";

export type LeaseStartContext = {
  expectedStateToken: string;
  evaluationInstant: string;
  decision: CanonicalLeaseStartResult;
  stateSummary: {
    leaseId: string;
    propertyId: string;
    unitId: string;
    tenantId: string;
    eligibleCurrentLeaseIds: string[];
    tenancyIds: string[];
  };
};

export type LeaseStartServiceResult = {
  outcome: LeaseStartServiceOutcome;
  canonicalOutcome: CanonicalLeaseStartOutcome;
  occupancyEffective: boolean;
  reasons: CanonicalLeaseConflictReason[];
  expectedStateToken: string;
  auditEventIds: string[];
  idempotency: { key: string; replay: boolean; resultId: string | null };
  stateSummary: LeaseStartContext["stateSummary"];
};

export type StartCanonicalLeaseOccupancyInput = {
  landlordId: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  leaseId: string;
  operationKind: LeaseStartOperationKind;
  idempotencyKey: string;
  expectedStateToken: string;
  evaluationInstant: string;
  trigger: LeaseStartTrigger;
  actorId?: string | null;
  source?: string | null;
  firestore?: any;
};

type ContextInput = Pick<StartCanonicalLeaseOccupancyInput, "landlordId" | "propertyId" | "unitId" | "tenantId" | "leaseId" | "evaluationInstant"> & { firestore?: any };

export class LeaseStartServiceError extends Error {
  constructor(public code: LeaseStartErrorCode, public freshContext?: LeaseStartContext) {
    super(code);
  }
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function instant(value: unknown): string | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function docData(snapshot: any): any {
  return snapshot?.exists ? { id: snapshot.id, ...(snapshot.data() || {}) } : null;
}

function matchesEmbeddedUnit(unit: any, unitId: string, unitNumber: string): boolean {
  return [unit?.id, unit?.unitId, unit?.unitNumber].map(text).includes(unitId) || (Boolean(unitNumber) && text(unit?.unitNumber) === unitNumber);
}

function canonicalLease(lease: any): CanonicalLeaseStateInput & { tenantIds?: unknown } {
  return {
    ...lease,
    id: text(lease?.id),
    tenantId: lease?.tenantId || lease?.primaryTenantId || (Array.isArray(lease?.tenantIds) ? lease.tenantIds[0] : null),
    executionState: lease?.executionState || lease?.leaseExecutionState || lease?.leaseExecution?.executionStatus,
    executionStatus: lease?.executionStatus || lease?.leaseExecution?.executionStatus,
  };
}

async function readContext(reader: any, input: ContextInput): Promise<{ context: LeaseStartContext; records: any }> {
  const firestore = input.firestore || db;
  const propertyRef = firestore.collection("properties").doc(input.propertyId);
  const unitRef = firestore.collection("units").doc(input.unitId);
  const leaseRef = firestore.collection("leases").doc(input.leaseId);
  const tenantRef = firestore.collection("tenants").doc(input.tenantId);
  const unitsQuery = firestore.collection("units").where("landlordId", "==", input.landlordId).where("propertyId", "==", input.propertyId);
  const leasesQuery = firestore.collection("leases").where("landlordId", "==", input.landlordId).where("propertyId", "==", input.propertyId);
  const tenanciesQuery = firestore.collection("tenancies").where("tenantId", "==", input.tenantId);
  const get = (target: any) => reader?.get ? reader.get(target) : target.get();
  const [propertySnap, unitSnap, leaseSnap, tenantSnap, unitsSnap, leasesSnap, tenanciesSnap] = await Promise.all([
    get(propertyRef), get(unitRef), get(leaseRef), get(tenantRef), get(unitsQuery), get(leasesQuery), get(tenanciesQuery),
  ]);
  const property = docData(propertySnap);
  const unit = docData(unitSnap);
  const candidateLease = docData(leaseSnap);
  const tenant = docData(tenantSnap);
  if (!property || !unit || !candidateLease || !tenant) throw new LeaseStartServiceError("lease_start_context_ambiguous");
  if (text(property.landlordId || property.ownerId || property.owner) !== input.landlordId ||
      text(unit.landlordId) !== input.landlordId || text(unit.propertyId) !== input.propertyId ||
      text(tenant.landlordId) !== input.landlordId) {
    throw new LeaseStartServiceError("lease_start_context_ambiguous");
  }
  const embeddedUnits = Array.isArray(property.units) ? property.units : [];
  const unitNumber = text(unit.unitNumber);
  const matchingStandaloneUnits = (unitsSnap.docs || []).map(docData).filter((entry: any) =>
    entry && (entry.id === input.unitId || (Boolean(unitNumber) && text(entry.unitNumber) === unitNumber))
  );
  if (matchingStandaloneUnits.length !== 1 || matchingStandaloneUnits[0].id !== input.unitId) {
    throw new LeaseStartServiceError("lease_start_context_ambiguous");
  }
  const matches = embeddedUnits.map((entry: any, index: number) => ({ entry, index }))
    .filter(({ entry }: any) => matchesEmbeddedUnit(entry, input.unitId, unitNumber));
  if (matches.length !== 1) throw new LeaseStartServiceError("lease_start_context_ambiguous");

  const leases = (leasesSnap.docs || []).map(docData)
    .filter((lease: any) => lease && text(lease.unitId) === input.unitId)
    .map(canonicalLease);
  if (!leases.some((lease: any) => lease.id === input.leaseId)) leases.push(canonicalLease(candidateLease));
  const tenancies = (tenanciesSnap.docs || []).map(docData).filter(Boolean);
  const embedded = {
    ...matches[0].entry,
    id: text(matches[0].entry.id || matches[0].entry.unitId || input.unitId),
    landlordId: input.landlordId,
    propertyId: input.propertyId,
  };
  const canonicalInput: CanonicalLeaseStartInput = {
    landlordId: input.landlordId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    tenantId: input.tenantId,
    evaluationInstant: input.evaluationInstant,
    candidateLease: canonicalLease(candidateLease),
    contextLeases: leases.filter((lease: any) => lease.id !== input.leaseId),
    standaloneUnits: [unit],
    embeddedUnits: [embedded],
    tenant,
    tenancies,
  };
  const decision = evaluateCanonicalLeaseStart(canonicalInput);
  const expectedStateToken = buildLeaseStartExpectedStateToken(canonicalInput, decision, { propertyUpdatedAt: property.updatedAt });
  const stateSummary = {
    leaseId: input.leaseId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    tenantId: input.tenantId,
    eligibleCurrentLeaseIds: [...decision.context.eligibleCurrentLeaseIds],
    tenancyIds: [...decision.context.tenancyIds],
  };
  return {
    context: { expectedStateToken, evaluationInstant: decision.context.evaluationInstant, decision, stateSummary },
    records: { propertyRef, unitRef, leaseRef, tenantRef, property, unit, candidateLease, tenant, embeddedUnits, embeddedIndex: matches[0].index, tenancies, canonicalInput },
  };
}

export async function getCanonicalLeaseStartContext(input: ContextInput): Promise<LeaseStartContext> {
  const normalized = instant(input.evaluationInstant);
  if (!normalized) throw new LeaseStartServiceError("lease_start_context_ambiguous");
  return (await readContext(input.firestore || db, { ...input, evaluationInstant: normalized })).context;
}

function resultFrom(context: LeaseStartContext, input: StartCanonicalLeaseOccupancyInput, resultId: string | null, replay = false): LeaseStartServiceResult {
  return {
    outcome: replay ? "idempotent_replay" : context.decision.outcome,
    canonicalOutcome: context.decision.outcome,
    occupancyEffective: context.decision.occupancyEffective,
    reasons: [...context.decision.reasons],
    expectedStateToken: context.expectedStateToken,
    auditEventIds: [],
    idempotency: { key: input.idempotencyKey, replay, resultId },
    stateSummary: context.stateSummary,
  };
}

function assertPostcondition(context: LeaseStartContext, next: { unit: any; embedded: any; tenant: any; tenancy: any }) {
  const expected = context.decision.postcondition;
  if (!expected ||
      ["status", "occupancyStatus", "tenantId", "currentTenantId", "leaseId", "currentLeaseId", "occupancySource", "occupancyUpdatedAt", "updatedAt"]
        .some((key) => next.unit[key] !== (expected.standaloneUnit as any)[key] || next.embedded[key] !== (expected.embeddedPropertyUnit as any)[key]) ||
      next.tenant.currentLeaseId !== expected.tenant.currentLeaseId || next.tenancy.leaseId !== expected.tenancy.leaseId ||
      next.tenancy.tenantId !== expected.tenancy.tenantId || next.tenancy.status !== "active" || next.tenancy.moveInAt !== expected.tenancy.moveInAt) {
    throw new LeaseStartServiceError("lease_start_postcondition_failed", context);
  }
  for (const field of ["occupied", "isOccupied"] as const) {
    for (const [actual, desired] of [[next.unit, expected.standaloneUnit], [next.embedded, expected.embeddedPropertyUnit]] as const) {
      if (Object.prototype.hasOwnProperty.call(desired, field) !== Object.prototype.hasOwnProperty.call(actual, field) ||
          (Object.prototype.hasOwnProperty.call(desired, field) && actual[field] !== true)) {
        throw new LeaseStartServiceError("lease_start_postcondition_failed", context);
      }
    }
  }
}

export async function startCanonicalLeaseOccupancy(input: StartCanonicalLeaseOccupancyInput): Promise<LeaseStartServiceResult> {
  const firestore = input.firestore || db;
  const normalizedInstant = instant(input.evaluationInstant);
  if (!normalizedInstant || !text(input.idempotencyKey) || input.idempotencyKey.length > 160 || !text(input.expectedStateToken)) {
    throw new LeaseStartServiceError("lease_start_state_stale");
  }
  const requestId = leaseStartDeterministicId("lease_start", [input.landlordId, input.operationKind, input.idempotencyKey]);
  const requestRef = firestore.collection("leaseStartRequests").doc(requestId);
  const payloadHash = leaseStartHash({
    landlordId: input.landlordId, propertyId: input.propertyId, unitId: input.unitId, tenantId: input.tenantId,
    leaseId: input.leaseId, operationKind: input.operationKind, trigger: input.trigger, source: input.source || null,
    evaluationInstant: normalizedInstant,
  });

  return firestore.runTransaction(async (transaction: any) => {
    const prior = await transaction.get(requestRef);
    if (prior.exists) {
      const data = prior.data() || {};
      if (data.payloadHash !== payloadHash) throw new LeaseStartServiceError("lease_start_idempotency_key_reused");
      return { ...data.result, outcome: "idempotent_replay", idempotency: { ...data.result.idempotency, replay: true } };
    }
    const loaded = await readContext(transaction, { ...input, evaluationInstant: normalizedInstant, firestore });
    if (loaded.context.expectedStateToken !== input.expectedStateToken) {
      throw new LeaseStartServiceError("lease_start_state_stale", loaded.context);
    }
    if (loaded.context.decision.outcome === "rejected") return resultFrom(loaded.context, input, null);

    const baseResult = resultFrom(loaded.context, input, requestId);
    if (loaded.context.decision.outcome === "created_without_occupancy" || loaded.context.decision.outcome === "already_coherent") {
      const committedResult = { ...baseResult, idempotency: { ...baseResult.idempotency, resultId: requestId } };
      transaction.create(requestRef, {
        landlordId: input.landlordId, operationKind: input.operationKind, idempotencyKey: input.idempotencyKey,
        payloadHash, leaseId: input.leaseId, canonicalOutcome: committedResult.canonicalOutcome,
        reasons: committedResult.reasons, occupancyEffective: committedResult.occupancyEffective,
        resultingExpectedStateToken: committedResult.expectedStateToken, canonicalEventIds: [], committedAt: normalizedInstant,
        result: committedResult,
      });
      return committedResult;
    }

    const postcondition = loaded.context.decision.postcondition;
    if (!postcondition) throw new LeaseStartServiceError("lease_start_postcondition_failed", loaded.context);
    const nextUnit = { ...loaded.records.unit, ...postcondition.standaloneUnit };
    const currentEmbedded = loaded.records.embeddedUnits[loaded.records.embeddedIndex];
    const nextEmbedded = { ...currentEmbedded, ...postcondition.embeddedPropertyUnit };
    const nextTenant = { ...loaded.records.tenant, ...postcondition.tenant, updatedAt: normalizedInstant };
    const tenancyId = postcondition.tenancy.id || leaseStartDeterministicId("tenancy", [input.landlordId, input.propertyId, input.unitId, input.tenantId, input.leaseId]);
    const tenancyRef = firestore.collection("tenancies").doc(tenancyId);
    const existingTenancy = loaded.records.tenancies.find((tenancy: any) => tenancy.id === tenancyId);
    const nextTenancy = postcondition.tenancy.action === "reuse"
      ? { ...existingTenancy }
      : { ...existingTenancy, ...postcondition.tenancy, id: tenancyId, updatedAt: normalizedInstant, moveOutAt: null };
    assertPostcondition(loaded.context, { unit: nextUnit, embedded: nextEmbedded, tenant: nextTenant, tenancy: nextTenancy });

    const nextEmbeddedUnits = loaded.records.embeddedUnits.map((entry: any, index: number) => index === loaded.records.embeddedIndex ? nextEmbedded : entry);
    const nextTenancies = postcondition.tenancy.action === "create"
      ? [...loaded.records.tenancies, nextTenancy]
      : loaded.records.tenancies.map((tenancy: any) => tenancy.id === tenancyId ? nextTenancy : tenancy);
    const nextCanonicalInput: CanonicalLeaseStartInput = {
      ...loaded.records.canonicalInput,
      candidateLease: { ...loaded.records.canonicalInput.candidateLease, occupancyEffective: true, occupancyEffectiveAt: normalizedInstant, updatedAt: normalizedInstant },
      standaloneUnits: [nextUnit],
      embeddedUnits: [{ ...nextEmbedded, landlordId: input.landlordId, propertyId: input.propertyId }],
      tenant: nextTenant,
      tenancies: nextTenancies,
    };
    const verifiedDecision = evaluateCanonicalLeaseStart(nextCanonicalInput);
    if (verifiedDecision.outcome !== "already_coherent" || verifiedDecision.postcondition !== null) {
      throw new LeaseStartServiceError("lease_start_postcondition_failed", loaded.context);
    }
    const resultingExpectedStateToken = buildLeaseStartExpectedStateToken(
      nextCanonicalInput,
      verifiedDecision,
      { propertyUpdatedAt: normalizedInstant }
    );
    const eventId = leaseStartDeterministicId("lease_occupancy_started", [input.landlordId, input.operationKind, input.idempotencyKey, input.leaseId]);
    const eventRef = firestore.collection("canonicalEvents").doc(eventId);
    const committedResult: LeaseStartServiceResult = {
      ...baseResult,
      auditEventIds: [eventId],
      idempotency: { ...baseResult.idempotency, resultId: requestId },
      expectedStateToken: resultingExpectedStateToken,
    };

    transaction.set(loaded.records.leaseRef, { occupancyEffective: true, occupancyEffectiveAt: normalizedInstant, updatedAt: normalizedInstant }, { merge: true });
    transaction.set(loaded.records.propertyRef, { units: nextEmbeddedUnits, updatedAt: normalizedInstant }, { merge: true });
    transaction.set(loaded.records.unitRef, nextUnit, { merge: true });
    transaction.set(loaded.records.tenantRef, { currentLeaseId: input.leaseId, status: "current", updatedAt: normalizedInstant }, { merge: true });
    if (postcondition.tenancy.action === "create") transaction.create(tenancyRef, nextTenancy);
    else if (postcondition.tenancy.action === "reconcile") transaction.set(tenancyRef, nextTenancy, { merge: true });
    transaction.create(eventRef, {
      id: eventId, version: "v1", type: "lease.occupancy_started", domain: "lease", action: "occupancy_started", status: "succeeded",
      actor: { type: "landlord", id: leaseStartDeterministicId("actor", [input.actorId || input.landlordId]), role: "landlord", displayName: null },
      resource: { type: "lease", id: leaseStartDeterministicId("lease", [input.leaseId]), parentType: "property", parentId: leaseStartDeterministicId("property", [input.propertyId]) },
      occurredAt: normalizedInstant, recordedAt: normalizedInstant, visibility: "internal",
      summary: "Canonical lease occupancy started.",
      metadata: {
        landlordRef: leaseStartDeterministicId("landlord", [input.landlordId]), tenantRef: leaseStartDeterministicId("tenant", [input.tenantId]),
        unitRef: leaseStartDeterministicId("unit", [input.unitId]), requestRef: leaseStartDeterministicId("request", [requestId]),
        operationKind: input.operationKind, trigger: input.trigger, source: input.source || null, legalDetermination: false,
      },
      tags: ["lease_start", input.trigger], appendOnly: true, immutable: true,
    });
    transaction.create(requestRef, {
      landlordId: input.landlordId, operationKind: input.operationKind, idempotencyKey: input.idempotencyKey,
      payloadHash, leaseId: input.leaseId, canonicalOutcome: committedResult.canonicalOutcome,
      reasons: committedResult.reasons, occupancyEffective: committedResult.occupancyEffective,
      resultingExpectedStateToken: committedResult.expectedStateToken, canonicalEventIds: [eventId], committedAt: normalizedInstant,
      result: committedResult,
    });
    return committedResult;
  });
}
