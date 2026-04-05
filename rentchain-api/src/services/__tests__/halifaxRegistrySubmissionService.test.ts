import { describe, expect, it } from "vitest";
import {
  buildHalifaxRegistrySubmissionExportPayload,
  buildHalifaxRegistrySubmissionPrefill,
  getRegistrySchemaSummaryForProperty,
  loadPropertyRegistrySubmissionDraft,
  validateHalifaxRegistrySubmissionDraft,
} from "../registry/halifaxRegistrySubmissionService";
import { genericCanadaRegistryReadySchema } from "../registry/schemas/genericCanadaRegistryReadySchema";

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
    expect(validation.missingConsentItems.some((item) => item.path === "consent.preparationAuthorized")).toBe(true);
    expect(validation.exportReady).toBe(false);
    expect(validation.warnings.some((warning) => warning.includes("up to five buildings"))).toBe(true);
  });

  it("builds an export payload with grouped Halifax sections and draft disclaimer", () => {
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
        consent: {
          preparationAuthorized: true,
          preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
          preparationAuthorizedBy: "landlord-1",
          declarationsConfirmed: true,
          declarationsConfirmedAt: "2026-04-05T00:05:00.000Z",
          declarationsConfirmedBy: "landlord-1",
          finalReviewConfirmed: false,
          finalReviewConfirmedAt: null,
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
      fieldMeta: prefilled.fieldMeta,
      declarations: prefilled.declarations,
      consent: prefilled.consent,
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
    expect(exportPayload.validation.exportReady).toBe(true);
    expect(String(exportPayload.disclaimer)).toContain("preparation draft");
    expect(exportPayload.exportMeta.consentCapturedAt).toBe("2026-04-05T00:00:00.000Z");
    expect(exportPayload.exportMeta.declarationsConfirmedAt).toBe("2026-04-05T00:05:00.000Z");
  });

  it("tracks provenance for key prefilled fields", () => {
    const prefilled = buildHalifaxRegistrySubmissionPrefill({
      property,
      landlordProfile,
      userAccount: {},
      persisted: null,
    });

    expect(prefilled.fieldMeta["fieldValues.siteAddress.line1"]?.status).toBe("needs_confirmation");
    expect(prefilled.fieldMeta["fieldValues.owner.email"]?.source).toBe("rentchain_profile");
    expect(prefilled.fieldMeta["fieldValues.propertyIdentifierPid"]?.status).toBe("needs_confirmation");
  });

  it("resolves Halifax and generic fallback schemas deterministically", () => {
    expect(
      getRegistrySchemaSummaryForProperty({
        country: "Canada",
        province: "NS",
        city: "Halifax",
      }).schemaKey
    ).toBe("halifax_rental_registry_v1");

    const generic = getRegistrySchemaSummaryForProperty({
      country: "Canada",
      province: "ON",
      city: "Ottawa",
    });
    expect(generic.schemaKey).toBe("canada_registry_ready_v1");
    expect(generic.mode).toBe("registry_ready_fallback");
  });

  it("builds a generic registry-ready export without claiming official registration", () => {
    const prefilled = genericCanadaRegistryReadySchema.buildPrefill({
      property: {
        id: "prop-2",
        name: "Market Street Homes",
        addressLine1: "88 Market Street",
        city: "Ottawa",
        province: "ON",
        postalCode: "K1A 0A1",
        country: "Canada",
        totalUnits: 3,
      },
      landlordProfile,
      userAccount: {},
      persisted: {
        fieldValues: {
          primaryContactSameAsOwner: true,
          buildings: [
            {
              id: "building-1",
              primaryAddress: {
                line1: "88 Market Street",
                line2: null,
                city: "Ottawa",
                province: "ON",
                postalCode: "K1A 0A1",
                country: "Canada",
              },
              rentalUnitTypes: ["Entire house"],
              residentialUnitsRented: 3,
              shortTermRentalUnits: 0,
              buildingType: "House",
              totalResidentialUnits: 3,
              hasCommercialUnits: false,
              amenities: ["Laundry"],
              fireLifeSafetySystems: ["Smoke alarm(s)"],
              accessibilityFeatures: [],
              yearConstructed: 2002,
            },
          ],
        },
        declarations: {
          acknowledged: true,
          maintenancePlanConfirmed: true,
          ownerDeclarationConfirmed: true,
          informationAccurateConfirmed: true,
        },
        consent: {
          preparationAuthorized: true,
          preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
          preparationAuthorizedBy: "landlord-1",
          declarationsConfirmed: true,
          declarationsConfirmedAt: "2026-04-05T00:05:00.000Z",
          declarationsConfirmedBy: "landlord-1",
          finalReviewConfirmed: false,
          finalReviewConfirmedAt: null,
        },
      },
    });

    const validation = genericCanadaRegistryReadySchema.validate(prefilled);
    const exportPayload = genericCanadaRegistryReadySchema.buildExportPayload({
      property: {
        id: "prop-2",
        name: "Market Street Homes",
        addressLine1: "88 Market Street",
      },
      submission: {
        id: "draft-2",
        propertyId: "prop-2",
        landlordId: "landlord-1",
        sourceKey: genericCanadaRegistryReadySchema.sourceKey,
        schemaKey: genericCanadaRegistryReadySchema.schemaKey,
        schemaLabel: genericCanadaRegistryReadySchema.label,
        mode: genericCanadaRegistryReadySchema.mode,
        jurisdiction: {
          country: "CA",
          province: "ON",
          municipality: "Ottawa",
        },
        status: "ready",
        fieldValues: prefilled.fieldValues,
        fieldMeta: prefilled.fieldMeta,
        declarations: prefilled.declarations,
        consent: prefilled.consent,
        validation,
        exportedAt: null,
        lastReviewedAt: null,
        createdAt: "2026-04-05T00:00:00.000Z",
        updatedAt: "2026-04-05T00:00:00.000Z",
        updatedBy: "landlord-1",
      },
    });

    expect(validation.exportReady).toBe(true);
    expect(String(exportPayload.disclaimer)).toContain("does not indicate that an official registry currently exists");
    expect(exportPayload.mode).toBe("registry_ready_fallback");
  });
});
