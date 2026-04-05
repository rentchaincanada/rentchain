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
      validation: {
        missingRequiredFields: [
          { path: "fieldValues.owner.phone", label: "Owner phone", section: "Property Owner" },
          { path: "fieldValues.primaryContactSameAsOwner", label: "Primary contact same as owner", section: "Primary Contact" },
        ],
        warnings: [],
        readinessScore: 58,
        completionPercent: 58,
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
      submission: {
        ...baseSubmission,
        fieldValues: {
          ...baseSubmission.fieldValues,
          ...(payload.fieldValues || {}),
        },
        declarations: { ...baseSubmission.declarations, ...(payload.declarations || {}) },
        validation: {
          missingRequiredFields: [],
          warnings: [],
          readinessScore: 100,
          completionPercent: 100,
        },
        status: "ready",
      },
      fieldMap: [],
    }));
    mocks.exportHalifaxRegistrySubmission.mockResolvedValue({
      submission: {
        ...baseSubmission,
        status: "exported",
        validation: {
          missingRequiredFields: [],
          warnings: [],
          readinessScore: 100,
          completionPercent: 100,
        },
      },
      exportPayload: {
        sourceKey: "halifax_rental_registry_form",
      },
    });
    global.URL.createObjectURL = vi.fn(() => "blob:mock");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("loads prefilled data and exports the Halifax payload", async () => {
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
    expect(screen.getByDisplayValue("Jordan Harbour")).toBeInTheDocument();
    expect(screen.getByText(/2 required fields missing/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "902-555-0101" } });
    fireEvent.click(screen.getByRole("button", { name: "Same as owner" }));
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() => {
      expect(mocks.saveHalifaxRegistrySubmission).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));

    await waitFor(() => {
      expect(mocks.exportHalifaxRegistrySubmission).toHaveBeenCalledWith("prop-1");
    });
    expect(anchorClick).toHaveBeenCalled();
    anchorClick.mockRestore();
  });
});
