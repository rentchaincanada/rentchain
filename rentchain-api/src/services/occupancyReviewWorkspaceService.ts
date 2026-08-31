import crypto from "crypto";
import { db } from "../firebase";
import {
  buildCanonicalLeaseOccupancyProjection,
  resolveCanonicalUnitProjectionInputs,
  type CanonicalLeaseOccupancyProjection,
} from "../lib/leases/canonicalLeaseOccupancyProjection";
import type { CanonicalLeaseConflictReason } from "../lib/leases/canonicalLeaseOccupancyState";
import { normalizeUnitToken, toCanonicalLeaseRecord, toCanonicalUnitRecord } from "./leaseCanonicalizationService";
import { classifyStaleTenantRelationship, type SafeEndedEvidence, type TenantRelationshipResolutionBlocker } from "./tenantRelationshipStatusResolutionService";

export type OccupancyReviewCategory = "occupancy" | "lease" | "signing" | "tenant_relationship";
export type OccupancyReviewAction =
  | "resolve_multiple_current"
  | "resolve_occupancy"
  | "continue_signing"
  | "review_lease_dates"
  | "review_lease"
  | "review_tenant_relationship"
  | "review_only";

export type OccupancyReviewItem = {
  id: string;
  scope: "unit" | "tenant";
  landlordId: string;
  propertyId: string | null;
  propertyName: string | null;
  unitId: string | null;
  unitLabel: string | null;
  tenantId: string | null;
  tenantName: string | null;
  supportingLeaseId: string | null;
  candidateLeaseIds: string[];
  canonicalState: CanonicalLeaseOccupancyProjection;
  reasons: CanonicalLeaseConflictReason[];
  severity: "high" | "medium" | "low";
  category: OccupancyReviewCategory;
  action: OccupancyReviewAction;
  actionTarget: string | null;
  stableSortKey: string;
  remediationSubtype: "status_only_stale_after_explicit_ended_occupancy" | null;
  resolutionAvailable: boolean;
  resolutionType: "reconcile_stale_tenant_relationship_status" | null;
  diagnosticCategory: TenantRelationshipResolutionBlocker | "status_only_reconciliation_available" | null;
  supportingEvidence: SafeEndedEvidence[];
  expectedStateToken: string | null;
};

export type OccupancyReviewWorkspace = {
  items: OccupancyReviewItem[];
  counts: { total: number; multipleCurrent: number; occupancy: number; lease: number; signing: number; tenantRelationship: number };
};

export type OccupancyReviewRecords = {
  properties: Array<Record<string, any>>;
  units: Array<Record<string, any>>;
  leases: Array<Record<string, any>>;
  tenants: Array<Record<string, any>>;
  tenancies: Array<Record<string, any>>;
  canonicalEvents?: Array<Record<string, any>>;
};

const OCCUPANCY_REASONS = new Set<CanonicalLeaseConflictReason>([
  "MULTIPLE_CURRENT_LEASES", "CURRENT_LEASE_CONTEXT_MISMATCH", "OCCUPIED_WITHOUT_CURRENT_LEASE",
  "VACANT_WITH_CURRENT_LEASE", "STALE_CURRENT_LEASE_POINTER",
]);
const LEASE_REASONS = new Set<CanonicalLeaseConflictReason>([
  "INVALID_LEASE_DATE_RANGE", "DRAFT_LEASE_CANNOT_SUPPORT_OCCUPANCY", "UPCOMING_LEASE_CANNOT_SUPPORT_OCCUPANCY",
  "PAST_LEASE_CANNOT_SUPPORT_OCCUPANCY", "ENDED_LEASE_CANNOT_SUPPORT_OCCUPANCY",
]);

function text(value: unknown): string { return String(value || "").trim(); }
function normalize(value: unknown): string { return text(value).toLowerCase().replace(/[\s-]+/g, "_"); }
function participantIds(lease: Record<string, any>): string[] {
  return Array.from(new Set([lease.tenantId, lease.primaryTenantId, ...(Array.isArray(lease.tenantIds) ? lease.tenantIds : [])].map(text).filter(Boolean)));
}
function stableId(landlordId: string, scope: string, contextId: string): string {
  return `occupancy_review:${crypto.createHash("sha256").update(`${landlordId}:${scope}:${contextId}`).digest("hex").slice(0, 32)}`;
}
function tenantName(tenant?: Record<string, any>): string | null {
  return text(tenant?.name || tenant?.fullName || [tenant?.firstName, tenant?.lastName].map(text).filter(Boolean).join(" ")) || null;
}

