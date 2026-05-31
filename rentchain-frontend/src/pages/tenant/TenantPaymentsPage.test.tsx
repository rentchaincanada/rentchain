import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TenantPaymentsPage from "./TenantPaymentsPage";

const tenantPortalApi = vi.hoisted(() => ({
  getTenantPayments: vi.fn(),
  getTenantPaymentsSummary: vi.fn(),
  getTenantRentCharges: vi.fn(),
  confirmTenantRentCharge: vi.fn(),
}));

vi.mock("../../api/tenantPortalApi", () => tenantPortalApi);

vi.mock("./TenantLayout.clean", () => ({
  useTenantOutletContext: () => ({
    lease: {
      propertyName: "123 Main St",
      unitNumber: "2",
    },
  }),
}));

describe("TenantPaymentsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders tenant payment history when auxiliary payment surfaces are unavailable", async () => {
    const notFound = Object.assign(new Error("Request failed (404)"), { status: 404 });
    tenantPortalApi.getTenantPayments.mockResolvedValue([
      {
        id: "internal-payment-id-1",
        amount: 1200,
        dueDate: "2026-05-01",
        paidAt: "2026-05-02",
        method: "e-transfer",
        status: "paid",
        notes: "May rent",
      },
    ]);
    tenantPortalApi.getTenantPaymentsSummary.mockRejectedValue(notFound);
    tenantPortalApi.getTenantRentCharges.mockRejectedValue(notFound);

    render(<TenantPaymentsPage />);

    expect(await screen.findByText(/Rent payments/i)).toBeInTheDocument();
    expect(screen.getByText("$1,200")).toBeInTheDocument();
    expect(screen.getByText("e-transfer")).toBeInTheDocument();
    expect(screen.getByText("May rent")).toBeInTheDocument();
    expect(screen.queryByText(/Request failed \(404\)/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No rent charges issued yet/i)).toBeInTheDocument();
    expect(screen.queryByText("internal-payment-id-1")).not.toBeInTheDocument();
  });
});
