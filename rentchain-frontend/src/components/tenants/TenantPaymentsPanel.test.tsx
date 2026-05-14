import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TenantPaymentsPanel } from "./TenantPaymentsPanel";

const mocks = vi.hoisted(() => ({
  fetchPayments: vi.fn(),
  getTenantMonthlyPayments: vi.fn(),
  updatePayment: vi.fn(),
}));

function paymentEditId(payment: any) {
  const source = String(payment?.source || "").trim().toLowerCase();
  const status = String(payment?.status || "").trim().toLowerCase();
  if (["checkout_created", "provider_checkout", "checkout"].includes(status)) return "";
  if (source === "rentpayments" || source === "ledgerentries") return "";
  const explicitCanonicalId = String(payment?.canonicalPaymentId || payment?.paymentDocumentId || "").trim();
  if (explicitCanonicalId) return explicitCanonicalId;
  if (source && source !== "payments") return "";
  return source === "payments" ? String(payment?.id || "").trim() : "";
}

vi.mock("@/api/paymentsApi", () => ({
  fetchPayments: mocks.fetchPayments,
  getCanonicalPaymentEditId: (payment: any) => paymentEditId(payment),
  getTenantMonthlyPayments: mocks.getTenantMonthlyPayments,
  isEditablePaymentRecord: (payment: any) => Boolean(paymentEditId(payment)),
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

  it("uses the canonical payment document id when saving edits", async () => {
    mocks.fetchPayments.mockResolvedValue([
      {
        id: "display-payment-1",
        paymentDocumentId: "canonical-payment-doc-1",
        tenantId: "tenant-1",
        amount: 1850,
        paidAt: "2026-04-03",
        status: "Recorded",
        source: "payments",
      },
    ]);
    mocks.getTenantMonthlyPayments.mockResolvedValue({ payments: [], total: 0 });
    mocks.updatePayment.mockResolvedValue({});

    render(<TenantPaymentsPanel tenantId="tenant-1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const amountInput = await screen.findByPlaceholderText("e.g. 1500");
    fireEvent.change(amountInput, { target: { value: "1800" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(mocks.updatePayment).toHaveBeenCalledWith("canonical-payment-doc-1", {
        amount: 1800,
        status: "Recorded",
      })
    );
  });

  it("shows edit for explicit canonical payment ids when source is absent", async () => {
    mocks.fetchPayments.mockResolvedValue([
      {
        id: "display-payment-2",
        paymentDocumentId: "canonical-payment-doc-2",
        tenantId: "tenant-1",
        amount: 1850,
        paidAt: "2026-04-03",
        status: "Recorded",
      },
      {
        id: "id-only-row",
        tenantId: "tenant-1",
        amount: 1850,
        paidAt: "2026-04-04",
        status: "Recorded",
      },
    ]);
    mocks.getTenantMonthlyPayments.mockResolvedValue({ payments: [], total: 0 });

    render(<TenantPaymentsPanel tenantId="tenant-1" />);

    await screen.findAllByText("Recorded");
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });
});
