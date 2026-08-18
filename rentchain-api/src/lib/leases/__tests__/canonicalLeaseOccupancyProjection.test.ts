import { describe, expect, it } from "vitest";
import { buildCanonicalLeaseOccupancyProjection } from "../canonicalLeaseOccupancyProjection";

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
});
