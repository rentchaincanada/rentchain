import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import TenantScreeningConsentCard from "./TenantScreeningConsentCard";

const tenantScreeningApi = vi.hoisted(() => ({
  acceptTenantScreeningConsent: vi.fn(),
  markTenantScreeningViewed: vi.fn(),
}));

vi.mock("../../api/tenantScreeningApi", async () => {
  const actual = await vi.importActual<any>("../../api/tenantScreeningApi");
  return {
    ...actual,
    acceptTenantScreeningConsent: tenantScreeningApi.acceptTenantScreeningConsent,
    markTenantScreeningViewed: tenantScreeningApi.markTenantScreeningViewed,
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
    nextAction: "awaiting_applicant_consent",
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

describe("TenantScreeningConsentCard", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    tenantScreeningApi.markTenantScreeningViewed.mockResolvedValue({ ok: true });
    tenantScreeningApi.acceptTenantScreeningConsent.mockResolvedValue({
      ok: true,
      screeningRequest: buildScreening({
        status: "consented",
        consentedAt: 1710000100000,
        consent: {
          id: "consent-1",
          requestId: "screening-1",
          acceptedAt: 1710000100000,
          providerLabel: "TransUnion",
          providerDisclosure: "Disclosure",
          disclosureVersion: "screening-consent-v2",
        },
      }),
    });
  });

  it("renders plain-English consent copy and keeps the authorize button disabled until checked", async () => {
    render(<TenantScreeningConsentCard screening={buildScreening()} />);

    expect(screen.getByText(/The landlord is requesting tenant screening for this rental application/i)).toBeInTheDocument();
    expect(screen.getByText(/A third-party provider may be used/i)).toBeInTheDocument();
    expect(screen.getByText(/RentChain records your consent and screening workflow status for audit/i)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /Authorize screening/i });
    expect(button).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/Authorize screening consent/i));
    expect(button).not.toBeDisabled();

    await waitFor(() => {
      expect(tenantScreeningApi.markTenantScreeningViewed).toHaveBeenCalledWith(
        "screening-1",
        expect.objectContaining({
          disclosureVersion: "screening-consent-v2",
        })
      );
    });
  });

  it("submits explicit consent through the tenant screening API", async () => {
    const onConsentUpdated = vi.fn();
    render(<TenantScreeningConsentCard screening={buildScreening()} onConsentUpdated={onConsentUpdated} />);

    fireEvent.click(screen.getByLabelText(/Authorize screening consent/i));
    fireEvent.click(screen.getByRole("button", { name: /Authorize screening/i }));

    await waitFor(() => {
      expect(tenantScreeningApi.acceptTenantScreeningConsent).toHaveBeenCalledWith(
        "screening-1",
        expect.objectContaining({
          disclosureVersion: "screening-consent-v2",
          providerDisclosure: expect.stringMatching(/third-party screening provider may be used/i),
          consentSummary: expect.stringMatching(/RentChain records consent and screening workflow status/i),
        })
      );
    });
    expect(onConsentUpdated).toHaveBeenCalled();
  });

  it("shows existing consent confirmation details without a duplicate prompt", () => {
    render(
      <TenantScreeningConsentCard
        screening={buildScreening({
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
        })}
      />
    );

    expect(screen.getByText(/Screening consent confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/Confirmed at:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Provider:/i).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Authorize screening/i })).not.toBeInTheDocument();
  });

  it("uses neutral provider-setup copy after consent when landlord setup is still completing", () => {
    render(
      <TenantScreeningConsentCard
        screening={buildScreening({
          status: "manual_review_required",
          consentedAt: 1710000100000,
          consent: {
            id: "consent-1",
            requestId: "screening-1",
            acceptedAt: 1710000100000,
            providerLabel: "Manual review",
            providerDisclosure: "Disclosure",
            disclosureVersion: "screening-consent-v2",
          },
        })}
      />
    );

    expect(
      screen.getByText(/Screening setup is being completed by the landlord/i)
    ).toBeInTheDocument();
  });
});
