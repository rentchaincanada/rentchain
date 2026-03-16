import type { CanonicalLeaseRecord } from "./leaseCanonicalizationService";
import { compareLeaseWinner, isCurrentLeaseStatus, toMillisSafe } from "./leaseCanonicalizationService";

export type LeaseAgreementCandidate = {
  lease: CanonicalLeaseRecord;
  raw: Record<string, unknown>;
};

export type LeaseAgreementGroup = {
  groupKey: string;
  representativeKey: string;
  candidates: LeaseAgreementCandidate[];
  mergedTenantIds: string[];
  ambiguous: boolean;
  reasons: string[];
};

function asTrimmedString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function uniqueStrings(values: Array<unknown>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => asTrimmedString(value))
        .filter((value): value is string => Boolean(value))
    )
  );
}

function toDateKey(value: string | null | undefined): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return raw.slice(0, 10);
}

function toMonthKey(value: string | null | undefined): string | null {
  const dateKey = toDateKey(value);
  return dateKey ? dateKey.slice(0, 7) : null;
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

export function getLeasePartyIds(raw: Record<string, unknown>, lease?: CanonicalLeaseRecord): string[] {
  const tenantIds = Array.isArray(raw?.tenantIds) ? raw.tenantIds : [];
  const primary = asTrimmedString(raw?.tenantId) || lease?.tenantId || null;
  return uniqueStrings([primary, ...tenantIds]);
}

export function getLeasePrimaryTenantId(raw: Record<string, unknown>, lease?: CanonicalLeaseRecord): string | null {
  return asTrimmedString(raw?.primaryTenantId) || getLeasePartyIds(raw, lease)[0] || null;
}

export function tenantBelongsToLease(raw: Record<string, unknown>, lease: CanonicalLeaseRecord, tenantId: string): boolean {
  return getLeasePartyIds(raw, lease).includes(String(tenantId || "").trim());
}

export function buildAgreementTermKey(lease: CanonicalLeaseRecord): string {
  const startDate = toDateKey(lease.leaseStartDate);
  const endDate = toDateKey(lease.leaseEndDate);
  if (startDate && endDate) return `exact:${startDate}:${endDate}`;
  if (!startDate && !endDate) return "open:open";
  return `month:${toMonthKey(lease.leaseStartDate) || "open"}:${toMonthKey(lease.leaseEndDate) || "open"}`;
}

export function evaluateAgreementTermMatch(a: CanonicalLeaseRecord, b: CanonicalLeaseRecord): {
  decision: "merge" | "ambiguous" | "separate";
  reason: string;
} {
  const aStart = toDateKey(a.leaseStartDate);
  const aEnd = toDateKey(a.leaseEndDate);
  const bStart = toDateKey(b.leaseStartDate);
  const bEnd = toDateKey(b.leaseEndDate);
  if (aStart === bStart && aEnd === bEnd) {
    return { decision: "merge", reason: "exact_term_match" };
  }
  if (!aStart && !aEnd && !bStart && !bEnd) {
    return { decision: "merge", reason: "both_terms_missing" };
  }
  if (toMonthKey(a.leaseStartDate) === toMonthKey(b.leaseStartDate) && toMonthKey(a.leaseEndDate) === toMonthKey(b.leaseEndDate)) {
    return { decision: "merge", reason: "aligned_term_months" };
  }

  const aRange = getRangeBounds(a);
  const bRange = getRangeBounds(b);
  if (aRange.start != null && aRange.end != null && bRange.start != null && bRange.end != null) {
    const overlaps = aRange.start <= bRange.end && bRange.start <= aRange.end;
    if (overlaps) {
      return { decision: "ambiguous", reason: "overlapping_terms_need_review" };
    }
  }

  return { decision: "separate", reason: "term_mismatch" };
}

export function buildAgreementRepresentativeKey(lease: CanonicalLeaseRecord): string {
  return [
    String(lease.landlordId || "").trim(),
    String(lease.propertyId || "").trim(),
    String(lease.logicalUnitKey || lease.resolvedUnitId || lease.unitId || lease.unitLabel || lease.id).trim(),
    buildAgreementTermKey(lease),
  ].join("::");
}

export function evaluateSameLeaseAgreement(a: LeaseAgreementCandidate, b: LeaseAgreementCandidate) {
  if (!isCurrentLeaseStatus(a.lease.status) || !isCurrentLeaseStatus(b.lease.status)) {
    return { decision: "separate" as const, reason: "non_current_status" };
  }
  if (String(a.lease.landlordId || "") !== String(b.lease.landlordId || "")) {
    return { decision: "separate" as const, reason: "different_landlord" };
  }
  if (String(a.lease.propertyId || "") !== String(b.lease.propertyId || "")) {
    return { decision: "separate" as const, reason: "different_property" };
  }
  if (String(a.lease.logicalUnitKey || "") !== String(b.lease.logicalUnitKey || "")) {
    return { decision: "separate" as const, reason: "different_logical_unit" };
  }
  return evaluateAgreementTermMatch(a.lease, b.lease);
}

export function buildMergedTenantIds(group: LeaseAgreementCandidate[], winner: LeaseAgreementCandidate): string[] {
  const winnerPrimary = getLeasePrimaryTenantId(winner.raw, winner.lease);
  const merged = uniqueStrings(group.flatMap((candidate) => getLeasePartyIds(candidate.raw, candidate.lease)));
  if (!winnerPrimary) return merged;
  return [winnerPrimary, ...merged.filter((tenantId) => tenantId !== winnerPrimary)];
}

export function pickAgreementWinner(group: LeaseAgreementCandidate[]): LeaseAgreementCandidate {
  return [...group].sort((a, b) => compareLeaseWinner(a.lease, b.lease))[0];
}

export function groupLeaseAgreementCandidates(candidates: LeaseAgreementCandidate[]): {
  mergeGroups: LeaseAgreementGroup[];
  ambiguousGroups: LeaseAgreementGroup[];
  singles: LeaseAgreementCandidate[];
} {
  const sorted = [...candidates].sort((a, b) => compareLeaseWinner(a.lease, b.lease));
  const groupedByUnit = new Map<string, LeaseAgreementCandidate[]>();
  for (const candidate of sorted) {
    const key = [
      String(candidate.lease.landlordId || "").trim(),
      String(candidate.lease.propertyId || "").trim(),
      String(candidate.lease.logicalUnitKey || candidate.lease.id).trim(),
    ].join("::");
    const bucket = groupedByUnit.get(key) || [];
    bucket.push(candidate);
    groupedByUnit.set(key, bucket);
  }

  const mergeGroups: LeaseAgreementGroup[] = [];
  const ambiguousGroups: LeaseAgreementGroup[] = [];
  const singles: LeaseAgreementCandidate[] = [];

  groupedByUnit.forEach((bucket, bucketKey) => {
    const byRepKey = new Map<string, LeaseAgreementCandidate[]>();
    for (const candidate of bucket) {
      const repKey = buildAgreementRepresentativeKey(candidate.lease);
      const repBucket = byRepKey.get(repKey) || [];
      repBucket.push(candidate);
      byRepKey.set(repKey, repBucket);
    }

    byRepKey.forEach((repBucket, repKey) => {
      if (repBucket.length === 1) {
        const [single] = repBucket;
        const hasAmbiguousSibling = bucket.some((other) => {
          if (other.lease.id === single.lease.id) return false;
          return evaluateSameLeaseAgreement(single, other).decision === "ambiguous";
        });
        if (hasAmbiguousSibling) {
          const related = bucket.filter((other) => evaluateSameLeaseAgreement(single, other).decision !== "separate");
          const winner = pickAgreementWinner(related);
          ambiguousGroups.push({
            groupKey: bucketKey,
            representativeKey: repKey,
            candidates: related,
            mergedTenantIds: buildMergedTenantIds(related, winner),
            ambiguous: true,
            reasons: Array.from(new Set(related.flatMap((candidate) =>
              bucket
                .filter((other) => other.lease.id !== candidate.lease.id)
                .map((other) => evaluateSameLeaseAgreement(candidate, other).reason)
                .filter(Boolean)
            ))),
          });
        } else {
          singles.push(single);
        }
        return;
      }
      const winner = pickAgreementWinner(repBucket);
      mergeGroups.push({
        groupKey: bucketKey,
        representativeKey: repKey,
        candidates: repBucket,
        mergedTenantIds: buildMergedTenantIds(repBucket, winner),
        ambiguous: false,
        reasons: ["same_unit_same_term_signature"],
      });
    });
  });

  return { mergeGroups, ambiguousGroups, singles };
}

export function buildMergedLeasePatch(group: LeaseAgreementCandidate[], winner: LeaseAgreementCandidate) {
  const mergedTenantIds = buildMergedTenantIds(group, winner);
  const primaryTenantId = getLeasePrimaryTenantId(winner.raw, winner.lease) || mergedTenantIds[0] || null;

  // Future-safe modeling notes:
  // 1. Assignment/replacement on the same term should usually update parties on the same lease agreement.
  // 2. Party changes within a continuing term should be representable via tenantIds plus later party-history metadata.
  // 3. A new term with a materially new party composition should generally become a new lease agreement.
  return {
    tenantIds: mergedTenantIds,
    primaryTenantId,
    tenantId: primaryTenantId,
    consolidatedAt: Date.now(),
    consolidationSource: "consolidateCoTenantLeases",
  };
}

export function flattenAgreementTenantIds(group: LeaseAgreementGroup): string[] {
  return uniqueStrings(group.candidates.flatMap((candidate) => getLeasePartyIds(candidate.raw, candidate.lease)));
}

export function pickTenantWinningAgreement(groups: LeaseAgreementGroup[], tenantId: string): LeaseAgreementGroup | null {
  const target = String(tenantId || "").trim();
  const matches = groups.filter((group) => flattenAgreementTenantIds(group).includes(target));
  if (!matches.length) return null;
  return [...matches].sort((a, b) => {
    const winnerA = pickAgreementWinner(a.candidates);
    const winnerB = pickAgreementWinner(b.candidates);
    return compareLeaseWinner(winnerA.lease, winnerB.lease);
  })[0];
}
