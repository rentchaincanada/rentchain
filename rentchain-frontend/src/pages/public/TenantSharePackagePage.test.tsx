import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import TenantSharePackagePage from "./TenantSharePackagePage";

const publicTenantSharePackageApi = vi.hoisted(() => ({
  fetchPublicTenantSharePackage: vi.fn(),
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
      profile: { completionStatus: "complete" },
      application: { reusable: true },
      documents: { completionStatus: "in_progress" },
      screening: { status: "in_progress" },
      leases: { summary: { activeCount: 1, historicalCount: 0 } },
      generatedAt: "2026-04-26T00:00:00.000Z",
    });

    renderPage();

    expect(await screen.findByText(/Shared Rental Profile/i)).toBeInTheDocument();
    expect(screen.getByText(/Ready to apply/i)).toBeInTheDocument();
    expect(screen.getByText(/^Verification$/i)).toBeInTheDocument();
    expect(screen.queryByText(/TransUnion/i)).not.toBeInTheDocument();
  });

  it("shows an unavailable state for missing share packages", async () => {
    publicTenantSharePackageApi.fetchPublicTenantSharePackage.mockResolvedValue(null);

    renderPage();

    expect(await screen.findByText(/This shared rental profile is unavailable/i)).toBeInTheDocument();
  });
});
