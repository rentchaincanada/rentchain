import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => {
    cleanup();
  });

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
          leaseExecution: {
            executionStatus: "fully_executed",
            executionLabel: "Lease fully executed",
            executionDescription: "The visible lease record indicates the current execution flow is complete.",
            requiredNextAction: "none",
            tenantSignatureStatus: "completed",
            landlordSignatureStatus: "completed",
            pdfStatus: "generated",
            completedAt: "2026-01-01T00:00:00.000Z",
          },
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
    expect(screen.getByText("Lease fully executed")).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Tenant phone (optional)"), { target: { value: "(902) 555-1111 ext 9" } });
    fireEvent.change(screen.getByLabelText("Co-applicant email (optional)"), { target: { value: "coapplicant@example.com" } });
    fireEvent.change(screen.getByLabelText("Co-applicant phone (optional)"), { target: { value: "902-555-3333" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-04-01" } });
    fireEvent.change(screen.getByLabelText("Monthly rent"), { target: { value: "2100" } });
    fireEvent.click(screen.getByRole("button", { name: "Create lease" }));

    await waitFor(() =>
      expect(mocks.convertUnitReferenceToLease).toHaveBeenCalledWith(
        "unit-9",
        expect.objectContaining({
          tenantPhone: "90255511119",
          coApplicantEmail: "coapplicant@example.com",
          coApplicantPhone: "9025553333",
          startDate: "2026-04-01",
          monthlyRent: 2100,
        })
      )
    );
  });

  it("shows a recovery action when conversion is blocked by missing info", async () => {
    mocks.getLeaseReconciliationCandidates.mockResolvedValue({
      candidates: [
        {
          id: "unit-3",
          unitId: "unit-3",
          propertyId: "prop-3",
          propertyName: "Dockside",
          unitNumber: "3",
          occupantName: null,
          monthlyRent: 0,
          leaseEndDate: null,
          canConvert: false,
          blockingReasons: ["occupant_name_required", "rent_required"],
          leaseDocument: null,
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Complete tenant info")).toHaveAttribute(
      "href",
      "/properties?propertyId=prop-3&unitId=unit-3"
    );
    expect(screen.queryByRole("button", { name: "Convert unit 3 to lease" })).not.toBeInTheDocument();
    expect(screen.getByText("Missing: Occupant name required, Monthly rent required")).toBeInTheDocument();
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

  it("filters the current lease list by tenant, unit, and property with a no-match state", async () => {
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
        },
        {
          id: "lease-2",
          propertyId: "prop-2",
          propertyName: "Dockside Flats",
          unitNumber: "9B",
          monthlyRent: 2100,
          startDate: "2026-02-01",
          endDate: "2027-01-31",
          status: "active",
          tenantName: "Mark Harbor",
          tenantEmail: "mark@example.com",
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect((await screen.findAllByText("Jane Tenant")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mark Harbor").length).toBeGreaterThan(0);

    const search = screen.getByLabelText("Search leases");

    fireEvent.change(search, { target: { value: "jane" } });
    expect(screen.getAllByText("Jane Tenant").length).toBeGreaterThan(0);
    expect(screen.queryByText("Mark Harbor")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: " 9b " } });
    expect(screen.getAllByText("Mark Harbor").length).toBeGreaterThan(0);
    expect(screen.queryByText("Jane Tenant")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "dockside" } });
    expect(screen.getByText("Dockside Flats")).toBeInTheDocument();
    expect(screen.queryByText("Harbour View")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "no-match" } });
    expect(screen.getByText("No leases match your search.")).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "" } });
    expect(screen.getAllByText("Jane Tenant").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mark Harbor").length).toBeGreaterThan(0);
  });

  it("fails closed by hiding targeted synthetic cleanup leases from the landlord list", async () => {
    mocks.getActiveLeasesForLandlord.mockResolvedValue({
      leases: [
        {
          id: "test_lease_quit_01",
          propertyId: "prop-1",
          propertyName: "Property_test",
          unitNumber: "UNIT_B",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "test2",
          tenantEmail: "hello+tenanttest2@rentchain.ai",
        },
        {
          id: "lease-visible",
          propertyId: "prop-2",
          propertyName: "Harbour View",
          unitNumber: "101",
          monthlyRent: 1850,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          status: "active",
          tenantName: "Jane Tenant",
          tenantEmail: "jane@example.com",
        },
      ],
    });

    render(
      <MemoryRouter>
        <LandlordActiveLeasesPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Harbour View")).toBeInTheDocument();
    expect(screen.queryByText("Property_test")).not.toBeInTheDocument();
    expect(screen.queryByText("test2")).not.toBeInTheDocument();
  });
});
