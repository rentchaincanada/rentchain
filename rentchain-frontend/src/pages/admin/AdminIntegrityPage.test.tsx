import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminIntegrityPage from "./AdminIntegrityPage";

const mocks = vi.hoisted(() => ({
  fetchAdminIntegrityMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../../api/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/adminApi")>("../../api/adminApi");
  return {
    ...actual,
    fetchAdminIntegrity: mocks.fetchAdminIntegrityMock,
  };
});

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToastMock }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("AdminIntegrityPage", () => {
  beforeEach(() => {
    mocks.showToastMock.mockReset();
    mocks.fetchAdminIntegrityMock.mockResolvedValue({
      ok: true,
      totals: {
        issueTypes: 3,
        totalIssues: 6,
        highSeverity: 4,
        mediumSeverity: 2,
        lowSeverity: 0,
      },
      sections: [
        {
          key: "orphan_properties",
          label: "Orphan Properties",
          severity: "high",
          count: 1,
          description: "Properties with no owner or landlord linkage.",
          samples: [
            {
              id: "sample-1",
              type: "property",
              label: "Orphan House",
              propertyId: "prop-1",
              relatedAdminPath: "/admin/properties?q=prop-1",
            },
          ],
        },
        {
          key: "duplicate_active_leases",
          label: "Duplicate Active Leases",
          severity: "high",
          count: 2,
          description: "Multiple active lease agreements resolve to the same context.",
          samples: [
            {
              id: "sample-2",
              type: "lease",
              label: "Coburg Rd · Lease lease-1",
              propertyId: "prop-2",
              leaseId: "lease-1",
              tenantId: "tenant-1",
              relatedAdminPath: "/admin/leases?q=lease-1",
            },
          ],
        },
      ],
    });
  });

  it("renders totals and integrity sections", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/integrity"]}>
        <Routes>
          <Route path="/admin/integrity" element={<AdminIntegrityPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchAdminIntegrityMock).toHaveBeenCalled();
    });

    expect(screen.getByText("Integrity")).toBeInTheDocument();
    expect(screen.getByText("Issue Types")).toBeInTheDocument();
    expect(screen.getByText("Orphan Properties")).toBeInTheDocument();
    expect(screen.getByText("Duplicate Active Leases")).toBeInTheDocument();
    expect(screen.getAllByText("high").length).toBeGreaterThan(0);
  });

  it("renders sample links and labels", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/integrity"]}>
        <Routes>
          <Route path="/admin/integrity" element={<AdminIntegrityPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Orphan House")).toBeInTheDocument();
    expect(screen.getAllByText("Review sample").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lease lease-1/).length).toBeGreaterThan(0);
  });
});
