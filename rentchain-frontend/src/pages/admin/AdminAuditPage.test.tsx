import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import AdminAuditPage from "./AdminAuditPage";

const mocks = vi.hoisted(() => ({
  fetchAdminAuditMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../../api/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/adminApi")>("../../api/adminApi");
  return {
    ...actual,
    fetchAdminAudit: mocks.fetchAdminAuditMock,
  };
});

vi.mock("../../components/ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToastMock }),
}));

vi.mock("../../components/layout/MacShell", () => ({
  MacShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("AdminAuditPage", () => {
  beforeEach(() => {
    mocks.fetchAdminAuditMock.mockResolvedValue({
      ok: true,
      summary: {
        recentAdminActions: 1,
        recentExports: 1,
        recentIntegrityEvents: 1,
        recentSavedFilterActions: 1,
      },
      sections: {
        adminActions: [
          {
            id: "a1",
            type: "view_properties",
            label: "Viewed properties admin page",
            pageKey: "properties",
            route: "/api/admin/properties",
            occurredAt: 1000,
            relatedAdminPath: "/admin/properties",
          },
        ],
        exports: [
          {
            id: "e1",
            exportType: "leases",
            label: "Exported leases CSV",
            rowCount: 22,
            capped: false,
            occurredAt: 2000,
            relatedAdminPath: "/admin/leases",
          },
        ],
        integrityEvents: [
          {
            id: "i1",
            severity: "high",
            label: "Viewed integrity snapshot with 4 issues",
            eventType: "integrity_snapshot_viewed",
            occurredAt: 3000,
            relatedAdminPath: "/admin/integrity",
          },
        ],
        savedFilterActions: [
          {
            id: "s1",
            action: "create",
            pageKey: "leases",
            label: "Saved filter created for leases",
            occurredAt: 4000,
            relatedAdminPath: "/admin/leases",
          },
        ],
      },
    });
  });

  it("renders summary cards and audit sections", async () => {
    render(
      <MemoryRouter initialEntries={["/admin/audit"]}>
        <Routes>
          <Route path="/admin/audit" element={<AdminAuditPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mocks.fetchAdminAuditMock).toHaveBeenCalled();
    });

    expect(screen.getByText("Audit")).toBeInTheDocument();
    expect(screen.getAllByText("Recent Admin Actions").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recent Exports").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Recent Saved Filter Actions").length).toBeGreaterThan(0);
    expect(screen.getByText("Viewed properties admin page")).toBeInTheDocument();
  });
});
