import type { Lease } from "@/api/leasesApi";
import { resolveConfiguredUnitRent } from "@/lib/propertyRentSummary";

const ACTIVE_LEASE_STATUSES = new Set([
  "active",
  "notice_pending",
  "renewal_pending",
  "renewal_accepted",
  "move_out_pending",
]);

type UnitLike = Record<string, unknown>;

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function unitIdentifiers(unit: UnitLike): string[] {
  const values = [
    normalizeString(unit.id),
    normalizeString(unit.unitId),
    normalizeString(unit.unitNumber),
    normalizeString(unit.label),
  ].filter(Boolean);
  return Array.from(new Set(values));
}

function leaseIdentifiers(lease: Lease): string[] {
  const values = [normalizeString(lease.unitId), normalizeString(lease.unitNumber)].filter(Boolean);
  return Array.from(new Set(values));
}

function isOccupiedUnit(unit: UnitLike): boolean {
  const status = normalizeString(unit.occupancyStatus || unit.status).toLowerCase();
  return status === "occupied";
}

function isActiveLease(lease: Lease): boolean {
  return ACTIVE_LEASE_STATUSES.has(normalizeString(lease.status).toLowerCase());
}

function getMatchingActiveLeases(unit: UnitLike, activeLeases: Lease[]): Lease[] {
  const ids = new Set(unitIdentifiers(unit));
  if (!ids.size) return [];
  return activeLeases.filter((lease) => leaseIdentifiers(lease).some((identifier) => ids.has(identifier)));
}

export type PropertySummaryMetrics = {
  activeLeases: Lease[];
  occupiedUnits: UnitLike[];
  leasedUnits: UnitLike[];
  occupancyRate: number;
  activeLeaseRentTotal: number;
  currentOccupiedRentTotal: number;
};

export function buildPropertySummaryMetrics(units: UnitLike[], leases: Lease[], unitCount: number): PropertySummaryMetrics {
  const displayedUnits = Array.isArray(units) ? units : [];
  const activeLeases = (Array.isArray(leases) ? leases : []).filter(isActiveLease);
  const occupiedUnits = displayedUnits.filter(isOccupiedUnit);
  const leasedUnits = displayedUnits.filter((unit) => getMatchingActiveLeases(unit, activeLeases).length > 0);
  const occupancyRate = unitCount > 0 ? (occupiedUnits.length / unitCount) * 100 : 0;
  const activeLeaseRentTotal = activeLeases.reduce(
    (sum, lease) => sum + (typeof lease.monthlyRent === "number" ? lease.monthlyRent : 0),
    0
  );
  const currentOccupiedRentTotal = occupiedUnits.reduce((sum, unit) => {
    const matchingLeases = getMatchingActiveLeases(unit, activeLeases);
    if (matchingLeases.length > 0) {
      return (
        sum +
        matchingLeases.reduce(
          (leaseSum, lease) => leaseSum + (typeof lease.monthlyRent === "number" ? lease.monthlyRent : 0),
          0
        )
      );
    }
    return sum + (resolveConfiguredUnitRent(unit) ?? 0);
  }, 0);

  return {
    activeLeases,
    occupiedUnits,
    leasedUnits,
    occupancyRate,
    activeLeaseRentTotal,
    currentOccupiedRentTotal,
  };
}
