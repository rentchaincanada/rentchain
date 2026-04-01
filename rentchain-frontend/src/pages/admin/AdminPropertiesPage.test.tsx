import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminPropertiesPage from "./AdminPropertiesPage";

const mocks = vi.hoisted(() => ({
  fetchAdminPropertiesMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../../api/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/adminApi")>("../../api/adminApi");
  return {
    ...actual,
    fetchAdminProperties: mocks.fetchAdminPropertiesMock,
  };
});

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToastMock }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("AdminPropertiesPage", () => {
  beforeEach(() => {
    mocks.showToastMock.mockReset();
    mocks.fetchAdminPropertiesMock.mockResolvedValue({
      ok: true,
      items: [
        {
          id: "prop-1",
          name: "Coburg Rd",
          address1: "123 Coburg Rd",
          city: "Halifax",
          province: "NS",
          postalCode: "B3H 1Y5",
          ownerUserId: "owner-1",
          landlordId: "landlord-1",
          managerUserIds: ["manager-1"],
          unitCount: 2,
          occupiedUnitCount: 1,
          vacantUnitCount: 1,
          createdAt: "2026-03-01T00:00:00.000Z",
          updatedAt: "2026-03-05T00:00:00.000Z",
          integrity: { hasIssues: false, orphaned: false, missingOwner: false },
        },
      ],
      page: 1,
      pageSize: 25,
      total: 1,
      hasMore: false,
    });
  });

  it("loads admin properties from URL-backed filters", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/properties?q=coburg&province=NS&page=1&pageSize=25"]}>
        <Routes>
          <Route path="/admin/properties" element={<AdminPropertiesPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchAdminPropertiesMock).toHaveBeenCalledWith({
        q: "coburg",
        province: "NS",
        integrity: "all",
        sortBy: "updatedAt",
        sortDir: "desc",
        page: 1,
        pageSize: 25,
      });
    });

    expect(screen.getByText("Coburg Rd")).toBeInTheDocument();
  });

  it("opens the property detail drawer when a row is selected", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/properties"]}>
        <Routes>
          <Route path="/admin/properties" element={<AdminPropertiesPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Coburg Rd")).toBeInTheDocument();

    fireEvent.click(screen.getAllByText("Coburg Rd")[0]);

    const drawer = screen.getByRole("dialog", { name: "Property detail drawer" });
    expect(drawer).toBeInTheDocument();
    expect(within(drawer).getByText("owner-1")).toBeInTheDocument();
    expect(within(drawer).getByText("landlord-1")).toBeInTheDocument();
  });
});
