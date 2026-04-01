import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminSavedFilters from "./AdminSavedFilters";

const mocks = vi.hoisted(() => ({
  fetchAdminSavedFiltersMock: vi.fn(),
  createAdminSavedFilterMock: vi.fn(),
  deleteAdminSavedFilterMock: vi.fn(),
  showToastMock: vi.fn(),
}));

vi.mock("../../api/adminApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/adminApi")>("../../api/adminApi");
  return {
    ...actual,
    fetchAdminSavedFilters: mocks.fetchAdminSavedFiltersMock,
    createAdminSavedFilter: mocks.createAdminSavedFilterMock,
    deleteAdminSavedFilter: mocks.deleteAdminSavedFilterMock,
  };
});

vi.mock("../ui/ToastProvider", () => ({
  useToast: () => ({ showToast: mocks.showToastMock }),
}));

describe("AdminSavedFilters", () => {
  beforeEach(() => {
    mocks.fetchAdminSavedFiltersMock.mockReset();
    mocks.createAdminSavedFilterMock.mockReset();
    mocks.deleteAdminSavedFilterMock.mockReset();
    mocks.showToastMock.mockReset();
    mocks.fetchAdminSavedFiltersMock
      .mockResolvedValueOnce({
        ok: true,
        items: [
          {
            id: "preset-1",
            userId: "admin-1",
            pageKey: "leases",
            name: "Active leases with issues",
            filters: { q: "Coburg", status: "active", integrity: "issues" },
            createdAt: 1,
            updatedAt: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        ok: true,
        items: [
          {
            id: "preset-1",
            userId: "admin-1",
            pageKey: "leases",
            name: "Active leases with issues",
            filters: { q: "Coburg", status: "active", integrity: "issues" },
            createdAt: 1,
            updatedAt: 2,
          },
          {
            id: "preset-2",
            userId: "admin-1",
            pageKey: "leases",
            name: "Expiring soon",
            filters: { endBefore: "2026-06-01" },
            createdAt: 3,
            updatedAt: 3,
          },
        ],
      })
      .mockResolvedValue({
        ok: true,
        items: [
          {
            id: "preset-2",
            userId: "admin-1",
            pageKey: "leases",
            name: "Expiring soon",
            filters: { endBefore: "2026-06-01" },
            createdAt: 3,
            updatedAt: 3,
          },
        ],
      });
    mocks.createAdminSavedFilterMock.mockResolvedValue({
      ok: true,
      item: {
        id: "preset-2",
        userId: "admin-1",
        pageKey: "leases",
        name: "Expiring soon",
        filters: { endBefore: "2026-06-01" },
        createdAt: 3,
        updatedAt: 3,
      },
    });
    mocks.deleteAdminSavedFilterMock.mockResolvedValue({ ok: true });
    vi.stubGlobal("prompt", vi.fn(() => "Expiring soon"));
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  it("loads, applies, saves, and deletes page-specific presets", async () => {
    const onApplyPreset = vi.fn();

    render(
      <AdminSavedFilters
        pageKey="leases"
        currentFilters={{ q: "Coburg", status: "active", integrity: "issues" }}
        onApplyPreset={onApplyPreset}
      />
    );

    expect(await screen.findByText("Active leases with issues")).toBeInTheDocument();
    expect(mocks.fetchAdminSavedFiltersMock).toHaveBeenCalledWith("leases");

    fireEvent.click(screen.getByRole("button", { name: "Load preset" }));
    expect(onApplyPreset).toHaveBeenCalledWith({
      q: "Coburg",
      status: "active",
      integrity: "issues",
    });

    fireEvent.click(screen.getByRole("button", { name: "Save current filters" }));
    expect(mocks.createAdminSavedFilterMock).toHaveBeenCalledWith({
      pageKey: "leases",
      name: "Expiring soon",
      filters: { q: "Coburg", status: "active", integrity: "issues" },
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Expiring soon")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(mocks.deleteAdminSavedFilterMock).toHaveBeenCalledWith("preset-2");
    });
  });
});
