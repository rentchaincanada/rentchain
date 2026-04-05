import { describe, expect, it } from "vitest";
import {
  buildHalifaxRegistrySubmissionExportPayload,
  buildHalifaxRegistrySubmissionPrefill,
  validateHalifaxRegistrySubmissionDraft,
} from "../registry/halifaxRegistrySubmissionService";

describe("halifaxRegistrySubmissionService", () => {
  const property = {
    id: "prop-1",
    name: "Harbour View",
    pid: "PID-123",
    addressLine1: "12 Wharf Street",
    addressLine2: "Suite 200",
    city: "Halifax",
    province: "NS",
    postalCode: "B3H 1A1",
    country: "Canada",
    totalUnits: 8,
  };

  const landlordProfile = {
    email: "owner@example.com",
    contactName: "Jordan Harbour",
    businessName: "Harbour Holdings Ltd.",
    phone: "902-555-0101",
    mailingAddressLine1: "55 Owner Lane",
    mailingCity: "Halifax",
    mailingProvince: "NS",
    mailingPostalCode: "B3H 2B2",
    mailingCountry: "Canada",
  };

  it("maps property and landlord data into Halifax field groups", () => {
    const prefilled = buildHalifaxRegistrySubmissionPrefill({
      property,
      landlordProfile,
      userAccount: { email: "backup@example.com" },
      persisted: null,
    });

    expect(prefilled.fieldValues.siteAddress.line1).toBe("12 Wharf Street");
    expect(prefilled.fieldValues.propertyIdentifierPid).toBe("PID-123");
    expect(prefilled.fieldValues.owner.name).toBe("Jordan Harbour");
    expect(prefilled.fieldValues.owner.company).toBe("Harbour Holdings Ltd.");
    expect(prefilled.fieldValues.owner.email).toBe("owner@example.com");
    expect(prefilled.fieldValues.owner.phone).toBe("902-555-0101");
    expect(prefilled.fieldValues.buildings).toHaveLength(1);
    expect(prefilled.fieldValues.buildings[0].totalResidentialUnits).toBe(8);
  });

  it("flags missing required fields and Halifax-specific warnings", () => {
    const prefilled = buildHalifaxRegistrySubmissionPrefill({
      property,
      landlordProfile: { email: "owner@example.com" },
      userAccount: {},
      persisted: {
        fieldValues: {
          moreThanFiveBuildings: true,
        },
      },
    });

    const validation = validateHalifaxRegistrySubmissionDraft(prefilled);
    expect(validation.missingRequiredFields.some((item) => item.path === "fieldValues.owner.phone")).toBe(true);
    expect(validation.missingRequiredFields.some((item) => item.path === "fieldValues.primaryContactSameAsOwner")).toBe(true);
    expect(validation.warnings.some((warning) => warning.includes("up to five buildings"))).toBe(true);
  });

  it("builds an export payload with grouped Halifax sections", () => {
    const prefilled = buildHalifaxRegistrySubmissionPrefill({
      property,
      landlordProfile,
      userAccount: {},
      persisted: {
        fieldValues: {
          moreThanFiveBuildings: false,
          primaryContactSameAsOwner: true,
          buildings: [
            {
              id: "building-1",
              primaryAddress: {
                line1: "12 Wharf Street",
                line2: null,
                city: "Halifax",
                province: "NS",
                postalCode: "B3H 1A1",
                country: "Canada",
              },
              rentalUnitTypes: ["Apartment(s)"],
              residentialUnitsRented: 8,
              shortTermRentalUnits: 0,
              buildingType: "Apartment building",
              totalResidentialUnits: 8,
              hasCommercialUnits: false,
              amenities: ["Laundry"],
              fireLifeSafetySystems: ["Smoke alarm(s)"],
              accessibilityFeatures: [],
              yearConstructed: 1998,
            },
          ],
        },
        declarations: {
          acknowledged: true,
          maintenancePlanConfirmed: true,
          ownerDeclarationConfirmed: true,
          informationAccurateConfirmed: true,
        },
      },
    });
    const validation = validateHalifaxRegistrySubmissionDraft(prefilled);
    const submission = {
      id: "draft-1",
      propertyId: property.id,
      landlordId: "landlord-1",
      sourceKey: "halifax_rental_registry_form" as const,
      jurisdiction: {
        country: "CA" as const,
        province: "NS" as const,
        municipality: "Halifax" as const,
      },
      status: "ready" as const,
      fieldValues: prefilled.fieldValues,
      declarations: prefilled.declarations,
      validation,
      exportedAt: null,
      lastReviewedAt: null,
      createdAt: "2026-04-05T00:00:00.000Z",
      updatedAt: "2026-04-05T00:00:00.000Z",
      updatedBy: "landlord-1",
    };

    const exportPayload = buildHalifaxRegistrySubmissionExportPayload({
      property,
      submission,
    });

    expect(exportPayload.sections.propertySite.civicAddress.line1).toBe("12 Wharf Street");
    expect(exportPayload.sections.propertyOwner.email).toBe("owner@example.com");
    expect(Array.isArray(exportPayload.sections.buildings)).toBe(true);
    expect(exportPayload.sections.buildings[0].buildingType).toBe("Apartment building");
    expect(exportPayload.validation.readinessScore).toBeGreaterThan(0);
  });
});
