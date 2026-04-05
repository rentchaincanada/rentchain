import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyRegistryStatusCard } from "./PropertyRegistryStatusCard";

const mocks = vi.hoisted(() => ({
  fetchPropertyRegistryStatus: vi.fn(),
}));

vi.mock("../../api/propertiesApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/propertiesApi")>("../../api/propertiesApi");
  return {
    ...actual,
    fetchPropertyRegistryStatus: mocks.fetchPropertyRegistryStatus,
  };
});

describe("PropertyRegistryStatusCard", () => {
  beforeEach(() => {
    mocks.fetchPropertyRegistryStatus.mockReset();
  });

  it("renders readiness summary, top missing items, and schema-aware CTA", async () => {
    mocks.fetchPropertyRegistryStatus.mockResolvedValue({
      status: {
        id: "projection-1",
        propertyId: "prop-1",
        sourceKey: "halifax_r400",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
        registryStatus: "not_found",
        registryRecordId: null,
        registrationNumber: null,
        pid: null,
        matchedAt: null,
        matchConfidence: null,
        summary: "No public match found.",
        recommendedAction: "Prepare Halifax draft",
        lastSourceRefreshAt: null,
        lastEvaluatedAt: "2026-04-05T00:00:00.000Z",
        createdAt: "2026-04-05T00:00:00.000Z",
        updatedAt: "2026-04-05T00:00:00.000Z",
      },
      source: {
        sourceKey: "halifax_r400",
        sourceLabel: "Halifax Registry Intelligence",
        jurisdictionProvince: "NS",
        jurisdictionMunicipality: "Halifax",
      },
      coverage: {
        available: true,
        message: null,
      },
      pidPrompt: {
        propertyPid: null,
        propertyPidMissing: true,
        registryPid: null,
        registryPidAvailable: false,
        pidPromptEligible: false,
        pidPromptMessage: null,
        sourceLabel: "Halifax Registry Intelligence",
        actionable: false,
      },
      readiness: {
        schemaKey: "halifax_rental_registry_v1",
        schemaLabel: "Halifax Rental Registry",
        jurisdiction: {
          country: "CA",
          province: "NS",
          municipality: "Halifax",
        },
        mode: "official_registry",
        readinessStatus: "incomplete",
        readinessScore: 62,
        completionPercent: 62,
        exportReady: false,
        missingRequiredFields: [],
        missingConsentItems: [],
        warnings: ["Building 1 has no fire / life-safety systems recorded yet."],
        topMissingItems: [
          {
            category: "owner_contact",
            headline: "Owner or contact details are incomplete",
            count: 2,
          },
          {
            category: "building_details",
            headline: "Building details are incomplete",
            count: 3,
          },
        ],
        nextRecommendedAction: "complete_missing_fields",
        currentRegistryState: {
          status: "not_found",
          summary: "No public match found.",
          publicRegistryAvailable: true,
        },
        registryAvailabilityNote: null,
        assistant: {
          title: "Halifax registration draft",
          description: "Prepare or review the Halifax rental registry draft using RentChain-prefilled property and owner data.",
          ctaLabel: "Complete Halifax registration draft",
        },
      },
    });

    const onOpenSubmissionAssistant = vi.fn();

    render(
      <PropertyRegistryStatusCard
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
        onOpenSubmissionAssistant={onOpenSubmissionAssistant}
      />
    );

    expect(await screen.findByText("Compliance / Registry Readiness")).toBeInTheDocument();
    expect(screen.getByText("Halifax Rental Registry")).toBeInTheDocument();
    expect(screen.getByText(/Owner or contact details are incomplete/)).toBeInTheDocument();
    expect(screen.getByText(/Building details are incomplete/)).toBeInTheDocument();
    expect(screen.getByText(/Complete missing data/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete Halifax registration draft" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Complete Halifax registration draft" }));
    await waitFor(() => {
      expect(onOpenSubmissionAssistant).toHaveBeenCalled();
    });
  });
});
