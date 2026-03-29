import type { CanonicalUnitRecord } from "../leaseCanonicalizationService";
import { normalizeUnitAlias, normalizeUnitToken } from "../leaseCanonicalizationService";

type PropertyScopedLeaseLike = {
  id: string;
  landlordId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;
  unitLabel?: string | null;
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
