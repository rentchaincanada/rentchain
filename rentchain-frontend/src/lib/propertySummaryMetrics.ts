import type { Lease } from "@/api/leasesApi";
import {
  deriveUnitOccupancyFromLeases,
  isLeaseCurrentlyActive,
} from "@/lib/leases/leaseLifecycle";
import { resolveConfiguredUnitRent } from "@/lib/propertyRentSummary";

type UnitLike = Record<string, unknown>;

export type PropertySummaryMetrics = {
  activeLeases: Lease[];
  occupiedUnits: UnitLike[];
  leasedUnits: UnitLike[];
  occupancyRate: number;
  activeLeaseRentTotal: number;
  currentOccupiedRentTotal: number;
};

export function buildPropertySummaryMetrics(
  units: UnitLike[],
  leases: Lease[],
  unitCount: number,
  today: string | number | Date = new Date()
): PropertySummaryMetrics {
  const displayedUnits = Array.isArray(units) ? units : [];
  const activeLeases = (Array.isArray(leases) ? leases : []).filter((lease) => isLeaseCurrentlyActive(lease, today));
  const occupancyByUnit = displayedUnits.map((unit) => ({
    unit,
    occupancy: deriveUnitOccupancyFromLeases(unit, leases, today),
  }));
  const occupiedUnits = occupancyByUnit
    .filter((item) => item.occupancy.status === "occupied" || item.occupancy.status === "notice_period")
    .map((item) => item.unit);
  const leasedUnits = occupiedUnits;
  const occupancyRate = unitCount > 0 ? (occupiedUnits.length / unitCount) * 100 : 0;
  const activeLeaseRentTotal = activeLeases.reduce(
    (sum, lease) => sum + (typeof lease.monthlyRent === "number" ? lease.monthlyRent : 0),
    0
  );
  const currentOccupiedRentTotal = occupancyByUnit.reduce((sum, item) => {
    if (item.occupancy.status !== "occupied" && item.occupancy.status !== "notice_period") return sum;
    const rentFromLease =
      typeof item.occupancy.lease?.monthlyRent === "number"
        ? item.occupancy.lease.monthlyRent
        : null;
    return sum + (rentFromLease ?? resolveConfiguredUnitRent(item.unit) ?? 0);
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
