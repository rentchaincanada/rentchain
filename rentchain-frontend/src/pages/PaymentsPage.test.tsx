import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PaymentsPage from "./PaymentsPage";

const mocks = vi.hoisted(() => ({
  usePayments: vi.fn(),
  updatePayment: vi.fn(),
  exportPayments: vi.fn(),
  fetchProperties: vi.fn(),
  fetchTenants: vi.fn(),
  printSummaryDocument: vi.fn(),
}));

vi.mock("../hooks/usePayments", () => ({
  usePayments: mocks.usePayments,
}));

vi.mock("../api/paymentsApi", () => ({
  updatePayment: mocks.updatePayment,
  exportPayments: mocks.exportPayments,
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

describe("PaymentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.usePayments.mockReturnValue({
      payments: [
        {
          id: "payment-1",
          tenantId: "tenant-1",
          propertyId: "prop-1",
          amount: 1800,
          paidAt: "2026-04-01",
          method: "e-transfer",
          notes: "April rent",
        },
      ],
      loading: false,
      error: null,
    });
    mocks.fetchTenants.mockResolvedValue([{ id: "tenant-1", fullName: "Taylor Tenant" }]);
    mocks.fetchProperties.mockResolvedValue({ items: [{ id: "prop-1", name: "123 Main St" }] });
    mocks.exportPayments.mockResolvedValue({
      blob: new Blob(["csv"]),
      filename: "payments.csv",
    });
  });

  it("renders export controls and payment labels", async () => {
    render(<PaymentsPage />);

    expect(await screen.findByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Spreadsheet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeInTheDocument();
    expect((await screen.findAllByText("Taylor Tenant")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("123 Main St").length).toBeGreaterThan(0);
  });

  it("routes PDF export through the shared print helper", async () => {
    render(<PaymentsPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Export PDF" }))[0]);
    expect(mocks.printSummaryDocument).toHaveBeenCalledWith("summary");
  });

  it("calls the export api for CSV and spreadsheet downloads", async () => {
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

    render(<PaymentsPage />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Export CSV" }))[0]);
    await waitFor(() => expect(mocks.exportPayments).toHaveBeenCalledWith("csv"));

    fireEvent.click(screen.getAllByRole("button", { name: "Export Spreadsheet" })[0]);
    await waitFor(() => expect(mocks.exportPayments).toHaveBeenCalledWith("xlsx"));

    createElementSpy.mockRestore();
    click.mockRestore();
  });
});
