import type { Firestore } from "firebase-admin/firestore";
import { db } from "../../config/firebase";
import {
  CURRENT_LEASE_STATUSES,
  loadUnitsForProperty,
  resolveUnitReference,
  toCanonicalLeaseRecord,
  type CanonicalLeaseRecord,
  type CanonicalUnitRecord,
} from "../leaseCanonicalizationService";
import {
  evaluateAgreementTermMatch,
  getLeasePartyIds,
  groupLeaseAgreementCandidates,
  pickAgreementWinner,
  type LeaseAgreementCandidate,
} from "../leasePartyConsolidationService";
import { reportTenantPointerIssues } from "../leaseIntegrityService";
import type {
  LeaseOverlapAuditGroup,
  LeaseOverlapAuditReport,
  LeaseOverlapSeverity,
  LeaseOverlapType,
} from "./leaseOverlapAuditTypes";

type FirestoreLike = Pick<Firestore, "collection">;

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function isCurrentLeaseStatus(status: unknown): boolean {
  return CURRENT_LEASE_STATUSES.has(asTrimmedString(status).toLowerCase());
}

function groupCountRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return keys.reduce((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<T, number>);
}

function toDateKey(value: string | null | undefined): string | null {
  const raw = asTrimmedString(value);
  return raw ? raw.slice(0, 10) : null;
}

function getRangeBounds(lease: CanonicalLeaseRecord): { start: number | null; end: number | null } {
  const startDate = toDateKey(lease.leaseStartDate);
  const endDate = toDateKey(lease.leaseEndDate);
  const start = startDate ? Date.parse(`${startDate}T00:00:00.000Z`) : null;
  const end = endDate ? Date.parse(`${endDate}T23:59:59.999Z`) : null;
  return {
    start: Number.isFinite(start as number) ? start : null,
    end: Number.isFinite(end as number) ? end : null,
  };
}

function hasOverlappingDates(candidates: LeaseAgreementCandidate[]): boolean {
  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const a = candidates[i].lease;
      const b = candidates[j].lease;
      const compared = evaluateAgreementTermMatch(a, b);
      if (compared.decision === "ambiguous") return true;

      const aRange = getRangeBounds(a);
      const bRange = getRangeBounds(b);
      if (aRange.start != null && aRange.end != null && bRange.start != null && bRange.end != null) {
        if (aRange.start <= bRange.end && bRange.start <= aRange.end) return true;
      }
    }
  }
  return false;
}

function buildSourceHints(candidates: LeaseAgreementCandidate[]): string[] {
  return Array.from(
    new Set(
      candidates.flatMap((candidate) => {
        const hints = [
          asTrimmedString((candidate.raw as any)?.source),
          asTrimmedString((candidate.raw as any)?.importSource),
          asTrimmedString((candidate.raw as any)?.consolidationSource),
        ].filter(Boolean);
        if (String(candidate.lease.id || "").toLowerCase().includes("migrat")) {
          hints.push("legacy-tenant-migration");
        }
        return hints;
      })
    )
  );
}

function buildGroup(input: {
  overlapType: LeaseOverlapType;
  severity: LeaseOverlapSeverity;
  confidence: LeaseOverlapAuditGroup["confidence"];
  landlordId: string | null;
  propertyId: string | null;
  propertyName: string | null;
  candidates?: LeaseAgreementCandidate[];
  unitId?: string | null;
  unitNumber?: string | null;
  unitLabel?: string | null;
  currentLeaseHints?: string[];
  riskNotes?: string[];
  sourceHints?: string[];
  recommendedReviewAction: string;
  generatedAt: string;
}): LeaseOverlapAuditGroup {
  const candidates = input.candidates || [];
  const winner = candidates.length ? pickAgreementWinner(candidates) : null;
  const leaseIds = candidates.map((candidate) => candidate.lease.id);
  const tenantIds = Array.from(
    new Set(candidates.flatMap((candidate) => getLeasePartyIds(candidate.raw, candidate.lease)))
  );

  return {
    landlordId: input.landlordId,
    propertyId: input.propertyId,
    propertyName: input.propertyName,
    unitId: input.unitId ?? winner?.lease.resolvedUnitId ?? winner?.lease.unitId ?? null,
    unitNumber: input.unitNumber ?? winner?.lease.resolvedUnitNumber ?? winner?.lease.unitLabel ?? null,
    unitLabel: input.unitLabel ?? winner?.lease.resolvedUnitLabel ?? winner?.lease.unitLabel ?? null,
    overlapType: input.overlapType,
    severity: input.severity,
    confidence: input.confidence,
    leaseIds,
    tenantIds,
    leaseStatuses: candidates.map((candidate) => String(candidate.lease.status || "")),
    startDates: candidates.map((candidate) => candidate.lease.leaseStartDate || null),
    endDates: candidates.map((candidate) => candidate.lease.leaseEndDate || null),
    currentLeaseHints: input.currentLeaseHints || [],
    riskNotes: input.riskNotes || [],
    sourceHints: input.sourceHints || buildSourceHints(candidates),
    recommendedReviewAction: input.recommendedReviewAction,
    generatedAt: input.generatedAt,
  };
}

