import crypto from "crypto";
import { db } from "../firebase";
import { buildCanonicalLeaseOccupancyProjection } from "../lib/leases/canonicalLeaseOccupancyProjection";
import { deriveCanonicalLeaseTermState, selectCanonicalCurrentLease } from "../lib/leases/canonicalLeaseOccupancyState";
import { deriveTenantWorkspaceLifecycle } from "../lib/tenants/deriveTenantWorkspaceLifecycle";
import { leaseStartDeterministicId } from "./leaseStart/leaseStartExpectedState";
import { toCanonicalLeaseStateInput } from "../lib/leases/canonicalLeaseOccupancyProjection";

export const STALE_TENANT_REMEDIATION_SUBTYPE = "status_only_stale_after_explicit_ended_occupancy" as const;
export const STALE_TENANT_RESOLUTION_TYPE = "reconcile_stale_tenant_relationship_status" as const;

export type TenantRelationshipResolutionBlocker =
  | "active_occupancy_present" | "active_tenancy_present" | "current_lease_present"
  | "upcoming_relationship_present" | "multiple_current_ambiguity" | "current_lease_context_mismatch"
  | "stale_occupancy_linkage_requires_reconciliation" | "occupied_without_current_lease"
  | "unit_occupancy_linkage_present" | "tenant_current_lease_pointer_present"
  | "ownership_mismatch" | "ownership_ambiguous" | "participant_mismatch" | "participant_ambiguous"
  | "explicit_end_evidence_missing" | "explicit_end_evidence_ambiguous"
  | "explicit_end_evidence_not_attributable" | "relationship_status_not_current_like"
  | "already_resolved";

export type SafeEndedEvidence = {
  evidenceType: "canonical_end_lease" | "canonical_operational_move_out" | "explicit_inactive_tenancy";
  effectiveDate: string;
  safeEvidenceRef: string;
  attributionStatus: "attributed";
};

export type TenantRelationshipResolutionContext = {
  tenantId: string;
  eligible: boolean;
  remediationSubtype: typeof STALE_TENANT_REMEDIATION_SUBTYPE;
  resolutionAvailable: boolean;
  resolutionType: typeof STALE_TENANT_RESOLUTION_TYPE;
  diagnosticCategory: TenantRelationshipResolutionBlocker | "status_only_reconciliation_available";
  supportingEvidence: SafeEndedEvidence[];
  expectedStateToken: string;
  canonicalReasons: string[];
  postRepairLifecycle: "Past" | null;
};

export type TenantRelationshipResolutionRecords = {
  tenant: Record<string, any>;
  leases: Array<Record<string, any>>;
  tenancies: Array<Record<string, any>>;
  units: Array<Record<string, any>>;
  properties: Array<Record<string, any>>;
  canonicalEvents: Array<Record<string, any>>;
};

export class TenantRelationshipResolutionError extends Error {
  constructor(public code: string, public status: number, public freshContext?: TenantRelationshipResolutionContext) { super(code); }
}

