import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiJsonMock } = vi.hoisted(() => ({
  apiJsonMock: vi.fn(),
}));

vi.mock("../lib/apiClient", () => ({
  apiJson: apiJsonMock,
}));

describe("adminVerifiedScreeningsApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiJsonMock.mockResolvedValue({ ok: true, data: [] });
  });

  it("lists landlord verified screenings through the landlord-safe route", async () => {
    const { listVerifiedScreenings } = await import("./adminVerifiedScreeningsApi");

    await listVerifiedScreenings("landlord");

    expect(apiJsonMock).toHaveBeenCalledWith("/landlord/verified-screenings");
  });

  it("keeps admin verified screenings on the admin route", async () => {
    const { listVerifiedScreenings } = await import("./adminVerifiedScreeningsApi");

    await listVerifiedScreenings("admin");

    expect(apiJsonMock).toHaveBeenCalledWith("/admin/verified-screenings");
  });
});
