import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchUnifiedInbox, markUnifiedInboxRecordRead } from "./unifiedInboxApi";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
  tenantApiFetch: vi.fn(),
}));

vi.mock("./apiFetch", () => ({
  apiFetch: mocks.apiFetch,
}));

vi.mock("./tenantApiFetch", () => ({
  tenantApiFetch: mocks.tenantApiFetch,
}));

describe("fetchUnifiedInbox", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.tenantApiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue({ ok: true, records: [], items: [], total: 0, limit: 20, offset: 0 });
    mocks.tenantApiFetch.mockResolvedValue({ ok: true, records: [], items: [], total: 0, limit: 20, offset: 0 });
  });

  it("uses the tenant inbox route for tenant users", async () => {
    await fetchUnifiedInbox("tenant");

    expect(mocks.tenantApiFetch).toHaveBeenCalledWith("/tenant/inbox");
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });

  it("uses the landlord inbox route for landlord users", async () => {
    await fetchUnifiedInbox("landlord");

    expect(mocks.apiFetch).toHaveBeenCalledWith("/landlord/inbox");
    expect(mocks.tenantApiFetch).not.toHaveBeenCalled();
  });

  it("uses the contractor inbox route for contractor users", async () => {
    await fetchUnifiedInbox("contractor");

    expect(mocks.apiFetch).toHaveBeenCalledWith("/contractor/inbox");
    expect(mocks.tenantApiFetch).not.toHaveBeenCalled();
  });

  it("marks landlord inbox records read through the landlord persistence route", async () => {
    await markUnifiedInboxRecordRead("landlord", "inbox_v1_safe-record");

    expect(mocks.apiFetch).toHaveBeenCalledWith("/landlord/inbox/inbox_v1_safe-record/read", { method: "POST" });
  });

  it("does not expose read persistence for non-landlord inbox roles", async () => {
    await expect(markUnifiedInboxRecordRead("tenant", "inbox_v1_safe-record")).rejects.toThrow(
      "Read-state persistence is not available"
    );
    expect(mocks.apiFetch).not.toHaveBeenCalled();
  });
});