async function loadCurrentLeaseEntries(
  firestoreDb: FirestoreLike,
  filters: { landlordId?: string | null; propertyId?: string | null }
) {
  let query: FirebaseFirestore.Query = firestoreDb.collection("leases");
  const propertyId = asTrimmedString(filters.propertyId);
  const landlordId = asTrimmedString(filters.landlordId);
  if (propertyId) {
    query = query.where("propertyId", "==", propertyId);
  } else if (landlordId) {
    query = query.where("landlordId", "==", landlordId);
  }
  const snap = await query.get();
  return (snap.docs || [])
    .map((doc: any) => ({ id: doc.id, raw: (doc.data() || {}) as Record<string, unknown> }))
    .filter((entry) => isCurrentLeaseStatus((entry.raw as any)?.status))
    .filter((entry) => !propertyId || asTrimmedString((entry.raw as any)?.propertyId) === propertyId)
    .filter((entry) => !landlordId || asTrimmedString((entry.raw as any)?.landlordId) === landlordId);
}

async function loadPropertyMeta(
  firestoreDb: FirestoreLike,
  propertyIds: string[]
): Promise<Map<string, { propertyName: string | null; landlordId: string | null }>> {
  const map = new Map<string, { propertyName: string | null; landlordId: string | null }>();
  await Promise.all(
    propertyIds.map(async (propertyId) => {
      if (!propertyId) return;
      try {
        const snap = await firestoreDb.collection("properties").doc(propertyId).get();
        if (!snap.exists) return;
        const data = (snap.data() || {}) as Record<string, unknown>;
        map.set(propertyId, {
          propertyName:
            asTrimmedString(data?.name) ||
            asTrimmedString(data?.title) ||
            asTrimmedString(data?.addressLine1) ||
            null,
          landlordId: asTrimmedString(data?.landlordId || data?.ownerId || data?.owner) || null,
        });
      } catch {
        // best effort only
      }
    })
  );
  return map;
}

async function loadReferencedUnitDocs(
  firestoreDb: FirestoreLike,
  unitIds: string[]
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  await Promise.all(
    unitIds.map(async (unitId) => {
      try {
        const snap = await firestoreDb.collection("units").doc(unitId).get();
        if (!snap.exists) return;
        map.set(unitId, (snap.data() || {}) as Record<string, unknown>);
      } catch {
        // best effort only
      }
    })
  );
  return map;
}

