import { db } from "../../firebase";
import { evaluateCanonicalLeaseStart, type CanonicalLeaseStartInput } from "../../lib/leases/canonicalLeaseStart";
import { buildLeaseStartExpectedStateToken, leaseStartDeterministicId, leaseStartHash } from "./leaseStartExpectedState";
import { LeaseStartServiceError, type LeaseStartOperationKind, type LeaseStartServiceResult } from "./leaseStartService";

export type CreateCanonicalLeaseInput = {
  landlordId: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  leaseId: string;
  leaseRecord: Record<string, any>;
  operationKind: Extract<LeaseStartOperationKind, "direct_create" | "draft_activation" | "conversion">;
  idempotencyKey: string;
  evaluationInstant: string;
  actorId: string;
  source: string;
  tenantRecord?: Record<string, any> | null;
  draftActivation?: { draftId: string; expectedLeaseId?: string | null } | null;
  firestore?: any;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizedInstant(value: unknown): string | null {
  const parsed = new Date(String(value || ""));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function data(snapshot: any): any {
  return snapshot?.exists ? { id: snapshot.id, ...(snapshot.data() || {}) } : null;
}

function canonicalLease(lease: any) {
  return {
    ...lease,
    id: text(lease?.id),
    tenantId: lease?.tenantId || lease?.primaryTenantId || lease?.tenantIds?.[0] || null,
    executionState: lease?.executionState || lease?.executionStatus || lease?.leaseExecutionState || lease?.leaseExecution?.executionStatus,
    executionStatus: lease?.executionStatus || lease?.executionState || lease?.leaseExecutionState || lease?.leaseExecution?.executionStatus,
  };
}

function matchesEmbeddedUnit(unit: any, unitId: string, unitNumber: string): boolean {
  return [unit?.id, unit?.unitId, unit?.unitNumber].map(text).includes(unitId) || (Boolean(unitNumber) && text(unit?.unitNumber) === unitNumber);
}

function baseResult(input: CreateCanonicalLeaseInput, decision: any, expectedStateToken: string, requestId: string, eventIds: string[], replay = false): LeaseStartServiceResult {
  return {
    outcome: replay ? "idempotent_replay" : decision.outcome,
    canonicalOutcome: decision.outcome,
    occupancyEffective: decision.occupancyEffective,
    reasons: [...decision.reasons],
    expectedStateToken,
    auditEventIds: eventIds,
    idempotency: { key: input.idempotencyKey, replay, resultId: requestId },
    stateSummary: {
      leaseId: input.leaseId,
      propertyId: input.propertyId,
      unitId: input.unitId,
      tenantId: input.tenantId,
      eligibleCurrentLeaseIds: [...decision.context.eligibleCurrentLeaseIds],
      tenancyIds: [...decision.context.tenancyIds],
    },
  };
}

function canonicalEvent(input: CreateCanonicalLeaseInput, eventId: string, type: "lease.created" | "lease.created_without_occupancy" | "lease.occupancy_started" | "lease.occupancy_start_rejected", occurredAt: string, requestId: string, reasons: string[] = []) {
  const action = type.replace(/^lease\./, "");
  return {
    id: eventId,
    version: "v1",
    type,
    domain: "lease",
    action,
    status: type === "lease.occupancy_start_rejected" ? "rejected" : "succeeded",
    actor: { type: "landlord", id: leaseStartDeterministicId("actor", [input.actorId]), role: "landlord", displayName: null },
    resource: { type: "lease", id: leaseStartDeterministicId("lease", [input.leaseId]), parentType: "property", parentId: leaseStartDeterministicId("property", [input.propertyId]) },
    occurredAt,
    recordedAt: occurredAt,
    visibility: "internal",
    summary: type === "lease.occupancy_start_rejected" ? "Canonical lease occupancy start rejected." : type === "lease.occupancy_started" ? "Canonical lease occupancy started." : "Lease created through the canonical lease-start workflow.",
    metadata: {
      landlordRef: leaseStartDeterministicId("landlord", [input.landlordId]),
      tenantRef: leaseStartDeterministicId("tenant", [input.tenantId]),
      unitRef: leaseStartDeterministicId("unit", [input.unitId]),
      requestRef: leaseStartDeterministicId("request", [requestId]),
      operationKind: input.operationKind,
      trigger: input.operationKind,
      source: input.source,
      reasons,
      legalDetermination: false,
    },
    tags: ["lease_start", input.operationKind],
    appendOnly: true,
    immutable: true,
  };
}

export async function createCanonicalLease(input: CreateCanonicalLeaseInput): Promise<LeaseStartServiceResult & { leaseId: string }> {
  const firestore = input.firestore || db;
  const instant = normalizedInstant(input.evaluationInstant);
  if (!instant || !text(input.idempotencyKey) || input.idempotencyKey.length > 128) {
    throw new LeaseStartServiceError("lease_start_state_stale");
  }
  const requestId = leaseStartDeterministicId("lease_start", [input.landlordId, input.operationKind, input.idempotencyKey]);
  const requestRef = firestore.collection("leaseStartRequests").doc(requestId);
  const leaseRef = firestore.collection("leases").doc(input.leaseId);
  const propertyRef = firestore.collection("properties").doc(input.propertyId);
  const unitRef = firestore.collection("units").doc(input.unitId);
  const tenantRef = firestore.collection("tenants").doc(input.tenantId);
  const draftRef = input.draftActivation ? firestore.collection("leaseDrafts").doc(input.draftActivation.draftId) : null;
  const {
    risk: _risk,
    riskScore: _riskScore,
    riskGrade: _riskGrade,
    riskConfidence: _riskConfidence,
    riskTimeline: _riskTimeline,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...semanticLeaseRecord
  } = input.leaseRecord;
  const payloadHash = leaseStartHash({
    landlordId: input.landlordId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    tenantId: input.tenantId,
    leaseId: input.leaseId,
    leaseRecord: semanticLeaseRecord,
    tenantRecord: input.tenantRecord || null,
    draftActivation: input.draftActivation || null,
    operationKind: input.operationKind,
    idempotencyKey: input.idempotencyKey,
    actorId: input.actorId,
    source: input.source,
  });

  return firestore.runTransaction(async (transaction: any) => {
    const prior = await transaction.get(requestRef);
    if (prior.exists) {
      const priorData = prior.data() || {};
      if (priorData.payloadHash !== payloadHash) throw new LeaseStartServiceError("lease_start_idempotency_key_reused");
      return { ...priorData.result, leaseId: input.leaseId, outcome: "idempotent_replay", idempotency: { ...priorData.result.idempotency, replay: true } };
    }

    const unitsQuery = firestore.collection("units").where("landlordId", "==", input.landlordId).where("propertyId", "==", input.propertyId);
    const leasesQuery = firestore.collection("leases").where("landlordId", "==", input.landlordId).where("propertyId", "==", input.propertyId);
    const tenanciesQuery = firestore.collection("tenancies").where("propertyId", "==", input.propertyId);
    const [leaseSnap, propertySnap, unitSnap, tenantSnap, unitsSnap, leasesSnap, tenanciesSnap, draftSnap] = await Promise.all([
      transaction.get(leaseRef),
      transaction.get(propertyRef),
      transaction.get(unitRef),
      transaction.get(tenantRef),
      transaction.get(unitsQuery),
      transaction.get(leasesQuery),
      transaction.get(tenanciesQuery),
      draftRef ? transaction.get(draftRef) : Promise.resolve(null),
    ]);
    if (leaseSnap.exists) throw new LeaseStartServiceError("lease_start_idempotency_key_reused");
    const property = data(propertySnap);
    const unit = data(unitSnap);
    const persistedTenant = data(tenantSnap);
    const tenant = persistedTenant || (input.tenantRecord ? { id: input.tenantId, ...input.tenantRecord } : null);
    if (!property || !unit || !tenant || text(property.landlordId || property.ownerId || property.owner) !== input.landlordId ||
        text(unit.landlordId) !== input.landlordId || text(unit.propertyId) !== input.propertyId || text(tenant.landlordId) !== input.landlordId) {
      throw new LeaseStartServiceError("lease_start_context_ambiguous");
    }
    if (input.tenantRecord && persistedTenant) throw new LeaseStartServiceError("lease_start_context_ambiguous");
    if (draftRef && (!draftSnap?.exists || text(draftSnap.data()?.landlordId) !== input.landlordId)) {
      throw new LeaseStartServiceError("lease_start_context_ambiguous");
    }
    if (draftRef && text(draftSnap.data()?.leaseId) && text(draftSnap.data()?.leaseId) !== input.leaseId) {
      throw new LeaseStartServiceError("lease_start_idempotency_key_reused");
    }

    const embeddedUnits = Array.isArray(property.units) ? property.units : [];
    const unitNumber = text(unit.unitNumber);
    const matchingUnits = (unitsSnap.docs || []).map(data).filter((entry: any) => entry && (entry.id === input.unitId || (unitNumber && text(entry.unitNumber) === unitNumber)));
    const embeddedMatches = embeddedUnits.map((entry: any, index: number) => ({ entry, index })).filter(({ entry }: any) => matchesEmbeddedUnit(entry, input.unitId, unitNumber));
    if (matchingUnits.length !== 1 || matchingUnits[0].id !== input.unitId || embeddedMatches.length !== 1) {
      throw new LeaseStartServiceError("lease_start_context_ambiguous");
    }

    const candidateLease = canonicalLease({ ...input.leaseRecord, id: input.leaseId });
    const contextLeases = (leasesSnap.docs || []).map(data).filter((lease: any) => lease && text(lease.unitId) === input.unitId).map(canonicalLease);
    const tenancies = (tenanciesSnap.docs || []).map(data).filter((tenancy: any) => tenancy && (text(tenancy.unitId) === input.unitId || (unitNumber && [tenancy.unitNumber, tenancy.unitLabel].map(text).includes(unitNumber))));
    const embedded = { ...embeddedMatches[0].entry, id: text(embeddedMatches[0].entry.id || embeddedMatches[0].entry.unitId || input.unitId), landlordId: input.landlordId, propertyId: input.propertyId };
    const canonicalInput: CanonicalLeaseStartInput = {
      landlordId: input.landlordId,
      propertyId: input.propertyId,
      unitId: input.unitId,
      tenantId: input.tenantId,
      evaluationInstant: instant,
      candidateLease,
      contextLeases,
      standaloneUnits: [unit],
      embeddedUnits: [embedded],
      tenant,
      tenancies,
    };
    const decision = evaluateCanonicalLeaseStart(canonicalInput);
    const expectedStateToken = buildLeaseStartExpectedStateToken(canonicalInput, decision, { propertyUpdatedAt: property.updatedAt });
    const creationType = decision.outcome === "created_without_occupancy" ? "lease.created_without_occupancy" : "lease.created";
    const creationEventId = leaseStartDeterministicId(creationType.replace(/\./g, "_"), [input.landlordId, input.operationKind, input.idempotencyKey, input.leaseId]);
    const occupancyEventId = leaseStartDeterministicId("lease_occupancy_started", [input.landlordId, input.operationKind, input.idempotencyKey, input.leaseId]);
    const rejectionEventId = leaseStartDeterministicId("lease_occupancy_start_rejected", [input.landlordId, input.operationKind, input.idempotencyKey, input.leaseId]);

    if (decision.outcome === "rejected") {
      const result = { ...baseResult(input, decision, expectedStateToken, requestId, [rejectionEventId]), leaseId: input.leaseId };
      transaction.create(firestore.collection("canonicalEvents").doc(rejectionEventId), canonicalEvent(input, rejectionEventId, "lease.occupancy_start_rejected", instant, requestId, result.reasons));
      transaction.create(requestRef, { landlordId: input.landlordId, operationKind: input.operationKind, idempotencyKey: input.idempotencyKey, payloadHash, leaseId: input.leaseId, canonicalOutcome: decision.outcome, reasons: result.reasons, occupancyEffective: false, canonicalEventIds: [rejectionEventId], committedAt: instant, result });
      return result;
    }

    const eventIds = decision.outcome === "occupancy_effective" ? [creationEventId, occupancyEventId] : [creationEventId];
    const result = { ...baseResult(input, decision, expectedStateToken, requestId, eventIds), leaseId: input.leaseId };
    const compatibilityStatus = decision.outcome === "occupancy_effective" ? "active" : "pending";
    transaction.create(leaseRef, { ...input.leaseRecord, id: input.leaseId, status: compatibilityStatus, occupancyEffective: decision.occupancyEffective, occupancyEffectiveAt: decision.occupancyEffective ? instant : null });
    if (input.tenantRecord) transaction.create(tenantRef, { ...input.tenantRecord, id: input.tenantId });
    if (draftRef) transaction.set(draftRef, { status: "activated", leaseId: input.leaseId, activatedAt: instant, updatedAt: instant }, { merge: true });
    transaction.create(firestore.collection("canonicalEvents").doc(creationEventId), canonicalEvent(input, creationEventId, creationType, instant, requestId));

    if (decision.outcome === "occupancy_effective") {
      const postcondition = decision.postcondition;
      if (!postcondition) throw new LeaseStartServiceError("lease_start_postcondition_failed");
      const nextUnit = { ...unit, ...postcondition.standaloneUnit };
      const nextEmbedded = { ...embeddedMatches[0].entry, ...postcondition.embeddedPropertyUnit };
      const nextEmbeddedUnits = embeddedUnits.map((entry: any, index: number) => index === embeddedMatches[0].index ? nextEmbedded : entry);
      const tenancyId = postcondition.tenancy.id || leaseStartDeterministicId("tenancy", [input.landlordId, input.propertyId, input.unitId, input.tenantId, input.leaseId]);
      const tenancyRef = firestore.collection("tenancies").doc(tenancyId);
      const existingTenancy = tenancies.find((entry: any) => entry.id === tenancyId);
      const nextTenancy = postcondition.tenancy.action === "reuse" ? { ...existingTenancy } : { ...existingTenancy, ...postcondition.tenancy, id: tenancyId, updatedAt: instant, moveOutAt: null };
      const nextTenant = { ...tenant, currentLeaseId: input.leaseId, status: "current", updatedAt: instant };
      const nextTenancies = postcondition.tenancy.action === "create" ? [...tenancies, nextTenancy] : tenancies.map((entry: any) => entry.id === tenancyId ? nextTenancy : entry);
      const verified = evaluateCanonicalLeaseStart({ ...canonicalInput, candidateLease: { ...candidateLease, occupancyEffective: true, occupancyEffectiveAt: instant }, standaloneUnits: [nextUnit], embeddedUnits: [{ ...nextEmbedded, landlordId: input.landlordId, propertyId: input.propertyId }], tenant: nextTenant, tenancies: nextTenancies });
      if (verified.outcome !== "already_coherent" || verified.postcondition !== null) throw new LeaseStartServiceError("lease_start_postcondition_failed");
      result.expectedStateToken = buildLeaseStartExpectedStateToken(
        { ...canonicalInput, candidateLease: { ...candidateLease, occupancyEffective: true, occupancyEffectiveAt: instant }, standaloneUnits: [nextUnit], embeddedUnits: [{ ...nextEmbedded, landlordId: input.landlordId, propertyId: input.propertyId }], tenant: nextTenant, tenancies: nextTenancies },
        verified,
        { propertyUpdatedAt: instant }
      );
      transaction.set(propertyRef, { units: nextEmbeddedUnits, updatedAt: instant }, { merge: true });
      transaction.set(unitRef, nextUnit, { merge: true });
      transaction.set(tenantRef, { currentLeaseId: input.leaseId, status: "current", updatedAt: instant }, { merge: true });
      if (postcondition.tenancy.action === "create") transaction.create(tenancyRef, nextTenancy);
      else if (postcondition.tenancy.action === "reconcile") transaction.set(tenancyRef, nextTenancy, { merge: true });
      transaction.create(firestore.collection("canonicalEvents").doc(occupancyEventId), canonicalEvent(input, occupancyEventId, "lease.occupancy_started", instant, requestId));
    }

    transaction.create(requestRef, { landlordId: input.landlordId, operationKind: input.operationKind, idempotencyKey: input.idempotencyKey, payloadHash, leaseId: input.leaseId, canonicalOutcome: decision.outcome, reasons: result.reasons, occupancyEffective: result.occupancyEffective, canonicalEventIds: eventIds, committedAt: instant, result });
    return result;
  });
}
