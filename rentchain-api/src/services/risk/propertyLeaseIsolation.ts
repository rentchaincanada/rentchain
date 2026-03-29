import type { CanonicalUnitRecord } from "../leaseCanonicalizationService";
import {
  normalizeUnitAlias,
  normalizeUnitToken,
  rankLeaseStatus,
  toMillisSafe,
} from "../leaseCanonicalizationService";

type PropertyScopedLeaseLike = {
  id: string;
  landlordId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;
  unitLabel?: string | null;
};

type UnitScopedLeaseLike = PropertyScopedLeaseLike & {
  resolvedUnitId?: string | null;
  logicalUnitKey?: string | null;
  status?: string | null;
  riskScore?: number | null;
  riskGrade?: string | null;
  riskConfidence?: number | null;
  updatedAt?: unknown;
  createdAt?: unknown;
};

type IsolationLogger = (message: string, detail: Record<string, unknown>) => void;

export type PropertyLeaseIsolationExclusion = {
  leaseId: string;
  reason:
    | "missing_property_match"
    | "landlord_mismatch"
    | "unit_not_in_requested_property";
  detail: Record<string, unknown>;
};

function asTrimmedString(value: unknown): string {
  return String(value || "").trim();
}

function buildUnitTokens(value: unknown): string[] {
  const raw = asTrimmedString(value);
  if (!raw) return [];
  const token = normalizeUnitToken(raw);
  const alias = normalizeUnitAlias(raw);
  return Array.from(new Set([raw, raw.toUpperCase(), token, alias].filter(Boolean)));
}

function toUnitScopeKey(lease: UnitScopedLeaseLike): string {
  const direct = asTrimmedString(lease.resolvedUnitId);
  if (direct) return `resolved:${direct}`;
  const logical = asTrimmedString(lease.logicalUnitKey);
  if (logical) return `logical:${logical}`;
  const unitId = asTrimmedString(lease.unitId);
  if (unitId) return `unit:${unitId}`;
  const unitNumber = asTrimmedString(lease.unitNumber);
  if (unitNumber) return `number:${normalizeUnitAlias(unitNumber) || normalizeUnitToken(unitNumber) || unitNumber}`;
  const unitLabel = asTrimmedString(lease.unitLabel);
  if (unitLabel) return `label:${normalizeUnitAlias(unitLabel) || normalizeUnitToken(unitLabel) || unitLabel}`;
  return `lease:${asTrimmedString(lease.id)}`;
}

function hasRiskContext(lease: UnitScopedLeaseLike): boolean {
  return lease.riskScore != null || Boolean(asTrimmedString(lease.riskGrade)) || lease.riskConfidence != null;
}

function compareUnitLeasePriority(a: UnitScopedLeaseLike, b: UnitScopedLeaseLike): number {
  const statusDiff = rankLeaseStatus(b.status) - rankLeaseStatus(a.status);
  if (statusDiff !== 0) return statusDiff;

  const riskDiff = Number(hasRiskContext(b)) - Number(hasRiskContext(a));
  if (riskDiff !== 0) return riskDiff;

  const confidenceDiff = Number(b.riskConfidence ?? -1) - Number(a.riskConfidence ?? -1);
  if (confidenceDiff !== 0) return confidenceDiff;

  const updatedDiff = toMillisSafe(b.updatedAt) - toMillisSafe(a.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;

  const createdDiff = toMillisSafe(b.createdAt) - toMillisSafe(a.createdAt);
  if (createdDiff !== 0) return createdDiff;

  return String(a.id || "").localeCompare(String(b.id || ""));
}

function matchesRequestedUnit(units: CanonicalUnitRecord[], lease: PropertyScopedLeaseLike): boolean {
  const identifiers = Array.from(
    new Set(
      [lease.unitId, lease.unitNumber, lease.unitLabel]
        .flatMap((value) => buildUnitTokens(value))
        .filter(Boolean)
    )
  );
  if (!identifiers.length) return false;
  return units.some((unit) => {
    const unitTokens = Array.from(
      new Set(
        [unit.id, unit.unitNumber, unit.label]
          .flatMap((value) => buildUnitTokens(value))
          .filter(Boolean)
      )
    );
    return unitTokens.some((token) => identifiers.includes(token));
  });
}

export function filterPropertyScopedLeases<T extends PropertyScopedLeaseLike>(input: {
  leases: T[];
  requestedPropertyId: string;
  requestedLandlordId?: string | null;
  units?: CanonicalUnitRecord[];
  logger?: IsolationLogger;
}): { included: T[]; excluded: Array<PropertyLeaseIsolationExclusion & { lease: T }> } {
  const requestedPropertyId = asTrimmedString(input.requestedPropertyId);
  const requestedLandlordId = asTrimmedString(input.requestedLandlordId);
  const units = Array.isArray(input.units) ? input.units : [];
  const included: T[] = [];
  const excluded: Array<PropertyLeaseIsolationExclusion & { lease: T }> = [];

  for (const lease of input.leases) {
    const leaseId = asTrimmedString(lease?.id);
    const leasePropertyId = asTrimmedString(lease?.propertyId);
    const leaseLandlordId = asTrimmedString(lease?.landlordId);

    let reason: PropertyLeaseIsolationExclusion["reason"] | null = null;
    if (!leasePropertyId || leasePropertyId !== requestedPropertyId) {
      reason = "missing_property_match";
    } else if (requestedLandlordId && leaseLandlordId && leaseLandlordId !== requestedLandlordId) {
      reason = "landlord_mismatch";
    } else if (units.length > 0 && !matchesRequestedUnit(units, lease)) {
      reason = "unit_not_in_requested_property";
    }

    if (!reason) {
      included.push(lease);
      continue;
    }

    const detail = {
      requestedLandlordId: requestedLandlordId || null,
      requestedPropertyId: requestedPropertyId || null,
      leaseLandlordId: leaseLandlordId || null,
      leasePropertyId: leasePropertyId || null,
      unitId: asTrimmedString(lease?.unitId) || null,
      unitNumber: asTrimmedString(lease?.unitNumber) || null,
      unitLabel: asTrimmedString(lease?.unitLabel) || null,
    };
    const entry = { leaseId, reason, detail, lease };
    excluded.push(entry);
    input.logger?.("[property-lease-isolation] excluded lease row", {
      leaseId,
      reason,
      ...detail,
    });
  }

  return { included, excluded };
}

export function dedupePropertyScopedLeasesByUnit<T extends UnitScopedLeaseLike>(leases: T[]): T[] {
  const byUnit = new Map<string, T[]>();
  for (const lease of leases) {
    const key = toUnitScopeKey(lease);
    const bucket = byUnit.get(key) || [];
    bucket.push(lease);
    byUnit.set(key, bucket);
  }

  return Array.from(byUnit.values())
    .map((bucket) => [...bucket].sort(compareUnitLeasePriority)[0])
    .sort((a, b) => compareUnitLeasePriority(a, b));
}