type ReviewUnitCandidate = {
  propertyId: string;
  unitId: string;
  unitLabel: string;
  standalone: Record<string, any> | null;
  embedded: Record<string, any> | null;
};

function embeddedIdentity(unit: Record<string, any>): string {
  return text(unit.id || unit.unitId || unit.unitNumber || unit.unit || unit.label || unit.displayLabel);
}

function unitTokens(unit: Record<string, any>): Set<string> {
  return new Set([unit.id, unit.unitId, unit.unitNumber, unit.unit, unit.name, unit.label, unit.displayLabel, unit.unitLabel]
    .map(normalizeUnitToken).filter(Boolean));
}

function candidatesForOwnedProperties(properties: Map<string, Record<string, any>>, rows: Array<Record<string, any>>): ReviewUnitCandidate[] {
  const candidates: ReviewUnitCandidate[] = [];
  for (const unit of rows) {
    const propertyId = text(unit.propertyId);
    const explicitLandlordId = text(unit.landlordId);
    if (!properties.has(propertyId) || (explicitLandlordId && explicitLandlordId !== text(properties.get(propertyId)?.landlordId || properties.get(propertyId)?.ownerId || properties.get(propertyId)?.owner))) continue;
    const unitId = text(unit.id);
    if (!unitId) continue;
    candidates.push({ propertyId, unitId, unitLabel: text(unit.unitNumber || unit.label) || "Unit", standalone: unit, embedded: null });
  }
  for (const [propertyId, property] of properties) {
    for (const embedded of Array.isArray(property.units) ? property.units : []) {
      const identity = embeddedIdentity(embedded);
      if (!identity) continue;
      const embeddedTokens = unitTokens(embedded);
      const matches = candidates.filter((candidate) => candidate.propertyId === propertyId && candidate.standalone &&
        [...unitTokens(candidate.standalone)].some((token) => embeddedTokens.has(token)));
      if (matches.length === 1) {
        matches[0].embedded = embedded;
        if (matches[0].unitLabel === "Unit") matches[0].unitLabel = text(embedded.unitNumber || embedded.label) || "Unit";
      } else if (matches.length === 0) {
        candidates.push({ propertyId, unitId: identity, unitLabel: text(embedded.unitNumber || embedded.label || identity), standalone: null, embedded });
      }
      // Ambiguous embedded identity fails closed instead of joining to the wrong unit.
    }
  }
  return candidates;
}

export function classifyOccupancyReviewAction(reasons: CanonicalLeaseConflictReason[], input: { propertyId?: string | null; unitId?: string | null; tenantId?: string | null; supportingLeaseId?: string | null } = {}) {
  const has = (reason: CanonicalLeaseConflictReason) => reasons.includes(reason);
  if (has("MULTIPLE_CURRENT_LEASES") && input.propertyId && input.unitId) return { category: "occupancy" as const, severity: "high" as const, action: "resolve_multiple_current" as const, actionTarget: `/properties?propertyId=${encodeURIComponent(input.propertyId)}&unitId=${encodeURIComponent(input.unitId)}&resolveOccupancy=1` };
  if (["OCCUPIED_WITHOUT_CURRENT_LEASE", "VACANT_WITH_CURRENT_LEASE", "STALE_CURRENT_LEASE_POINTER", "CURRENT_LEASE_CONTEXT_MISMATCH"].some((reason) => reasons.includes(reason as CanonicalLeaseConflictReason)) && input.propertyId && input.unitId) {
    return { category: "occupancy" as const, severity: "high" as const, action: "resolve_occupancy" as const, actionTarget: `/properties?propertyId=${encodeURIComponent(input.propertyId)}&unitId=${encodeURIComponent(input.unitId)}&resolveOccupancy=1` };
  }
  if (has("LEASE_EXECUTION_INCOMPLETE") && input.supportingLeaseId) return { category: "signing" as const, severity: "medium" as const, action: "continue_signing" as const, actionTarget: `/leases?view=pending-signing&leaseId=${encodeURIComponent(input.supportingLeaseId)}` };
  if (has("INVALID_LEASE_DATE_RANGE")) return { category: "lease" as const, severity: "medium" as const, action: "review_lease_dates" as const, actionTarget: input.supportingLeaseId ? `/leases/${encodeURIComponent(input.supportingLeaseId)}/summary` : "/leases" };
  if (has("TENANT_CURRENT_WITHOUT_CURRENT_LEASE")) return { category: "tenant_relationship" as const, severity: "medium" as const, action: "review_tenant_relationship" as const, actionTarget: input.tenantId ? `/tenants?tenantId=${encodeURIComponent(input.tenantId)}` : "/tenants" };
  if (reasons.some((reason) => LEASE_REASONS.has(reason))) return { category: "lease" as const, severity: "low" as const, action: "review_lease" as const, actionTarget: input.supportingLeaseId ? `/leases/${encodeURIComponent(input.supportingLeaseId)}/summary` : "/leases" };
  return { category: OCCUPANCY_REASONS.has(reasons[0]) ? "occupancy" as const : "lease" as const, severity: "low" as const, action: "review_only" as const, actionTarget: null };
}

