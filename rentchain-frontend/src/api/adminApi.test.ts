import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetchMock: vi.fn(),
  getAuthTokenMock: vi.fn(),
  getFirebaseIdTokenMock: vi.fn(),
}));

vi.mock("./apiFetch", () => ({
  apiFetch: mocks.apiFetchMock,
}));

vi.mock("./config", () => ({
  API_BASE_URL: "https://rentchain.example.com/api",
}));

vi.mock("../lib/authToken", () => ({
  getAuthToken: mocks.getAuthTokenMock,
}));

vi.mock("../lib/firebaseAuthToken", () => ({
  getFirebaseIdToken: mocks.getFirebaseIdTokenMock,
}));

describe("adminApi export helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.apiFetchMock.mockReset();
    mocks.getAuthTokenMock.mockReset();
    mocks.getFirebaseIdTokenMock.mockReset();
    mocks.getAuthTokenMock.mockReturnValue("session-token");
    mocks.getFirebaseIdTokenMock.mockResolvedValue(null);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["csv"]),
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "content-disposition"
            ? 'attachment; filename="admin-leases-2026-04-01.csv"'
            : null,
      },
    } as any) as any;
  });

  it("builds admin lease export URLs from the current filter state without pagination noise", async () => {
    const { exportAdminLeasesCsv } = await import("./adminApi");

    const result = await exportAdminLeasesCsv({
      q: "Coburg",
      status: "active",
      riskGrade: "B",
      integrity: "issues",
      startAfter: "2026-01-01",
      page: 2,
      pageSize: 50,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://rentchain.example.com/api/admin/leases/export.csv?q=Coburg&status=active&riskGrade=B&integrity=issues&startAfter=2026-01-01",
      expect.objectContaining({
        credentials: "include",
        headers: expect.objectContaining({
          Authorization: "Bearer session-token",
          "x-api-client": "web",
        }),
      })
    );
    expect(result.filename).toBe("admin-leases-2026-04-01.csv");
  });

  it("builds admin saved-filter list calls with page-specific keys", async () => {
    mocks.apiFetchMock.mockResolvedValue({ ok: true, items: [] });
    const { fetchAdminSavedFilters } = await import("./adminApi");

    await fetchAdminSavedFilters("properties");

    expect(mocks.apiFetchMock).toHaveBeenCalledWith("/admin/saved-filters?pageKey=properties");
  });
});