function text(value: unknown): string { return String(value || "").trim(); }
function state(value: unknown): string { return text(value).toLowerCase().replace(/[\s-]+/g, "_"); }
function iso(value: unknown): string | null {
  if (!value) return null;
  const parsed = typeof (value as any)?.toDate === "function" ? (value as any).toDate() : new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
function hash(value: unknown): string { return crypto.createHash("sha256").update(stable(value)).digest("hex"); }
function safeRef(prefix: string, value: unknown): string { return `${prefix}:${hash([prefix, text(value)]).slice(0, 32)}`; }
function participants(lease: Record<string, any>): string[] {
  return Array.from(new Set([lease.tenantId, lease.primaryTenantId, ...(Array.isArray(lease.tenantIds) ? lease.tenantIds : [])].map(text).filter(Boolean)));
}
function currentLike(value: unknown): boolean { return ["current", "active", "occupied"].includes(state(value)); }
function vacant(unit: Record<string, any>): boolean {
  const statuses = [unit.status, unit.occupancyStatus].map(state).filter(Boolean);
  return statuses.length > 0 && statuses.every((value) => ["vacant", "available"].includes(value));
}
function activeTenancy(row: Record<string, any>): boolean { return ["active", "current", "occupied"].includes(state(row.status)) && !row.moveOutAt; }
function eventRefs(landlordId: string, tenantId: string) {
  return {
    landlord: new Set([safeRef("landlord", landlordId), leaseStartDeterministicId("landlord", [landlordId])]),
    tenant: new Set([safeRef("tenant", tenantId), leaseStartDeterministicId("tenant", [tenantId])]),
  };
}
function eventEvidence(records: TenantRelationshipResolutionRecords, landlordId: string, tenantId: string): { evidence: SafeEndedEvidence[]; foreign: boolean; ambiguous: boolean; unitRefs: string[] } {
  const refs = eventRefs(landlordId, tenantId);
  const evidence: SafeEndedEvidence[] = [];
  let foreign = false;
  const unitRefs = new Set<string>();
  for (const event of records.canonicalEvents) {
    const metadata = event.metadata || {};
    const tenantRefs = [metadata.tenantRef, ...(Array.isArray(metadata.tenantRefs) ? metadata.tenantRefs : [])].map(text).filter(Boolean);
    if (!tenantRefs.some((ref) => refs.tenant.has(ref))) continue;
    if (!refs.landlord.has(text(metadata.landlordRef))) { foreign = true; continue; }
    if (event.immutable !== true || event.appendOnly !== true || event.status !== "succeeded") continue;
    const effectiveDate = iso(metadata.effectiveDate || event.occurredAt);
    if (!effectiveDate) continue;
    const eventUnitRef = text(metadata.unitRef || event.resource?.id);
    if (event.type === "lease.occupancy_ended" && event.action === "occupancy_ended") {
      evidence.push({ evidenceType: "canonical_end_lease", effectiveDate, safeEvidenceRef: safeRef("evidence", event.id || event.eventId), attributionStatus: "attributed" });
      if (eventUnitRef) unitRefs.add(eventUnitRef);
    }
    if (event.action === "occupancy_resolution_recorded" && metadata.resolutionType === "record_operational_move_out" && metadata.effectiveDate && metadata.after?.occupancyState === "vacant") {
      evidence.push({ evidenceType: "canonical_operational_move_out", effectiveDate, safeEvidenceRef: safeRef("evidence", event.id || event.eventId), attributionStatus: "attributed" });
      if (eventUnitRef) unitRefs.add(eventUnitRef);
    }
  }
  const inactive = records.tenancies.filter((row) => text(row.tenantId) === tenantId && state(row.status) === "inactive" && row.moveOutAt && text(row.moveOutReason));
  for (const row of inactive) {
    if (text(row.landlordId) !== landlordId) { foreign = true; continue; }
    const effectiveDate = iso(row.moveOutAt);
    if (effectiveDate) evidence.push({ evidenceType: "explicit_inactive_tenancy", effectiveDate, safeEvidenceRef: safeRef("tenancy_evidence", row.id), attributionStatus: "attributed" });
  }
  const contexts = new Set(inactive.filter((row) => text(row.landlordId) === landlordId).map((row) => `${text(row.propertyId)}:${text(row.unitId || row.unitLabel)}`).filter((value) => value !== ":"));
  const contextCounts = [...contexts].map((context) => records.units.filter((unit) => `${text(unit.propertyId)}:${text(unit.id || unit.unitId || unit.unitNumber || unit.label)}` === context).length);
  const eventUnitCounts = [...unitRefs].map((ref) => records.units.filter((unit) => [safeRef("unit", unit.id), leaseStartDeterministicId("unit", [unit.id])].includes(ref)).length);
  const hasEventEvidence = evidence.some((item) => item.evidenceType !== "explicit_inactive_tenancy");
  return { evidence: evidence.sort((a, b) => a.safeEvidenceRef.localeCompare(b.safeEvidenceRef)), foreign, ambiguous: contexts.size > 1 || contextCounts.some((count) => count !== 1) || eventUnitCounts.some((count) => count !== 1) || (hasEventEvidence && unitRefs.size === 0), unitRefs: [...unitRefs].sort() };
}

export function classifyStaleTenantRelationship(input: { landlordId: string; tenantId: string; records: TenantRelationshipResolutionRecords }): TenantRelationshipResolutionContext {
  const { landlordId, tenantId, records } = input;
  const tenant = records.tenant;
  const tenantLeases = records.leases.filter((lease) => participants(lease).includes(tenantId));
  const selection = selectCanonicalCurrentLease(tenantLeases.map(toCanonicalLeaseStateInput), { landlordId, tenantId });
  const upcoming = tenantLeases.filter((lease) => deriveCanonicalLeaseTermState(toCanonicalLeaseStateInput(lease)).state === "upcoming");
  const tenantTenancies = records.tenancies.filter((row) => text(row.tenantId) === tenantId);
  const evidence = eventEvidence(records, landlordId, tenantId);
  const tenancyContexts = new Set(tenantTenancies.map((row) => `${text(row.propertyId)}:${text(row.unitId || row.unitLabel)}`).filter((value) => value !== ":"));
  const unitInPriorContext = (unit: Record<string, any>) => tenancyContexts.has(`${text(unit.propertyId)}:${text(unit.id || unit.unitId || unit.unitNumber || unit.label)}`);
  const linkedUnits = records.units.filter((unit) => [unit.tenantId, unit.currentTenantId].map(text).includes(tenantId) || unitInPriorContext(unit) || (tenant.propertyId && text(unit.propertyId) === text(tenant.propertyId) && tenant.unitId && text(unit.id) === text(tenant.unitId)));
  const embeddedUnits = records.properties.flatMap((property) => (Array.isArray(property.units) ? property.units : []).map((unit: any) => ({ ...unit, propertyId: property.id, landlordId: property.landlordId || property.ownerId || property.owner })));
  const eventUnits = records.units.filter((unit) => evidence.unitRefs.some((ref) => [safeRef("unit", unit.id), leaseStartDeterministicId("unit", [unit.id])].includes(ref)));
  const relevantUnits = [...linkedUnits, ...eventUnits, ...embeddedUnits.filter((unit) => [unit.tenantId, unit.currentTenantId].map(text).includes(tenantId) || unitInPriorContext(unit))];
  const propertyContextAmbiguous = relevantUnits.some((unit) => records.properties.filter((property) => text(property.id) === text(unit.propertyId) && text(property.landlordId || property.ownerId || property.owner) === landlordId).length !== 1);
  const projection = buildCanonicalLeaseOccupancyProjection({ leases: tenantLeases, context: { landlordId, tenantId }, persistedTenantStatus: tenant.status, currentLeasePointerId: tenant.currentLeaseId, tenantId });
  let blocker: TenantRelationshipResolutionBlocker | null = null;
  if (!tenant || !text(tenant.landlordId)) blocker = "ownership_ambiguous";
  else if (text(tenant.landlordId) !== landlordId) blocker = "ownership_mismatch";
  else if (tenantTenancies.some((row) => !text(row.landlordId))) blocker = "ownership_ambiguous";
  else if (tenantTenancies.some((row) => text(row.landlordId) !== landlordId) || relevantUnits.some((unit) => text(unit.landlordId) && text(unit.landlordId) !== landlordId)) blocker = "ownership_mismatch";
  else if (tenantLeases.some((lease) => participants(lease).length > 1)) blocker = "participant_ambiguous";
  else if (!currentLike(tenant.status)) blocker = ["past", "former", "inactive", "ended", "vacated"].includes(state(tenant.status)) ? "already_resolved" : "relationship_status_not_current_like";
  else if (text(tenant.currentLeaseId)) blocker = "tenant_current_lease_pointer_present";
  else if (selection.reasons.includes("MULTIPLE_CURRENT_LEASES")) blocker = "multiple_current_ambiguity";
  else if (selection.reasons.includes("CURRENT_LEASE_CONTEXT_MISMATCH")) blocker = "current_lease_context_mismatch";
  else if (selection.lease) blocker = "current_lease_present";
  else if (upcoming.length) blocker = "upcoming_relationship_present";
  else if (tenantTenancies.some(activeTenancy)) blocker = "active_tenancy_present";
  else if (relevantUnits.some((unit) => !vacant(unit))) blocker = "active_occupancy_present";
  else if (relevantUnits.some((unit) => [unit.currentTenantId, unit.currentLeaseId, unit.tenantId, unit.leaseId].some((value) => text(value)))) blocker = "unit_occupancy_linkage_present";
  else if (projection.reasons.includes("OCCUPIED_WITHOUT_CURRENT_LEASE")) blocker = "occupied_without_current_lease";
  else if (projection.reasons.includes("STALE_CURRENT_LEASE_POINTER")) blocker = "stale_occupancy_linkage_requires_reconciliation";
  else if (projection.reasons.some((reason) => !["TENANT_CURRENT_WITHOUT_CURRENT_LEASE", "PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY", "ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY"].includes(reason))) blocker = "stale_occupancy_linkage_requires_reconciliation";
  else if (evidence.foreign) blocker = "explicit_end_evidence_not_attributable";
  else if (evidence.ambiguous || propertyContextAmbiguous) blocker = "explicit_end_evidence_ambiguous";
  else if (!evidence.evidence.length) blocker = "explicit_end_evidence_missing";
  const material = {
    tenant: { id: tenantId, landlordId: tenant?.landlordId ?? null, status: tenant?.status ?? null, relationshipStatus: tenant?.relationshipStatus ?? null, currentLeaseId: tenant?.currentLeaseId ?? null, updatedAt: tenant?.updatedAt ?? null },
    leases: tenantLeases.map((lease) => ({ id: lease.id, landlordId: lease.landlordId, propertyId: lease.propertyId, unitId: lease.unitId, participants: participants(lease), status: lease.status, startDate: lease.startDate || lease.leaseStartDate, endDate: lease.endDate || lease.leaseEndDate, endedAt: lease.endedAt, executionStatus: lease.executionStatus, updatedAt: lease.updatedAt })).sort((a, b) => text(a.id).localeCompare(text(b.id))),
    units: relevantUnits.map((unit) => ({ id: unit.id, propertyId: unit.propertyId, landlordId: unit.landlordId, status: unit.status, occupancyStatus: unit.occupancyStatus, tenantId: unit.tenantId, currentTenantId: unit.currentTenantId, leaseId: unit.leaseId, currentLeaseId: unit.currentLeaseId, updatedAt: unit.updatedAt })).sort((a, b) => text(a.id).localeCompare(text(b.id))),
    tenancies: tenantTenancies.map((row) => ({ id: row.id, landlordId: row.landlordId, propertyId: row.propertyId, unitId: row.unitId, tenantId: row.tenantId, leaseId: row.leaseId, status: row.status, moveOutAt: row.moveOutAt, moveOutReason: row.moveOutReason, updatedAt: row.updatedAt })).sort((a, b) => text(a.id).localeCompare(text(b.id))),
    evidence: evidence.evidence,
    canonicalReasons: [...projection.reasons].sort(), currentCandidateIds: selection.candidates.map((row) => row.lease.id).sort(), upcomingCandidateIds: upcoming.map((row) => row.id).sort(), blocker,
  };
  const eligible = blocker === null && projection.reasons.includes("TENANT_CURRENT_WITHOUT_CURRENT_LEASE");
  return { tenantId, eligible, remediationSubtype: STALE_TENANT_REMEDIATION_SUBTYPE, resolutionAvailable: eligible, resolutionType: STALE_TENANT_RESOLUTION_TYPE, diagnosticCategory: eligible ? "status_only_reconciliation_available" : blocker || "explicit_end_evidence_missing", supportingEvidence: eligible ? evidence.evidence : [], expectedStateToken: hash({ version: "tenant_relationship_status_resolution_v1", ...material }), canonicalReasons: projection.reasons, postRepairLifecycle: eligible ? "Past" : null };
}

async function rows(reader: any, collection: string): Promise<Array<Record<string, any>>> {
  const target = db.collection(collection);
  const snapshot = typeof reader.get === "function" ? await reader.get(target) : await target.get();
  return (snapshot.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

async function readContext(reader: any, landlordId: string, tenantId: string) {
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = typeof reader.get === "function" ? await reader.get(tenantRef) : await tenantRef.get();
  if (!tenantSnap.exists) throw new TenantRelationshipResolutionError("ownership_ambiguous", 404);
  const tenant = { id: tenantSnap.id, ref: tenantRef, ...(tenantSnap.data() || {}) };
  if (text(tenant.landlordId) !== landlordId) throw new TenantRelationshipResolutionError("ownership_mismatch", 403);
  const [leases, tenancies, units, properties, canonicalEvents] = await Promise.all(["leases", "tenancies", "units", "properties", "canonicalEvents"].map((name) => rows(reader, name)));
  const records = { tenant, leases, tenancies, units, properties, canonicalEvents };
  return { context: classifyStaleTenantRelationship({ landlordId, tenantId, records }), records, tenantRef };
}

export async function getTenantRelationshipResolutionContext(input: { landlordId: string; tenantId: string }): Promise<TenantRelationshipResolutionContext> {
  return (await readContext(db as any, input.landlordId, input.tenantId)).context;
}

export async function resolveStaleTenantRelationshipStatus(input: { landlordId: string; tenantId: string; actorId: string; expectedStateToken: string; idempotencyKey: string; confirmation: boolean }) {
  if (!input.confirmation) throw new TenantRelationshipResolutionError("confirmation_required", 400);
  if (!text(input.idempotencyKey) || text(input.idempotencyKey).length > 160) throw new TenantRelationshipResolutionError("idempotency_key_invalid", 400);
  const requestId = hash([input.landlordId, input.idempotencyKey]).slice(0, 40);
  const requestRef = db.collection("occupancyResolutionRequests").doc(requestId);
  const payloadHash = hash({ tenantId: input.tenantId, type: STALE_TENANT_RESOLUTION_TYPE, expectedStateToken: input.expectedStateToken });
  return (db as any).runTransaction(async (transaction: any) => {
    const prior = await transaction.get(requestRef);
    if (prior.exists) {
      const data = prior.data() || {};
      if (data.payloadHash !== payloadHash) throw new TenantRelationshipResolutionError("idempotency_key_reused", 409);
      return { ...data.result, idempotent: true };
    }
    const loaded = await readContext(transaction, input.landlordId, input.tenantId);
    if (loaded.context.diagnosticCategory === "already_resolved") return { context: loaded.context, auditEventId: null, idempotent: false, outcome: "already_resolved" as const };
    if (loaded.context.expectedStateToken !== input.expectedStateToken) throw new TenantRelationshipResolutionError("state_changed", 409, loaded.context);
    if (!loaded.context.eligible) throw new TenantRelationshipResolutionError(loaded.context.diagnosticCategory, 409, loaded.context);
    const beforeStatus = text(loaded.records.tenant.status);
    const now = new Date().toISOString();
    const tenantUpdate: Record<string, unknown> = { status: "Past", updatedAt: now };
    if (Object.prototype.hasOwnProperty.call(loaded.records.tenant, "relationshipStatus") && currentLike(loaded.records.tenant.relationshipStatus)) tenantUpdate.relationshipStatus = "past";
    const nextTenant = { ...loaded.records.tenant, ...tenantUpdate };
    const nextContext = classifyStaleTenantRelationship({ landlordId: input.landlordId, tenantId: input.tenantId, records: { ...loaded.records, tenant: nextTenant } });
    const lifecycle = deriveTenantWorkspaceLifecycle({ canonicalState: buildCanonicalLeaseOccupancyProjection({ leases: loaded.records.leases.filter((lease) => participants(lease).includes(input.tenantId)), context: { landlordId: input.landlordId, tenantId: input.tenantId }, persistedTenantStatus: nextTenant.status, currentLeasePointerId: nextTenant.currentLeaseId, tenantId: input.tenantId }), leases: loaded.records.leases.filter((lease) => participants(lease).includes(input.tenantId)).map(toCanonicalLeaseStateInput), archivedAt: nextTenant.archivedAt });
    if (nextContext.canonicalReasons.includes("TENANT_CURRENT_WITHOUT_CURRENT_LEASE") || lifecycle.label !== "Past" || lifecycle.isArchived) throw new TenantRelationshipResolutionError("postcondition_failed", 409);
    const auditEventId = `occupancy_resolution:${requestId}`;
    transaction.set(loaded.tenantRef, tenantUpdate, { merge: true });
    transaction.create(db.collection("canonicalEvents").doc(auditEventId), { id: auditEventId, version: "v1", type: "tenant.relationship_status_reconciled", domain: "tenant", action: "stale_tenant_relationship_status_reconciled", status: "succeeded", actor: { type: "landlord", id: safeRef("actor", input.actorId), role: "landlord", displayName: null }, resource: { type: "tenant", id: safeRef("tenant", input.tenantId) }, occurredAt: now, recordedAt: now, visibility: "internal", summary: "Stale tenant relationship status reconciled from explicit ended-occupancy evidence.", metadata: { landlordRef: safeRef("landlord", input.landlordId), tenantRef: safeRef("tenant", input.tenantId), beforeStatus, afterStatus: "Past", supportingEndedEvidenceRefs: loaded.context.supportingEvidence.map((item) => item.safeEvidenceRef), canonicalReasonResolved: "TENANT_CURRENT_WITHOUT_CURRENT_LEASE", expectedStateRef: safeRef("expected_state", input.expectedStateToken), idempotencyRef: safeRef("idempotency", input.idempotencyKey), legalDetermination: false, changedFields: Object.keys(tenantUpdate).filter((key) => key !== "updatedAt").map((key) => `tenant.${key}`).sort() }, tags: ["tenant_relationship_resolution", STALE_TENANT_RESOLUTION_TYPE], appendOnly: true, immutable: true });
    const result = { context: { ...nextContext, postRepairLifecycle: "Past" as const }, auditEventId, idempotent: false, outcome: "resolved" as const };
    transaction.create(requestRef, { landlordId: input.landlordId, payloadHash, auditEventId, createdAt: now, result });
    return result;
  });
}
