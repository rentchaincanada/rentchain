import { describe, expect, it } from "vitest";
import { buildRegistrySubmissionDraftV2 } from "../registry/halifaxRegistrySubmissionService";
import { halifaxRentalRegistryManualPortalAdapter } from "../registry/adapters/halifaxRentalRegistryManualPortalAdapter";
import {
  buildRegistrySubmissionFilingRequestFromReady,
  buildRegistrySubmissionReadyV3FromDraft,
} from "../registry/registrySubmissionLayerV3";
import { resolveRegistrySchemaForProperty } from "../registry/schemas/registrySchemaResolver";

function buildReadyDraft() {
  const property = {
    id: "prop-1",
    addressLine1: "12 Wharf Street",
    city: "Halifax",
    province: "NS",
    postalCode: "B3H 1A1",
    country: "Canada",
    totalUnits: 8,
  };
  const schema = resolveRegistrySchemaForProperty(property);
  return buildRegistrySubmissionDraftV2({
    schema,
    draftId: "prop-1__halifax_rental_registry_form",
    propertyId: "prop-1",
    landlordId: "landlord-1",
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
      moreThanFiveBuildings: false,
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
          hasAlternateContact: null,
          alternateContact: {
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
          hasAdditionalCivicAddress: null,
          additionalCivicAddress: null,
          rentalUnitTypes: ["Apartment(s)"],
          otherRentalUnitType: null,
          residentialUnitsRented: 8,
          shortTermRentalUnits: 0,
          buildingType: "Apartment building",
          otherBuildingType: null,
          totalResidentialUnits: 8,
          hasCommercialUnits: false,
          amenities: ["Laundry"],
          fireLifeSafetySystems: ["Smoke alarm(s)"],
          accessibilityFeatures: [],
          yearConstructed: 1998,
          notes: null,
        },
      ],
      propertyDescription: "Waterfront rental property",
    },
    fieldMeta: {},
    consent: {
      preparationAuthorized: true,
      preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
      preparationAuthorizedBy: "landlord-1",
      declarationsConfirmed: true,
      declarationsConfirmedAt: "2026-04-05T00:02:00.000Z",
      declarationsConfirmedBy: "landlord-1",
      finalReviewConfirmed: false,
      finalReviewConfirmedAt: null,
    },
    declarations: {
      acknowledged: true,
      maintenancePlanConfirmed: true,
      ownerDeclarationConfirmed: true,
      informationAccurateConfirmed: true,
    },
    status: "ready",
    updatedBy: "landlord-1",
  });
}

describe("registrySubmissionLayerV3", () => {
  it("builds a ready package from canonical v2 draft data without mutating the draft", () => {
    const draft = buildReadyDraft();
    const ready = buildRegistrySubmissionReadyV3FromDraft(draft);

    expect(draft.schemaVersion).toBe(2);
    expect(ready.schemaVersion).toBe(3);
    expect(ready.sourceDraftId).toBe(draft.draftId);
    expect(ready.sourceDraftVersion).toBe(2);
    expect(ready.status).toBe("ready_to_file");
    expect(ready.validation.exportReady).toBe(true);
    expect(ready.declarationsLock.acceptedIds).toEqual(draft.declarations.acceptedIds);
    expect(ready.normalizedSubmission.sections.some((section) => section.id === "property_site")).toBe(true);
    expect(ready.audit.events[0]?.type).toBe("ready_package_created");
  });

  it("builds a Halifax manual filing request and checklist from the ready package", () => {
    const ready = buildRegistrySubmissionReadyV3FromDraft(buildReadyDraft());
    const request = buildRegistrySubmissionFilingRequestFromReady(ready, "operator-1");

    expect(request.schemaVersion).toBe(3);
    expect(request.adapterKey).toBe(halifaxRentalRegistryManualPortalAdapter.adapterKey);
    expect(request.filingChannel).toBe("manual_portal");
    expect(request.status).toBe("ready_to_file");
    expect(request.checklist.portalUrl).toContain("halifax.ca/form/rental-registry");
    expect(request.checklist.steps.length).toBeGreaterThan(2);
    expect(request.payload.sections.length).toBeGreaterThan(2);
  });
});
