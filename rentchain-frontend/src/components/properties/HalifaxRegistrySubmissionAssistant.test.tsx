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
  beforeEach(() => {
    mocks.showToast.mockReset();
    const baseSubmission = {
      id: "draft-1",
      propertyId: "prop-1",
      landlordId: "landlord-1",
      sourceKey: "halifax_rental_registry_form",
      jurisdiction: {
        country: "CA",
        province: "NS",
        municipality: "Halifax",
      },
      status: "draft",
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
            rentalUnitTypes: [],
            otherRentalUnitType: "",
            residentialUnitsRented: null,
            shortTermRentalUnits: null,
            buildingType: "",
            otherBuildingType: "",
            totalResidentialUnits: 8,
            hasCommercialUnits: null,
            amenities: [],
            fireLifeSafetySystems: [],
            accessibilityFeatures: [],
            yearConstructed: null,
            notes: "",
          },
        ],
        propertyDescription: "",
      },
      declarations: {
        acknowledged: false,
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
      },
      exportedAt: null,
      lastReviewedAt: null,
      createdAt: "2026-04-05T00:00:00.000Z",
      updatedAt: "2026-04-05T00:00:00.000Z",
      updatedBy: "landlord-1",
    };
    mocks.fetchHalifaxRegistrySubmission.mockResolvedValue({
      submission: baseSubmission,
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
    mocks.saveHalifaxRegistrySubmission.mockImplementation(async (_propertyId: string, payload: any) => ({
      submission: (() => {
        const declarations = { ...baseSubmission.declarations, ...(payload.declarations || {}) };
        const consent = {
          ...baseSubmission.consent,
          ...(payload.consent || {}),
        };
        const declarationsConfirmed =
          Boolean(declarations.acknowledged) &&
          Boolean(declarations.maintenancePlanConfirmed) &&
          Boolean(declarations.ownerDeclarationConfirmed) &&
          Boolean(declarations.informationAccurateConfirmed);
        const preparationAuthorized = Boolean(consent.preparationAuthorized);
        const ready = preparationAuthorized && declarationsConfirmed;
        return {
          ...baseSubmission,
          fieldValues: {
            ...baseSubmission.fieldValues,
            ...(payload.fieldValues || {}),
          },
          declarations,
          consent: {
            ...consent,
            preparationAuthorized,
            declarationsConfirmed,
            preparationAuthorizedAt: preparationAuthorized ? "2026-04-05T00:00:00.000Z" : null,
            declarationsConfirmedAt: declarationsConfirmed ? "2026-04-05T00:05:00.000Z" : null,
          },
          fieldMeta: {
            ...baseSubmission.fieldMeta,
            ...(payload.fieldMeta || {}),
          },
          validation: {
            missingRequiredFields: ready ? [] : baseSubmission.validation.missingRequiredFields,
            missingConsentItems: ready ? [] : [{ path: "consent.declarationsConfirmed", label: "Declaration confirmation", section: "Declarations" }],
            warnings: [],
            readinessScore: ready ? 100 : 72,
            completionPercent: ready ? 100 : 72,
            exportReady: ready,
          },
          status: ready ? "ready" : "draft",
        };
      })(),
      fieldMap: [],
    }));
    mocks.exportHalifaxRegistrySubmission.mockResolvedValue({
      submission: {
        ...baseSubmission,
        status: "exported",
        validation: {
          missingRequiredFields: [],
          missingConsentItems: [],
          warnings: [],
          readinessScore: 100,
          completionPercent: 100,
          exportReady: true,
        },
        consent: {
          ...baseSubmission.consent,
          preparationAuthorized: true,
          preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
          declarationsConfirmed: true,
          declarationsConfirmedAt: "2026-04-05T00:05:00.000Z",
          finalReviewConfirmed: true,
          finalReviewConfirmedAt: "2026-04-05T00:10:00.000Z",
        },
      },
      exportPayload: {
        sourceKey: "halifax_rental_registry_form",
        disclaimer: "This file is a preparation draft generated by RentChain",
      },
    });
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("requires consent before progression and exports only after declarations are confirmed", async () => {
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

    expect(await screen.findByText("Prepare Halifax rental registry submission")).toBeInTheDocument();
    expect(screen.getAllByText(/Consent & use notice/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(
      screen.getByLabelText(
        /I authorize RentChain to use my stored property and account information to prepare a Halifax rental registry submission draft/i
      )
    );
    expect(screen.getByRole("button", { name: "Next" })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByDisplayValue("Jordan Harbour")).toBeInTheDocument();
    expect(screen.getByText(/4 readiness blockers/i)).toBeInTheDocument();
    expect(screen.getAllByText("Needs confirmation").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "902-555-0101" } });
    fireEvent.click(screen.getByRole("button", { name: "Same as owner" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(mocks.saveHalifaxRegistrySubmission).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByLabelText(/I understand this draft is prepared by RentChain for review and export/i));
    fireEvent.click(screen.getByLabelText(/I confirm a maintenance \/ property management plan exists/i));
    fireEvent.click(screen.getByLabelText(/I am authorized to make owner or operator declarations/i));
    fireEvent.click(screen.getByLabelText(/I confirm the information in this draft is accurate/i));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(mocks.saveHalifaxRegistrySubmission).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByText(/Ready to export/i).length).toBeGreaterThan(0);

    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    await waitFor(() => {
      expect(mocks.exportHalifaxRegistrySubmission).toHaveBeenCalledWith("prop-1");
    });
    expect(anchorClick).toHaveBeenCalled();
    anchorClick.mockRestore();
  });
});
