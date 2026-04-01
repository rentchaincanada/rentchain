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

    expect(screen.getByText("Jane Tenant")).toBeInTheDocument();
  });

  it("opens the tenant detail drawer when a row is selected", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/tenants"]}>
        <Routes>
          <Route path="/admin/tenants" element={<AdminTenantsPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Jane Tenant")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Jane Tenant")[0]);

    const drawer = screen.getByRole("dialog", { name: "Tenant detail drawer" });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByText("jane@example.com")).toBeInTheDocument();
    expect(within(drawer).getByText("landlord-1")).toBeInTheDocument();
    expect(within(drawer).getByText("lease-1")).toBeInTheDocument();
  });
});