export function aggregateOccupancyReviewWorkspace(landlordId: string, records: OccupancyReviewRecords): OccupancyReviewWorkspace {
  const properties = new Map(records.properties.filter((row) => text(row.landlordId || row.ownerId || row.owner) === landlordId).map((row) => [text(row.id), row]));
  const candidates = candidatesForOwnedProperties(properties, records.units);
  const canonicalUnits = candidates.map((candidate) => toCanonicalUnitRecord(candidate.unitId, {
    ...(candidate.embedded || {}), ...(candidate.standalone || {}), propertyId: candidate.propertyId,
    landlordId, unitNumber: candidate.unitLabel,
  }));
  const leases = records.leases.filter((row) => {
    const explicitLandlordId = text(row.landlordId);
    return properties.has(text(row.propertyId)) && (!explicitLandlordId || explicitLandlordId === landlordId);
  });
  const tenants = new Map(records.tenants.filter((row) => text(row.landlordId) === landlordId).map((row) => [text(row.id), row]));
  const tenancies = records.tenancies.filter((row) => !row.landlordId || text(row.landlordId) === landlordId);
  const items: OccupancyReviewItem[] = [];

  for (const candidate of candidates) {
    const propertyId = candidate.propertyId;
    const unitId = candidate.unitId;
    const property = properties.get(propertyId)!;
    const matchedLeases = leases
      .map((lease) => toCanonicalLeaseRecord(text(lease.id), lease, canonicalUnits))
      .filter((lease) => lease.resolvedUnitId === unitId);
    const representations = [candidate.standalone, candidate.embedded].filter((row): row is Record<string, any> => Boolean(row));
    const representationInputs = representations.map(resolveCanonicalUnitProjectionInputs);
    const pointerIds = representationInputs.map((input) => text(input.currentLeasePointerId)).filter(Boolean);
    const pointedLeases = pointerIds.map((id) => leases.find((lease) => text(lease.id) === id)).filter((lease): lease is Record<string, any> => Boolean(lease));
    const relatedLeases = [...matchedLeases];
    for (const lease of pointedLeases) if (!relatedLeases.some((row) => row.id === text(lease.id))) relatedLeases.push(toCanonicalLeaseRecord(text(lease.id), lease, canonicalUnits));
    const contextTenancies = tenancies.filter((row) => text(row.propertyId) === propertyId &&
      (text(row.unitId) === unitId || normalizeUnitToken(row.unitLabel) === normalizeUnitToken(candidate.unitLabel)));
    const tenantId = representationInputs.map((input) => text(input.tenantId)).find(Boolean) || participantIds(relatedLeases[0] || {})[0] || null;
    const tenant = tenantId ? tenants.get(tenantId) : undefined;
    const projections = representationInputs.map((unitInputs) => buildCanonicalLeaseOccupancyProjection({
      leases: relatedLeases, context: { landlordId, propertyId, unitId }, ...unitInputs,
      persistedTenancyStatus: contextTenancies.some((row) => normalize(row.status) === "active") ? "active" : unitInputs.persistedTenancyStatus,
      persistedTenantStatus: tenant?.status, currentLeasePointerId: tenant?.currentLeaseId || unitInputs.currentLeasePointerId, tenantId,
    }));
    const canonicalState = projections.find((projection) => projection.occupancyState === "review_needed") ||
      projections.find((projection) => projection.tenantRelationshipState === "occupancy_unresolved") || projections[0];
    if (!canonicalState) continue;
    const reasons = [...canonicalState.reasons];
    const needsReview = canonicalState.occupancyState === "review_needed" || canonicalState.tenantRelationshipState === "occupancy_unresolved";
    if (!needsReview || reasons.length === 0) continue;
    const candidates = relatedLeases.filter((lease) => {
      const projection = buildCanonicalLeaseOccupancyProjection({ leases: [lease], context: { landlordId, propertyId, unitId }, ...(representationInputs[0] || {}) });
      return projection.supportingLeaseId === lease.id;
    }).map((lease) => lease.id).sort();
    const guidance = candidate.standalone
      ? classifyOccupancyReviewAction(reasons, { propertyId, unitId, tenantId, supportingLeaseId: canonicalState.supportingLeaseId })
      : { category: OCCUPANCY_REASONS.has(reasons[0]) ? "occupancy" as const : "lease" as const, severity: "high" as const, action: "review_only" as const, actionTarget: null };
    const propertyName = text(property.name || property.addressLine1) || "Property";
    const unitLabel = candidate.unitLabel;
    items.push({ id: stableId(landlordId, "unit", `${propertyId}:${unitId}`), scope: "unit", landlordId, propertyId, propertyName, unitId, unitLabel, tenantId, tenantName: tenantName(tenant), supportingLeaseId: canonicalState.supportingLeaseId, candidateLeaseIds: candidates, canonicalState, reasons, ...guidance, stableSortKey: `${guidance.severity}:${propertyName.toLowerCase()}:${unitLabel.toLowerCase()}:${unitId}`, remediationSubtype: null, resolutionAvailable: false, resolutionType: null, diagnosticCategory: null, supportingEvidence: [], expectedStateToken: null });
  }

  const representedTenants = new Set(items.map((item) => item.tenantId).filter(Boolean));
  for (const tenant of tenants.values()) {
    const tenantId = text(tenant.id);
    if (representedTenants.has(tenantId) || !["current", "active", "occupied"].includes(normalize(tenant.status)) || text(tenant.currentLeaseId)) continue;
    const tenantLeases = leases.filter((lease) => participantIds(lease).includes(tenantId));
    const canonicalState = buildCanonicalLeaseOccupancyProjection({ leases: tenantLeases, context: { landlordId, tenantId }, persistedTenantStatus: tenant.status, currentLeasePointerId: tenant.currentLeaseId, tenantId });
    if (!canonicalState.reasons.includes("TENANT_CURRENT_WITHOUT_CURRENT_LEASE")) continue;
    const guidance = classifyOccupancyReviewAction(canonicalState.reasons, { tenantId, supportingLeaseId: canonicalState.supportingLeaseId });
    const remediation = classifyStaleTenantRelationship({ landlordId, tenantId, records: { tenant, leases: records.leases, tenancies: records.tenancies, units: records.units, properties: records.properties, canonicalEvents: records.canonicalEvents || [] } });
    const name = tenantName(tenant) || "Tenant record";
    items.push({ id: stableId(landlordId, "tenant", tenantId), scope: "tenant", landlordId, propertyId: null, propertyName: null, unitId: null, unitLabel: null, tenantId, tenantName: name, supportingLeaseId: canonicalState.supportingLeaseId, candidateLeaseIds: [], canonicalState, reasons: canonicalState.reasons, ...guidance, stableSortKey: `${guidance.severity}:tenant:${name.toLowerCase()}:${tenantId}`, remediationSubtype: remediation.remediationSubtype, resolutionAvailable: remediation.resolutionAvailable, resolutionType: remediation.resolutionAvailable ? remediation.resolutionType : null, diagnosticCategory: remediation.diagnosticCategory, supportingEvidence: remediation.supportingEvidence, expectedStateToken: remediation.expectedStateToken });
  }

  const severityRank = { high: 0, medium: 1, low: 2 };
  const sorted = items.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.stableSortKey.localeCompare(b.stableSortKey) || a.id.localeCompare(b.id));
  return { items: sorted, counts: { total: sorted.length, multipleCurrent: sorted.filter((item) => item.reasons.includes("MULTIPLE_CURRENT_LEASES")).length, occupancy: sorted.filter((item) => item.category === "occupancy").length, lease: sorted.filter((item) => item.category === "lease").length, signing: sorted.filter((item) => item.category === "signing").length, tenantRelationship: sorted.filter((item) => item.category === "tenant_relationship").length } };
}

