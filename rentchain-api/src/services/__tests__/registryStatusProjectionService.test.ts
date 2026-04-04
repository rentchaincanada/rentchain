import { describe, expect, it } from "vitest";
import { derivePropertyRegistryProjection } from "../registry/registryStatusProjectionService";

const source = {
  id: "halifax_r400",
  sourceKey: "halifax_r400" as const,
  jurisdictionCountry: "CA" as const,
  jurisdictionProvince: "NS",
  jurisdictionMunicipality: "Halifax",
  sourceType: "rental_registry" as const,
  sourceLabel: "Halifax Residential Rental Registry",
  sourceUrl: null,
  active: true,
  ingestionMode: "csv_upload" as const,
  schemaVersion: 1,
  refreshFrequency: "manual" as const,
  latestImportId: null,
  createdAt: "2026-04-01T00:00:00.000Z",
  updatedAt: "2026-04-01T00:00:00.000Z",
};

describe("registryStatusProjectionService", () => {
  it("projects a verified landlord-facing status for matched registered records", () => {
    const projection = derivePropertyRegistryProjection({
      propertyId: "prop-1",
      source,
      match: {
        id: "match-1",
        sourceKey: "halifax_r400",
        registryRecordId: "reg-1",
        normalizedRecordId: "norm-1",
        propertyId: "prop-1",
        landlordId: "landlord-1",
        matchMethod: "manual",
        matchScore: 1,
        matchStatus: "matched",
        mismatchReasons: [],
        reviewedBy: "admin-1",
        reviewedAt: "2026-04-01T00:00:00.000Z",
        overrideReason: "manual attach",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
      record: {
        id: "norm-1",
        importBatchId: "import-1",
        sourceKey: "halifax_r400",
        jurisdictionCountry: "CA",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
        registryCategory: "rental_registry",
        registryRecordId: "reg-1",
        registrationNumber: "REG-1",
        pid: "1234567",
        addressRaw: "123 Example St",
        addressNormalized: "123 example st",
        postalCode: null,
        rentalUnitTypeRaw: null,
        rentalUnitTypeNormalized: null,
        buildingTypeRaw: null,
        buildingTypeNormalized: null,
        registeredUnits: 4,
        numberOfFloors: 3,
        sharedFacilities: null,
        registrationStatusRaw: "Y",
        registrationStatusNormalized: "registered",
        registrationIssuedAt: "2026-04-01T00:00:00.000Z",
        lat: null,
        lng: null,
        sourceConfidence: 0.94,
        importedAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
      },
    });

    expect(projection.registryStatus).toBe("verified");
    expect(projection.summary).toContain("Verified against public Halifax rental registry data");
    expect(projection.recommendedAction).toBe("No action needed.");
  });

  it("uses cautious wording when no public match is available", () => {
    const projection = derivePropertyRegistryProjection({
      propertyId: "prop-2",
      source,
      match: null,
      record: null,
    });

    expect(projection.registryStatus).toBe("not_found");
    expect(projection.summary).toContain("No public registry match found");
    expect(projection.summary).toContain("not a definitive compliance determination");
    expect(projection.recommendedAction).toContain("Review property details");
  });
});
