import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock("./apiFetch", () => ({
  apiFetch: mocks.apiFetch,
}));

describe("leaseLedgerApi", () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
    mocks.apiFetch.mockResolvedValue({ ok: true });
  });

  it("records lease payments through the canonical lease ledger payment endpoint", async () => {
    const { addLeasePayment } = await import("./leaseLedgerApi");

    await addLeasePayment("lease-1", {
      amountCents: 15000,
      date: "2026-05-15",
      method: "etransfer",
      reference: "May payment",
      notes: "QA payment",
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith("/leases/lease-1/ledger/payment", {
      method: "POST",
      body: {
        amountCents: 15000,
        date: "2026-05-15",
        method: "etransfer",
        reference: "May payment",
        notes: "QA payment",
      },
    });
  });
});
