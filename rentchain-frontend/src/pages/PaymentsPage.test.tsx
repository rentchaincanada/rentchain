import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import PaymentsPage from "./PaymentsPage";

const mocks = vi.hoisted(() => ({
  usePayments: vi.fn(),
  updatePayment: vi.fn(),
  fetchProperties: vi.fn(),
  fetchTenants: vi.fn(),
  printSummaryDocument: vi.fn(),
}));

function paymentEditId(payment: any) {
  const source = String(payment?.source || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
  const status = String(payment?.status || "").trim().toLowerCase();
  if (["checkout_created", "provider_checkout", "checkout"].includes(status)) return "";
  if (["rentpayments", "rentpayment", "ledgerentries", "ledgerentry"].includes(source)) return "";
  const explicitCanonicalId = String(payment?.canonicalPaymentId || payment?.paymentDocumentId || "").trim();
  if (explicitCanonicalId) return explicitCanonicalId;
  return ["payments", "payment", "canonicalpayments", "canonicalpayment", "legacypayments", "legacypayment"].includes(source)
    ? String(payment?.id || "").trim()
    : "";
}

vi.mock("../hooks/usePayments", () => ({
  usePayments: mocks.usePayments,
}));

vi.mock("../api/paymentsApi", () => ({
  getCanonicalPaymentEditId: (payment: any) => paymentEditId(payment),
  isEditablePaymentRecord: (payment: any) => Boolean(paymentEditId(payment)),
  updatePayment: mocks.updatePayment,
}));

vi.mock("../api/propertiesApi", () => ({
  fetchProperties: mocks.fetchProperties,
}));

vi.mock("../api/tenantsApi", () => ({
  fetchTenants: mocks.fetchTenants,
}));

vi.mock("../utils/printSummary", () => ({
  printSummaryDocument: (...args: unknown[]) => mocks.printSummaryDocument(...args),
}));

vi.mock("@/components/ledger/PaymentCsvImportPreviewCard", () => ({
  PaymentCsvImportPreviewCard: () => <div>AI-assisted payment CSV import</div>,
}));

function renderPaymentsPage(initialEntry = "/payments") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <PaymentsPage />
    </MemoryRouter>
  );
}

