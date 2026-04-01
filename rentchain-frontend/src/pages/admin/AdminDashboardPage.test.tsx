import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminDashboardPage from "./AdminDashboardPage";

const mocks = vi.hoisted(() => ({
  fetchAdminOverviewMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../../api/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/adminApi")>("../../api/adminApi");
  return {
    ...actual,
    fetchAdminOverview: mocks.fetchAdminOverviewMock,
  };
});

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToastMock }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    mocks.showToastMock.mockReset();
    mocks.fetchAdminOverviewMock.mockResolvedValue({
      ok: true,
      summary: {
        totalProperties: 10,
        totalUnits: 18,
        totalTenants: 12,
        totalLeases: 11,
        activeLeases: 8,
        integrityWarnings: 4,
        orphanRecords: 1,
      },
      activity: {
        recentAdminAccessCount: 3,
        recentHighImpactEvents: [
          { key: "evt-1", label: "admin overview opened", ts: "2026-04-01T10:00:00.000Z" },
        ],
      },
      integrity: {
        orphanProperties: 1,
        missingOwnerLinks: 2,
        duplicateActiveLeases: 1,
        staleLeasePointers: 0,
        propertyUnitMismatches: 1,
      },
    });
  });

  it("renders the overview KPI strip and integrity snapshot", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchAdminOverviewMock).toHaveBeenCalled();
    });

    expect(screen.getByText("Admin Dashboard")).toBeInTheDocument();
    const totalPropertiesLabel = screen.getByText("Total Properties");
    const totalPropertiesCard = totalPropertiesLabel.parentElement as HTMLElement;
    expect(within(totalPropertiesCard).getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Integrity Snapshot")).toBeInTheDocument();
    expect(screen.getByText("Duplicate Active Leases: 1")).toBeInTheDocument();
  });

  it("renders quick links and recent activity", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Open Properties")).toBeInTheDocument();
    expect(screen.getAllByText("Open Tenants")).toHaveLength(2);
    expect(screen.getAllByText("Open Leases")).toHaveLength(2);
    expect(screen.getAllByText("Recent Activity")).toHaveLength(2);
    expect(screen.getAllByText("admin overview opened")).toHaveLength(2);
  });
});
