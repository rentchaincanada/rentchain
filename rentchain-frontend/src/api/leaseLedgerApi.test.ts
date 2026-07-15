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

  it("fetches landlord credit allocation previews through the scoped endpoint", async () => {
    const { fetchCreditAllocationPreview } = await import("./leaseLedgerApi");

    await fetchCreditAllocationPreview("lease-1");

    expect(mocks.apiFetch).toHaveBeenCalledWith("/landlord/leases/lease-1/credit-allocation-preview", {
      method: "GET",
      allowStatuses: [400, 403, 404, 409],
    });
  });

  it("applies credit allocations with the reviewed preview payload", async () => {
    const { applyCreditAllocation } = await import("./leaseLedgerApi");

    await applyCreditAllocation("lease-1", {
      obligationRowId: "obligation-1",
      allocationAmountCents: 200000,
      previewFingerprint: "preview-1",
      idempotencyKey: "idem-1",
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith("/landlord/leases/lease-1/credit-allocations", {
      method: "POST",
      body: {
        obligationRowId: "obligation-1",
        allocationAmountCents: 200000,
        previewFingerprint: "preview-1",
        idempotencyKey: "idem-1",
      },
      allowStatuses: [400, 409],
    });
  });

  it("surfaces credit allocation API error codes", async () => {
    const { applyCreditAllocation, CreditAllocationApiError } = await import("./leaseLedgerApi");
    mocks.apiFetch.mockResolvedValueOnce({
      ok: false,
      code: "CREDIT_ALLOCATION_STATE_STALE",
      message: "stale",
      preview: { leaseId: "lease-1" },
    });

    try {
      await applyCreditAllocation("lease-1", {
        obligationRowId: "obligation-1",
        allocationAmountCents: 200000,
        previewFingerprint: "preview-1",
        idempotencyKey: "idem-1",
      });
      throw new Error("expected allocation error");
    } catch (err) {
      expect(err).toBeInstanceOf(CreditAllocationApiError);
      expect(err).toMatchObject({
        name: "CreditAllocationApiError",
        code: "CREDIT_ALLOCATION_STATE_STALE",
        preview: { leaseId: "lease-1" },
      });
    }
  });
});