describe("PaymentsPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usePayments.mockReturnValue({
      payments: [
        {
          id: "payment-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          unitDisplayLabel: "3A",
          amount: 1800,
          paidAt: "2026-04-01",
          method: "e-transfer",
          notes: "April rent",
          status: "Recorded",
          source: "payments",
        },
      ],
      loading: false,
      error: null,
    });
    mocks.fetchTenants.mockResolvedValue([{ id: "tenant-1", fullName: "Taylor Tenant" }]);
    mocks.fetchProperties.mockResolvedValue({ items: [{ id: "prop-1", name: "123 Main St" }] });
  });

  it("renders the recorded-payments framing, explainer, and export controls", async () => {
    renderPaymentsPage();

    expect(screen.getByText("Payments (recorded)")).toBeInTheDocument();
    expect(
      screen.getByText(
        "This page shows recorded rent payments only. Lease charges, credits, and unmatched ledger entries appear in tenant Financial activity and lease ledger views."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Financial Activity")).toBeInTheDocument();
    expect(screen.getByText("Recorded payments track money entered in the payments system.")).toBeInTheDocument();
    expect(
      screen.getByText("Lease ledger activity tracks charges, credits, and unmatched ledger entries separately.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("These views are intentionally separate to avoid double counting and preserve audit integrity.")
    ).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Spreadsheet (.xls)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Print / Save PDF" })).toBeInTheDocument();
    expect(screen.getByText("AI-assisted payment CSV import")).toBeInTheDocument();
    expect((await screen.findAllByText("Taylor Tenant")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("123 Main St / Unit 3A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("e-transfer").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Clear filter" })).not.toBeInTheDocument();
  });

  it("routes PDF export through the shared print helper", async () => {
    renderPaymentsPage();

    fireEvent.click((await screen.findAllByRole("button", { name: "Print / Save PDF" }))[0]);
    expect(mocks.printSummaryDocument).toHaveBeenCalledWith("summary");
  });

  it("generates client-side CSV for CSV and spreadsheet downloads without HTML", async () => {
    const createObjectURL = vi.fn(() => "blob:url");
    const revokeObjectURL = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", { ...(window.URL || {}), createObjectURL, revokeObjectURL });
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation(((tagName: string) => {
      if (tagName === "a") {
        return originalCreateElement("a");
      }
      return originalCreateElement(tagName);
    }) as any);

    renderPaymentsPage();

    fireEvent.click((await screen.findAllByRole("button", { name: "Export CSV" }))[0]);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const csvBlob = createObjectURL.mock.calls[0][0] as Blob;
    expect(csvBlob.type).toBe("text/csv;charset=utf-8");

    fireEvent.click(screen.getAllByRole("button", { name: "Export Spreadsheet (.xls)" })[0]);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(2));
    const spreadsheetBlob = createObjectURL.mock.calls[1][0] as Blob;
    expect(spreadsheetBlob.type).toBe("text/csv;charset=utf-8");

    createElementSpy.mockRestore();
    click.mockRestore();
  });

  it("falls back to operational references instead of unavailable labels when API labels are absent", async () => {
    mocks.usePayments.mockReturnValue({
      payments: [
        {
          id: "payment-2",
          tenantId: "tenant-2",
          propertyId: "prop-2",
          amount: 900,
          paidAt: "2026-04-02",
          method: "cash",
          notes: "",
          status: "Recorded",
          source: "payments",
        },
      ],
      loading: false,
      error: null,
    });
    mocks.fetchTenants.mockResolvedValue([]);
    mocks.fetchProperties.mockResolvedValue({ items: [] });

    renderPaymentsPage();

    expect((await screen.findAllByText("Tenant ref tenant-2")).length).toBeGreaterThan(0);
    expect((await screen.findAllByText("Property ref prop-2")).length).toBeGreaterThan(0);
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument();
  });

  it("shows Edit only for canonical payments rows", async () => {
    mocks.usePayments.mockReturnValue({
      payments: [
        {
          id: "canonical-payment-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          amount: 1800,
          paidAt: "2026-04-01",
          method: "e-transfer",
          status: "Recorded",
          source: "payments",
        },
        {
          id: "38r6fSwiPSDke0rEGKkx",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          amount: 1800,
          paidAt: "2026-04-02",
          method: "manual",
          status: "Recorded",
          source: "ledgerEntries",
        },
        {
          id: "f871db5d-16b3-4818-92e6-99c43d0f58e3",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          amount: 1800,
          paidAt: "2026-04-03",
          method: "stripe",
          status: "checkout_created",
          source: "rentPayments",
        },
      ],
      loading: false,
      error: null,
    });

    renderPaymentsPage();

    await screen.findAllByText("Taylor Tenant");
    expect(await screen.findAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });

  it("updates canonical payments using the canonical document id", async () => {
    mocks.usePayments.mockReturnValue({
      payments: [
        {
          id: "display-row-1",
          paymentDocumentId: "canonical-payment-doc-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          amount: 1800,
          paidAt: "2026-04-01",
          method: "e-transfer",
          notes: "April rent",
          status: "Recorded",
          source: "payments",
        },
      ],
      loading: false,
      error: null,
    });
    mocks.updatePayment.mockResolvedValue({
      id: "canonical-payment-doc-1",
      amount: 1750,
      paidAt: "2026-04-01",
      method: "e-transfer",
      notes: "April rent adjusted",
    });
    const prompt = vi
      .spyOn(window, "prompt")
      .mockReturnValueOnce("1750")
      .mockReturnValueOnce("2026-04-01")
      .mockReturnValueOnce("e-transfer")
      .mockReturnValueOnce("April rent adjusted");

    renderPaymentsPage();

    fireEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[0]);

    await waitFor(() =>
      expect(mocks.updatePayment).toHaveBeenCalledWith("canonical-payment-doc-1", {
        amount: 1750,
        notes: "April rent adjusted",
      })
    );
    prompt.mockRestore();
  });

  it("shows Edit when the row has an explicit canonical payment id even if source is absent", async () => {
    mocks.usePayments.mockReturnValue({
      payments: [
        {
          id: "display-row-2",
          paymentDocumentId: "canonical-payment-doc-2",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          amount: 1800,
          paidAt: "2026-04-01",
          method: "e-transfer",
          status: "Recorded",
        },
        {
          id: "unknown-row-with-id-only",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          amount: 1800,
          paidAt: "2026-04-02",
          method: "manual",
          status: "Recorded",
        },
      ],
      loading: false,
      error: null,
    });

    renderPaymentsPage();

    await screen.findAllByText("Taylor Tenant");
    expect(await screen.findAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });

  it("shows Edit when a canonical row uses a singular payment source alias", async () => {
    mocks.usePayments.mockReturnValue({
      payments: [
        {
          id: "canonical-payment-doc-3",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          amount: 1800,
          paidAt: "2026-04-01",
          method: "e-transfer",
          status: "Recorded",
          source: "payment",
        },
      ],
      loading: false,
      error: null,
    });

    renderPaymentsPage();

    await screen.findAllByText("Taylor Tenant");
    expect(await screen.findAllByRole("button", { name: "Edit" })).toHaveLength(1);
  });

  it("applies and clears the Dashboard current-month context filter", async () => {
    mocks.usePayments.mockReturnValue({
      payments: [
        {
          id: "payment-june",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          amount: 1800,
          paidAt: "2026-06-03",
          method: "e-transfer",
          notes: "June rent",
          status: "Recorded",
          source: "payments",
        },
        {
          id: "payment-may",
          tenantId: "tenant-2",
          propertyId: "prop-1",
          amount: 1700,
          paidAt: "2026-05-03",
          method: "cheque",
          notes: "May rent",
          status: "Recorded",
          source: "payments",
        },
      ],
      loading: false,
      error: null,
    });
    mocks.fetchTenants.mockResolvedValue([
      { id: "tenant-1", fullName: "June Tenant" },
      { id: "tenant-2", fullName: "May Tenant" },
    ]);

    renderPaymentsPage("/payments?context=current_month&period=2026-06&source=dashboard");

    expect(await screen.findByText("Current month payments (2026-06)")).toBeInTheDocument();
    expect((await screen.findAllByText("June Tenant")).length).toBeGreaterThan(0);
    expect(screen.queryByText("May Tenant")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filter" }));

    expect((await screen.findAllByText("May Tenant")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Current month payments (2026-06)")).not.toBeInTheDocument();
  });

  it("renders a calm empty state for empty Dashboard context results", async () => {
    mocks.usePayments.mockReturnValue({
      payments: [
        {
          id: "payment-may",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          amount: 1700,
          paidAt: "2026-05-03",
          method: "cheque",
          notes: "May rent",
          status: "Recorded",
          source: "payments",
        },
      ],
      loading: false,
      error: null,
    });

    renderPaymentsPage("/payments?context=current_month&period=2026-06&source=dashboard");

    expect(await screen.findByText("Current month payments (2026-06)")).toBeInTheDocument();
    expect(
      screen.getByText("No payments match current month payments (2026-06). Clear the filter to return to all recorded payments.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filter" })).toBeInTheDocument();
  });
});
