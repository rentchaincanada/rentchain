import { describe, expect, it, vi } from "vitest";
import type { CanonicalUnitRecord } from "../leaseCanonicalizationService";
import { dedupePropertyScopedLeasesByUnit, filterPropertyScopedLeases } from "../risk/propertyLeaseIsolation";
import { loadPropertyCredibilitySummary } from "../risk/propertyCredibilitySummary";

function makeUnit(input: Partial<CanonicalUnitRecord> & { id: string }): CanonicalUnitRecord {
  return {
    id: input.id,
    landlordId: input.landlordId ?? "landlord-1",
    propertyId: input.propertyId ?? "prop-1",
    unitNumber: input.unitNumber ?? "A",
    label: input.label ?? "Unit A",
    rent: input.rent ?? 1800,
    raw: input.raw ?? {},
  };
}

describe("propertyLeaseIsolation", () => {
  it("keeps property-scoped lease rows when lease and unit belong to the requested owner/property", () => {
    const result = filterPropertyScopedLeases({
      requestedLandlordId: "landlord-1",
      requestedPropertyId: "prop-1",
      units: [makeUnit({ id: "unit-1", unitNumber: "1A", label: "Unit 1A" })],
      leases: [
        {
          id: "lease-1",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "unit-1",
          unitNumber: "1A",
          status: "active",
        },
      ],
    });

    expect(result.included.map((lease) => lease.id)).toEqual(["lease-1"]);
    expect(result.excluded).toHaveLength(0);
  });

  it("excludes a foreign unit reference even when the row is otherwise present in the property lease set", () => {
    const logger = vi.fn();
    const result = filterPropertyScopedLeases({
      requestedLandlordId: "landlord-1",
      requestedPropertyId: "prop-1",
      units: [makeUnit({ id: "unit-local", unitNumber: "1A", label: "Unit 1A" })],
      leases: [
        {
          id: "lease-foreign-unit",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "kQKKrllUuFCRIBrD0yXr",
          unitNumber: "kQKKrllUuFCRIBrD0yXr",
          status: "active",
        },
      ],
      logger,
    });

    expect(result.included).toHaveLength(0);
    expect(result.excluded).toEqual([
      expect.objectContaining({
        leaseId: "lease-foreign-unit",
        reason: "unit_not_in_requested_property",
      }),
    ]);
    expect(logger).toHaveBeenCalledWith(
      "[property-lease-isolation] excluded lease row",
      expect.objectContaining({
        leaseId: "lease-foreign-unit",
        reason: "unit_not_in_requested_property",
        requestedLandlordId: "landlord-1",
        requestedPropertyId: "prop-1",
      })
    );
  });

  it("excludes a cross-landlord row when landlord ownership mismatches", () => {
    const result = filterPropertyScopedLeases({
      requestedLandlordId: "landlord-1",
      requestedPropertyId: "prop-1",
      units: [makeUnit({ id: "unit-1" })],
      leases: [
        {
          id: "lease-cross-landlord",
          landlordId: "landlord-2",
          propertyId: "prop-1",
          unitId: "unit-1",
          unitNumber: "A",
          status: "active",
        },
      ],
    });

    expect(result.included).toHaveLength(0);
    expect(result.excluded).toEqual([
      expect.objectContaining({
        leaseId: "lease-cross-landlord",
        reason: "landlord_mismatch",
      }),
    ]);
  });

  it("treats stale migration-style unit ids as invalid when they do not resolve to the requested property's units", () => {
    const result = filterPropertyScopedLeases({
      requestedLandlordId: "landlord-1",
      requestedPropertyId: "prop-1",
      units: [makeUnit({ id: "unit-1", unitNumber: "101", label: "Unit 101" })],
      leases: [
        {
          id: "lease-migrated",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          unitId: "legacy-tenant-migration-foreign-unit-id",
          unitNumber: "legacy-tenant-migration-foreign-unit-id",
          status: "active",
        },
      ],
    });

    expect(result.included).toHaveLength(0);
    expect(result.excluded[0]?.reason).toBe("unit_not_in_requested_property");
  });

  it("dedupes same-unit current leases down to one winner", () => {
    const result = dedupePropertyScopedLeasesByUnit([
      {
        id: "lease-older",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        resolvedUnitId: "unit-1",
        unitId: "unit-1",
        unitNumber: "1A",
        status: "active",
        updatedAt: 10,
        createdAt: 10,
        riskScore: null,
        riskConfidence: null,
      },
      {
        id: "lease-newer",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        resolvedUnitId: "unit-1",
        unitId: "unit-1",
        unitNumber: "1A",
        status: "renewal_pending",
        updatedAt: 20,
        createdAt: 20,
        riskScore: 81,
        riskConfidence: 0.86,
      },
    ]);

    expect(result.map((lease) => lease.id)).toEqual(["lease-newer"]);
  });

  it("keeps distinct units as separate rows after dedupe", () => {
    const result = dedupePropertyScopedLeasesByUnit([
      {
        id: "lease-1",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        resolvedUnitId: "unit-1",
        unitId: "unit-1",
        unitNumber: "1A",
        status: "active",
      },
      {
        id: "lease-2",
        landlordId: "landlord-1",
        propertyId: "prop-1",
        resolvedUnitId: "unit-2",
        unitId: "unit-2",
        unitNumber: "2A",
        status: "active",
      },
    ]);

    expect(result.map((lease) => lease.id)).toEqual(["lease-1", "lease-2"]);
  });
});

describe("loadPropertyCredibilitySummary", () => {
  it("filters mismatched lease rows before computing property credibility", async () => {
    const firestore = {
      collection: () => ({
        doc: (tenantId: string) => ({
          get: async () => ({
            exists: true,
            id: tenantId,
            data: () => ({
              landlordId: "landlord-1",
              tenantScoreValue: 81,
              tenantScoreConfidence: 0.82,
            }),
          }),
        }),
      }),
    };

    const summary = await loadPropertyCredibilitySummary({
      firestore: firestore as any,
      propertyId: "prop-1",
      landlordId: "landlord-1",
      leases: [
        {
          id: "lease-good",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          tenantId: "tenant-1",
          status: "active",
          riskScore: 78,
          riskConfidence: 0.8,
        },
        {
          id: "lease-bad",
          landlordId: "landlord-9",
          propertyId: "prop-9",
          tenantId: "tenant-foreign",
          status: "active",
          riskScore: 99,
          riskConfidence: 0.95,
        },
      ],
    });

    expect(summary).toEqual(
      expect.objectContaining({
        propertyId: "prop-1",
        activeLeaseCount: 1,
        leaseRiskAverage: 78,
        tenantsWithScoreCount: 1,
      })
    );
  });
});