export async function generateLeaseOverlapAuditReport(options?: {
  firestore?: FirestoreLike;
  landlordId?: string | null;
  propertyId?: string | null;
}): Promise<LeaseOverlapAuditReport> {
  const firestoreDb = (options?.firestore || (db as any)) as FirestoreLike;
  const generatedAt = nowIso();
  const landlordFilter = asTrimmedString(options?.landlordId) || null;
  const propertyFilter = asTrimmedString(options?.propertyId) || null;
  const entries = await loadCurrentLeaseEntries(firestoreDb, {
    landlordId: landlordFilter,
    propertyId: propertyFilter,
  });

  const propertyIds = Array.from(
    new Set(entries.map((entry) => asTrimmedString((entry.raw as any)?.propertyId)).filter(Boolean))
  );
  const propertyMeta = await loadPropertyMeta(firestoreDb, propertyIds);
  const groupedByProperty = new Map<string, Array<{ id: string; raw: Record<string, unknown> }>>();
  entries.forEach((entry) => {
    const propertyId = asTrimmedString((entry.raw as any)?.propertyId);
    if (!propertyId) return;
    const bucket = groupedByProperty.get(propertyId) || [];
    bucket.push(entry);
    groupedByProperty.set(propertyId, bucket);
  });

  const groups: LeaseOverlapAuditGroup[] = [];

  for (const [propertyId, propertyEntries] of groupedByProperty.entries()) {
    const propertyLandlordId =
      landlordFilter ||
      propertyMeta.get(propertyId)?.landlordId ||
      asTrimmedString((propertyEntries[0]?.raw as any)?.landlordId) ||
      null;
    const propertyName = propertyMeta.get(propertyId)?.propertyName || null;
    const units = await loadUnitsForProperty(firestoreDb as any, propertyId, propertyLandlordId);
    const candidates: LeaseAgreementCandidate[] = propertyEntries.map((entry) => ({
      raw: entry.raw,
      lease: toCanonicalLeaseRecord(entry.id, entry.raw, units),
    }));

    const directUnitGroups = new Map<string, LeaseAgreementCandidate[]>();
    const logicalUnitGroups = new Map<string, LeaseAgreementCandidate[]>();
    const unresolvedDirectUnitIds = Array.from(
      new Set(
        candidates
          .map((candidate) => asTrimmedString(candidate.lease.unitId))
          .filter(Boolean)
          .filter((unitId) => !units.some((unit) => unit.id === unitId))
      )
    );
    const referencedUnitDocs = await loadReferencedUnitDocs(firestoreDb, unresolvedDirectUnitIds);

    candidates.forEach((candidate) => {
      const directUnitId = asTrimmedString(candidate.lease.unitId);
      if (directUnitId) {
        const directBucket = directUnitGroups.get(directUnitId) || [];
        directBucket.push(candidate);
        directUnitGroups.set(directUnitId, directBucket);
      }

      const logicalUnitKey =
        asTrimmedString(candidate.lease.logicalUnitKey) ||
        asTrimmedString(candidate.lease.resolvedUnitId) ||
        null;
      if (logicalUnitKey) {
        const logicalBucket = logicalUnitGroups.get(logicalUnitKey) || [];
        logicalBucket.push(candidate);
        logicalUnitGroups.set(logicalUnitKey, logicalBucket);
      }
    });

    directUnitGroups.forEach((bucket, unitId) => {
      if (bucket.length < 2) return;
      groups.push(
        buildGroup({
          overlapType: "duplicate_current_same_unitId",
          severity: "high",
          confidence: "high",
          landlordId: propertyLandlordId,
          propertyId,
          propertyName,
          unitId,
          unitNumber: bucket[0]?.lease.resolvedUnitNumber || bucket[0]?.lease.unitLabel || null,
          unitLabel: bucket[0]?.lease.resolvedUnitLabel || bucket[0]?.lease.unitLabel || null,
          candidates: bucket,
          riskNotes: ["Multiple current leases share the same direct unitId."],
          recommendedReviewAction: "Review the overlapping current leases and confirm which single lease should represent the current unit state.",
          generatedAt,
        })
      );
    });

    logicalUnitGroups.forEach((bucket) => {
      if (bucket.length < 2) return;
      const distinctUnitIds = Array.from(new Set(bucket.map((candidate) => asTrimmedString(candidate.lease.unitId)).filter(Boolean)));
      if (distinctUnitIds.length <= 1) return;
      groups.push(
        buildGroup({
          overlapType: "duplicate_current_same_logical_unit",
          severity: "medium",
          confidence: "review_needed",
          landlordId: propertyLandlordId,
          propertyId,
          propertyName,
          unitId: bucket[0]?.lease.resolvedUnitId || bucket[0]?.lease.unitId || null,
          unitNumber: bucket[0]?.lease.resolvedUnitNumber || bucket[0]?.lease.unitLabel || null,
          unitLabel: bucket[0]?.lease.resolvedUnitLabel || bucket[0]?.lease.unitLabel || null,
          candidates: bucket,
          riskNotes: ["Multiple current leases resolve to the same logical unit through unit-number/label matching."],
          recommendedReviewAction: "Review migration-era or label-based unit references and confirm the single current lease for this logical unit.",
          generatedAt,
        })
      );
    });

    logicalUnitGroups.forEach((bucket) => {
      if (bucket.length < 2 || !hasOverlappingDates(bucket)) return;
      groups.push(
        buildGroup({
          overlapType: "overlapping_dates_same_unit",
          severity: "medium",
          confidence: "review_needed",
          landlordId: propertyLandlordId,
          propertyId,
          propertyName,
          unitId: bucket[0]?.lease.resolvedUnitId || bucket[0]?.lease.unitId || null,
          unitNumber: bucket[0]?.lease.resolvedUnitNumber || bucket[0]?.lease.unitLabel || null,
          unitLabel: bucket[0]?.lease.resolvedUnitLabel || bucket[0]?.lease.unitLabel || null,
          candidates: bucket,
          riskNotes: ["Current leases for the same logical unit have overlapping or ambiguous term ranges."],
          recommendedReviewAction: "Review lease dates and end-state transitions to confirm whether one lease should have ended or been consolidated.",
          generatedAt,
        })
      );
    });

    candidates.forEach((candidate) => {
      const directUnitId = asTrimmedString(candidate.lease.unitId);
      if (!directUnitId) return;
      const unitDoc = referencedUnitDocs.get(directUnitId);
      if (!unitDoc) return;
      const unitPropertyId = asTrimmedString((unitDoc as any)?.propertyId);
      const unitLandlordId = asTrimmedString((unitDoc as any)?.landlordId);
      if (unitPropertyId === propertyId && (!propertyLandlordId || unitLandlordId === propertyLandlordId)) {
        return;
      }
      groups.push(
        buildGroup({
          overlapType: "property_unit_mismatch",
          severity: "high",
          confidence: "high",
          landlordId: propertyLandlordId,
          propertyId,
          propertyName,
          unitId: directUnitId,
          unitNumber: candidate.lease.unitLabel || null,
          unitLabel: candidate.lease.unitLabel || null,
          candidates: [candidate],
          riskNotes: [
            `Referenced unit belongs to property ${unitPropertyId || "unknown"} and landlord ${unitLandlordId || "unknown"}.`,
          ],
          recommendedReviewAction: "Review the lease's unitId reference and confirm it points to a unit owned by the same landlord and property.",
          generatedAt,
        })
      );
    });

    const pointerIssues = await reportTenantPointerIssues(propertyId, propertyLandlordId, firestoreDb as any);
    pointerIssues.forEach((issue) => {
      if (issue.issueType !== "tenant_missing_currentLeaseId" && issue.issueType !== "tenant_stale_currentLeaseId") {
        return;
      }
      groups.push({
        landlordId: propertyLandlordId,
        propertyId,
        propertyName,
        unitId: issue.unitId || null,
        unitNumber: null,
        unitLabel: null,
        overlapType: "stale_pointer_conflict",
        severity: issue.severity === "error" ? "medium" : "low",
        confidence: issue.severity === "error" ? "high" : "review_needed",
        leaseIds: issue.relatedLeaseIds,
        tenantIds: issue.relatedTenantIds,
        leaseStatuses: [],
        startDates: [],
        endDates: [],
        currentLeaseHints: issue.relatedLeaseIds,
        riskNotes: [issue.issueType],
        sourceHints: [],
        recommendedReviewAction: issue.recommendedFix,
        generatedAt,
      });
    });

    const groupedAgreements = groupLeaseAgreementCandidates(candidates);
    groupedAgreements.ambiguousGroups.forEach((group) => {
      const winner = pickAgreementWinner(group.candidates);
      groups.push(
        buildGroup({
          overlapType: "overlapping_dates_same_unit",
          severity: "medium",
          confidence: "review_needed",
          landlordId: propertyLandlordId,
          propertyId,
          propertyName,
          unitId: winner.lease.resolvedUnitId || winner.lease.unitId || null,
          unitNumber: winner.lease.resolvedUnitNumber || winner.lease.unitLabel || null,
          unitLabel: winner.lease.resolvedUnitLabel || winner.lease.unitLabel || null,
          candidates: group.candidates,
          riskNotes: group.reasons,
          recommendedReviewAction: "Review the ambiguous current lease group and confirm whether one agreement should end or be consolidated.",
          generatedAt,
        })
      );
    });
  }

  const dedupedGroups = Array.from(
    new Map(
      groups.map((group) => [
        [
          group.overlapType,
          group.landlordId || "",
          group.propertyId || "",
          group.unitId || "",
          [...group.leaseIds].sort().join("|"),
          [...group.currentLeaseHints].sort().join("|"),
        ].join("::"),
        group,
      ])
    ).values()
  );

  const byType = groupCountRecord([
    "duplicate_current_same_unitId",
    "duplicate_current_same_logical_unit",
    "overlapping_dates_same_unit",
    "stale_pointer_conflict",
    "property_unit_mismatch",
  ] as const);
  const bySeverity = groupCountRecord(["high", "medium", "low"] as const);
  dedupedGroups.forEach((group) => {
    byType[group.overlapType] += 1;
    bySeverity[group.severity] += 1;
  });

  return {
    generatedAt,
    filters: {
      landlordId: landlordFilter,
      propertyId: propertyFilter,
    },
    summary: {
      generatedAt,
      overlapGroupCount: dedupedGroups.length,
      byType,
      bySeverity,
    },
    groups: dedupedGroups.sort((a, b) => {
      const byLandlord = String(a.landlordId || "").localeCompare(String(b.landlordId || ""));
      if (byLandlord !== 0) return byLandlord;
      const byProperty = String(a.propertyId || "").localeCompare(String(b.propertyId || ""));
      if (byProperty !== 0) return byProperty;
      return String(a.unitId || a.unitNumber || "").localeCompare(String(b.unitId || b.unitNumber || ""));
    }),
  };
}
