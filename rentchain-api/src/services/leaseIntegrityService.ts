import type { Firestore } from "firebase-admin/firestore";
import { db } from "../config/firebase";
import {
  CURRENT_LEASE_STATUSES,
  loadUnitsForProperty,
  toCanonicalLeaseRecord,
  toNumberSafe,
  type CanonicalLeaseRecord,
  type CanonicalUnitRecord,
} from "./leaseCanonicalizationService";
import {
  getLeasePartyIds,
  groupLeaseAgreementCandidates,
  pickAgreementWinner,
  pickTenantWinningAgreement,
  type LeaseAgreementCandidate,
  type LeaseAgreementGroup,
} from "./leasePartyConsolidationService";

export type LeaseIntegrityIssue = {
  propertyId: string | null;
  unitId: string | null;
  issueType:
    | "occupied_unit_without_active_lease"
    | "active_lease_missing_property_or_unit"
    | "duplicate_active_agreement_overlap"
    | "tenant_missing_currentLeaseId"
    | "tenant_stale_currentLeaseId"
    | "active_lease_missing_rent"
    | "unit_status_mismatch";
  severity: "warning" | "error";
  recommendedFix: string;
  relatedLeaseIds: string[];
  relatedTenantIds: string[];
  detail?: Record<string, unknown>;
};

export type LeaseAgreementSelection = {
  winners: LeaseAgreementCandidate[];
  mergeGroups: LeaseAgreementGroup[];
  ambiguousGroups: LeaseAgreementGroup[];
  singles: LeaseAgreementCandidate[];
};

export type PropertyIntegrityDiagnostics = {
  propertyId: string;
  totalUnits: number;
  rawCurrentLeaseCount: number;
  canonicalAgreementCount: number;
  occupiedWithoutLeaseUnitIds: string[];
  unitStatusMismatchUnitIds: string[];
  canonicalWinnerLeaseIds: string[];
  ambiguousAgreementLeaseIds: string[];
};

