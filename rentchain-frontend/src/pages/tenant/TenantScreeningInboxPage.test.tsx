import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TenantScreeningInboxPage from "./TenantScreeningInboxPage";

const tenantScreeningApi = vi.hoisted(() => ({
  listTenantScreenings: vi.fn(),
  markTenantScreeningViewed: vi.fn(),
  acceptTenantScreeningConsent: vi.fn(),
}));

vi.mock("../../api/tenantScreeningApi", async () => {
  const actual = await vi.importActual<any>("../../api/tenantScreeningApi");
  return {
    ...actual,
    listTenantScreenings: tenantScreeningApi.listTenantScreenings,
    markTenantScreeningViewed: tenantScreeningApi.markTenantScreeningViewed,
    acceptTenantScreeningConsent: tenantScreeningApi.acceptTenantScreeningConsent,
  };
});

function buildScreening(overrides?: Record<string, unknown>) {
  return {
    id: "screening-1",
    rentalApplicationId: "app-1",
    status: "consent_pending",
    normalizedResultStatus: "pending",
    requestedAt: 1710000000000,
    consentedAt: null,
    startedAt: null,
    completedAt: null,
    provider: "transunion_redirect",
    providerLabel: "TransUnion",
    packageType: "basic",
    payerType: "landlord",
    propertyLabel: "123 Main St",
    unitLabel: "Unit 4",
    applicantName: "Taylor Tenant",
    requesterDisplayLabel: "Harbour Homes Ltd.",
    nextAction: "awaiting_applicant_consent",
    tenantStatus: null,
    tenantStatusLabel: null,
    tenantStatusDescription: null,
    tenantNextAction: null,
    consent: null,
    session: null,
    result: null,
    returnFlow: null,
    summary: {
      status: "consent_pending",
      provider: "transunion_redirect",
      requestedDate: 1710000000000,
      package: "basic",
      summaryResult: "Consent is required before screening can begin.",
      nextActions: ["Provide consent"],
    },
    auditTrail: [],
    ...overrides,
  } as any;
}

function hasExactText(expected: string) {
  return (_content: string, node: Element | null) => {
    const text = node?.textContent?.replace(/\s+/g, " ").trim() || "";
    return text === expected;
  };
}

