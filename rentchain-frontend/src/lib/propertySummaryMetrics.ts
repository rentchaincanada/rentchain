import type { Lease } from "@/api/leasesApi";
import { deriveUnitOccupancyFromLeases, type UnitOccupancy } from "@/lib/leases/leaseLifecycle";
import type { CanonicalLeaseOccupancyState } from "@/lib/leases/canonicalStatePresentation";
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
  today: string | number | Date = new Date(),
  canonicalUnitStates: Record<string, CanonicalLeaseOccupancyState> = {}
): PropertySummaryMetrics {
  const displayedUnits = Array.isArray(units) ? units : [];
  const availableLeases = Array.isArray(leases) ? leases : [];
  const occupancyByUnit = displayedUnits.map((unit) => {
    const unitId = String(unit.id || unit.unitId || "").trim();
    const canonical = canonicalUnitStates[unitId];
    let occupancy: UnitOccupancy;
    if (!canonical) {
      occupancy = deriveUnitOccupancyFromLeases(unit, availableLeases, today);
    } else {
      const supportingLease = canonical.supportingLeaseId
        ? availableLeases.find((lease) => lease.id === canonical.supportingLeaseId) ?? null
        : null;
      if (canonical.occupancyState === "occupied") {
        occupancy = { status: "occupied", label: "Occupied", lease: supportingLease };
      } else if (canonical.occupancyState === "review_needed") {
        occupancy = { status: "review_required", label: "Review needed", lease: supportingLease };
      } else if (canonical.leaseTermState === "upcoming") {
        occupancy = { status: "upcoming", label: "Upcoming", lease: supportingLease };
      } else {
        occupancy = { status: "vacant", label: "Vacant", lease: supportingLease };
      }
    }
    return { unit, occupancy };
  });
  const activeLeases = Array.from(
    new Map(
      [
        ...occupancyByUnit
          .filter((item) => item.occupancy.status === "occupied" && item.occupancy.lease?.id)
          .map((item) => item.occupancy.lease as Lease),
        ...availableLeases.filter(
          (lease) =>
            lease.canonicalState?.occupancyState === "occupied" &&
            lease.canonicalState?.tenantRelationshipState === "current_occupant" &&
            !displayedUnits.some((unit) =>
              [unit.id, unit.unitId, unit.unitNumber]
                .map((value) => String(value || "").trim())
                .includes(String(lease.unitId || lease.unitNumber || "").trim())
            )
        ),
      ].map((lease) => [lease.id, lease])
    ).values()
  );
  const occupiedUnits = occupancyByUnit
    .filter((item) => item.occupancy.status === "occupied")
    .map((item) => item.unit);
  const leasedUnits = occupiedUnits;
  const occupancyRate = unitCount > 0 ? (occupiedUnits.length / unitCount) * 100 : 0;
  const activeLeaseRentTotal = activeLeases.reduce(
    (sum, lease) => sum + (typeof lease.monthlyRent === "number" ? lease.monthlyRent : 0),
    0
  );
  const currentOccupiedRentTotal = occupancyByUnit.reduce((sum, item) => {
    if (item.occupancy.status !== "occupied") return sum;
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
