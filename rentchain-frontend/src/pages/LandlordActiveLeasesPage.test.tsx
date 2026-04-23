import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LandlordActiveLeasesPage from "./LandlordActiveLeasesPage";

const mocks = vi.hoisted(() => ({
  getActiveLeasesForLandlord: vi.fn(),
}));

vi.mock("@/api/leasesApi", () => ({
  getActiveLeasesForLandlord: mocks.getActiveLeasesForLandlord,
}));

describe("LandlordActiveLeasesPage", () => {
  beforeEach(() => {
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-1",
          propertyId: "prop-1",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Jane Tenant",
          tenantEmail: "jane@example.com",
          documentUrl: "https://example.com/lease.pdf",
        },
      ],
    });
  });

  it("renders active leases with view, email, and save actions", async () => {
    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Harbour View")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View" })).toHaveAttribute("href", "/leases/lease-1/ledger");
    expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:jane%40example.com")
    );
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("renders an empty state when no active leases are available", async () => {
    mocks.getActiveLeasesForLandlord.mockResolvedValue({ leases: [] });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/No active leases were found/i)).toBeInTheDocument();
  });
});
