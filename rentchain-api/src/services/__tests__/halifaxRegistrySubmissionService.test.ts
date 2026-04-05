import { describe, expect, it } from "vitest";
import {
  buildHalifaxRegistrySubmissionPrefill,
  buildPropertyRegistryReadiness,
  buildRegistrySubmissionDraftV2,
  exportRegistrySubmissionDraftV2,
  getRegistrySchemaSummaryForProperty,
  hydrateRegistryAssistantUiState,
  migrateRegistryDraftToV2,
  validateHalifaxRegistrySubmissionDraft,
  validateRegistrySubmissionDraftV2,
} from "../registry/halifaxRegistrySubmissionService";
import { genericCanadaRegistryReadySchema } from "../registry/schemas/genericCanadaRegistryReadySchema";
import { resolveRegistrySchemaForProperty } from "../registry/schemas/registrySchemaResolver";

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

  function buildReadyDraft() {
    const schema = resolveRegistrySchemaForProperty(property);
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

    return buildRegistrySubmissionDraftV2({
      schema,
      draftId: "prop-1__halifax_rental_registry_form",
      propertyId: property.id,
      landlordId: "landlord-1",
      fieldValues: prefilled.fieldValues,
      fieldMeta: prefilled.fieldMeta,
      consent: prefilled.consent,
      declarations: {
        acknowledged: true,
        maintenancePlanConfirmed: true,
        ownerDeclarationConfirmed: true,
        informationAccurateConfirmed: true,
      },
      status: "ready",
      updatedBy: "landlord-1",
      migratedFromVersion: null,
    });
  }

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

  it("validates required Halifax fields, consent, and declaration requirements", () => {
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
    expect(validation.missingConsentItems.some((item) => item.path === "consent.preparationAuthorized")).toBe(true);
    expect(validation.exportReady).toBe(false);
    expect(validation.warnings.some((warning) => warning.includes("up to five buildings"))).toBe(true);
  });

  it("builds canonical v2 declarations and derives accepted ids", () => {
    const draft = buildReadyDraft();
    expect(draft.schemaVersion).toBe(2);
    expect(draft.declarations.items).toHaveLength(4);
    expect(draft.declarations.acceptedIds).toEqual([
      "acknowledged",
      "maintenancePlanConfirmed",
      "ownerDeclarationConfirmed",
      "informationAccurateConfirmed",
    ]);
    expect(draft.form.fieldValues.owner.email).toBe("owner@example.com");
    expect(draft.review.validation.exportReady).toBe(true);
  });

  it("hydrates canonical drafts without losing declaration checkbox state", () => {
    const draft = buildReadyDraft();
    const hydrated = hydrateRegistryAssistantUiState(draft);
    expect(hydrated.declarations.items.every((item) => item.checked)).toBe(true);
    expect(hydrated.declarations.acceptedIds).toHaveLength(4);
  });

  it("exports canonical v2 JSON from the same declaration state shown in the draft", () => {
    const draft = buildReadyDraft();
    const exported = exportRegistrySubmissionDraftV2(draft);
    expect(exported.schemaVersion).toBe(2);
    expect(exported.declarations.acceptedIds).toEqual(draft.declarations.acceptedIds);
    expect(exported.meta.disclaimer).toContain("preparation draft");
    expect(exported.meta.exportPreparedAt).toBeTruthy();
  });

  it("migrates legacy drafts to v2 without losing declaration selections", () => {
    const migrated = migrateRegistryDraftToV2({
      id: "draft-legacy",
      propertyId: "prop-1",
      landlordId: "landlord-1",
      sourceKey: "halifax_rental_registry_form",
      schemaKey: "halifax_rental_registry_v1",
      schemaLabel: "Halifax Rental Registry",
      mode: "official_registry",
      jurisdiction: {
        country: "CA",
        province: "NS",
        municipality: "Halifax",
      },
      status: "draft",
      fieldValues: {
        siteAddress: {
          line1: "12 Wharf Street",
          line2: null,
          city: "Halifax",
          province: "NS",
          postalCode: "B3H 1A1",
          country: "Canada",
        },
        propertyIdentifierPid: "PID-123",
        owner: {
          name: "Jordan Harbour",
          company: "Harbour Holdings Ltd.",
          email: "owner@example.com",
          phone: "902-555-0101",
          address: {
            line1: "55 Owner Lane",
            line2: null,
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 2B2",
            country: "Canada",
          },
        },
        primaryContactSameAsOwner: true,
        primaryContact: {
          name: null,
          company: null,
          email: null,
          phone: null,
          address: {
            line1: null,
            line2: null,
            city: null,
            province: null,
            postalCode: null,
            country: "Canada",
          },
        },
        moreThanFiveBuildings: false,
        buildings: [],
        propertyDescription: null,
      },
      declarations: {
        acknowledged: true,
        maintenancePlanConfirmed: false,
        ownerDeclarationConfirmed: true,
        informationAccurateConfirmed: false,
      },
      consent: {
        preparationAuthorized: true,
        preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
        preparationAuthorizedBy: "landlord-1",
        declarationsConfirmed: false,
        declarationsConfirmedAt: null,
        declarationsConfirmedBy: null,
        finalReviewConfirmed: false,
        finalReviewConfirmedAt: null,
      },
      validation: {
        missingRequiredFields: [],
        missingConsentItems: [],
        warnings: [],
        readinessScore: 50,
        completionPercent: 50,
        exportReady: false,
      },
      exportedAt: null,
      lastReviewedAt: null,
      createdAt: "2026-04-05T00:00:00.000Z",
      updatedAt: "2026-04-05T00:00:00.000Z",
      updatedBy: "landlord-1",
    });

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.audit.migratedFromVersion).toBe(1);
    expect(migrated.declarations.acceptedIds).toEqual(["acknowledged", "ownerDeclarationConfirmed"]);
    expect(migrated.declarations.items.find((item) => item.id === "acknowledged")?.checked).toBe(true);
  });

  it("validates canonical v2 drafts with structured errors", () => {
    const draft = migrateRegistryDraftToV2({
      id: "draft-1",
      propertyId: "prop-1",
      sourceKey: "halifax_rental_registry_form",
      schemaKey: "halifax_rental_registry_v1",
      schemaLabel: "Halifax Rental Registry",
      mode: "official_registry",
      jurisdiction: {
        country: "CA",
        province: "NS",
        municipality: "Halifax",
      },
      fieldValues: {
        siteAddress: {
          line1: "12 Wharf Street",
          line2: null,
          city: "Halifax",
          province: "NS",
          postalCode: "B3H 1A1",
          country: "Canada",
        },
        propertyIdentifierPid: "PID-123",
        owner: {
          name: "Jordan Harbour",
          company: "Harbour Holdings Ltd.",
          email: "owner@example.com",
          phone: null,
          address: {
            line1: null,
            line2: null,
            city: null,
            province: null,
            postalCode: null,
            country: "Canada",
          },
        },
        primaryContactSameAsOwner: null,
        primaryContact: {
          name: null,
          company: null,
          email: null,
          phone: null,
          address: {
            line1: null,
            line2: null,
            city: null,
            province: null,
            postalCode: null,
            country: "Canada",
          },
        },
        moreThanFiveBuildings: null,
        buildings: [],
        propertyDescription: null,
      },
      declarations: {
        acknowledged: true,
        maintenancePlanConfirmed: false,
        ownerDeclarationConfirmed: false,
        informationAccurateConfirmed: false,
      },
      consent: {
        preparationAuthorized: false,
        preparationAuthorizedAt: null,
        preparationAuthorizedBy: null,
        declarationsConfirmed: false,
        declarationsConfirmedAt: null,
        declarationsConfirmedBy: null,
        finalReviewConfirmed: false,
        finalReviewConfirmedAt: null,
      },
    });
    const validation = validateRegistrySubmissionDraftV2({
      draft,
      schema: resolveRegistrySchemaForProperty(property),
    });
    expect(validation.exportReady).toBe(false);
    expect(validation.errors?.length).toBeGreaterThan(0);
    expect(validation.missingConsentItems.some((item) => item.path === "consent.preparationAuthorized")).toBe(true);
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

  it("resolves verified Halifax readiness over draft completeness", () => {
    const readiness = buildPropertyRegistryReadiness({
      property,
      submission: buildReadyDraft(),
      projection: {
        registryStatus: "verified",
        summary: "Verified against Halifax public registry data.",
      },
      coverageAvailable: true,
      coverageMessage: null,
      propertyPid: "PID-123",
    });

    expect(readiness.readinessStatus).toBe("verified");
    expect(readiness.nextRecommendedAction).toBe("view_verified_details");
  });

  it("keeps generic fallback registry-ready behavior without claiming a public match", () => {
    const prefilled = genericCanadaRegistryReadySchema.buildPrefill({
      property: {
        id: "prop-3",
        name: "Prairie Homes",
        addressLine1: "10 River Road",
        city: "Calgary",
        province: "AB",
        postalCode: "T2P 1J9",
        country: "Canada",
        totalUnits: 2,
      },
      landlordProfile,
      userAccount: {},
      persisted: null,
    });
    const validation = genericCanadaRegistryReadySchema.validate(prefilled);
    const draft = buildRegistrySubmissionDraftV2({
      schema: genericCanadaRegistryReadySchema,
      draftId: "prop-3__canada_registry_ready_v1",
      propertyId: "prop-3",
      landlordId: "landlord-1",
      fieldValues: prefilled.fieldValues,
      fieldMeta: prefilled.fieldMeta,
      consent: prefilled.consent,
      declarations: prefilled.declarations,
      status: "draft",
      updatedBy: "landlord-1",
      migratedFromVersion: null,
    });
    const readiness = buildPropertyRegistryReadiness({
      property: {
        id: "prop-3",
        city: "Calgary",
        province: "AB",
        country: "Canada",
      },
      submission: {
        ...draft,
        review: { validation },
      },
      projection: null,
      coverageAvailable: false,
      coverageMessage:
        "This jurisdiction currently uses RentChain's registry-ready compliance workflow rather than a connected public registry.",
      propertyPid: null,
    });

    expect(readiness.readinessStatus).toBe("incomplete");
    expect(readiness.currentRegistryState.status).toBe("not_applicable");
  });
});
