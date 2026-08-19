import { describe, expect, it } from "vitest";
import { buildCanonicalLeaseOccupancyProjection } from "../../lib/leases/canonicalLeaseOccupancyProjection";
import { preserveCanonicalLeaseEvidence, type LeaseAgreementCandidate } from "../leasePartyConsolidationService";

function candidate(id: string): LeaseAgreementCandidate {
  const lease: any = {
    id,
    landlordId: "landlord-1",
    propertyId: "property-1",
    unitId: "unit-1",
    resolvedUnitId: "unit-1",
    logicalUnitKey: "unit-1",
    tenantId: "tenant-1",
    primaryTenantId: "tenant-1",
    status: "active",
    startDate: "2026-05-01",
    endDate: "2027-04-30",
    executionStatus: "fully_executed",
  };
  return { lease, raw: lease };
}

describe("preserveCanonicalLeaseEvidence", () => {
  it.each([
    [[candidate("lease-a"), candidate("lease-b")]],
    [[candidate("lease-b"), candidate("lease-a")]],
  ])("fails closed for two distinct current leases regardless of input order", (candidates) => {
    const projection = buildCanonicalLeaseOccupancyProjection({
      leases: preserveCanonicalLeaseEvidence(candidates),
      context: { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", asOfDate: "2026-08-18" },
      persistedUnitOccupancy: "occupied",
      tenantId: "tenant-1",
    });
    expect(projection).toMatchObject({ occupancyState: "review_needed", supportingLeaseId: null });
    expect(projection.reasons).toContain("MULTIPLE_CURRENT_LEASES");
  });

  it("does not manufacture ambiguity from a repeated representation of the same lease id", () => {
    const repeated = candidate("lease-a");
    const projection = buildCanonicalLeaseOccupancyProjection({
      leases: preserveCanonicalLeaseEvidence([repeated, { ...repeated, raw: { ...repeated.raw } }]),
      context: { landlordId: "landlord-1", propertyId: "property-1", unitId: "unit-1", tenantId: "tenant-1", asOfDate: "2026-08-18" },
      persistedUnitOccupancy: "occupied",
      tenantId: "tenant-1",
    });
    expect(projection).toMatchObject({ occupancyState: "occupied", supportingLeaseId: "lease-a" });
    expect(projection.reasons).not.toContain("MULTIPLE_CURRENT_LEASES");
  });
});
