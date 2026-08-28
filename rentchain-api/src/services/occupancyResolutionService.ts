import crypto from "crypto";
import { db } from "../firebase";
import {
  buildCanonicalLeaseOccupancyProjection,
  resolveCanonicalUnitProjectionInputs,
  toCanonicalLeaseStateInput,
  type CanonicalLeaseOccupancyProjection,
} from "../lib/leases/canonicalLeaseOccupancyProjection";
import {
  deriveCanonicalLeaseTermState,
  MULTIPLE_CURRENT_OCCUPANCY_EXCLUSION,
  selectCanonicalCurrentLease,
} from "../lib/leases/canonicalLeaseOccupancyState";
import { resolveUnitReference, toCanonicalLeaseRecord, toCanonicalUnitRecord } from "./leaseCanonicalizationService";

export type OccupancyResolutionType =
  | "record_operational_move_out"
  | "clear_stale_occupancy_record"
  | "link_existing_lease"
  | "resolve_multiple_current_leases"
  | "reconcile_stale_occupancy_linkage";

export type ContextMismatchRemediationClassification =
  | "stale_occupancy_linkage_with_unique_authoritative_lease"
  | "lease_context_mismatch"
  | "ownership_mismatch"
  | "ambiguous_context"
  | "participant_mismatch"
  | "missing_context"
  | "not_applicable";

export type ContextMismatchRemediation = {
  classification: ContextMismatchRemediationClassification;
  repairEligible: boolean;
  authoritativeLeaseId: string | null;
  blockedReason: string | null;
  mismatchedComponents: string[];
  staleLinkageFields: string[];
};

type ResolutionContextInput = {
  landlordId: string;
  propertyId: string;
  unitId: string;
  tenantId?: string | null;
};

export type OccupancyResolutionContext = {
  propertyId: string;
  unitId: string;
  tenantId: string | null;
  unitLabel: string;
  propertyLabel: string;
  canonicalState: CanonicalLeaseOccupancyProjection;
  expectedStateToken: string;
  eligibleResolutionTypes: OccupancyResolutionType[];
  existingLeaseCandidates: Array<{
    id: string;
    label: string;
    tenantId: string | null;
    startDate: string | null;
    endDate: string | null;
    executionStatus: string | null;
    participantNames: string[];
    participantCount: number;
    reference: string;
    occupancyEffective: boolean;
    activeTenancyCount: number;
  }>;
  activeLeaseRequiresEndWorkflow: boolean;
  contextMismatchRemediation: ContextMismatchRemediation;
};

export class OccupancyResolutionError extends Error {
  constructor(public code: string, public status: number, public freshContext?: OccupancyResolutionContext) {
    super(code);
  }
}

