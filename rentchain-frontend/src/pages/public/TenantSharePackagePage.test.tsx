import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import TenantSharePackagePage from "./TenantSharePackagePage";

const publicTenantSharePackageApi = vi.hoisted(() => ({
  createApplyWithRentChainContext: vi.fn(),
  fetchPublicTenantSharePackage: vi.fn(),
  requestPublicTenantSharePackageVerification: vi.fn(),
}));

vi.mock("../../api/publicTenantSharePackageApi", () => publicTenantSharePackageApi);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage() {
  function ApplyCapture() {
    const location = useLocation();
    return <div data-testid="apply-state">{JSON.stringify(location.state || {})}</div>;
  }

  return render(
    <MemoryRouter initialEntries={["/share/token-123"]}>
      <Routes>
        <Route path="/share/:token" element={<TenantSharePackagePage />} />
        <Route path="/apply" element={<ApplyCapture />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("TenantSharePackagePage", () => {
  beforeEach(() => {
    publicTenantSharePackageApi.fetchPublicTenantSharePackage.mockReset();
    publicTenantSharePackageApi.createApplyWithRentChainContext.mockReset();
  });

  it("renders the shared tenant identity summary safely", async () => {
    publicTenantSharePackageApi.fetchPublicTenantSharePackage.mockResolvedValue({
      identity: {
        identityStatus: "ready",
        verification: { level: "partial" },
        readinessLabel: "Ready to apply",
        readinessDescription: "Your core profile and supporting records are ready for most rental workflows.",
      },
      identityExchangeReference: {
        referenceType: "tenant_identity_reference",
        referenceStatus: "available",
        referenceLabel: "Identity exchange available",
        referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
        portabilityStatus: "ready",
      },
      availability: {
        canRequestMore: true,
        availableSections: ["identity"],
      },
      generatedAt: "2026-04-26T00:00:00.000Z",
    });

    renderPage();

    expect(await screen.findByText(/Shared Rental Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready to apply/i)).toBeInTheDocument();
    expect(screen.getByText(/^Verification$/i)).toBeInTheDocument();
    expect(screen.getByText(/Identity exchange available/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Request verification/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply with RentChain/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /This shared profile supports summary-only reuse today\. Reusable application prefill is only available when both identity and application sharing have been approved by the tenant\./i
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/TransUnion/i)).not.toBeInTheDocument();
  });

  it("shows an unavailable state for missing share packages", async () => {
    publicTenantSharePackageApi.fetchPublicTenantSharePackage.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByText(/This shared rental profile is unavailable/i)).toBeInTheDocument();
  });

  it("submits a request for additional information without exposing unapproved sections", async () => {
    publicTenantSharePackageApi.fetchPublicTenantSharePackage.mockResolvedValue({
      identity: {
        identityStatus: "ready",
        verification: { level: "partial" },
        readinessLabel: "Ready to apply",
        readinessDescription: "Your core profile and supporting records are ready for most rental workflows.",
      },
      identityExchangeReference: {
        referenceType: "tenant_identity_reference",
        referenceStatus: "available",
        referenceLabel: "Identity exchange available",
        referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
        portabilityStatus: "ready",
      },
      availability: {
        canRequestMore: true,
        availableSections: ["identity"],
      },
      generatedAt: "2026-04-26T00:00:00.000Z",
    });
    publicTenantSharePackageApi.requestPublicTenantSharePackageVerification.mockResolvedValue({
      status: "requested",
      requestedScopes: ["credibility_summary", "payment_readiness_summary"],
    });

    renderPage();

    expect(await screen.findByRole("button", { name: /Request verification/i })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Credibility summary/i));
    fireEvent.click(screen.getByLabelText(/Payment readiness summary/i));
    fireEvent.click(screen.getByRole("button", { name: /Request verification/i }));

    await waitFor(() => {
      expect(publicTenantSharePackageApi.requestPublicTenantSharePackageVerification).toHaveBeenCalledWith("token-123", [
        "credibility_summary",
        "payment_readiness_summary",
      ]);
    });
    expect(
      screen.getByText(
        /Requesting additional sections does not grant access automatically\. The tenant must approve any expanded scope later\./i
      )
    ).toBeInTheDocument();
    expect(screen.getAllByText(/^Unavailable$/i).length).toBeGreaterThan(0);
  });

  it("explains when only summary reuse is available", async () => {
    publicTenantSharePackageApi.fetchPublicTenantSharePackage.mockResolvedValue({
      identity: {
        identityStatus: "ready",
        verification: { level: "partial" },
        readinessLabel: "Ready to apply",
        readinessDescription: "Your core profile and supporting records are ready for most rental workflows.",
      },
      identityExchangeReference: {
        referenceType: "tenant_identity_reference",
        referenceStatus: "limited",
        referenceLabel: "Identity exchange available",
        referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
        portabilityStatus: "limited",
      },
      availability: {
        canRequestMore: true,
        availableSections: ["identity"],
      },
      generatedAt: "2026-04-26T00:00:00.000Z",
    });

    renderPage();

    expect(await screen.findByRole("button", { name: /Apply with RentChain/i })).toBeInTheDocument();
    expect(
      await screen.findByText(
        /This shared profile supports summary-only reuse today\. Reusable application prefill is only available when both identity and application sharing have been approved by the tenant\./i
      )
    ).toBeInTheDocument();
  });

  it("explains when approved identity and application details can prefill the apply path", async () => {
    publicTenantSharePackageApi.fetchPublicTenantSharePackage.mockResolvedValue({
      identity: {
        identityStatus: "ready",
        verification: { level: "partial" },
        readinessLabel: "Ready to apply",
        readinessDescription: "Your core profile and supporting records are ready for most rental workflows.",
      },
      application: { reusable: true },
      identityExchangeReference: {
        referenceType: "tenant_identity_reference",
        referenceStatus: "available",
        referenceLabel: "Identity exchange available",
        referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
        portabilityStatus: "ready",
      },
      availability: {
        canRequestMore: true,
        availableSections: ["identity", "application"],
      },
      generatedAt: "2026-04-26T00:00:00.000Z",
    });

    renderPage();

    expect(await screen.findByRole("button", { name: /Apply with RentChain/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Use the tenant-approved identity and application details already shared here to start an application faster\. Any remaining application requirements, including consent, still apply\./i
      )
    ).toBeInTheDocument();
  });

  it("routes into the applicant apply flow with visible prefill state", async () => {
    publicTenantSharePackageApi.fetchPublicTenantSharePackage.mockResolvedValue({
      identity: {
        identityStatus: "ready",
        verification: { level: "partial" },
        readinessLabel: "Ready to apply",
        readinessDescription: "Your core profile and supporting records are ready for most rental workflows.",
      },
      application: { reusable: true },
      identityExchangeReference: {
        referenceType: "tenant_identity_reference",
        referenceStatus: "available",
        referenceLabel: "Identity exchange available",
        referenceDescription: "This rental identity can support summary-only exchange requests within the tenant-controlled sharing flow.",
        portabilityStatus: "ready",
      },
      availability: {
        canRequestMore: true,
        availableSections: ["identity", "application"],
      },
      generatedAt: "2026-04-26T00:00:00.000Z",
    });
    publicTenantSharePackageApi.createApplyWithRentChainContext.mockResolvedValue({
      applyWithRentChain: {
        source: "share_token",
        tokenValidated: true,
        scopesApproved: ["identity_summary", "application_summary"],
        identityReference: {
          referenceStatus: "available",
          portabilityStatus: "ready",
        },
        applicationContext: {
          prefilled: true,
          requiredRemaining: ["credit_consent"],
          prefill: {
            applicant: { firstName: "Jordan", lastName: "Lee", email: "jordan@example.com", phone: "5551112222" },
            currentAddress: { line1: "123 King St", city: "Halifax", province: "NS", postalCode: "B3H1A1" },
            employment: null,
          },
        },
      },
    });

    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: /Apply with RentChain/i }));

    await waitFor(() => {
      expect(publicTenantSharePackageApi.createApplyWithRentChainContext).toHaveBeenCalledWith("token-123");
    });
    expect(await screen.findByTestId("apply-state")).toHaveTextContent("Jordan");
    expect(screen.getByTestId("apply-state")).toHaveTextContent("identity_summary");
  });
});
