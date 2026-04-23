import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LandlordActiveLeasesPage from "./LandlordActiveLeasesPage";

const mocks = vi.hoisted(() => ({
  getActiveLeasesForLandlord: vi.fn(),
  getArchivedLeasesForLandlord: vi.fn(),
  getLeaseReconciliationCandidates: vi.fn(),
  convertUnitReferenceToLease: vi.fn(),
  archiveLeaseRecord: vi.fn(),
  restoreLeaseRecord: vi.fn(),
}));

vi.mock("@/api/leasesApi", () => ({
  getActiveLeasesForLandlord: mocks.getActiveLeasesForLandlord,
  getArchivedLeasesForLandlord: mocks.getArchivedLeasesForLandlord,
  getLeaseReconciliationCandidates: mocks.getLeaseReconciliationCandidates,
  convertUnitReferenceToLease: mocks.convertUnitReferenceToLease,
  archiveLeaseRecord: mocks.archiveLeaseRecord,
  restoreLeaseRecord: mocks.restoreLeaseRecord,
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
    mocks.getArchivedLeasesForLandlord.mockResolvedValue({ leases: [] });
    mocks.getLeaseReconciliationCandidates.mockResolvedValue({
      candidates: [
        {
          id: "unit-9",
          unitId: "unit-9",
          propertyId: "prop-9",
          propertyName: "Dockside",
          unitNumber: "9",
          occupantName: "Recovered Tenant",
          monthlyRent: 2100,
          leaseEndDate: "2026-12-31",
          canConvert: true,
          blockingReasons: [],
          leaseDocument: {
            fileName: "lease.pdf",
            url: "https://example.com/unit-lease.pdf",
          },
        },
      ],
    });
    mocks.convertUnitReferenceToLease.mockResolvedValue({
      ok: true,
      lease: { id: "lease-9" },
      tenant: { id: "tenant-9", fullName: "Recovered Tenant" },
    });
    mocks.archiveLeaseRecord.mockResolvedValue({ ok: true, lease: { id: "lease-1" } });
    mocks.restoreLeaseRecord.mockResolvedValue({ ok: true, lease: { id: "lease-2" } });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("renders active leases with ledger, email, save, and archive actions", async () => {
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
    fireEvent.click(screen.getByRole("button", { name: "Archive lease" }));
    await waitFor(() => expect(mocks.archiveLeaseRecord).toHaveBeenCalledWith("lease-1"));
  });

  it("shows reconciliation candidates and converts a reference into a lease", async () => {
    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Occupied units missing lease records/i)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Convert unit 9 to lease" })[0]);
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-04-01" } });
    fireEvent.change(screen.getByLabelText("Monthly rent"), { target: { value: "2100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create lease" }));

    await waitFor(() =>
      expect(mocks.convertUnitReferenceToLease).toHaveBeenCalledWith(
        "unit-9",
        expect.objectContaining({ startDate: "2026-04-01", monthlyRent: 2100 })
      )
    );
  });

  it("loads archived leases when archive view is selected", async () => {
    mocks.getArchivedLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "lease-2",
          propertyId: "prop-2",
          propertyName: "Archived Place",
          unitNumber: "2B",
          monthlyRent: 1200,
          startDate: "2025-01-01",
          endDate: "2025-12-31",
          status: "ended",
          archivedAt: "2026-04-01T00:00:00.000Z",
          tenantName: "Past Tenant",
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={["/leases?view=archived"]}>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Archived Place")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(mocks.restoreLeaseRecord).toHaveBeenCalledWith("lease-2"));
  });
});
