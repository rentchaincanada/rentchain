import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetchPayments.mockResolvedValue([
      {
        id: "payment-1",
        tenantId: "tenant-1",
        amount: 1850,
        paidAt: "2026-04-03",
        status: "Recorded",
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
        },
      ],
      total: 1850,
    });
  });

  it("keeps reading the payments api and renders the approved clarity copy", async () => {
    render(<TenantPaymentsPanel tenantId="tenant-1" />);

    expect(
      screen.getByText(
        "Only recorded rent payments appear here. Charges and credits are shown in the lease ledger."
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
});
