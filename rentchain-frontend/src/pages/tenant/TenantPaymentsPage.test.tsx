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

const tenantLayout = vi.hoisted(() => ({
  context: {
    lease: {
      propertyName: "123 Main St",
      unitNumber: "2",
    },
  } as { lease: { propertyName: string; unitNumber: string } | null } | null,
}));

vi.mock("../../api/tenantPortalApi", () => tenantPortalApi);

vi.mock("./TenantLayout.clean", () => ({
  useTenantOutletContext: () => tenantLayout.context,
}));

describe("TenantPaymentsPage", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    tenantLayout.context = {
      lease: {
        propertyName: "123 Main St",
        unitNumber: "2",
      },
    };
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

  it("renders a safe empty state when tenant layout context is not ready", async () => {
    tenantLayout.context = null;
    tenantPortalApi.getTenantPayments.mockResolvedValue([]);
    tenantPortalApi.getTenantPaymentsSummary.mockResolvedValue(null);
    tenantPortalApi.getTenantRentCharges.mockResolvedValue([]);

    render(<TenantPaymentsPage />);

    expect(await screen.findByText(/Rent payments/i)).toBeInTheDocument();
    expect(screen.getByText(/Your lease/i)).toBeInTheDocument();
    expect(await screen.findByText(/No active lease found/i)).toBeInTheDocument();
  });
});
