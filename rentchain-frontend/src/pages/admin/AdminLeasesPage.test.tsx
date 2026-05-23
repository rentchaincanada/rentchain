import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminLeasesPage from "./AdminLeasesPage";

const mocks = vi.hoisted(() => ({
  fetchAdminLeasesMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../../api/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/adminApi")>("../../api/adminApi");
  return {
    ...actual,
    fetchAdminLeases: mocks.fetchAdminLeasesMock,
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

describe("AdminLeasesPage", () => {
  beforeEach(() => {
    mocks.showToastMock.mockReset();
    mocks.fetchAdminLeasesMock.mockResolvedValue({
      ok: true,
      items: [
        {
          id: "lease-1",
          leaseDisplayLabel: "Coburg Rd · Unit 101 · Jane Tenant",
          propertyId: "prop-1",
          propertyName: "Coburg Rd",
          unitId: "unit-1",
          unitNumber: "101",
          landlordId: "landlord-1",
          landlordDisplayName: "Harbour Homes",
          tenantIds: ["tenant-1"],
          tenantNames: ["Jane Tenant"],
          status: "active",
          monthlyRent: 1800,
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          riskGrade: "B",
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-05T00:00:00.000Z",
          integrity: {
            hasIssues: false,
            duplicateAgreement: false,
            occupancyMismatch: false,
          },
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
      hasMore: false,
    });
  });

  it("loads admin leases from URL-backed filters", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/leases?q=coburg&status=active&page=1&pageSize=25"]}>
        <Routes>
          <Route path="/admin/leases" element={<AdminLeasesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchAdminLeasesMock).toHaveBeenCalledWith({
        q: "coburg",
        status: "active",
        riskGrade: "",
        integrity: "all",
        sortBy: "updatedAt",
        sortDir: "desc",
        page: 1,
        pageSize: 25,
      });
    });

    expect(screen.getByText("Coburg Rd · Unit 101 · Jane Tenant")).toBeInTheDocument();
    expect(screen.queryByText("lease-1")).not.toBeInTheDocument();
    expect(screen.queryByText("landlord-1")).not.toBeInTheDocument();
  });

  it("opens the lease detail drawer when a row is selected", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/leases"]}>
        <Routes>
          <Route path="/admin/leases" element={<AdminLeasesPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Coburg Rd · Unit 101 · Jane Tenant")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Coburg Rd · Unit 101 · Jane Tenant")[0]);

    const drawer = screen.getByRole("dialog", { name: "Lease detail drawer" });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByText("Coburg Rd · Unit 101 · Jane Tenant")).toBeInTheDocument();
    expect(within(drawer).queryByText("prop-1")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("unit-1")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("tenant-1")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("lease-1")).not.toBeInTheDocument();
    expect(within(drawer).queryByText("landlord-1")).not.toBeInTheDocument();
    expect(within(drawer).getByText("Unit 101")).toBeInTheDocument();
    expect(within(drawer).getByText("Jane Tenant")).toBeInTheDocument();
    expect(within(drawer).getAllByText("Harbour Homes").length).toBeGreaterThan(0);
  });
});
