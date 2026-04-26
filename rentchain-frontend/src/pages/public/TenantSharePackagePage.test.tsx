import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TenantSharePackagePage from "./TenantSharePackagePage";

const publicTenantSharePackageApi = vi.hoisted(() => ({
  fetchPublicTenantSharePackage: vi.fn(),
  requestPublicTenantSharePackageItems: vi.fn(),
}));

vi.mock("../../api/publicTenantSharePackageApi", () => publicTenantSharePackageApi);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/share/token-123"]}>
      <Routes>
        <Route path="/share/:token" element={<TenantSharePackagePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("TenantSharePackagePage", () => {
  beforeEach(() => {
    publicTenantSharePackageApi.fetchPublicTenantSharePackage.mockReset();
  });

  it("renders the shared tenant identity summary safely", async () => {
    publicTenantSharePackageApi.fetchPublicTenantSharePackage.mockResolvedValue({
      identity: {
        identityStatus: "ready",
        verification: { level: "partial" },
        readinessLabel: "Ready to apply",
        readinessDescription: "Your core profile and supporting records are ready for most rental workflows.",
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
    expect(screen.getByRole("button", { name: /Request additional information/i })).toBeInTheDocument();
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
      availability: {
        canRequestMore: true,
        availableSections: ["identity"],
      },
      generatedAt: "2026-04-26T00:00:00.000Z",
    });
    publicTenantSharePackageApi.requestPublicTenantSharePackageItems.mockResolvedValue({
      requestedItems: ["credibility_summary"],
    });

    renderPage();

    expect(await screen.findByRole("button", { name: /Request additional information/i })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Credibility summary/i));
    fireEvent.click(screen.getByRole("button", { name: /Request additional information/i }));

    await waitFor(() => {
      expect(publicTenantSharePackageApi.requestPublicTenantSharePackageItems).toHaveBeenCalledWith("token-123", [
        "credibility_summary",
      ]);
    });
    expect(screen.getAllByText(/^Unavailable$/i).length).toBeGreaterThan(0);
  });
});
