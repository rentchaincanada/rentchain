import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PropertyRegistryStatusCard } from "./PropertyRegistryStatusCard";

const mocks = vi.hoisted(() => ({
  fetchPropertyRegistryStatus: vi.fn(),
  fetchPropertyRegistrySubmission: vi.fn(),
  createReadyFromDraft: vi.fn(),
  createRegistryFilingRequest: vi.fn(),
  retryRegistryFilingAttempt: vi.fn(),
  updateRegistryFilingStatus: vi.fn(),
  attachFilingReferenceAndNotes: vi.fn(),
  fetchBillingPricing: vi.fn(),
  useEntitlements: vi.fn(),
}));

vi.mock("../../api/billingApi", () => ({
  fetchBillingPricing: mocks.fetchBillingPricing,
}));

vi.mock("../../hooks/useEntitlements", () => ({
  useEntitlements: mocks.useEntitlements,
}));

vi.mock("../../api/propertiesApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/propertiesApi")>("../../api/propertiesApi");
  return {
    ...actual,
    fetchPropertyRegistryStatus: mocks.fetchPropertyRegistryStatus,
    fetchPropertyRegistrySubmission: mocks.fetchPropertyRegistrySubmission,
    createReadyFromDraft: mocks.createReadyFromDraft,
    createRegistryFilingRequest: mocks.createRegistryFilingRequest,
    retryRegistryFilingAttempt: mocks.retryRegistryFilingAttempt,
    updateRegistryFilingStatus: mocks.updateRegistryFilingStatus,
    attachFilingReferenceAndNotes: mocks.attachFilingReferenceAndNotes,
  };
});

function buildStatus(overrides: Record<string, any> = {}) {
  return {
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
      readinessStatus: "registry_ready",
      readinessScore: 96,
      completionPercent: 96,
      exportReady: true,
      missingRequiredFields: [],
      missingConsentItems: [],
      warnings: [],
      topMissingItems: [],
      nextRecommendedAction: "export_ready_draft",
      currentRegistryState: {
        status: "not_found",
        summary: "No public match found.",
        publicRegistryAvailable: true,
      },
      registryAvailabilityNote: null,
      assistant: {
        title: "Halifax registration draft",
        description: "Prepare or review the Halifax rental registry draft using RentChain-prefilled property and owner data.",
        ctaLabel: "Review Halifax draft",
      },
    },
    filing: {
      ready: null,
      latestAttempt: null,
      attempts: [],
      request: null,
      result: null,
      currentStatus: null,
    },
    ...overrides,
  };
}

function buildSubmission(overrides: Record<string, any> = {}) {
  return {
    submission: {
      schemaVersion: 2,
      draftId: "prop-1__halifax_rental_registry_form",
      assistantType: "halifax_registry_submission_assistant",
      status: "ready",
      timestamps: {
        createdAt: "2026-04-05T00:00:00.000Z",
        updatedAt: "2026-04-06T00:00:00.000Z",
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
        buildings: [],
      },
      contact: {
        owner: {
          name: "Jordan Harbour",
          company: "Harbour Holdings Ltd.",
          email: "owner@example.com",
          phone: "902-555-0101",
          address: {
            line1: "55 Owner Lane",
            line2: "",
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
            line2: "",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 2B2",
            country: "Canada",
          },
        },
      },
      people: {
        owner: {
          name: "Jordan Harbour",
          company: "Harbour Holdings Ltd.",
          email: "owner@example.com",
          phone: "902-555-0101",
          address: {
            line1: "55 Owner Lane",
            line2: "",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 2B2",
            country: "Canada",
          },
        },
        primaryContact: {
          name: "Jordan Harbour",
          company: "Harbour Holdings Ltd.",
          email: "owner@example.com",
          phone: "902-555-0101",
          address: {
            line1: "55 Owner Lane",
            line2: "",
            city: "Halifax",
            province: "NS",
            postalCode: "B3H 2B2",
            country: "Canada",
          },
        },
      },
      declarations: {
        items: [
          {
            id: "acknowledged",
            label: "Acknowledged",
            required: true,
            checked: true,
            checkedAt: "2026-04-05T00:02:00.000Z",
          },
        ],
        acceptedIds: ["acknowledged"],
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
            phone: "902-555-0101",
            address: {
              line1: "55 Owner Lane",
              line2: "",
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
              line2: "",
              city: "Halifax",
              province: "NS",
              postalCode: "B3H 2B2",
              country: "Canada",
            },
          },
          moreThanFiveBuildings: false,
          buildings: [],
          propertyDescription: "",
        },
        fieldMeta: {},
      },
      review: {
        validation: {
          missingRequiredFields: [],
          missingConsentItems: [],
          warnings: [],
          readinessScore: 96,
          completionPercent: 96,
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
          declarationsConfirmedAt: "2026-04-05T00:02:00.000Z",
          declarationsConfirmedBy: "landlord-1",
          finalReviewConfirmed: false,
          finalReviewConfirmedAt: null,
        },
      },
      audit: {
        migratedFromVersion: null,
      },
      meta: {
        disclaimer: "This file is a preparation draft generated by RentChain for review and export.",
        exportPreparedAt: null,
      },
    },
    fieldMap: [],
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
    filing: {
      ready: null,
      latestAttempt: null,
      attempts: [],
      request: null,
      result: null,
      currentStatus: null,
    },
    ...overrides,
  };
}

