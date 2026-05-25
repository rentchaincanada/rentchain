import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminTenantsPage from "./AdminTenantsPage";

const mocks = vi.hoisted(() => ({
  fetchAdminTenantsMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../../api/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/adminApi")>("../../api/adminApi");
  return {
    ...actual,
    fetchAdminTenants: mocks.fetchAdminTenantsMock,
  };
});

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToastMock }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../components/admin/AdminSavedFilters", () => ({
  AdminSavedFilters: () => <div>Saved filters</div>,
  default: () => <div>Saved filters</div>,
}));

describe("AdminTenantsPage", () => {
  beforeEach(() => {
    mocks.showToastMock.mockReset();
    mocks.fetchAdminTenantsMock.mockResolvedValue({
      ok: true,
      items: [
        {
          id: "tenant-1",
          fullName: "Jane Tenant",
          firstName: "Jane",
          lastName: "Tenant",
          email: "jane@example.com",
          phone: "902-555-1000",
          landlordId: "landlord-1",
          propertyId: "prop-1",
          propertyName: "Coburg Rd",
          unitId: "unit-1",
          unitNumber: "101",
          leaseId: "lease-1",
          leaseStatus: "active",
          screeningStatus: "complete",
          moveInStatus: "ready",
          currentLeaseStartDate: "2026-01-01",
          currentLeaseEndDate: "2026-12-31",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-05T00:00:00.000Z",
          lifecycle: {
            lifecycleState: "active",
            lifecycleLabel: "Active",
            lifecycleReason: "active_tenancy_or_lease_signal",
            confidence: "high",
            sourceFields: { leaseStatus: "active", screeningStatus: "complete" },
            flags: {
              hasActiveLease: true,
              hasPendingLease: false,
              hasCompletedScreening: true,
              isArchived: false,
              isPastTenant: false,
              hasStateConflict: false,
            },
          },
          flags: {
            missingLeaseLink: false,
            missingPropertyLink: false,
            hasScreening: true,
          },
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
      hasMore: false,
    });
  });

  it("loads admin tenants from URL-backed filters", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/tenants?q=jane&leaseStatus=active&page=1&pageSize=25"]}>
        <Routes>
          <Route path="/admin/tenants" element={<AdminTenantsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchAdminTenantsMock).toHaveBeenCalledWith({
        q: "jane",
        leaseStatus: "active",
        screeningStatus: "",
        moveInStatus: "",
        sortBy: "updatedAt",
        sortDir: "desc",
        page: 1,
        pageSize: 25,
      });
    });

    expect(screen.getAllByText("Jane Tenant").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Admin tenants mobile list")).toBeInTheDocument();
    expect(screen.getAllByText("Landlord linked").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active tenant workspace").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lifecycle: Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lease: Active").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Screening: Complete").length).toBeGreaterThan(0);
    expect(screen.queryByText("tenant-1")).not.toBeInTheDocument();
  });

  it("opens the tenant detail drawer when a row is selected", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/tenants"]}>
        <Routes>
          <Route path="/admin/tenants" element={<AdminTenantsPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Jane Tenant").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText("Jane Tenant")[0]);

    const drawer = screen.getByRole("dialog", { name: "Tenant detail drawer" });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByText("jane@example.com")).toBeInTheDocument();
    expect(within(drawer).getByText("Active tenant workspace")).toBeInTheDocument();
    expect(within(drawer).getAllByText("Landlord linked").length).toBeGreaterThan(0);
    expect(within(drawer).getByText("Active lease")).toBeInTheDocument();
    expect(within(drawer).getByText("Lease status: Active")).toBeInTheDocument();
    expect(within(drawer).getByText("Screening status: Complete")).toBeInTheDocument();
    expect(within(drawer).getByText("Move-in status: Ready")).toBeInTheDocument();
    expect(within(drawer).queryByText("prop-1")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("unit-1")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("landlord-1")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("lease-1")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("tenant-1")).not.toBeInTheDocument();
  });
});
