import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantPaymentsPanel } from "./TenantPaymentsPanel";

const mocks = vi.hoisted(() => ({
  fetchPayments: vi.fn(),
  getTenantMonthlyPayments: vi.fn(),
  updatePayment: vi.fn(),
}));

vi.mock("@/api/paymentsApi", () => ({
  fetchPayments: mocks.fetchPayments,
  getTenantMonthlyPayments: mocks.getTenantMonthlyPayments,
  updatePayment: mocks.updatePayment,
}));

describe("TenantPaymentsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPayments.mockResolvedValue([
      {
        id: "payment-1",
        tenantId: "tenant-1",
        amount: 1850,
        paidAt: "2026-04-03",
        status: "Recorded",
        source: "payments",
      },
    ]);
    mocks.getTenantMonthlyPayments.mockResolvedValue({
      payments: [
        {
          id: "payment-1",
          tenantId: "tenant-1",
          amount: 1850,
          paidAt: "2026-04-03",
          status: "Recorded",
          source: "payments",
        },
      ],
      total: 1850,
    });
  });

  it("keeps reading the payments api and renders the approved clarity copy", async () => {
    render(<TenantPaymentsPanel tenantId="tenant-1" />);

    expect(
      screen.getByText(
        "Only recorded rent payments appear here. Lease charges, credits, and unmatched ledger entries appear in Financial activity and the current lease ledger."
      )
    ).toBeInTheDocument();

    await waitFor(() => expect(mocks.fetchPayments).toHaveBeenCalledWith("tenant-1"));
    expect(mocks.getTenantMonthlyPayments).toHaveBeenCalled();
    expect(await screen.findByText("Recorded")).toBeInTheDocument();
    expect(
      screen.getByText((content) => content.includes("Total:") && content.includes("1,850.00"))
    ).toBeInTheDocument();
  });

  it("shows the existing empty state when the payments api returns no payments", async () => {
    mocks.fetchPayments.mockResolvedValue([]);
    mocks.getTenantMonthlyPayments.mockResolvedValue({ payments: [], total: 0 });

    render(<TenantPaymentsPanel tenantId="tenant-1" />);

    expect(await screen.findByText("No payments yet.")).toBeInTheDocument();
  });

  it("shows edit only for canonical payments rows", async () => {
    mocks.fetchPayments.mockResolvedValue([
      {
        id: "payment-1",
        tenantId: "tenant-1",
        amount: 1850,
        paidAt: "2026-04-03",
        status: "Recorded",
        source: "payments",
      },
      {
        id: "f871db5d-16b3-4818-92e6-99c43d0f58e3",
        tenantId: "tenant-1",
        amount: 1850,
        paidAt: "2026-04-04",
        status: "checkout_created",
        source: "rentPayments",
      },
      {
        id: "ledger-payment-1",
        tenantId: "tenant-1",
        amount: 1850,
        paidAt: "2026-04-05",
        status: "Recorded",
        source: "ledgerEntries",
      },
    ]);
    mocks.getTenantMonthlyPayments.mockResolvedValue({ payments: [], total: 0 });

    render(<TenantPaymentsPanel tenantId="tenant-1" />);

    await screen.findByText("checkout_created");
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });
});