function text(value: unknown): string {
  return String(value || "").trim();
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stable(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function safeRef(prefix: string, value: unknown): string {
  return `${prefix}:${hash([prefix, text(value)]).slice(0, 32)}`;
}

function participantTenantIds(lease: any): string[] {
  return Array.from(new Set([
    lease?.tenantId,
    lease?.primaryTenantId,
    ...(Array.isArray(lease?.tenantIds) ? lease.tenantIds : []),
  ].map(text).filter(Boolean)));
}

function matchesEmbeddedUnit(unit: any, unitId: string, unitNumber: string): boolean {
  const candidates = [unit?.id, unit?.unitId, unit?.unitNumber, unit?.label, unit?.unit].map(text);
  return candidates.includes(unitId) || (Boolean(unitNumber) && candidates.includes(unitNumber));
}

function pointerValues(record: any, fields: string[]): string[] {
  return fields.map((field) => text(record?.[field])).filter(Boolean);
}

function matchesTenancyUnitContext(row: any, propertyId: string, unitId: string, unitLabel: string): boolean {
  if (text(row.propertyId) !== propertyId) return false;
  const rowUnitId = text(row.unitId);
  const rowUnitLabel = text(row.unitLabel);
  return rowUnitId === unitId || (Boolean(unitLabel) && rowUnitLabel === unitLabel);
}

function classifyContextMismatch(input: {
  landlordId: string;
  propertyId: string;
  unitId: string;
  requestedTenantId?: string | null;
  unit: any;
  embeddedUnitMatches: any[];
  strictLeases: any[];
  diagnosticLeases: any[];
  tenantsById: Map<string, any>;
  tenancies: any[];
  canonicalState: CanonicalLeaseOccupancyProjection;
}): ContextMismatchRemediation {
  const blocked = (
    classification: ContextMismatchRemediationClassification,
    blockedReason: string,
    mismatchedComponents: string[] = []
  ): ContextMismatchRemediation => ({ classification, repairEligible: false, authoritativeLeaseId: null, blockedReason, mismatchedComponents, staleLinkageFields: [] });

  if (!input.landlordId || !input.propertyId || !input.unitId) return blocked("missing_context", "Required occupancy context is missing.");
  if (!input.canonicalState.reasons.includes("CURRENT_LEASE_CONTEXT_MISMATCH")) return blocked("not_applicable", "The current context mismatch is no longer present.");
  if (input.embeddedUnitMatches.length !== 1) return blocked("ambiguous_context", "The standalone and property unit records do not identify one unit context.", ["unit"]);

  const pointedLeaseIds = new Set([
    ...pointerValues(input.unit, ["leaseId", "currentLeaseId"]),
    ...pointerValues(input.embeddedUnitMatches[0], ["leaseId", "currentLeaseId"]),
  ]);
  const pointedDiagnosticLeases = input.diagnosticLeases.filter((lease) => pointedLeaseIds.has(text(lease.id)));
  if (pointedDiagnosticLeases.some((lease) => text(lease.landlordId) !== input.landlordId)) {
    return blocked("ownership_mismatch", "A linked lease is outside the authorized landlord context.", ["landlord"]);
  }
  if (pointedDiagnosticLeases.some((lease) => text(lease.propertyId) !== input.propertyId || text(lease.resolvedUnitId || lease.unitId) !== input.unitId)) {
    const components = Array.from(new Set(pointedDiagnosticLeases.flatMap((lease) => [
      ...(text(lease.propertyId) !== input.propertyId ? ["property"] : []),
      ...(text(lease.resolvedUnitId || lease.unitId) !== input.unitId ? ["unit"] : []),
    ])));
    if (!input.strictLeases.length) return blocked("lease_context_mismatch", "The linked lease belongs to a different property or unit and cannot be corrected here.", components);
  }

  const selection = selectCanonicalCurrentLease(input.strictLeases.map(toCanonicalLeaseStateInput), {
    landlordId: input.landlordId,
    propertyId: input.propertyId,
    unitId: input.unitId,
  });
  if (selection.reasons.includes("MULTIPLE_CURRENT_LEASES") || selection.candidates.length > 1) {
    return blocked("ambiguous_context", "More than one lease could represent current occupancy.", ["lease"]);
  }
  const authoritativeLease = selection.lease && input.strictLeases.find((lease) => lease.id === selection.lease?.id);
  if (!authoritativeLease) return blocked("lease_context_mismatch", "No unique current lease matches this property and unit.", ["lease"]);
  const executionStatus = text(authoritativeLease.executionStatus || authoritativeLease.leaseExecutionState || authoritativeLease.leaseExecution?.executionStatus).toLowerCase().replace(/[\s-]+/g, "_");
  if (executionStatus !== "fully_executed") return blocked("lease_context_mismatch", "The matching lease is not fully executed and cannot support linkage reconciliation.", ["lease"]);

  const participantIds = participantTenantIds(authoritativeLease);
  if (participantIds.length !== 1) return blocked("participant_mismatch", "Lease participants do not identify one unambiguous occupancy linkage.", ["tenant"]);
  const authoritativeTenantId = participantIds[0];
  const authoritativeTenant = input.tenantsById.get(authoritativeTenantId);
  if (!authoritativeTenant || text(authoritativeTenant.landlordId) !== input.landlordId) {
    return blocked("ownership_mismatch", "The lease participant is outside the authorized landlord context.", ["landlord", "tenant"]);
  }
  const requestedTenantId = text(input.requestedTenantId);
  const unitTenantPointers = [
    ...pointerValues(input.unit, ["tenantId", "currentTenantId"]),
    ...pointerValues(input.embeddedUnitMatches[0], ["tenantId", "currentTenantId"]),
  ];
  if (requestedTenantId && requestedTenantId !== authoritativeTenantId && !unitTenantPointers.includes(requestedTenantId)) {
    return blocked("participant_mismatch", "The requested tenant is not a participant on the authoritative lease.", ["tenant"]);
  }

  const contextTenancies = input.tenancies.filter((row) => matchesTenancyUnitContext(
    row,
    input.propertyId,
    input.unitId,
    text(input.unit.unitNumber || input.unit.label)
  ));
  if (contextTenancies.some((row) => text(row.landlordId) !== input.landlordId)) {
    return blocked("ownership_mismatch", "A tenancy record is outside the authorized landlord context.", ["landlord", "tenancy"]);
  }
  if (contextTenancies.length > 1) return blocked("ambiguous_context", "More than one tenancy record represents this occupancy context.", ["tenancy"]);
  if (contextTenancies.some((row) => text(row.tenantId) !== authoritativeTenantId)) {
    return blocked("participant_mismatch", "The tenancy points to a different tenant.", ["tenant", "tenancy"]);
  }
  if (contextTenancies.some((row) => text(row.leaseId) && text(row.leaseId) !== authoritativeLease.id)) {
    return blocked("lease_context_mismatch", "The tenancy points to a different lease.", ["lease", "tenancy"]);
  }

  const staleLinkageFields = new Set<string>();
  const desiredPointers: Record<string, string> = { currentLeaseId: authoritativeLease.id, leaseId: authoritativeLease.id, currentTenantId: authoritativeTenantId, tenantId: authoritativeTenantId };
  for (const [field, desired] of Object.entries(desiredPointers)) if (text(input.unit[field]) !== desired) staleLinkageFields.add(`unit.${field}`);
  for (const [field, desired] of Object.entries(desiredPointers)) if (text(input.embeddedUnitMatches[0][field]) !== desired) staleLinkageFields.add(`property.units.${field}`);
  if (text(authoritativeTenant.currentLeaseId) !== authoritativeLease.id) staleLinkageFields.add("tenant.currentLeaseId");
  if (!["current", "active", "occupied"].includes(text(authoritativeTenant.status).toLowerCase())) staleLinkageFields.add("tenant.status");
  if (!contextTenancies.length) staleLinkageFields.add("tenancy.create");
  else if (text(contextTenancies[0].status).toLowerCase() !== "active") staleLinkageFields.add("tenancy.status");
  if (!staleLinkageFields.size) return blocked("not_applicable", "No stale operational occupancy linkage remains.");

  return {
    classification: "stale_occupancy_linkage_with_unique_authoritative_lease",
    repairEligible: true,
    authoritativeLeaseId: authoritativeLease.id,
    blockedReason: null,
    mismatchedComponents: ["occupancy_linkage"],
    staleLinkageFields: [...staleLinkageFields].sort(),
  };
}

function stateToken(input: {
  canonicalState: CanonicalLeaseOccupancyProjection;
  property: any;
  unit: any;
  tenants: any[];
  leases: any[];
  tenancies: any[];
}): string {
  return hash({
    canonicalState: { ...input.canonicalState, reasons: [...input.canonicalState.reasons].sort() },
    propertyUpdatedAt: input.property?.updatedAt || null,
    embeddedUnits: input.property?.units || [],
    unit: input.unit || null,
    tenants: input.tenants.map((tenant) => ({
      id: tenant.id,
      landlordId: tenant.landlordId,
      propertyId: tenant.propertyId,
      unitId: tenant.unitId,
      currentLeaseId: tenant.currentLeaseId,
      status: tenant.status,
      updatedAt: tenant.updatedAt,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    leases: input.leases.map((lease) => ({
      id: lease.id,
      landlordId: lease.landlordId,
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      tenantId: lease.tenantId || lease.primaryTenantId,
      tenantIds: participantTenantIds(lease),
      status: lease.status,
      startDate: lease.startDate || lease.leaseStartDate,
      endDate: lease.endDate || lease.leaseEndDate,
      executionStatus: lease.executionStatus || lease.leaseExecutionState || lease.leaseExecution?.executionStatus,
      occupancyEffective: lease.occupancyEffective === true,
      occupancyDisposition: lease.occupancyDisposition || null,
    })).sort((a, b) => a.id.localeCompare(b.id)),
    tenancies: input.tenancies.map((row) => ({ id: row.id, landlordId: row.landlordId, propertyId: row.propertyId, unitId: row.unitId, unitLabel: row.unitLabel, tenantId: row.tenantId, leaseId: row.leaseId, status: row.status, moveOutAt: row.moveOutAt, updatedAt: row.updatedAt }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}

async function readResolutionContext(
  reader: any,
  input: ResolutionContextInput
): Promise<{ context: OccupancyResolutionContext; records: any }> {
  const propertyRef = db.collection("properties").doc(input.propertyId);
  const unitRef = db.collection("units").doc(input.unitId);
  const unitsQuery = db.collection("units").where("propertyId", "==", input.propertyId).where("landlordId", "==", input.landlordId);
  const leasesQuery = db.collection("leases").where("landlordId", "==", input.landlordId);
  const tenanciesQuery = db.collection("tenancies").where("propertyId", "==", input.propertyId);
  const get = (target: any) => typeof reader.get === "function" ? reader.get(target) : target.get();
  const [propertySnap, unitSnap, unitsSnap, leaseSnap, tenancySnap] = await Promise.all([
    get(propertyRef),
    get(unitRef),
    get(unitsQuery),
    get(leasesQuery),
    get(tenanciesQuery),
  ]);
  if (!propertySnap.exists) throw new OccupancyResolutionError("property_not_found", 404);
  if (!unitSnap.exists) throw new OccupancyResolutionError("unit_not_found", 404);
  const property = propertySnap.data() || {};
  const unit = { id: unitSnap.id, ...(unitSnap.data() || {}) };
  if (text(property.landlordId || property.ownerId || property.owner) !== input.landlordId) {
    throw new OccupancyResolutionError("forbidden", 403);
  }
  if (text(unit.landlordId) !== input.landlordId || text(unit.propertyId) !== input.propertyId) {
    throw new OccupancyResolutionError("forbidden", 403);
  }
  const canonicalUnits = (unitsSnap.docs || []).map((doc: any) => toCanonicalUnitRecord(doc.id, doc.data() || {}));
  const unitResolution = resolveUnitReference(canonicalUnits, input.unitId);
  if (unitResolution.ambiguous || !unitResolution.unit || unitResolution.unit.id !== input.unitId) {
    throw new OccupancyResolutionError("unit_context_ambiguous", 409);
  }
  const unitLabel = text(unit.unitNumber || unit.label);
  if (unitLabel && resolveUnitReference(canonicalUnits, unitLabel).ambiguous) {
    throw new OccupancyResolutionError("unit_context_ambiguous", 409);
  }
  const allLeases = (leaseSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
  const canonicalLandlordLeases = allLeases.map((lease: any) => toCanonicalLeaseRecord(lease.id, lease, canonicalUnits));
  const propertyLeases = canonicalLandlordLeases.filter((lease: any) => text(lease.propertyId) === input.propertyId);
  const relatedLeases = propertyLeases
    .filter((lease: any) => lease.resolvedUnitId === input.unitId);
  const unitInputs = resolveCanonicalUnitProjectionInputs(unit);
  const pointedLeaseId = text(unitInputs.currentLeasePointerId);
  const pointedLease = pointedLeaseId ? canonicalLandlordLeases.find((lease: any) => lease.id === pointedLeaseId) : null;
  const diagnosticLeases = pointedLease && !relatedLeases.some((lease: any) => lease.id === pointedLease.id)
    ? [...relatedLeases, pointedLease]
    : relatedLeases;
  const allParticipantIds = Array.from(new Set<string>([
    ...diagnosticLeases.flatMap(participantTenantIds),
    ...([input.tenantId, resolveCanonicalUnitProjectionInputs(unit).tenantId].map(text).filter(Boolean)),
  ]));
  const tenantRefs = allParticipantIds.map((id) => db.collection("tenants").doc(id));
  const tenantSnaps = await Promise.all(tenantRefs.map((ref) => get(ref)));
  const tenants = tenantSnaps
    .filter((snap: any) => snap?.exists)
    .map((snap: any) => ({ id: snap.id, ref: snap.ref || db.collection("tenants").doc(snap.id), ...(snap.data() || {}) }));
  const tenantsById = new Map(tenants.map((tenant: any) => [tenant.id, tenant]));
  if (input.tenantId) {
    const requestedTenant = tenantsById.get(input.tenantId) as any;
    if (!requestedTenant || text(requestedTenant.landlordId) !== input.landlordId) {
      throw new OccupancyResolutionError("tenant_not_found", 404);
    }
  }
  const tenantId = text(input.tenantId || unitInputs.tenantId) || null;
  const tenant = tenantId ? tenantsById.get(tenantId) || null : null;
  const diagnosticTenancies = (tenancySnap.docs || [])
    .map((doc: any) => ({ id: doc.id, ref: doc.ref, ...(doc.data() || {}) }))
    .filter((row: any) => matchesTenancyUnitContext(row, input.propertyId, input.unitId, unitLabel));
  const tenancies = diagnosticTenancies.filter((row: any) => text(row.landlordId) === input.landlordId);
  const canonicalState = buildCanonicalLeaseOccupancyProjection({
    leases: diagnosticLeases,
    context: { landlordId: input.landlordId, propertyId: input.propertyId, unitId: input.unitId },
    ...unitInputs,
    persistedTenancyStatus: tenancies.some((row: any) => row.status === "active") ? "active" : unitInputs.persistedTenancyStatus,
    persistedTenantStatus: tenant?.status,
    currentLeasePointerId: tenant?.currentLeaseId || unitInputs.currentLeasePointerId,
    tenantId,
  });

  const blockerReasons = new Set(["INVALID_LEASE_DATE_RANGE", "CURRENT_LEASE_CONTEXT_MISMATCH"]);
  const mutationBlocked = canonicalState.reasons.some((reason) => blockerReasons.has(reason));
  const reviewNeeded = canonicalState.occupancyState === "review_needed" || canonicalState.tenantRelationshipState === "occupancy_unresolved";
  const candidates = relatedLeases.filter((lease: any) => {
    const lifecycle = deriveCanonicalLeaseTermState(toCanonicalLeaseStateInput(lease));
    return lifecycle.supportsCurrentOccupancy;
  });
  const embeddedUnits = Array.isArray(property.units) ? property.units : [];
  const embeddedUnitMatches = embeddedUnits.filter((candidate: any) => matchesEmbeddedUnit(candidate, input.unitId, unitLabel));
  const contextMismatchRemediation = classifyContextMismatch({
    landlordId: input.landlordId,
    propertyId: input.propertyId,
    unitId: input.unitId,
    requestedTenantId: input.tenantId,
    unit,
    embeddedUnitMatches,
    strictLeases: relatedLeases,
    diagnosticLeases,
    tenantsById,
    tenancies: diagnosticTenancies,
    canonicalState,
  });
  const activeLeaseRequiresEndWorkflow = reviewNeeded && candidates.length === 1 && canonicalState.supportingLeaseId === candidates[0].id;
  const eligibleResolutionTypes: OccupancyResolutionType[] = [];
  if (reviewNeeded && !mutationBlocked) {
    if (canonicalState.reasons.includes("MULTIPLE_CURRENT_LEASES") && candidates.length >= 2) {
      eligibleResolutionTypes.push("resolve_multiple_current_leases");
    }
    if (!canonicalState.supportingLeaseId && !canonicalState.reasons.includes("MULTIPLE_CURRENT_LEASES")) {
      eligibleResolutionTypes.push("record_operational_move_out", "clear_stale_occupancy_record");
    }
    if (candidates.length === 1 && canonicalState.reasons.includes("STALE_CURRENT_LEASE_POINTER")) {
      eligibleResolutionTypes.push("link_existing_lease");
    }
  }
  if (contextMismatchRemediation.repairEligible) eligibleResolutionTypes.push("reconcile_stale_occupancy_linkage");
  const context: OccupancyResolutionContext = {
    propertyId: input.propertyId,
    unitId: input.unitId,
    tenantId,
    unitLabel: text(unit.unitNumber || unit.label) || "Unit",
    propertyLabel: text(property.name || property.addressLine1) || "Property",
    canonicalState,
    expectedStateToken: "",
    eligibleResolutionTypes,
    existingLeaseCandidates: mutationBlocked && !contextMismatchRemediation.repairEligible ? [] : candidates
      .filter((lease: any) => !contextMismatchRemediation.repairEligible || lease.id === contextMismatchRemediation.authoritativeLeaseId)
      .map((lease: any) => ({
      id: lease.id,
      label: `${text(property.name || property.addressLine1) || "Property"} · Unit ${text(unit.unitNumber || unit.label) || ""}`,
      tenantId: text(lease.primaryTenantId || lease.tenantId || lease.tenantIds?.[0]) || null,
      startDate: text(lease.startDate || lease.leaseStartDate) || null,
      endDate: text(lease.endDate || lease.leaseEndDate) || null,
      executionStatus: text(lease.executionStatus || lease.leaseExecutionState || lease.leaseExecution?.executionStatus) || null,
      participantNames: participantTenantIds(lease).map((id) => {
        const participant: any = tenantsById.get(id);
        return text(participant?.name || participant?.fullName || [participant?.firstName, participant?.lastName].map(text).filter(Boolean).join(" ")) || "Tenant record";
      }),
      participantCount: participantTenantIds(lease).length,
      reference: `Lease ${hash([input.landlordId, lease.id]).slice(0, 8).toUpperCase()}`,
      occupancyEffective: lease.occupancyEffective === true,
      activeTenancyCount: tenancies.filter((row: any) => row.status === "active" && text(row.leaseId) === lease.id).length,
    })),
    activeLeaseRequiresEndWorkflow,
    contextMismatchRemediation,
  };
  context.expectedStateToken = stateToken({ canonicalState, property, unit, tenants, leases: diagnosticLeases, tenancies: diagnosticTenancies });
  return { context, records: { propertyRef, unitRef, property, unit, tenant, tenants, tenantsById, tenantRefs, leases: relatedLeases, diagnosticLeases, diagnosticTenancies, tenancies } };
}

export async function getOccupancyResolutionContext(input: ResolutionContextInput): Promise<OccupancyResolutionContext> {
  const { context } = await readResolutionContext(db as any, input);
  return context;
}

export async function resolveOccupancy(input: ResolutionContextInput & {
  actorId: string;
  type: OccupancyResolutionType;
  expectedStateToken: string;
  idempotencyKey: string;
  confirmation: boolean;
  effectiveDate?: string | null;
  selectedLeaseId?: string | null;
}): Promise<{ context: OccupancyResolutionContext; auditEventId: string; idempotent: boolean }> {
  if (!input.confirmation) throw new OccupancyResolutionError("confirmation_required", 400);
  if (!text(input.idempotencyKey) || text(input.idempotencyKey).length > 160) throw new OccupancyResolutionError("idempotency_key_invalid", 400);
  if (input.type === "record_operational_move_out" && !/^\d{4}-\d{2}-\d{2}$/.test(text(input.effectiveDate))) {
    throw new OccupancyResolutionError("effective_date_required", 400);
  }
  if (input.type === "record_operational_move_out" && !text(input.tenantId)) {
    throw new OccupancyResolutionError("tenant_required_for_move_out", 400);
  }
  const requestId = hash([input.landlordId, input.idempotencyKey]).slice(0, 40);
  const requestRef = db.collection("occupancyResolutionRequests").doc(requestId);
  const payloadHash = hash({ propertyId: input.propertyId, unitId: input.unitId, tenantId: input.tenantId || null, type: input.type, effectiveDate: input.effectiveDate || null, selectedLeaseId: input.selectedLeaseId || null, expectedStateToken: input.expectedStateToken });

  return (db as any).runTransaction(async (transaction: any) => {
    const prior = await transaction.get(requestRef);
    if (prior.exists) {
      const data = prior.data() || {};
      if (data.payloadHash !== payloadHash) throw new OccupancyResolutionError("idempotency_key_reused", 409);
      return { context: data.resultContext, auditEventId: data.auditEventId, idempotent: true };
    }
    const loaded = await readResolutionContext(transaction, input);
    if (loaded.context.expectedStateToken !== input.expectedStateToken) {
      throw new OccupancyResolutionError("occupancy_state_stale", 409, loaded.context);
    }
    if (!loaded.context.eligibleResolutionTypes.includes(input.type)) {
      if (input.type === "record_operational_move_out" && loaded.context.activeLeaseRequiresEndWorkflow) {
        throw new OccupancyResolutionError("end_lease_workflow_required", 409, loaded.context);
      }
      throw new OccupancyResolutionError("resolution_not_applicable", 409, loaded.context);
    }

    const { records } = loaded;
    const embeddedUnits = Array.isArray(records.property.units) ? records.property.units : [];
    const matches = embeddedUnits.map((unit: any, index: number) => ({ unit, index }))
      .filter(({ unit }: any) => matchesEmbeddedUnit(unit, input.unitId, text(records.unit.unitNumber)));
    if (matches.length !== 1) throw new OccupancyResolutionError("embedded_unit_ambiguous", 409, loaded.context);
    const now = new Date().toISOString();
    let nextUnit = { ...records.unit };
    let nextTenant = records.tenant ? { ...records.tenant } : null;
    let nextTenantRef = records.tenant?.ref || null;
    let selectedLease: any = null;
    let selectedTenantId = "";
    let nextLeases = records.leases;
    const plannedTenancies = records.tenancies.map((row: any) => ({ ...row }));
    const changedFields = new Set<string>();

    if (input.type === "reconcile_stale_occupancy_linkage") {
      const remediation = loaded.context.contextMismatchRemediation;
      if (!loaded.context.canonicalState.reasons.includes("CURRENT_LEASE_CONTEXT_MISMATCH") ||
          remediation.classification !== "stale_occupancy_linkage_with_unique_authoritative_lease" ||
          !remediation.repairEligible || !remediation.authoritativeLeaseId) {
        throw new OccupancyResolutionError("stale_linkage_classification_changed", 409, loaded.context);
      }
      selectedLease = records.leases.find((lease: any) => lease.id === remediation.authoritativeLeaseId);
      const selectedParticipantIds = participantTenantIds(selectedLease);
      if (!selectedLease || selectedParticipantIds.length !== 1) {
        throw new OccupancyResolutionError("stale_linkage_not_repairable", 409, loaded.context);
      }
      selectedTenantId = selectedParticipantIds[0];
      const authoritativeTenant: any = records.tenantsById.get(selectedTenantId);
      if (!authoritativeTenant || text(authoritativeTenant.landlordId) !== input.landlordId) {
        throw new OccupancyResolutionError("stale_linkage_not_repairable", 409, loaded.context);
      }
      nextTenant = { ...authoritativeTenant };
      nextTenantRef = authoritativeTenant.ref;
      const desiredPointers: Record<string, string> = {
        tenantId: selectedTenantId,
        currentTenantId: selectedTenantId,
        leaseId: selectedLease.id,
        currentLeaseId: selectedLease.id,
      };
      for (const [field, desired] of Object.entries(desiredPointers)) {
        if (text(nextUnit[field]) !== desired) {
          nextUnit[field] = desired;
          changedFields.add(`unit.${field}`);
        }
        if (text(matches[0].unit[field]) !== desired) changedFields.add(`property.units.${field}`);
      }
      if (text(nextTenant.currentLeaseId) !== selectedLease.id) {
        nextTenant.currentLeaseId = selectedLease.id;
        changedFields.add("tenant.currentLeaseId");
      }
      if (!["current", "active", "occupied"].includes(text(nextTenant.status).toLowerCase())) {
        nextTenant.status = "current";
        changedFields.add("tenant.status");
      }
      const diagnosticContextTenancies = records.diagnosticTenancies.filter((row: any) => matchesTenancyUnitContext(
        row,
        input.propertyId,
        input.unitId,
        text(records.unit.unitNumber || records.unit.label)
      ));
      if (diagnosticContextTenancies.length > 1 || diagnosticContextTenancies.some((row: any) => text(row.landlordId) !== input.landlordId)) {
        throw new OccupancyResolutionError("stale_linkage_not_repairable", 409, loaded.context);
      }
      const contextTenancies = records.tenancies.filter((row: any) => matchesTenancyUnitContext(
        row,
        input.propertyId,
        input.unitId,
        text(records.unit.unitNumber || records.unit.label)
      ));
      if (contextTenancies.length > 1 || contextTenancies.some((row: any) =>
        text(row.landlordId) !== input.landlordId || text(row.tenantId) !== selectedTenantId || (text(row.leaseId) && text(row.leaseId) !== selectedLease.id)
      )) {
        throw new OccupancyResolutionError("stale_linkage_not_repairable", 409, loaded.context);
      }
      if (!contextTenancies.length) {
        const tenancyId = `occupancy_resolution_tenancy:${hash([input.landlordId, input.propertyId, input.unitId, selectedTenantId, selectedLease.id]).slice(0, 32)}`;
        const tenancy = { id: tenancyId, landlordId: input.landlordId, propertyId: input.propertyId, unitId: input.unitId, unitLabel: text(records.unit.unitNumber || records.unit.label) || null, tenantId: selectedTenantId, leaseId: selectedLease.id, status: "active", moveInAt: now, moveOutAt: null, source: "stale_occupancy_linkage_reconciliation", createdAt: now, updatedAt: now };
        transaction.create(db.collection("tenancies").doc(tenancyId), tenancy);
        plannedTenancies.push(tenancy);
        changedFields.add("tenancy.create");
      } else if (text(contextTenancies[0].status).toLowerCase() !== "active") {
        transaction.set(contextTenancies[0].ref, { status: "active", updatedAt: now }, { merge: true });
        const planned = plannedTenancies.find((row: any) => row.id === contextTenancies[0].id);
        if (planned) planned.status = "active";
        changedFields.add("tenancy.status");
      }
    } else if (input.type === "resolve_multiple_current_leases") {
      if (!loaded.context.canonicalState.reasons.includes("MULTIPLE_CURRENT_LEASES") || loaded.context.existingLeaseCandidates.length < 2) {
        throw new OccupancyResolutionError("multiple_current_no_longer_present", 409, loaded.context);
      }
      selectedLease = records.leases.find((lease: any) => lease.id === text(input.selectedLeaseId));
      const candidateIds = new Set(loaded.context.existingLeaseCandidates.map((lease) => lease.id));
      if (!selectedLease || !candidateIds.has(selectedLease.id)) {
        throw new OccupancyResolutionError("selected_lease_not_eligible", 409, loaded.context);
      }
      const conflictingLeases = records.leases.filter((lease: any) => candidateIds.has(lease.id));
      const conflictParticipantIds = Array.from(new Set(conflictingLeases.flatMap(participantTenantIds)));
      const selectedParticipantIds = participantTenantIds(selectedLease);
      if (!selectedParticipantIds.length || conflictParticipantIds.some((id) => {
        const tenant: any = records.tenantsById.get(id);
        return !tenant || text(tenant.landlordId) !== input.landlordId;
      })) {
        throw new OccupancyResolutionError("candidate_participant_context_ambiguous", 409, loaded.context);
      }
      const conflictParticipantSet = new Set(conflictParticipantIds);
      const unitTenantPointers = [
        records.unit.tenantId,
        records.unit.currentTenantId,
        matches[0].unit.tenantId,
        matches[0].unit.currentTenantId,
      ].map(text).filter(Boolean);
      const unitLeasePointers = [
        records.unit.leaseId,
        records.unit.currentLeaseId,
        matches[0].unit.leaseId,
        matches[0].unit.currentLeaseId,
      ].map(text).filter(Boolean);
      if (unitTenantPointers.some((id) => !conflictParticipantSet.has(id)) || unitLeasePointers.some((id) => !candidateIds.has(id))) {
        throw new OccupancyResolutionError("occupancy_projection_context_ambiguous", 409, loaded.context);
      }
      selectedTenantId = unitTenantPointers.find((id) => selectedParticipantIds.includes(id)) || selectedParticipantIds[0];
      const auditEventId = `occupancy_resolution:${requestId}`;
      const disposition = {
        status: MULTIPLE_CURRENT_OCCUPANCY_EXCLUSION,
        reason: "multiple_current_resolution",
        resolutionEventId: auditEventId,
        selectedLeaseId: selectedLease.id,
        excludedAt: now,
      };
      nextLeases = records.leases.map((lease: any) => {
        if (!candidateIds.has(lease.id)) return lease;
        return lease.id === selectedLease.id
          ? { ...lease, occupancyEffective: true, occupancyEffectiveAt: lease.occupancyEffectiveAt || now }
          : { ...lease, occupancyEffective: false, occupancyDisposition: disposition };
      });
      for (const lease of conflictingLeases) {
        const leaseRef = db.collection("leases").doc(lease.id);
        transaction.set(leaseRef, lease.id === selectedLease.id
          ? { occupancyEffective: true, occupancyEffectiveAt: lease.occupancyEffectiveAt || now, updatedAt: now }
          : { occupancyEffective: false, occupancyDisposition: disposition, updatedAt: now }, { merge: true });
      }
      const selectedParticipantSet = new Set(selectedParticipantIds);
      for (const tenant of records.tenants) {
        const currentLeaseId = text(tenant.currentLeaseId);
        if (selectedParticipantSet.has(tenant.id)) {
          transaction.set(tenant.ref, { currentLeaseId: selectedLease.id, status: "current", updatedAt: now }, { merge: true });
        } else if (candidateIds.has(currentLeaseId)) {
          transaction.set(tenant.ref, { currentLeaseId: null, updatedAt: now }, { merge: true });
        }
      }
      const selectedActiveTenancies = records.tenancies.filter((row: any) => row.status === "active" && text(row.leaseId) === selectedLease.id);
      if (selectedActiveTenancies.length > 1 || selectedActiveTenancies.some((row: any) => !selectedParticipantSet.has(text(row.tenantId)))) {
        throw new OccupancyResolutionError("selected_tenancy_context_ambiguous", 409, loaded.context);
      }
      for (const tenancy of records.tenancies.filter((row: any) => row.status === "active" && candidateIds.has(text(row.leaseId)) && text(row.leaseId) !== selectedLease.id)) {
        transaction.set(tenancy.ref, { status: "inactive", moveOutAt: now, moveOutReason: "OCCUPANCY_RECONCILIATION", updatedAt: now }, { merge: true });
        const plannedTenancy = plannedTenancies.find((row: any) => row.id === tenancy.id);
        if (plannedTenancy) plannedTenancy.status = "inactive";
      }
      if (!selectedActiveTenancies.length) {
        const tenancyId = `occupancy_resolution_tenancy:${hash([input.landlordId, input.propertyId, input.unitId, selectedTenantId, selectedLease.id]).slice(0, 32)}`;
        const selectedTenancy = {
          id: tenancyId,
          landlordId: input.landlordId,
          propertyId: input.propertyId,
          unitId: input.unitId,
          unitLabel: text(records.unit.unitNumber || records.unit.label) || null,
          tenantId: selectedTenantId,
          leaseId: selectedLease.id,
          status: "active",
          moveInAt: now,
          moveOutAt: null,
          source: "multiple_current_occupancy_resolution",
          createdAt: now,
          updatedAt: now,
        };
        transaction.create(db.collection("tenancies").doc(tenancyId), selectedTenancy);
        plannedTenancies.push(selectedTenancy);
      }
      nextUnit = { ...nextUnit, status: "occupied", occupancyStatus: "occupied", tenantId: selectedTenantId, currentTenantId: selectedTenantId, leaseId: selectedLease.id, currentLeaseId: selectedLease.id, occupancySource: "occupancy_resolution", occupancyUpdatedAt: now, updatedAt: now };
      nextTenant = records.tenantsById.get(selectedTenantId) ? { ...records.tenantsById.get(selectedTenantId), currentLeaseId: selectedLease.id, status: "current" } : null;
      ["status", "occupancyStatus", "tenantId", "currentTenantId", "leaseId", "currentLeaseId"].forEach((field) => changedFields.add(`unit.${field}`));
      changedFields.add("lease.occupancyDisposition");
      changedFields.add("lease.occupancyEffective");
      changedFields.add("tenant.currentLeaseId");
      changedFields.add("tenancy.status");
    } else if (input.type === "link_existing_lease") {
      selectedLease = records.leases.find((lease: any) => lease.id === text(input.selectedLeaseId));
      if (!selectedLease || !loaded.context.existingLeaseCandidates.some((lease) => lease.id === selectedLease.id)) {
        throw new OccupancyResolutionError("selected_lease_not_eligible", 409, loaded.context);
      }
      selectedTenantId = text(selectedLease.primaryTenantId || selectedLease.tenantId || selectedLease.tenantIds?.[0]);
      nextUnit = { ...nextUnit, status: "occupied", occupancyStatus: "occupied", tenantId: selectedTenantId || null, currentTenantId: selectedTenantId || null, leaseId: selectedLease.id, currentLeaseId: selectedLease.id, occupancySource: "occupancy_resolution", occupancyUpdatedAt: now, updatedAt: now };
      if (nextTenant) nextTenant.currentLeaseId = selectedLease.id;
      ["status", "occupancyStatus", "tenantId", "currentTenantId", "leaseId", "currentLeaseId"].forEach((field) => changedFields.add(`unit.${field}`));
      changedFields.add("tenant.currentLeaseId");
    } else {
      nextUnit = { ...nextUnit, status: "vacant", occupancyStatus: "vacant", tenantId: null, currentTenantId: null, leaseId: null, currentLeaseId: null, occupancySource: "occupancy_resolution", occupancyUpdatedAt: now, updatedAt: now };
      if (nextTenant) {
        nextTenant.currentLeaseId = null;
        nextTenant.status = "Past";
      }
      ["status", "occupancyStatus", "tenantId", "currentTenantId", "leaseId", "currentLeaseId"].forEach((field) => changedFields.add(`unit.${field}`));
      changedFields.add("tenant.currentLeaseId");
      changedFields.add("tenant.status");
    }

    const nextEmbeddedUnits = embeddedUnits.map((unit: any, index: number) => {
      if (index !== matches[0].index) return unit;
      if (input.type === "reconcile_stale_occupancy_linkage") {
        const updates = Object.fromEntries(["tenantId", "currentTenantId", "leaseId", "currentLeaseId"]
          .filter((field) => changedFields.has(`property.units.${field}`))
          .map((field) => [field, nextUnit[field]]));
        return Object.keys(updates).length ? { ...unit, ...updates, updatedAt: now } : unit;
      }
      return {
        ...unit,
        status: nextUnit.status,
        occupancyStatus: nextUnit.occupancyStatus,
        tenantId: nextUnit.tenantId,
        currentTenantId: nextUnit.currentTenantId,
        leaseId: nextUnit.leaseId,
        currentLeaseId: nextUnit.currentLeaseId,
        occupancySource: "occupancy_resolution",
        occupancyUpdatedAt: now,
        updatedAt: now,
      };
    });

    if (input.type === "record_operational_move_out" || input.type === "clear_stale_occupancy_record") {
      for (const tenancy of records.tenancies.filter((row: any) => row.status === "active")) {
        transaction.set(tenancy.ref, input.type === "record_operational_move_out"
          ? { status: "inactive", moveOutAt: `${input.effectiveDate}T00:00:00.000Z`, moveOutReason: "OTHER", moveOutReasonNote: "Operational occupancy reconciliation", updatedAt: now }
          : { status: "inactive", updatedAt: now }, { merge: true });
        const plannedTenancy = plannedTenancies.find((row: any) => row.id === tenancy.id);
        if (plannedTenancy) plannedTenancy.status = "inactive";
      }
      changedFields.add("tenancy.status");
      if (input.type === "record_operational_move_out") changedFields.add("tenancy.moveOutAt");
    }

    const selectedActivePlannedTenancies = selectedLease
      ? plannedTenancies.filter((row: any) => row.status === "active" && text(row.leaseId) === selectedLease.id)
      : [];
    if (input.type === "resolve_multiple_current_leases") {
      const candidateIds = new Set(loaded.context.existingLeaseCandidates.map((lease) => lease.id));
      const excludedActivePlannedTenancies = plannedTenancies.filter((row: any) => row.status === "active" && candidateIds.has(text(row.leaseId)) && text(row.leaseId) !== selectedLease.id);
      if (selectedActivePlannedTenancies.length !== 1 || excludedActivePlannedTenancies.length) {
        throw new OccupancyResolutionError("unsafe_canonical_postcondition", 409, loaded.context);
      }
    }

    const resultingCanonicalState = buildCanonicalLeaseOccupancyProjection({
      leases: nextLeases,
      context: { landlordId: input.landlordId, propertyId: input.propertyId, unitId: input.unitId, ...(selectedTenantId ? { tenantId: selectedTenantId } : loaded.context.tenantId ? { tenantId: loaded.context.tenantId } : {}) },
      ...resolveCanonicalUnitProjectionInputs(nextUnit),
      persistedTenancyStatus: input.type === "resolve_multiple_current_leases"
        ? selectedActivePlannedTenancies.length === 1 ? "active" : "inactive"
        : input.type === "link_existing_lease" && records.tenancies.some((row: any) => row.status === "active") ? "active" : "inactive",
      persistedTenantStatus: nextTenant?.status,
      currentLeasePointerId: nextTenant?.currentLeaseId || nextUnit.currentLeaseId,
      tenantId: selectedTenantId || loaded.context.tenantId,
    });
    const selectedOccupancyAction = input.type === "link_existing_lease" || input.type === "resolve_multiple_current_leases";
    const expectedOccupancy = selectedOccupancyAction ? "occupied" : "vacant";
    if (input.type === "reconcile_stale_occupancy_linkage") {
      if (resultingCanonicalState.reasons.includes("CURRENT_LEASE_CONTEXT_MISMATCH") || resultingCanonicalState.supportingLeaseId !== selectedLease.id) {
        throw new OccupancyResolutionError("unsafe_canonical_postcondition", 409, loaded.context);
      }
    } else if (resultingCanonicalState.occupancyState !== expectedOccupancy || (selectedOccupancyAction && resultingCanonicalState.supportingLeaseId !== selectedLease.id)) {
      throw new OccupancyResolutionError("unsafe_canonical_postcondition", 409, loaded.context);
    }

    if (input.type !== "reconcile_stale_occupancy_linkage" || [...changedFields].some((field) => field.startsWith("property.units."))) {
      transaction.set(records.propertyRef, { units: nextEmbeddedUnits, updatedAt: now }, { merge: true });
    }
    if (input.type === "reconcile_stale_occupancy_linkage") {
      const unitUpdates = Object.fromEntries(["tenantId", "currentTenantId", "leaseId", "currentLeaseId"]
        .filter((field) => changedFields.has(`unit.${field}`))
        .map((field) => [field, nextUnit[field]]));
      if (Object.keys(unitUpdates).length) transaction.set(records.unitRef, { ...unitUpdates, updatedAt: now }, { merge: true });
      const tenantUpdates: Record<string, unknown> = {};
      if (changedFields.has("tenant.currentLeaseId")) tenantUpdates.currentLeaseId = nextTenant?.currentLeaseId;
      if (changedFields.has("tenant.status")) tenantUpdates.status = nextTenant?.status;
      if (nextTenantRef && Object.keys(tenantUpdates).length) transaction.set(nextTenantRef, { ...tenantUpdates, updatedAt: now }, { merge: true });
    } else {
      transaction.set(records.unitRef, nextUnit, { merge: true });
      if (input.type !== "resolve_multiple_current_leases" && records.tenant?.ref && nextTenant) transaction.set(records.tenant.ref, { currentLeaseId: nextTenant.currentLeaseId, ...(input.type === "link_existing_lease" ? {} : { status: nextTenant.status }), updatedAt: now }, { merge: true });
    }

    const auditEventId = `occupancy_resolution:${requestId}`;
    const auditRef = db.collection("canonicalEvents").doc(auditEventId);
    transaction.create(auditRef, {
      id: auditEventId,
      version: "v1",
      type: input.type === "resolve_multiple_current_leases" ? "occupancy.multiple_current_resolved" : input.type === "reconcile_stale_occupancy_linkage" ? "occupancy.stale_linkage_reconciled" : "lease.occupancy_resolution_recorded",
      domain: "lease",
      action: input.type === "resolve_multiple_current_leases" ? "multiple_current_resolved" : input.type === "reconcile_stale_occupancy_linkage" ? "stale_occupancy_linkage_reconciled" : "occupancy_resolution_recorded",
      status: "succeeded",
      actor: { type: "landlord", id: safeRef("actor", input.actorId), role: "landlord", displayName: null },
      resource: { type: "unit", id: safeRef("unit", input.unitId), parentType: "property", parentId: safeRef("property", input.propertyId) },
      occurredAt: now,
      recordedAt: now,
      visibility: "internal",
      summary: "Operational occupancy records reconciled by landlord confirmation.",
      metadata: {
        landlordRef: safeRef("landlord", input.landlordId),
        tenantRef: (selectedTenantId || loaded.context.tenantId) ? safeRef("tenant", selectedTenantId || loaded.context.tenantId) : null,
        leaseRefs: records.leases.map((lease: any) => safeRef("lease", lease.id)),
        selectedLeaseRef: selectedLease ? safeRef("lease", selectedLease.id) : null,
        excludedLeaseRefs: input.type === "resolve_multiple_current_leases" ? records.leases.filter((lease: any) => loaded.context.existingLeaseCandidates.some((candidate) => candidate.id === lease.id) && lease.id !== selectedLease.id).map((lease: any) => safeRef("lease", lease.id)) : [],
        participantRefs: input.type === "resolve_multiple_current_leases" ? Array.from(new Set<string>(records.leases.filter((lease: any) => loaded.context.existingLeaseCandidates.some((candidate) => candidate.id === lease.id)).flatMap(participantTenantIds))).map((id) => safeRef("tenant", id)) : [],
        requestRef: safeRef("request", requestId),
        idempotencyRef: safeRef("idempotency", input.idempotencyKey),
        expectedStateRef: safeRef("expected_state", input.expectedStateToken),
        source: "occupancy_resolution_service",
        originalReasons: [...loaded.context.canonicalState.reasons].sort(),
        resultingReasons: [...resultingCanonicalState.reasons].sort(),
        resolutionType: input.type,
        landlordAssertion: input.type === "record_operational_move_out" ? "operational_occupancy_ended" : input.type === "link_existing_lease" ? "selected_lease_supports_current_occupancy" : input.type === "resolve_multiple_current_leases" ? "selected_lease_supports_current_occupancy_without_legal_determination" : input.type === "reconcile_stale_occupancy_linkage" ? "authoritative_lease_occupancy_linkage_confirmed" : "occupancy_projection_is_stale",
        effectiveDate: input.effectiveDate || null,
        changedFields: [...changedFields].sort(),
        before: { occupancyState: loaded.context.canonicalState.occupancyState, tenantRelationshipState: loaded.context.canonicalState.tenantRelationshipState, supportingLeaseRef: loaded.context.canonicalState.supportingLeaseId ? safeRef("lease", loaded.context.canonicalState.supportingLeaseId) : null },
        after: { occupancyState: resultingCanonicalState.occupancyState, tenantRelationshipState: resultingCanonicalState.tenantRelationshipState, supportingLeaseRef: resultingCanonicalState.supportingLeaseId ? safeRef("lease", resultingCanonicalState.supportingLeaseId) : null },
        legalDetermination: false,
        contractualLeaseStatusChanged: false,
      },
      tags: ["occupancy_resolution", input.type],
      appendOnly: true,
      immutable: true,
    });
    const resultContext = {
      ...loaded.context,
      tenantId: selectedTenantId || loaded.context.tenantId,
      canonicalState: resultingCanonicalState,
      expectedStateToken: "committed",
      eligibleResolutionTypes: [],
      existingLeaseCandidates: input.type === "resolve_multiple_current_leases"
        ? loaded.context.existingLeaseCandidates.filter((candidate) => candidate.id === selectedLease.id)
        : loaded.context.existingLeaseCandidates,
      activeLeaseRequiresEndWorkflow: selectedOccupancyAction,
      contextMismatchRemediation: {
        classification: "not_applicable",
        repairEligible: false,
        authoritativeLeaseId: null,
        blockedReason: "The prior mismatch was re-evaluated after reconciliation.",
        mismatchedComponents: [],
        staleLinkageFields: [],
      },
    };
    transaction.create(requestRef, { landlordId: input.landlordId, payloadHash, auditEventId, createdAt: now, resultContext });
    return { context: resultContext, auditEventId, idempotent: false };
  });
}