function normalizeStatus(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function toUnitStatus(unit: Record<string, unknown>): string {
  return normalizeStatus(unit?.occupancyStatus || unit?.status);
}

function canonicalWinnerSet(selection: Pick<LeaseAgreementSelection, "mergeGroups" | "ambiguousGroups" | "singles">): LeaseAgreementCandidate[] {
  const winners = [
    ...selection.mergeGroups.map((group) => pickAgreementWinner(group.candidates)),
    ...selection.ambiguousGroups.map((group) => pickAgreementWinner(group.candidates)),
    ...selection.singles,
  ];
  const byId = new Map<string, LeaseAgreementCandidate>();
  winners.forEach((winner) => byId.set(winner.lease.id, winner));
  return Array.from(byId.values());
}

async function loadPropertyLeaseCandidates(
  propertyId: string,
  landlordId?: string | null,
  firestoreDb: Firestore = db as any
): Promise<{ units: CanonicalUnitRecord[]; currentCandidates: LeaseAgreementCandidate[]; allCandidates: LeaseAgreementCandidate[] }> {
  const units = await loadUnitsForProperty(firestoreDb, propertyId, landlordId);
  let query: FirebaseFirestore.Query = firestoreDb.collection("leases").where("propertyId", "==", propertyId);
  if (landlordId) {
    query = query.where("landlordId", "==", landlordId);
  }
  const snap = await query.get();
  const allCandidates = snap.docs.map((doc) => {
    const raw = (doc.data() || {}) as Record<string, unknown>;
    return {
      raw,
      lease: toCanonicalLeaseRecord(doc.id, raw, units),
    };
  });
  return {
    units,
    allCandidates,
    currentCandidates: allCandidates.filter((candidate) => CURRENT_LEASE_STATUSES.has(normalizeStatus(candidate.lease.status))),
  };
}

export async function loadPropertyLeaseIntegrityDiagnostics(
  propertyId: string,
  landlordId?: string | null,
  firestoreDb: Firestore = db as any
): Promise<{ diagnostics: PropertyIntegrityDiagnostics; selection: LeaseAgreementSelection; units: CanonicalUnitRecord[]; issues: LeaseIntegrityIssue[] }> {
  const { units, currentCandidates } = await loadPropertyLeaseCandidates(propertyId, landlordId, firestoreDb);
  const grouped = groupLeaseAgreementCandidates(currentCandidates);
  const selection: LeaseAgreementSelection = {
    ...grouped,
    winners: canonicalWinnerSet(grouped),
  };
  const winners = selection.winners;
  const occupiedUnitIds = new Set(
    winners.map((winner) => String(winner.lease.resolvedUnitId || "").trim()).filter(Boolean)
  );
  const issues: LeaseIntegrityIssue[] = [];
  const occupiedWithoutLeaseUnitIds: string[] = [];
  const unitStatusMismatchUnitIds: string[] = [];

  for (const unit of units) {
    const currentStatus = toUnitStatus(unit.raw);
    const derivedOccupied = occupiedUnitIds.has(unit.id);
    if (currentStatus === "occupied" && !derivedOccupied) {
      occupiedWithoutLeaseUnitIds.push(unit.id);
      issues.push({
        propertyId,
        unitId: unit.id,
        issueType: "occupied_unit_without_active_lease",
        severity: "error",
        recommendedFix: "Run reconcileUnitOccupancyFromLeases after reviewing active lease agreements.",
        relatedLeaseIds: [],
        relatedTenantIds: [],
      });
    }
    if ((currentStatus === "occupied") !== derivedOccupied) {
      unitStatusMismatchUnitIds.push(unit.id);
      issues.push({
        propertyId,
        unitId: unit.id,
        issueType: "unit_status_mismatch",
        severity: "warning",
        recommendedFix: "Review unit.status versus canonical lease-derived occupancy and reconcile if appropriate.",
        relatedLeaseIds: winners.filter((winner) => winner.lease.resolvedUnitId === unit.id).map((winner) => winner.lease.id),
        relatedTenantIds: winners.filter((winner) => winner.lease.resolvedUnitId === unit.id).flatMap((winner) => getLeasePartyIds(winner.raw, winner.lease)),
        detail: { unitStatus: currentStatus || null, derivedOccupied },
      });
    }
  }

  for (const candidate of currentCandidates) {
    const relatedTenantIds = getLeasePartyIds(candidate.raw, candidate.lease);
    if (!candidate.lease.propertyId || !candidate.lease.unitId) {
      issues.push({
        propertyId: candidate.lease.propertyId,
        unitId: candidate.lease.unitId,
        issueType: "active_lease_missing_property_or_unit",
        severity: "error",
        recommendedFix: "Repair the lease propertyId/unitId reference before relying on occupancy math.",
        relatedLeaseIds: [candidate.lease.id],
        relatedTenantIds,
      });
    }
    const missingRentFields = ["monthlyRent", "currentRent", "rent", "rentAmount"].filter((field) => {
      const value = (candidate.raw as any)?.[field];
      return !Number.isFinite(Number(value)) || Number(value) <= 0;
    });
    if (toNumberSafe(candidate.raw?.monthlyRent, candidate.raw?.currentRent, candidate.raw?.rent, candidate.raw?.rentAmount) <= 0) {
      issues.push({
        propertyId: candidate.lease.propertyId,
        unitId: candidate.lease.resolvedUnitId || candidate.lease.unitId,
        issueType: "active_lease_missing_rent",
        severity: "warning",
        recommendedFix: "Populate the active lease rent fields or confirm unit-level fallback rent before billing/reporting.",
        relatedLeaseIds: [candidate.lease.id],
        relatedTenantIds,
        detail: { missingRentFields, unitRentFallback: candidate.lease.resolvedUnitId ? units.find((unit) => unit.id === candidate.lease.resolvedUnitId)?.rent ?? null : null },
      });
    }
  }

  for (const group of selection.mergeGroups) {
    issues.push({
      propertyId,
      unitId: group.candidates[0]?.lease.resolvedUnitId || group.candidates[0]?.lease.unitId || null,
      issueType: "duplicate_active_agreement_overlap",
      severity: "error",
      recommendedFix: "Run consolidateCoTenantLeases to merge same-agreement rows into one canonical active lease with tenantIds.",
      relatedLeaseIds: group.candidates.map((candidate) => candidate.lease.id),
      relatedTenantIds: group.candidates.flatMap((candidate) => getLeasePartyIds(candidate.raw, candidate.lease)),
      detail: { representativeKey: group.representativeKey },
    });
  }

  const diagnostics: PropertyIntegrityDiagnostics = {
    propertyId,
    totalUnits: units.length,
    rawCurrentLeaseCount: currentCandidates.length,
    canonicalAgreementCount: winners.length,
    occupiedWithoutLeaseUnitIds,
    unitStatusMismatchUnitIds: Array.from(new Set(unitStatusMismatchUnitIds)),
    canonicalWinnerLeaseIds: winners.map((winner) => winner.lease.id),
    ambiguousAgreementLeaseIds: selection.ambiguousGroups.flatMap((group) => group.candidates.map((candidate) => candidate.lease.id)),
  };

  return { diagnostics, selection, units, issues };
}

export async function resolveTenantCurrentLeasePointer(
  tenantId: string,
  propertyId?: string | null,
  landlordId?: string | null,
  firestoreDb: Firestore = db as any
): Promise<{ leaseId: string | null; stale: boolean; ambiguous: boolean }> {
  const [directSnap, arraySnap] = await Promise.all([
    firestoreDb.collection("leases").where("tenantId", "==", tenantId).get().catch(() => ({ docs: [] } as any)),
    firestoreDb.collection("leases").where("tenantIds", "array-contains", tenantId).get().catch(() => ({ docs: [] } as any)),
  ]);
  const rawEntries = new Map<string, Record<string, unknown>>();
  for (const doc of [...(directSnap.docs || []), ...(arraySnap.docs || [])]) {
    rawEntries.set(doc.id, (doc.data() || {}) as Record<string, unknown>);
  }
  const filtered = Array.from(rawEntries.entries())
    .filter(([, raw]) => CURRENT_LEASE_STATUSES.has(normalizeStatus((raw as any)?.status)))
    .filter(([, raw]) => !propertyId || String((raw as any)?.propertyId || "").trim() === String(propertyId).trim())
    .filter(([, raw]) => !landlordId || String((raw as any)?.landlordId || "").trim() === String(landlordId).trim())
    .map(([id, raw]) => ({ id, raw }));

  if (!filtered.length) return { leaseId: null, stale: false, ambiguous: false };
  const unitsByProperty = new Map<string, CanonicalUnitRecord[]>();
  for (const entry of filtered) {
    const currentPropertyId = String(entry.raw?.propertyId || "").trim();
    if (!currentPropertyId || unitsByProperty.has(currentPropertyId)) continue;
    unitsByProperty.set(currentPropertyId, await loadUnitsForProperty(firestoreDb, currentPropertyId, landlordId));
  }
  const candidates = filtered.map((entry) => {
    const currentPropertyId = String(entry.raw?.propertyId || "").trim();
    return {
      raw: entry.raw,
      lease: toCanonicalLeaseRecord(entry.id, entry.raw, unitsByProperty.get(currentPropertyId) || []),
    };
  });
  const grouped = groupLeaseAgreementCandidates(candidates);
  const selection: LeaseAgreementSelection = {
    ...grouped,
    winners: canonicalWinnerSet(grouped),
  };
  const group = pickTenantWinningAgreement([...selection.mergeGroups, ...selection.ambiguousGroups], tenantId);
  if (!group) return { leaseId: null, stale: false, ambiguous: grouped.ambiguousGroups.length > 0 };
  return {
    leaseId: pickAgreementWinner(group.candidates).lease.id,
    stale: false,
    ambiguous: group.ambiguous,
  };
}

export async function reportTenantPointerIssues(
  propertyId?: string | null,
  landlordId?: string | null,
  firestoreDb: Firestore = db as any
): Promise<LeaseIntegrityIssue[]> {
  let query: FirebaseFirestore.Query = firestoreDb.collection("tenants");
  if (propertyId) query = query.where("propertyId", "==", propertyId);
  if (landlordId) query = query.where("landlordId", "==", landlordId);
  const snap = await query.get();
  const issues: LeaseIntegrityIssue[] = [];
  for (const doc of snap.docs) {
    const tenant = (doc.data() || {}) as Record<string, unknown>;
    const resolved = await resolveTenantCurrentLeasePointer(doc.id, propertyId || String(tenant.propertyId || "").trim(), landlordId || String(tenant.landlordId || "").trim(), firestoreDb);
    const currentLeaseId = String(tenant.currentLeaseId || "").trim() || null;
    if (!resolved.leaseId) continue;
    if (!currentLeaseId) {
      issues.push({
        propertyId: String(tenant.propertyId || "").trim() || null,
        unitId: String(tenant.unitId || "").trim() || null,
        issueType: "tenant_missing_currentLeaseId",
        severity: resolved.ambiguous ? "warning" : "error",
        recommendedFix: "Run backfillTenantCurrentLeaseId for deterministic tenants.",
        relatedLeaseIds: [resolved.leaseId],
        relatedTenantIds: [doc.id],
      });
      continue;
    }
    if (currentLeaseId !== resolved.leaseId) {
      issues.push({
        propertyId: String(tenant.propertyId || "").trim() || null,
        unitId: String(tenant.unitId || "").trim() || null,
        issueType: "tenant_stale_currentLeaseId",
        severity: resolved.ambiguous ? "warning" : "error",
        recommendedFix: "Run backfillTenantCurrentLeaseId after reviewing lease agreement winners.",
        relatedLeaseIds: [currentLeaseId, resolved.leaseId],
        relatedTenantIds: [doc.id],
      });
    }
  }
  return issues;
}

export async function buildDesiredUnitOccupancy(
  propertyId: string,
  landlordId?: string | null,
  firestoreDb: Firestore = db as any
): Promise<Array<{ unitId: string; nextStatus: "occupied" | "vacant"; currentStatus: string | null; winnerLeaseIds: string[] }>> {
  const { units, selection } = await loadPropertyLeaseIntegrityDiagnostics(propertyId, landlordId, firestoreDb);
  const winners = canonicalWinnerSet(selection);
  const leaseIdsByUnit = new Map<string, string[]>();
  winners.forEach((winner) => {
    const unitId = String(winner.lease.resolvedUnitId || "").trim();
    if (!unitId) return;
    const bucket = leaseIdsByUnit.get(unitId) || [];
    bucket.push(winner.lease.id);
    leaseIdsByUnit.set(unitId, bucket);
  });
  return units.map((unit) => ({
    unitId: unit.id,
    nextStatus: leaseIdsByUnit.has(unit.id) ? "occupied" : "vacant",
    currentStatus: toUnitStatus(unit.raw) || null,
    winnerLeaseIds: leaseIdsByUnit.get(unit.id) || [],
  }));
}


