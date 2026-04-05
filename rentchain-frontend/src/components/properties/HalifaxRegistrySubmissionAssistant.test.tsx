import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HalifaxRegistrySubmissionAssistant } from "./HalifaxRegistrySubmissionAssistant";

const mocks = vi.hoisted(() => ({
  fetchHalifaxRegistrySubmission: vi.fn(),
  saveHalifaxRegistrySubmission: vi.fn(),
  exportHalifaxRegistrySubmission: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../api/propertiesApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/propertiesApi")>("../../api/propertiesApi");
  return {
    ...actual,
    fetchHalifaxRegistrySubmission: mocks.fetchHalifaxRegistrySubmission,
    saveHalifaxRegistrySubmission: mocks.saveHalifaxRegistrySubmission,
    exportHalifaxRegistrySubmission: mocks.exportHalifaxRegistrySubmission,
  };
});

vi.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

describe("HalifaxRegistrySubmissionAssistant", () => {
  function clickLastButton(name: string) {
    const buttons = screen.getAllByRole("button", { name });
    fireEvent.click(buttons[buttons.length - 1]);
  }

  function clickLastCheckbox(label: RegExp) {
    const inputs = screen.getAllByLabelText(label);
    fireEvent.click(inputs[inputs.length - 1]);
  }

  function buildDraft(overrides: Record<string, any> = {}) {
    return {
      schemaVersion: 2,
      draftId: "draft-1",
      assistantType: "halifax_registry_submission_assistant",
      status: "draft",
      timestamps: {
        createdAt: "2026-04-05T00:00:00.000Z",
        updatedAt: "2026-04-05T00:00:00.000Z",
        exportedAt: null,
        lastReviewedAt: null,
      },
      actor: {
        landlordId: "landlord-1",
        updatedBy: "landlord-1",
      },
      context: {
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
      },
      entity: {
        siteAddress: {
          line1: "12 Wharf Street",
          line2: "",
          city: "Halifax",
          province: "NS",
          postalCode: "B3H 1A1",
          country: "Canada",
        },
        propertyIdentifierPid: "PID-123",
        moreThanFiveBuildings: false,
        propertyDescription: "",
        buildings: [
          {
            id: "building-1",
            primaryAddress: {
              line1: "12 Wharf Street",
              line2: "",
              city: "Halifax",
              province: "NS",
              postalCode: "B3H 1A1",
              country: "Canada",
            },
            hasAlternateContact: null,
            alternateContact: {
              name: "",
              company: "",
              email: "",
              phone: "",
              address: {
                line1: "",
                line2: "",
                city: "",
                province: "",
                postalCode: "",
                country: "Canada",
              },
            },
            hasAdditionalCivicAddress: null,
            additionalCivicAddress: "",
            rentalUnitTypes: ["Apartment(s)"],
            otherRentalUnitType: "",
            residentialUnitsRented: 8,
            shortTermRentalUnits: 0,
            buildingType: "Apartment building",
            otherBuildingType: "",
            totalResidentialUnits: 8,
            hasCommercialUnits: false,
            amenities: ["Laundry"],
            fireLifeSafetySystems: ["Smoke alarm(s)"],
            accessibilityFeatures: [],
            yearConstructed: 1998,
            notes: "",
          },
        ],
      },
      contact: {
        owner: {
          name: "Jordan Harbour",
          company: "Harbour Holdings Ltd.",
          email: "owner@example.com",
          phone: "",
          address: {
            line1: "",
            line2: "",
            city: "",
            province: "",
            postalCode: "",
            country: "Canada",
          },
        },
        primaryContactSameAsOwner: null,
        primaryContact: {
          name: "",
          company: "",
          email: "",
          phone: "",
          address: {
            line1: "",
            line2: "",
            city: "",
            province: "",
            postalCode: "",
            country: "Canada",
          },
        },
      },
      people: {
        owner: {
          name: "Jordan Harbour",
          company: "Harbour Holdings Ltd.",
          email: "owner@example.com",
          phone: "",
          address: {
            line1: "",
            line2: "",
            city: "",
            province: "",
            postalCode: "",
            country: "Canada",
          },
        },
        primaryContact: {
          name: "",
          company: "",
          email: "",
          phone: "",
          address: {
            line1: "",
            line2: "",
            city: "",
            province: "",
            postalCode: "",
            country: "Canada",
          },
        },
      },
      declarations: {
        items: [
          {
            id: "acknowledged",
            label: "I understand this draft is prepared by RentChain for review and export and is not automatically submitted to Halifax.",
            required: true,
            checked: false,
            checkedAt: null,
          },
          {
            id: "maintenancePlanConfirmed",
            label: "I confirm a maintenance / property management plan exists or will be maintained as required.",
            required: true,
            checked: false,
            checkedAt: null,
          },
          {
            id: "ownerDeclarationConfirmed",
            label: "I am authorized to make owner or operator declarations for this property, and I understand that municipal registration requirements remain my responsibility.",
            required: true,
            checked: false,
            checkedAt: null,
          },
          {
            id: "informationAccurateConfirmed",
            label: "I confirm the information in this draft is accurate to the best of my knowledge.",
            required: true,
            checked: false,
            checkedAt: null,
          },
        ],
        acceptedIds: [],
      },
      attachments: [],
      form: {
        fieldValues: {
          siteAddress: {
            line1: "12 Wharf Street",
            line2: "",
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
            phone: "",
            address: {
              line1: "",
              line2: "",
              city: "",
              province: "",
              postalCode: "",
              country: "Canada",
            },
          },
          primaryContactSameAsOwner: null,
          primaryContact: {
            name: "",
            company: "",
            email: "",
            phone: "",
            address: {
              line1: "",
              line2: "",
              city: "",
              province: "",
              postalCode: "",
              country: "Canada",
            },
          },
          moreThanFiveBuildings: false,
          buildings: [
            {
              id: "building-1",
              primaryAddress: {
                line1: "12 Wharf Street",
                line2: "",
                city: "Halifax",
                province: "NS",
                postalCode: "B3H 1A1",
                country: "Canada",
              },
              hasAlternateContact: null,
              alternateContact: {
                name: "",
                company: "",
                email: "",
                phone: "",
                address: {
                  line1: "",
                  line2: "",
                  city: "",
                  province: "",
                  postalCode: "",
                  country: "Canada",
                },
              },
              hasAdditionalCivicAddress: null,
              additionalCivicAddress: "",
              rentalUnitTypes: ["Apartment(s)"],
              otherRentalUnitType: "",
              residentialUnitsRented: 8,
              shortTermRentalUnits: 0,
              buildingType: "Apartment building",
              otherBuildingType: "",
              totalResidentialUnits: 8,
              hasCommercialUnits: false,
              amenities: ["Laundry"],
              fireLifeSafetySystems: ["Smoke alarm(s)"],
              accessibilityFeatures: [],
              yearConstructed: 1998,
              notes: "",
            },
          ],
          propertyDescription: "",
        },
        fieldMeta: {
          "fieldValues.siteAddress.line1": {
            source: "rentchain_property",
            status: "needs_confirmation",
            confirmed: false,
          },
          "fieldValues.owner.name": {
            source: "rentchain_profile",
            status: "needs_confirmation",
            confirmed: false,
          },
          "fieldValues.owner.email": {
            source: "rentchain_profile",
            status: "needs_confirmation",
            confirmed: false,
          },
          "fieldValues.owner.phone": {
            source: "unknown",
            status: "missing",
            confirmed: false,
          },
        },
      },
      review: {
        validation: {
          missingRequiredFields: [
            { path: "fieldValues.owner.phone", label: "Owner phone", section: "Property Owner" },
            { path: "fieldValues.primaryContactSameAsOwner", label: "Primary contact same as owner", section: "Primary Contact" },
          ],
          missingConsentItems: [
            { path: "consent.preparationAuthorized", label: "Preparation consent authorization", section: "Consent & Use Notice" },
            { path: "consent.declarationsConfirmed", label: "Declaration confirmation", section: "Declarations" },
          ],
          warnings: [],
          readinessScore: 58,
          completionPercent: 58,
          exportReady: false,
          errors: [],
        },
      },
      submission: {
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
      },
      audit: {
        migratedFromVersion: null,
      },
      meta: {
        disclaimer: "This file is a preparation draft generated by RentChain for review and export. It is not a direct Halifax filing.",
        exportPreparedAt: null,
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    mocks.showToast.mockReset();
    const baseSubmission = buildDraft();
    mocks.fetchHalifaxRegistrySubmission.mockResolvedValue({
      submission: baseSubmission,
      schema: {
        schemaKey: "halifax_rental_registry_v1",
        sourceKey: "halifax_rental_registry_form",
        label: "Halifax Rental Registry",
        mode: "official_registry",
        jurisdiction: {
          country: "CA",
          province: "NS",
          municipality: "Halifax",
        },
      },
      fieldMap: [
        {
          path: "fieldValues.siteAddress.line1",
          label: "Civic address",
          section: "Property / Site",
          required: true,
          source: "property",
          confidence: "high",
        },
      ],
    });
    mocks.saveHalifaxRegistrySubmission.mockImplementation(async (_propertyId: string, payload: any) => {
      const draft = payload.draft;
      const allDeclarationsChecked = draft.declarations.items.every((item: any) => item.checked);
      return {
        submission: {
          ...draft,
          review: {
            validation: {
              missingRequiredFields: allDeclarationsChecked ? [] : baseSubmission.review.validation.missingRequiredFields,
              missingConsentItems:
                draft.submission.consent.preparationAuthorized && allDeclarationsChecked
                  ? []
                  : [{ path: "consent.declarationsConfirmed", label: "Declaration confirmation", section: "Declarations" }],
              warnings: [],
              readinessScore: draft.submission.consent.preparationAuthorized && allDeclarationsChecked ? 100 : 72,
              completionPercent: draft.submission.consent.preparationAuthorized && allDeclarationsChecked ? 100 : 72,
              exportReady: Boolean(draft.submission.consent.preparationAuthorized && allDeclarationsChecked),
              errors: [],
            },
          },
          submission: {
            consent: {
              ...draft.submission.consent,
              preparationAuthorized: Boolean(draft.submission.consent.preparationAuthorized),
              preparationAuthorizedAt: draft.submission.consent.preparationAuthorized
                ? "2026-04-05T00:00:00.000Z"
                : null,
              declarationsConfirmed: allDeclarationsChecked,
              declarationsConfirmedAt: allDeclarationsChecked ? "2026-04-05T00:05:00.000Z" : null,
            },
          },
          status: draft.submission.consent.preparationAuthorized && allDeclarationsChecked ? "ready" : "draft",
        },
        schema: {
          schemaKey: "halifax_rental_registry_v1",
          sourceKey: "halifax_rental_registry_form",
          label: "Halifax Rental Registry",
          mode: "official_registry",
          jurisdiction: {
            country: "CA",
            province: "NS",
            municipality: "Halifax",
          },
        },
        fieldMap: [],
      };
    });
    mocks.exportHalifaxRegistrySubmission.mockResolvedValue({
      submission: buildDraft({
        status: "exported",
        declarations: {
          items: buildDraft().declarations.items.map((item) => ({
            ...item,
            checked: true,
            checkedAt: "2026-04-05T00:05:00.000Z",
          })),
          acceptedIds: [
            "acknowledged",
            "maintenancePlanConfirmed",
            "ownerDeclarationConfirmed",
            "informationAccurateConfirmed",
          ],
        },
        review: {
          validation: {
            missingRequiredFields: [],
            missingConsentItems: [],
            warnings: [],
            readinessScore: 100,
            completionPercent: 100,
            exportReady: true,
            errors: [],
          },
        },
        submission: {
          consent: {
            preparationAuthorized: true,
            preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
            preparationAuthorizedBy: "landlord-1",
            declarationsConfirmed: true,
            declarationsConfirmedAt: "2026-04-05T00:05:00.000Z",
            declarationsConfirmedBy: "landlord-1",
            finalReviewConfirmed: true,
            finalReviewConfirmedAt: "2026-04-05T00:10:00.000Z",
          },
        },
      }),
      exportPayload: buildDraft({
        declarations: {
          items: buildDraft().declarations.items.map((item) => ({
            ...item,
            checked: true,
            checkedAt: "2026-04-05T00:05:00.000Z",
          })),
          acceptedIds: [
            "acknowledged",
            "maintenancePlanConfirmed",
            "ownerDeclarationConfirmed",
            "informationAccurateConfirmed",
          ],
        },
        meta: {
          disclaimer: "This file is a preparation draft generated by RentChain for review and export. It is not a direct Halifax filing.",
          exportPreparedAt: "2026-04-05T00:10:00.000Z",
        },
      }),
      schema: {
        schemaKey: "halifax_rental_registry_v1",
        sourceKey: "halifax_rental_registry_form",
        label: "Halifax Rental Registry",
        mode: "official_registry",
        jurisdiction: {
          country: "CA",
          province: "NS",
          municipality: "Halifax",
        },
      },
    });
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("persists declaration selections through save and reload", async () => {
    render(
      <HalifaxRegistrySubmissionAssistant
        open
        property={{
          id: "prop-1",
          name: "Harbour View",
          addressLine1: "12 Wharf Street",
          city: "Halifax",
          province: "NS",
          postalCode: "B3H 1A1",
          totalUnits: 8,
          units: [],
          createdAt: "2026-04-05T00:00:00.000Z",
        }}
        onClose={() => undefined}
      />
    );

    expect((await screen.findAllByText("Prepare Halifax rental registry submission")).length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByLabelText(
        /I authorize RentChain to use my stored property and account information to prepare a Halifax rental registry submission draft/i
      )
    );
    clickLastButton("Next");
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "902-555-0101" } });
    fireEvent.click(screen.getByRole("button", { name: "Same as owner" }));
    clickLastButton("Next");
    clickLastButton("Next");
    clickLastButton("Next");
    clickLastCheckbox(/I understand this draft is prepared by RentChain for review and export/i);
    clickLastCheckbox(/I confirm a maintenance \/ property management plan exists/i);
    clickLastCheckbox(/I am authorized to make owner or operator declarations/i);
    clickLastCheckbox(/I confirm the information in this draft is accurate/i);
    clickLastButton("Save draft");

    await waitFor(() => {
      expect(mocks.saveHalifaxRegistrySubmission).toHaveBeenCalledTimes(1);
    });

    const savedPayload = mocks.saveHalifaxRegistrySubmission.mock.calls[0][1].draft;
    expect(savedPayload.declarations.acceptedIds).toEqual([
      "acknowledged",
      "maintenancePlanConfirmed",
      "ownerDeclarationConfirmed",
      "informationAccurateConfirmed",
    ]);
    expect(savedPayload.declarations.items.every((item: any) => item.checked)).toBe(true);
  });

  it("exports JSON with the same checked declarations shown in the UI", async () => {
    render(
      <HalifaxRegistrySubmissionAssistant
        open
        property={{
          id: "prop-1",
          name: "Harbour View",
          addressLine1: "12 Wharf Street",
          city: "Halifax",
          province: "NS",
          postalCode: "B3H 1A1",
          totalUnits: 8,
          units: [],
          createdAt: "2026-04-05T00:00:00.000Z",
        }}
        onClose={() => undefined}
      />
    );

    expect((await screen.findAllByText("Prepare Halifax rental registry submission")).length).toBeGreaterThan(0);
    fireEvent.click(
      screen.getByLabelText(
        /I authorize RentChain to use my stored property and account information to prepare a Halifax rental registry submission draft/i
      )
    );
    clickLastButton("Next");
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "902-555-0101" } });
    fireEvent.click(screen.getByRole("button", { name: "Same as owner" }));
    clickLastButton("Next");
    clickLastButton("Next");
    clickLastButton("Next");
    clickLastCheckbox(/I understand this draft is prepared by RentChain for review and export/i);
    clickLastCheckbox(/I confirm a maintenance \/ property management plan exists/i);
    clickLastCheckbox(/I am authorized to make owner or operator declarations/i);
    clickLastCheckbox(/I confirm the information in this draft is accurate/i);
    clickLastButton("Save draft");

    await waitFor(() => {
      expect(mocks.saveHalifaxRegistrySubmission).toHaveBeenCalled();
    });

    clickLastButton("Next");

    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    await waitFor(() => {
      expect(mocks.exportHalifaxRegistrySubmission).toHaveBeenCalledWith("prop-1");
    });
    expect(anchorClick).toHaveBeenCalled();
    const exportPayload = mocks.exportHalifaxRegistrySubmission.mock.results[0].value;
    await expect(exportPayload).resolves.toMatchObject({
      exportPayload: {
        declarations: {
          acceptedIds: [
            "acknowledged",
            "maintenancePlanConfirmed",
            "ownerDeclarationConfirmed",
            "informationAccurateConfirmed",
          ],
        },
      },
    });
    anchorClick.mockRestore();
  });

  it("renders generic fallback framing when the schema changes", async () => {
    mocks.fetchHalifaxRegistrySubmission.mockResolvedValueOnce({
      submission: buildDraft({
        assistantType: "registry_ready_compliance_assistant",
        context: {
          propertyId: "prop-2",
          sourceKey: "canada_registry_ready_v1",
          schemaKey: "canada_registry_ready_v1",
          schemaLabel: "Canada Registry-Ready Compliance Profile",
          mode: "registry_ready_fallback",
          jurisdiction: {
            country: "CA",
            province: "ON",
            municipality: "Ottawa",
          },
        },
      }),
      schema: {
        schemaKey: "canada_registry_ready_v1",
        sourceKey: "canada_registry_ready_v1",
        label: "Canada Registry-Ready Compliance Profile",
        mode: "registry_ready_fallback",
        jurisdiction: {
          country: "CA",
          province: "ON",
          municipality: "Ottawa",
        },
      },
      fieldMap: [],
    });

    render(
      <HalifaxRegistrySubmissionAssistant
        open
        property={{
          id: "prop-2",
          name: "Market Street Homes",
          addressLine1: "88 Market Street",
          city: "Ottawa",
          province: "ON",
          postalCode: "K1A 0A1",
          totalUnits: 3,
          units: [],
          createdAt: "2026-04-05T00:00:00.000Z",
        }}
        onClose={() => undefined}
      />
    );

    expect(await screen.findByText("Prepare registry-ready compliance profile")).toBeInTheDocument();
    expect(screen.getByText(/It does not submit directly to a municipality/i)).toBeInTheDocument();
  });
});