describe("TenantScreeningInboxPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    tenantScreeningApi.markTenantScreeningViewed.mockResolvedValue({ ok: true });
    tenantScreeningApi.acceptTenantScreeningConsent.mockResolvedValue({ ok: true });
  });

  it("renders screening request cards and consent-required flow", async () => {
    tenantScreeningApi.listTenantScreenings.mockResolvedValue({
      ok: true,
      items: [
        buildScreening({
          tenantStatus: "consent_required",
          tenantStatusLabel: "Consent required",
          tenantStatusDescription:
            "The landlord has requested screening for this application. Your authorization is required before it can proceed.",
          tenantNextAction: "authorize_screening",
        }),
      ],
    });

    render(
      <MemoryRouter>
        <TenantScreeningInboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: /Open application checklist/i })).toBeInTheDocument();
    expect(screen.getByText(/^Screening Requests$/i)).toBeInTheDocument();
    expect(screen.getByText(/Requested for 123 Main St - Unit 4/i)).toBeInTheDocument();
    expect(screen.getByText(hasExactText("Requested by Harbour Homes Ltd."))).toBeInTheDocument();
    expect(screen.getAllByText(/Consent required/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Authorize screening/i })).toBeDisabled();
  });

  it("prefers backend-provided tenant-safe status fields", async () => {
    tenantScreeningApi.listTenantScreenings.mockResolvedValue({
      ok: true,
      items: [
        buildScreening({
          tenantStatus: "blocked",
          tenantStatusLabel: "Screening cannot proceed yet",
          tenantStatusDescription:
            "Screening cannot proceed yet. The landlord may still need to complete screening setup.",
          tenantNextAction: "wait_for_landlord",
        }),
      ],
    });

    render(
      <MemoryRouter>
        <TenantScreeningInboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/^Screening cannot proceed yet$/i)).toBeInTheDocument();
    expect(screen.getByText(/landlord may still need to complete screening setup/i)).toBeInTheDocument();
    expect(screen.getByText(/^Wait for landlord$/i)).toBeInTheDocument();
  });

  it("renders an empty state safely", async () => {
    tenantScreeningApi.listTenantScreenings.mockResolvedValue({
      ok: true,
      items: [],
    });

    render(
      <MemoryRouter>
        <TenantScreeningInboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/No screening requests yet\./i)).toBeInTheDocument();
    expect(screen.getByText(/If a landlord requests screening/i)).toBeInTheDocument();
  });

  it("shows confirmed consent timestamps without duplicate authorization prompts", async () => {
    tenantScreeningApi.listTenantScreenings.mockResolvedValue({
      ok: true,
      items: [
        buildScreening({
          status: "consented",
          consentedAt: 1710000100000,
          consent: {
            id: "consent-1",
            requestId: "screening-1",
            acceptedAt: 1710000100000,
            providerLabel: "TransUnion",
            consentTextSummary: "Consent summary snapshot",
            providerDisclosure: "Disclosure",
            disclosureVersion: "screening-consent-v2",
          },
        }),
      ],
    });

    render(
      <MemoryRouter>
        <TenantScreeningInboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Screening consent confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmed at:/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Authorize screening/i })).not.toBeInTheDocument();
  });

  it("uses a safe fallback requester label when no landlord display label is available", async () => {
    tenantScreeningApi.listTenantScreenings.mockResolvedValue({
      ok: true,
      items: [buildScreening({ requesterDisplayLabel: null })],
    });

    render(
      <MemoryRouter>
        <TenantScreeningInboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(hasExactText("Requested by your landlord"))).toBeInTheDocument();
  });

  it("falls back to frontend normalization when backend tenant-safe fields are absent", async () => {
    tenantScreeningApi.listTenantScreenings.mockResolvedValue({
      ok: true,
      items: [
        buildScreening({
          tenantStatus: null,
          tenantStatusLabel: null,
          tenantStatusDescription: null,
          tenantNextAction: null,
          status: "failed",
          nextAction: "provider_activation_pending",
        }),
      ],
    });

    render(
      <MemoryRouter>
        <TenantScreeningInboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Screening cannot proceed yet/i)).toBeInTheDocument();
    expect(screen.getByText(/landlord may still need to complete screening setup/i)).toBeInTheDocument();
  });

  it("renders neutral copy for completed, manual review, and blocked states", async () => {
    tenantScreeningApi.listTenantScreenings.mockResolvedValue({
      ok: true,
      items: [
        buildScreening({
          id: "completed",
          status: "completed",
          completedAt: 1710000200000,
          tenantStatus: "completed",
          tenantStatusLabel: "Screening workflow completed",
          tenantStatusDescription: "Screening workflow completed.",
          tenantNextAction: "no_action_needed",
        }),
        buildScreening({
          id: "manual",
          status: "manual_review_required",
          consentedAt: 1710000100000,
          tenantStatus: "manual_review",
          tenantStatusLabel: "Manual review may be required",
          tenantStatusDescription: "This screening may require manual review.",
          tenantNextAction: "view_status",
        }),
        buildScreening({
          id: "blocked",
          status: "failed",
          nextAction: "provider_activation_pending",
          tenantStatus: "blocked",
          tenantStatusLabel: "Screening cannot proceed yet",
          tenantStatusDescription:
            "Screening cannot proceed yet. The landlord may still need to complete screening setup.",
          tenantNextAction: "wait_for_landlord",
        }),
      ],
    });

    render(
      <MemoryRouter>
        <TenantScreeningInboxPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/Screening workflow completed\./i)).toBeInTheDocument();
    expect(screen.getByText(/This screening may require manual review\./i)).toBeInTheDocument();
    expect(screen.getByText(/landlord may still need to complete screening setup/i)).toBeInTheDocument();
  });
});
