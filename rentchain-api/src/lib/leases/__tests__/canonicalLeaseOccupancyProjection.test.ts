import { describe, expect, it } from "vitest";
import {
  buildCanonicalLeaseOccupancyProjection,
  canonicalLeaseMatchesUnit,
  resolveCanonicalUnitProjectionInputs,
} from "../canonicalLeaseOccupancyProjection";

const activeLease = {
  id: "lease-active",
  landlordId: "landlord-1",
  propertyId: "property-1",
  unitId: "unit-1",
  tenantId: "tenant-1",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  executionStatus: "fully_executed",
};

describe("canonical lease occupancy projection", () => {
  it("matches property units through the canonical resolved unit id", () => {
    expect(canonicalLeaseMatchesUnit({ unitId: "legacy-label", resolvedUnitId: "unit-1" }, "unit-1")).toBe(true);
    expect(canonicalLeaseMatchesUnit({ unitId: "legacy-label", resolvedUnitId: "unit-1" }, "legacy-label")).toBe(false);
  });

  it("projects one shared active/occupied/current state", () => {
    expect(buildCanonicalLeaseOccupancyProjection({
      leases: [activeLease],
      context: { propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", asOfDate: "2026-08-17" },
      persistedUnitOccupancy: "occupied",
      tenantId: "tenant-1",
    })).toMatchObject({
      leaseTermState: "active",
      occupancyState: "occupied",
      tenantRelationshipState: "current_occupant",
      supportingLeaseId: "lease-active",
    });
  });

  it("does not allow an expired lease to preserve occupied/current labels", () => {
    const result = buildCanonicalLeaseOccupancyProjection({
      leases: [{ ...activeLease, id: "lease-past", endDate: "2026-04-30", status: "active" }],
      context: { propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", asOfDate: "2026-08-17" },
      persistedUnitOccupancy: "occupied",
      persistedTenantStatus: "current",
      currentLeasePointerId: "lease-past",
      tenantId: "tenant-1",
    });
    expect(result.leaseTermState).toBe("past");
    expect(result.occupancyState).toBe("review_needed");
    expect(result.tenantRelationshipState).toBe("occupancy_unresolved");
    expect(result.reasons).toContain("OCCUPIED_WITHOUT_CURRENT_LEASE");
  });

  it("fails closed when two current leases support one unit", () => {
    const result = buildCanonicalLeaseOccupancyProjection({
      leases: [activeLease, { ...activeLease, id: "lease-active-2", tenantId: "tenant-2" }],
      context: { propertyId: "property-1", unitId: "unit-1", asOfDate: "2026-08-17" },
      persistedUnitOccupancy: "occupied",
    });
    expect(result.occupancyState).toBe("review_needed");
    expect(result.reasons).toContain("MULTIPLE_CURRENT_LEASES");
  });

  it("uses raw occupied/current linkage only when normalized unit inputs are absent", () => {
    const unitInputs = resolveCanonicalUnitProjectionInputs({
      id: "unit-1",
      raw: {
        occupancyStatus: "occupied",
        currentLeaseId: "lease-past",
        currentTenantId: "tenant-1",
      },
    });
    const result = buildCanonicalLeaseOccupancyProjection({
      leases: [{ ...activeLease, id: "lease-past", endDate: "2026-04-30", status: "active" }],
      context: { propertyId: "property-1", unitId: "unit-1", tenantId: unitInputs.tenantId, asOfDate: "2026-08-17" },
      ...unitInputs,
    });

    expect(unitInputs).toMatchObject({
      persistedUnitOccupancy: "occupied",
      currentLeasePointerId: "lease-past",
      tenantId: "tenant-1",
    });
    expect(result).toMatchObject({
      leaseTermState: "past",
      occupancyState: "review_needed",
      tenantRelationshipState: "occupancy_unresolved",
      supportingLeaseId: null,
    });
  });

  it("keeps explicit normalized vacancy authoritative over stale raw occupied data", () => {
    const unitInputs = resolveCanonicalUnitProjectionInputs({
      occupancyStatus: "vacant",
      currentLeaseId: "lease-active",
      raw: { occupancyStatus: "occupied", currentLeaseId: "lease-stale" },
    });
    const result = buildCanonicalLeaseOccupancyProjection({
      leases: [activeLease],
      context: { propertyId: "property-1", unitId: "unit-1", asOfDate: "2026-08-17" },
      ...unitInputs,
    });

    expect(unitInputs.persistedUnitOccupancy).toBe("vacant");
    expect(unitInputs.currentLeasePointerId).toBe("lease-active");
    expect(result.occupancyState).toBe("review_needed");
    expect(result.reasons).toContain("VACANT_WITH_CURRENT_LEASE");
  });

  it("keeps normalized occupied evidence for the active control", () => {
    const unitInputs = resolveCanonicalUnitProjectionInputs({
      occupancyStatus: "occupied",
      currentLeaseId: "lease-active",
      currentTenantId: "tenant-1",
      raw: { occupancyStatus: "vacant", currentLeaseId: "lease-stale", currentTenantId: "tenant-stale" },
    });
    const result = buildCanonicalLeaseOccupancyProjection({
      leases: [activeLease],
      context: { propertyId: "property-1", unitId: "unit-1", tenantId: unitInputs.tenantId, asOfDate: "2026-08-17" },
      ...unitInputs,
    });

    expect(result).toMatchObject({
      leaseTermState: "active",
      occupancyState: "occupied",
      tenantRelationshipState: "current_occupant",
      supportingLeaseId: "lease-active",
    });
  });

  it("normalizes boolean occupancy evidence without treating false as absent", () => {
    expect(resolveCanonicalUnitProjectionInputs({ isOccupied: false, raw: { status: "occupied" } }))
      .toMatchObject({ persistedUnitOccupancy: "vacant" });
    expect(resolveCanonicalUnitProjectionInputs({ raw: { occupied: true } }))
      .toMatchObject({ persistedUnitOccupancy: "occupied" });
  });
});