describe("PropertyRegistryStatusCard", () => {
  beforeEach(() => {
    mocks.fetchPropertyRegistryStatus.mockReset();
    mocks.fetchPropertyRegistrySubmission.mockReset();
    mocks.createReadyFromDraft.mockReset();
    mocks.createRegistryFilingRequest.mockReset();
    mocks.retryRegistryFilingAttempt.mockReset();
    mocks.updateRegistryFilingStatus.mockReset();
    mocks.attachFilingReferenceAndNotes.mockReset();
    mocks.fetchBillingPricing.mockReset();
    mocks.useEntitlements.mockReset();
    mocks.fetchBillingPricing.mockResolvedValue({
      ok: true,
      plans: [],
      registry: {
        filingWorkflow: {
          capability: "registry_filing_access",
          attemptsHistoryCapability: "registry_attempts_history",
          includedPlanKeys: ["pro", "elite"],
          freeIncludes: ["draft", "readiness", "export"],
          paidUnlocks: ["filing_workflow", "retry_safety", "attempt_history", "audit_tracking"],
          perFilingAmountCents: null,
          currency: "cad",
        },
      },
    });
    mocks.useEntitlements.mockReturnValue({
      isAdmin: false,
      hasCapability: (key: string) =>
        key === "registry_filing_access" || key === "registry_attempts_history",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a compact summary by default and shows the filing timeline and details behind view details", async () => {
    mocks.fetchPropertyRegistryStatus.mockResolvedValue(
      buildStatus({
        filing: {
          ready: {
            schemaVersion: 3,
            readyId: "ready-1",
            sourceDraftId: "prop-1__halifax_rental_registry_form",
            sourceDraftVersion: 2,
            propertyId: "prop-1",
            sourceKey: "halifax_rental_registry_form",
            schemaKey: "halifax_rental_registry_v1",
            schemaLabel: "Halifax Rental Registry",
            assistantType: "halifax_registry_submission_assistant",
            filingChannel: "manual_portal",
            status: "ready_to_file",
            createdAt: "2026-04-05T12:00:00.000Z",
            updatedAt: "2026-04-05T12:00:00.000Z",
            actor: {
              landlordId: "landlord-1",
              updatedBy: "operator-1",
            },
            jurisdiction: {
              country: "CA",
              province: "NS",
              municipality: "Halifax",
            },
            validation: {
              missingRequiredFields: [],
              missingConsentItems: [],
              warnings: [],
              readinessScore: 96,
              completionPercent: 96,
              exportReady: true,
              errors: [],
            },
            consentLock: {
              preparationAuthorized: true,
              preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
              preparationAuthorizedBy: "landlord-1",
              declarationsConfirmed: true,
              declarationsConfirmedAt: "2026-04-05T00:02:00.000Z",
              declarationsConfirmedBy: "landlord-1",
              finalReviewConfirmed: false,
              finalReviewConfirmedAt: null,
            },
            declarationsLock: {
              items: [{ id: "acknowledged", label: "Acknowledged", required: true, checked: true, checkedAt: "2026-04-05T00:02:00.000Z" }],
              acceptedIds: ["acknowledged"],
            },
            normalizedSubmission: {
              sections: [
                {
                  id: "property_site",
                  label: "Property / Site",
                  fields: [{ id: "siteAddress", label: "Site address", value: "12 Wharf Street, Halifax", required: true }],
                },
              ],
              attachments: [],
              disclaimer: "Draft only.",
            },
            audit: {
              sourceDraftUpdatedAt: "2026-04-05T11:00:00.000Z",
              events: [],
            },
          },
          request: {
            schemaVersion: 3,
            requestId: "request-1",
            readyId: "ready-1",
            sourceDraftId: "prop-1__halifax_rental_registry_form",
            propertyId: "prop-1",
            sourceKey: "halifax_rental_registry_form",
            schemaKey: "halifax_rental_registry_v1",
            schemaLabel: "Halifax Rental Registry",
            filingChannel: "manual_portal",
            adapterKey: "halifax_rental_registry_manual_portal_v1",
            status: "ready_to_file",
            createdAt: "2026-04-05T12:10:00.000Z",
            updatedAt: "2026-04-05T12:10:00.000Z",
            actor: {
              requestedBy: "operator-1",
              updatedBy: "operator-1",
            },
            checklist: {
              portalUrl: "https://www.halifax.ca/form/rental-registry",
              steps: ["Open the Halifax portal", "Copy the prepared draft values"],
              notes: ["This adapter prepares a manual filing checklist only."],
            },
            payload: {
              sections: [
                {
                  id: "property_site",
                  label: "Property / Site",
                  fields: [{ id: "siteAddress", label: "Site address", value: "12 Wharf Street, Halifax", required: true }],
                },
              ],
              disclaimer: "Draft only.",
            },
            referenceNumbers: [],
            operatorNotes: null,
            evidence: [],
            audit: {
              events: [],
            },
          },
          result: null,
          currentStatus: "ready_to_file",
        },
      })
    );
    mocks.fetchPropertyRegistrySubmission.mockResolvedValue(buildSubmission());

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
expect(await screen.findByText("Compliance / Registry Readiness")).toBeInTheDocument();
expect(screen.getByText("Ready to file")).toBeInTheDocument();
expect(screen.getByText("Halifax Rental Registry")).toBeInTheDocument();
expect(screen.queryByText("Filing timeline")).not.toBeInTheDocument();
expect(screen.getByRole("button", { name: "View details" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(await screen.findByText("Filing timeline")).toBeInTheDocument();
    expect(screen.getByText("Operator checklist")).toBeInTheDocument();
    expect(screen.getByText("Filing details")).toBeInTheDocument();
    expect(screen.getByText("Filing history")).toBeInTheDocument();
    expect(screen.getByText("Property / Site")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mark as Filed" })).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole("dialog", { name: "Compliance and registry details" })).getByRole("button", { name: "Review Halifax draft" }));
    await waitFor(() => expect(onOpenSubmissionAssistant).toHaveBeenCalled());
  });

  it("shows the correct actions for filed pending confirmation and updates lifecycle through the API", async () => {
    mocks.fetchPropertyRegistryStatus
      .mockResolvedValueOnce(
        buildStatus({
          filing: {
            ready: {
              schemaVersion: 3,
              readyId: "ready-1",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              sourceDraftVersion: 2,
              propertyId: "prop-1",
              sourceKey: "halifax_rental_registry_form",
              schemaKey: "halifax_rental_registry_v1",
              schemaLabel: "Halifax Rental Registry",
              assistantType: "halifax_registry_submission_assistant",
              filingChannel: "manual_portal",
              status: "ready_to_file",
              createdAt: "2026-04-05T12:00:00.000Z",
              updatedAt: "2026-04-05T12:00:00.000Z",
              actor: { landlordId: "landlord-1", updatedBy: "operator-1" },
              jurisdiction: { country: "CA", province: "NS", municipality: "Halifax" },
              validation: { missingRequiredFields: [], missingConsentItems: [], warnings: [], readinessScore: 96, completionPercent: 96, exportReady: true, errors: [] },
              consentLock: {
                preparationAuthorized: true,
                preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
                preparationAuthorizedBy: "landlord-1",
                declarationsConfirmed: true,
                declarationsConfirmedAt: "2026-04-05T00:02:00.000Z",
                declarationsConfirmedBy: "landlord-1",
                finalReviewConfirmed: false,
                finalReviewConfirmedAt: null,
              },
              declarationsLock: { items: [], acceptedIds: [] },
              normalizedSubmission: { sections: [], attachments: [], disclaimer: "Draft only." },
              audit: { sourceDraftUpdatedAt: "2026-04-05T11:00:00.000Z", events: [] },
            },
            request: {
              schemaVersion: 3,
              requestId: "request-1",
              readyId: "ready-1",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              propertyId: "prop-1",
              sourceKey: "halifax_rental_registry_form",
              schemaKey: "halifax_rental_registry_v1",
              schemaLabel: "Halifax Rental Registry",
              filingChannel: "manual_portal",
              adapterKey: "halifax_rental_registry_manual_portal_v1",
              status: "filed_pending_confirmation",
              createdAt: "2026-04-05T12:10:00.000Z",
              updatedAt: "2026-04-05T12:10:00.000Z",
              actor: { requestedBy: "operator-1", updatedBy: "operator-1" },
              checklist: { portalUrl: null, steps: [], notes: [] },
              payload: { sections: [], disclaimer: "Draft only." },
              referenceNumbers: [],
              operatorNotes: null,
              evidence: [],
              audit: { events: [] },
            },
            result: {
              schemaVersion: 3,
              resultId: "result-1",
              requestId: "request-1",
              readyId: "ready-1",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              propertyId: "prop-1",
              sourceKey: "halifax_rental_registry_form",
              schemaKey: "halifax_rental_registry_v1",
              filingChannel: "manual_portal",
              adapterKey: "halifax_rental_registry_manual_portal_v1",
              status: "filed_pending_confirmation",
              createdAt: "2026-04-05T12:12:00.000Z",
              updatedAt: "2026-04-05T12:12:00.000Z",
              submittedAt: "2026-04-05T12:12:00.000Z",
              confirmedAt: null,
              rejectedAt: null,
              failedAt: null,
              cancelledAt: null,
              actor: { updatedBy: "operator-1" },
              referenceNumbers: [],
              operatorNotes: null,
              evidence: [],
              outcome: { message: null },
              audit: { events: [] },
            },
            currentStatus: "filed_pending_confirmation",
          },
        })
      )
      .mockResolvedValueOnce(
        buildStatus({
          filing: {
            ready: null,
            request: null,
            result: {
              schemaVersion: 3,
              resultId: "result-1",
              requestId: "request-1",
              readyId: "ready-1",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              propertyId: "prop-1",
              sourceKey: "halifax_rental_registry_form",
              schemaKey: "halifax_rental_registry_v1",
              filingChannel: "manual_portal",
              adapterKey: "halifax_rental_registry_manual_portal_v1",
              status: "filed_confirmed",
              createdAt: "2026-04-05T12:12:00.000Z",
              updatedAt: "2026-04-05T12:20:00.000Z",
              submittedAt: "2026-04-05T12:12:00.000Z",
              confirmedAt: "2026-04-05T12:20:00.000Z",
              rejectedAt: null,
              failedAt: null,
              cancelledAt: null,
              actor: { updatedBy: "operator-2" },
              referenceNumbers: [{ type: "external_reference", value: "SUB-12345", label: "Reference number", recordedAt: "2026-04-05T12:20:00.000Z", recordedBy: "operator-2" }],
              operatorNotes: "Confirmed by email.",
              evidence: [],
              outcome: { message: "Confirmed by email." },
              audit: { events: [] },
            },
            currentStatus: "filed_confirmed",
          },
        })
      );
    mocks.fetchPropertyRegistrySubmission.mockResolvedValue(buildSubmission());
    mocks.updateRegistryFilingStatus.mockResolvedValue({
      filing: { currentStatus: "filed_confirmed" },
    });
    mocks.attachFilingReferenceAndNotes.mockResolvedValue({
      filing: { currentStatus: "filed_pending_confirmation" },
    });

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
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "View details" }));
    const dialog = await screen.findByRole("dialog", { name: "Compliance and registry details" });
    expect(within(dialog).getByRole("button", { name: "Add Reference Number" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Mark as Confirmed" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Mark as Rejected" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Mark as Failed" })).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Reference number"), { target: { value: "SUB-12345" } });
    fireEvent.change(within(dialog).getByLabelText("Notes"), { target: { value: "Confirmed by email." } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Mark as Confirmed" }));

    await waitFor(() => {
      expect(mocks.updateRegistryFilingStatus).toHaveBeenCalledWith(
        "prop-1",
        expect.objectContaining({
          status: "filed_confirmed",
          note: "Confirmed by email.",
          referenceNumbers: [expect.objectContaining({ value: "SUB-12345" })],
        })
      );
    });
    await waitFor(() => expect(screen.getAllByText("Filed confirmed").length).toBeGreaterThan(0));
  });

  it("shows a draft-change warning and allows regenerating the ready package", async () => {
    mocks.fetchPropertyRegistryStatus
      .mockResolvedValueOnce(
        buildStatus({
          filing: {
            ready: {
              schemaVersion: 3,
              readyId: "ready-1",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              sourceDraftVersion: 2,
              propertyId: "prop-1",
              sourceKey: "halifax_rental_registry_form",
              schemaKey: "halifax_rental_registry_v1",
              schemaLabel: "Halifax Rental Registry",
              assistantType: "halifax_registry_submission_assistant",
              filingChannel: "manual_portal",
              status: "ready_to_file",
              createdAt: "2026-04-05T12:00:00.000Z",
              updatedAt: "2026-04-05T12:00:00.000Z",
              actor: { landlordId: "landlord-1", updatedBy: "operator-1" },
              jurisdiction: { country: "CA", province: "NS", municipality: "Halifax" },
              validation: { missingRequiredFields: [], missingConsentItems: [], warnings: [], readinessScore: 96, completionPercent: 96, exportReady: true, errors: [] },
              consentLock: {
                preparationAuthorized: true,
                preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
                preparationAuthorizedBy: "landlord-1",
                declarationsConfirmed: true,
                declarationsConfirmedAt: "2026-04-05T00:02:00.000Z",
                declarationsConfirmedBy: "landlord-1",
                finalReviewConfirmed: false,
                finalReviewConfirmedAt: null,
              },
              declarationsLock: { items: [], acceptedIds: [] },
              normalizedSubmission: { sections: [], attachments: [], disclaimer: "Draft only." },
              audit: { sourceDraftUpdatedAt: "2026-04-05T11:00:00.000Z", events: [] },
            },
            request: null,
            result: null,
            currentStatus: "ready_to_file",
          },
        })
      )
      .mockResolvedValueOnce(
        buildStatus({
          filing: {
            ready: {
              schemaVersion: 3,
              readyId: "ready-2",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              sourceDraftVersion: 2,
              propertyId: "prop-1",
              sourceKey: "halifax_rental_registry_form",
              schemaKey: "halifax_rental_registry_v1",
              schemaLabel: "Halifax Rental Registry",
              assistantType: "halifax_registry_submission_assistant",
              filingChannel: "manual_portal",
              status: "ready_to_file",
              createdAt: "2026-04-06T12:00:00.000Z",
              updatedAt: "2026-04-06T12:00:00.000Z",
              actor: { landlordId: "landlord-1", updatedBy: "operator-1" },
              jurisdiction: { country: "CA", province: "NS", municipality: "Halifax" },
              validation: { missingRequiredFields: [], missingConsentItems: [], warnings: [], readinessScore: 96, completionPercent: 96, exportReady: true, errors: [] },
              consentLock: {
                preparationAuthorized: true,
                preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
                preparationAuthorizedBy: "landlord-1",
                declarationsConfirmed: true,
                declarationsConfirmedAt: "2026-04-05T00:02:00.000Z",
                declarationsConfirmedBy: "landlord-1",
                finalReviewConfirmed: false,
                finalReviewConfirmedAt: null,
              },
              declarationsLock: { items: [], acceptedIds: [] },
              normalizedSubmission: { sections: [], attachments: [], disclaimer: "Draft only." },
              audit: { sourceDraftUpdatedAt: "2026-04-06T00:00:00.000Z", events: [] },
            },
            request: null,
            result: null,
            currentStatus: "ready_to_file",
          },
        })
      );
    mocks.fetchPropertyRegistrySubmission.mockResolvedValue(
      buildSubmission({
        submission: {
          ...buildSubmission().submission,
          timestamps: {
            ...buildSubmission().submission.timestamps,
            updatedAt: "2026-04-06T00:00:00.000Z",
          },
        },
      })
    );
    mocks.createReadyFromDraft.mockResolvedValue({
      ready: { readyId: "ready-2" },
    });

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
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "View details" }));
    const dialog = await screen.findByRole("dialog", { name: "Compliance and registry details" });
    expect(within(dialog).getByText("Draft has changed since this filing package was prepared")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Regenerate filing package" }));
    await waitFor(() => expect(mocks.createReadyFromDraft).toHaveBeenCalledWith("prop-1"));
  });

  it("renders attempts history and allows retrying the latest rejected attempt when the ready package is still current", async () => {
    mocks.fetchPropertyRegistryStatus
      .mockResolvedValueOnce(
        buildStatus({
          filing: {
            ready: {
              schemaVersion: 3,
              readyId: "ready-2",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              sourceDraftVersion: 2,
              propertyId: "prop-1",
              sourceKey: "halifax_rental_registry_form",
              schemaKey: "halifax_rental_registry_v1",
              schemaLabel: "Halifax Rental Registry",
              assistantType: "halifax_registry_submission_assistant",
              filingChannel: "manual_portal",
              status: "ready_to_file",
              createdAt: "2026-04-06T12:00:00.000Z",
              updatedAt: "2026-04-06T12:00:00.000Z",
              actor: { landlordId: "landlord-1", updatedBy: "operator-1" },
              jurisdiction: { country: "CA", province: "NS", municipality: "Halifax" },
              validation: { missingRequiredFields: [], missingConsentItems: [], warnings: [], readinessScore: 96, completionPercent: 96, exportReady: true, errors: [] },
              consentLock: {
                preparationAuthorized: true,
                preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
                preparationAuthorizedBy: "landlord-1",
                declarationsConfirmed: true,
                declarationsConfirmedAt: "2026-04-05T00:02:00.000Z",
                declarationsConfirmedBy: "landlord-1",
                finalReviewConfirmed: false,
                finalReviewConfirmedAt: null,
              },
              declarationsLock: { items: [], acceptedIds: [] },
              normalizedSubmission: { sections: [], attachments: [], disclaimer: "Draft only." },
              audit: { sourceDraftUpdatedAt: "2026-04-06T00:00:00.000Z", events: [] },
            },
            latestAttempt: {
              schemaVersion: 3,
              attemptId: "prop-1__attempt_2",
              propertyId: "prop-1",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              readyId: "ready-2",
              requestId: "prop-1__attempt_2__request",
              resultId: "prop-1__attempt_2__result",
              attemptNumber: 2,
              filingChannel: "manual_portal",
              adapterKey: "halifax_rental_registry_manual_portal_v1",
              status: "rejected",
              createdAt: "2026-04-06T12:00:00.000Z",
              updatedAt: "2026-04-06T13:00:00.000Z",
              createdBy: "operator-1",
              updatedBy: "operator-2",
              referenceNumbers: [{ type: "external_reference", value: "RJ-22", label: "Reference number", recordedAt: "2026-04-06T13:00:00.000Z", recordedBy: "operator-2" }],
              operatorNotes: "Municipality requested corrections.",
              evidence: [],
              audit: { events: [] },
            },
            attempts: [
              {
                schemaVersion: 3,
                attemptId: "prop-1__attempt_2",
                propertyId: "prop-1",
                sourceDraftId: "prop-1__halifax_rental_registry_form",
                readyId: "ready-2",
                requestId: "prop-1__attempt_2__request",
                resultId: "prop-1__attempt_2__result",
                attemptNumber: 2,
                filingChannel: "manual_portal",
                adapterKey: "halifax_rental_registry_manual_portal_v1",
                status: "rejected",
                createdAt: "2026-04-06T12:00:00.000Z",
                updatedAt: "2026-04-06T13:00:00.000Z",
                createdBy: "operator-1",
                updatedBy: "operator-2",
                referenceNumbers: [{ type: "external_reference", value: "RJ-22", label: "Reference number", recordedAt: "2026-04-06T13:00:00.000Z", recordedBy: "operator-2" }],
                operatorNotes: "Municipality requested corrections.",
                evidence: [],
                audit: { events: [] },
              },
              {
                schemaVersion: 3,
                attemptId: "prop-1__attempt_1",
                propertyId: "prop-1",
                sourceDraftId: "prop-1__halifax_rental_registry_form",
                readyId: "ready-1",
                requestId: "prop-1__attempt_1__request",
                resultId: "prop-1__attempt_1__result",
                attemptNumber: 1,
                filingChannel: "manual_portal",
                adapterKey: "halifax_rental_registry_manual_portal_v1",
                status: "failed",
                createdAt: "2026-04-05T12:00:00.000Z",
                updatedAt: "2026-04-05T12:30:00.000Z",
                createdBy: "operator-1",
                updatedBy: "operator-1",
                referenceNumbers: [],
                operatorNotes: "Portal timed out.",
                evidence: [],
                audit: { events: [] },
              },
            ],
            request: {
              schemaVersion: 3,
              requestId: "prop-1__attempt_2__request",
              attemptId: "prop-1__attempt_2",
              readyId: "ready-2",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              propertyId: "prop-1",
              sourceKey: "halifax_rental_registry_form",
              schemaKey: "halifax_rental_registry_v1",
              schemaLabel: "Halifax Rental Registry",
              filingChannel: "manual_portal",
              adapterKey: "halifax_rental_registry_manual_portal_v1",
              status: "rejected",
              createdAt: "2026-04-06T12:05:00.000Z",
              updatedAt: "2026-04-06T13:00:00.000Z",
              actor: { requestedBy: "operator-1", updatedBy: "operator-2" },
              checklist: { portalUrl: null, steps: [], notes: [] },
              payload: { sections: [], disclaimer: "Draft only." },
              referenceNumbers: [],
              operatorNotes: "Municipality requested corrections.",
              evidence: [],
              audit: { events: [] },
            },
            result: {
              schemaVersion: 3,
              resultId: "prop-1__attempt_2__result",
              attemptId: "prop-1__attempt_2",
              requestId: "prop-1__attempt_2__request",
              readyId: "ready-2",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              propertyId: "prop-1",
              sourceKey: "halifax_rental_registry_form",
              schemaKey: "halifax_rental_registry_v1",
              filingChannel: "manual_portal",
              adapterKey: "halifax_rental_registry_manual_portal_v1",
              status: "rejected",
              createdAt: "2026-04-06T12:05:00.000Z",
              updatedAt: "2026-04-06T13:00:00.000Z",
              submittedAt: "2026-04-06T12:10:00.000Z",
              confirmedAt: null,
              rejectedAt: "2026-04-06T13:00:00.000Z",
              failedAt: null,
              cancelledAt: null,
              actor: { updatedBy: "operator-2" },
              referenceNumbers: [{ type: "external_reference", value: "RJ-22", label: "Reference number", recordedAt: "2026-04-06T13:00:00.000Z", recordedBy: "operator-2" }],
              operatorNotes: "Municipality requested corrections.",
              evidence: [],
              outcome: { message: "Municipality requested corrections." },
              audit: { events: [] },
            },
            currentStatus: "rejected",
          },
        })
      )
      .mockResolvedValueOnce(
        buildStatus({
          filing: {
            ready: null,
            latestAttempt: {
              schemaVersion: 3,
              attemptId: "prop-1__attempt_3",
              propertyId: "prop-1",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              readyId: "ready-2",
              requestId: "prop-1__attempt_3__request",
              resultId: null,
              attemptNumber: 3,
              filingChannel: "manual_portal",
              adapterKey: "halifax_rental_registry_manual_portal_v1",
              status: "ready_to_file",
              createdAt: "2026-04-06T14:00:00.000Z",
              updatedAt: "2026-04-06T14:00:00.000Z",
              createdBy: "operator-2",
              updatedBy: "operator-2",
              referenceNumbers: [],
              operatorNotes: "Retry created from prior attempt.",
              evidence: [],
              audit: { events: [] },
            },
            attempts: [],
            request: null,
            result: null,
            currentStatus: "ready_to_file",
          },
        })
      );
    mocks.fetchPropertyRegistrySubmission.mockResolvedValue(buildSubmission());
    mocks.retryRegistryFilingAttempt.mockResolvedValue({
      ready: { readyId: "ready-2" },
      attempt: { attemptId: "prop-1__attempt_3" },
      request: { requestId: "prop-1__attempt_3__request" },
      filing: { currentStatus: "ready_to_file" },
    });

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
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "View details" }));
    const dialog = await screen.findByRole("dialog", { name: "Compliance and registry details" });

    expect(within(dialog).getByText("Latest filing attempt (#2)")).toBeInTheDocument();
    expect(within(dialog).getByText("Attempt #1")).toBeInTheDocument();
    expect(within(dialog).getByText("Municipality requested corrections.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Retry filing attempt" })).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Retry filing attempt" }));

    await waitFor(() => {
      expect(mocks.retryRegistryFilingAttempt).toHaveBeenCalledWith("prop-1", {
        attemptId: "prop-1__attempt_2",
      });
    });
  });

  it("shows upgrade prompts for filing workflow and history when the user lacks registry filing entitlements", async () => {
    mocks.useEntitlements.mockReturnValue({
      isAdmin: false,
      hasCapability: () => false,
    });
    mocks.fetchPropertyRegistryStatus.mockResolvedValue(
      buildStatus({
        filing: {
          ready: {
            schemaVersion: 3,
            readyId: "ready-1",
            sourceDraftId: "prop-1__halifax_rental_registry_form",
            sourceDraftVersion: 2,
            propertyId: "prop-1",
            sourceKey: "halifax_rental_registry_form",
            schemaKey: "halifax_rental_registry_v1",
            schemaLabel: "Halifax Rental Registry",
            assistantType: "halifax_registry_submission_assistant",
            filingChannel: "manual_portal",
            status: "ready_to_file",
            createdAt: "2026-04-05T12:00:00.000Z",
            updatedAt: "2026-04-05T12:00:00.000Z",
            actor: { landlordId: "landlord-1", updatedBy: "operator-1" },
            jurisdiction: { country: "CA", province: "NS", municipality: "Halifax" },
            validation: { missingRequiredFields: [], missingConsentItems: [], warnings: [], readinessScore: 96, completionPercent: 96, exportReady: true, errors: [] },
            consentLock: {
              preparationAuthorized: true,
              preparationAuthorizedAt: "2026-04-05T00:00:00.000Z",
              preparationAuthorizedBy: "landlord-1",
              declarationsConfirmed: true,
              declarationsConfirmedAt: "2026-04-05T00:02:00.000Z",
              declarationsConfirmedBy: "landlord-1",
              finalReviewConfirmed: false,
              finalReviewConfirmedAt: null,
            },
            declarationsLock: { items: [], acceptedIds: [] },
            normalizedSubmission: { sections: [], attachments: [], disclaimer: "Draft only." },
            audit: { sourceDraftUpdatedAt: "2026-04-05T11:00:00.000Z", events: [] },
          },
          request: {
            schemaVersion: 3,
            requestId: "request-1",
            readyId: "ready-1",
            sourceDraftId: "prop-1__halifax_rental_registry_form",
            propertyId: "prop-1",
            sourceKey: "halifax_rental_registry_form",
            schemaKey: "halifax_rental_registry_v1",
            schemaLabel: "Halifax Rental Registry",
            filingChannel: "manual_portal",
            adapterKey: "halifax_rental_registry_manual_portal_v1",
            status: "ready_to_file",
            createdAt: "2026-04-05T12:10:00.000Z",
            updatedAt: "2026-04-05T12:10:00.000Z",
            actor: { requestedBy: "operator-1", updatedBy: "operator-1" },
            checklist: { portalUrl: null, steps: [], notes: [] },
            payload: { sections: [], disclaimer: "Draft only." },
            referenceNumbers: [],
            operatorNotes: null,
            evidence: [],
            audit: { events: [] },
          },
          latestAttempt: {
            schemaVersion: 3,
            attemptId: "attempt-1",
            propertyId: "prop-1",
            sourceDraftId: "prop-1__halifax_rental_registry_form",
            readyId: "ready-1",
            requestId: "request-1",
            resultId: null,
            attemptNumber: 1,
            filingChannel: "manual_portal",
            adapterKey: "halifax_rental_registry_manual_portal_v1",
            status: "ready_to_file",
            createdAt: "2026-04-05T12:10:00.000Z",
            updatedAt: "2026-04-05T12:10:00.000Z",
            createdBy: "operator-1",
            updatedBy: "operator-1",
            referenceNumbers: [],
            operatorNotes: null,
            evidence: [],
            audit: { events: [] },
          },
          attempts: [
            {
              schemaVersion: 3,
              attemptId: "attempt-1",
              propertyId: "prop-1",
              sourceDraftId: "prop-1__halifax_rental_registry_form",
              readyId: "ready-1",
              requestId: "request-1",
              resultId: null,
              attemptNumber: 1,
              filingChannel: "manual_portal",
              adapterKey: "halifax_rental_registry_manual_portal_v1",
              status: "ready_to_file",
              createdAt: "2026-04-05T12:10:00.000Z",
              updatedAt: "2026-04-05T12:10:00.000Z",
              createdBy: "operator-1",
              updatedBy: "operator-1",
              referenceNumbers: [],
              operatorNotes: null,
              evidence: [],
              audit: { events: [] },
            },
          ],
          result: null,
          currentStatus: "ready_to_file",
        },
      })
    );
    mocks.fetchPropertyRegistrySubmission.mockResolvedValue(buildSubmission());

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
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "View details" }));
    const dialog = await screen.findByRole("dialog", { name: "Compliance and registry details" });

    expect(within(dialog).getByText("Unlock filing workflow")).toBeInTheDocument();
    expect(within(dialog).getAllByRole("button", { name: "Upgrade to file" }).length).toBeGreaterThan(0);
    expect(within(dialog).queryByRole("button", { name: "Mark as Filed" })).not.toBeInTheDocument();
    expect(within(dialog).getByText("Unlock attempts history")).toBeInTheDocument();
  });
});
