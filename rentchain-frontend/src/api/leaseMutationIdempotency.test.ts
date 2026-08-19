import { beforeEach, describe, expect, it, vi } from "vitest";

const apiJsonMock = vi.fn(async () => ({ ok: true }));

vi.mock("@/api/http", () => ({ apiJson: apiJsonMock }));

describe("lease mutation idempotency transport", () => {
  beforeEach(() => apiJsonMock.mockClear());

  it("sends the caller-owned key for direct create and preserves it across retries", async () => {
    const { createLease } = await import("./leasesApi");
    const payload = { tenantId: "tenant-1", propertyId: "property-1", unitNumber: "1A", monthlyRent: 1800, startDate: "2026-09-01" };
    await createLease(payload, "stable-create-key");
    await createLease(payload, "stable-create-key");
    expect(apiJsonMock).toHaveBeenCalledTimes(2);
    expect(apiJsonMock).toHaveBeenNthCalledWith(1, "/leases", expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": "stable-create-key" }) }));
    expect(apiJsonMock).toHaveBeenNthCalledWith(2, "/leases", expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": "stable-create-key" }) }));
  });

  it("sends stable keys for draft activation and occupied-unit conversion", async () => {
    const { activateLeaseDraft } = await import("./leasePacksApi");
    const { convertUnitReferenceToLease } = await import("./leasesApi");
    await activateLeaseDraft("draft-1", "draft-key");
    await convertUnitReferenceToLease("unit-1", "conversion-key", { startDate: "2026-01-01", endDate: "2026-12-31" });
    expect(apiJsonMock).toHaveBeenCalledWith(
      "/leases/drafts/draft-1/activate",
      expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": "draft-key" }) })
    );
    expect(apiJsonMock).toHaveBeenCalledWith(
      "/leases/reconciliation-candidates/unit-1/convert",
      expect.objectContaining({ headers: expect.objectContaining({ "Idempotency-Key": "conversion-key" }) })
    );
  });
});