async function landlordRows(collection: string, landlordId: string) {
  const snap = await db.collection(collection).where("landlordId", "==", landlordId).get();
  return (snap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
}

async function ownedProperties(landlordId: string): Promise<Array<Record<string, any>>> {
  const snapshots = await Promise.all(["landlordId", "ownerId", "owner"].map((field) => db.collection("properties").where(field, "==", landlordId).get()));
  return Array.from(new Map<string, Record<string, any>>(snapshots.flatMap((snap: any) => (snap.docs || []).map((doc: any) => [doc.id, { id: doc.id, ...(doc.data() || {}) }]))).values());
}

async function propertyRows(collection: string, propertyIds: string[]): Promise<Array<Record<string, any>>> {
  const chunks: string[][] = [];
  for (let index = 0; index < propertyIds.length; index += 30) chunks.push(propertyIds.slice(index, index + 30));
  const snapshots = await Promise.all(chunks.map((ids) => db.collection(collection).where("propertyId", "in", ids).get()));
  return Array.from(new Map<string, Record<string, any>>(snapshots.flatMap((snap: any) => (snap.docs || []).map((doc: any) => [doc.id, { id: doc.id, ...(doc.data() || {}) }]))).values());
}

async function contextRows(collection: string, propertyIds: string[], tenantIds: string[], tenantFields: Array<{ field: string; operator?: "in" | "array-contains-any" }>): Promise<Array<Record<string, any>>> {
  const rows = await propertyRows(collection, propertyIds);
  const chunks: string[][] = [];
  for (let index = 0; index < tenantIds.length; index += 30) chunks.push(tenantIds.slice(index, index + 30));
  const snapshots = await Promise.all(tenantFields.flatMap(({ field, operator = "in" }) =>
    chunks.map((ids) => db.collection(collection).where(field, operator, ids).get())));
  return Array.from(new Map<string, Record<string, any>>([
    ...rows.map((row) => [text(row.id), row] as [string, Record<string, any>]),
    ...snapshots.flatMap((snap: any) => (snap.docs || []).map((doc: any) => [doc.id, { id: doc.id, ...(doc.data() || {}) }] as [string, Record<string, any>])),
  ]).values());
}

export async function getOccupancyReviewWorkspace(landlordId: string): Promise<OccupancyReviewWorkspace> {
  const properties = await ownedProperties(landlordId);
  const propertyIds = properties.map((property) => text(property.id)).filter(Boolean);
  const tenants = await landlordRows("tenants", landlordId);
  const tenantIds = tenants.map((tenant) => text(tenant.id)).filter(Boolean);
  const [units, leases, tenancies, canonicalEventsSnap] = await Promise.all([
    contextRows("units", propertyIds, tenantIds, [{ field: "tenantId" }, { field: "currentTenantId" }]),
    contextRows("leases", propertyIds, tenantIds, [{ field: "tenantId" }, { field: "primaryTenantId" }, { field: "tenantIds", operator: "array-contains-any" }]),
    contextRows("tenancies", propertyIds, tenantIds, [{ field: "tenantId" }]),
    db.collection("canonicalEvents").where("metadata.landlordRef", "==", `landlord:${crypto.createHash("sha256").update(JSON.stringify(["landlord", landlordId])).digest("hex").slice(0, 32)}`).get(),
  ]);
  const canonicalEvents = (canonicalEventsSnap.docs || []).map((doc: any) => ({ id: doc.id, ...(doc.data() || {}) }));
  return aggregateOccupancyReviewWorkspace(landlordId, { properties, units, leases, tenants, tenancies, canonicalEvents });
}
