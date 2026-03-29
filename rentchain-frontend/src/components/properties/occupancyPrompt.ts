import { resolveConfiguredUnitRent } from "@/lib/propertyRentSummary";
import type { Lease } from "../../api/leasesApi";

function unitKey(unit: any): string {
  return String(unit?.id || unit?.unitId || "").trim();
}

function unitNumber(unit: any): string {
  return String(unit?.unitNumber || unit?.label || "").trim();
}

export function getUnitsNeedingOccupancySetup(units: any[], activeLeases: Lease[]): any[] {
  const leasedUnitIds = new Set(
    activeLeases.map((lease) => String(lease.unitId || "").trim()).filter(Boolean)
  );
  const leasedUnitNumbers = new Set(
    activeLeases.map((lease) => String(lease.unitNumber || "").trim()).filter(Boolean)
  );

  return (Array.isArray(units) ? units : []).filter((unit) => {
    const isLeased =
      (unitKey(unit) && leasedUnitIds.has(unitKey(unit))) ||
      (unitNumber(unit) && leasedUnitNumbers.has(unitNumber(unit)));
    if (isLeased) return false;

    const statusVal = String(unit?.occupancyStatus || unit?.status || "").toLowerCase();
    const occupantName = String(unit?.occupantName || "").trim();
    const leaseEndDate = String(unit?.leaseEndDate || "").trim();
    const hasConfiguredRent = resolveConfiguredUnitRent(unit) != null;
    const explicitlyVacant = statusVal === "vacant";
    const fullyMarkedOccupied =
      statusVal === "occupied" && (Boolean(occupantName) || Boolean(leaseEndDate) || hasConfiguredRent);

    return !explicitlyVacant && !fullyMarkedOccupied;
  });
}
