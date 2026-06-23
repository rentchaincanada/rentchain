import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMyDelegatedAccessGrants } from "./delegatedAccessApi";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("./apiFetch", () => ({
  apiFetch: mocks.apiFetch,
}));

describe("delegatedAccessApi", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
  });

  it("loads delegate self grants from the non-landlord delegated-access route", async () => {
    mocks.apiFetch.mockResolvedValue({ ok: true, grants: [] });

    await expect(fetchMyDelegatedAccessGrants()).resolves.toEqual([]);

    expect(mocks.apiFetch).toHaveBeenCalledWith("/delegated-access/my-grants");
  });
});
