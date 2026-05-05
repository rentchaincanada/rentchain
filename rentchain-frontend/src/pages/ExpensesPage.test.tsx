import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExpensesPage from "./ExpensesPage";

const readBlobText = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });

const mocks = vi.hoisted(() => ({
  listExpensesMock: vi.fn(),
  exportExpensesMock: vi.fn(),
  fetchPropertiesMock: vi.fn(),
  useCapabilitiesMock: vi.fn(),
  previewExpenseImportMock: vi.fn(),
  confirmExpenseImportRowsMock: vi.fn(),
}));

vi.mock("../api/expensesApi", async () => {
  const actual = await vi.importActual<typeof import("../api/expensesApi")>("../api/expensesApi");
  return {
    ...actual,
    listExpenses: mocks.listExpensesMock,
    exportExpenses: mocks.exportExpensesMock,
    previewExpenseImport: mocks.previewExpenseImportMock,
    confirmExpenseImportRows: mocks.confirmExpenseImportRowsMock,
  };
});

vi.mock("../api/propertiesApi", () => ({
  fetchProperties: mocks.fetchPropertiesMock,
}));

vi.mock("../hooks/useCapabilities", () => ({
  useCapabilities: mocks.useCapabilitiesMock,
}));

vi.mock("../components/expenses/AddExpenseModal", () => ({
  AddExpenseModal: () => null,
}));

describe("ExpensesPage", () => {
  beforeEach(() => {
    mocks.listExpensesMock.mockResolvedValue([
      {
        id: "expense-1",
        propertyId: "prop-1",
        unitId: "unit-firestore-1",
        unitNumber: "3A",
        category: "Repairs",
        vendorName: "FixIt",
        amountCents: 12500,
        incurredAtMs: Date.parse("2026-03-01T00:00:00.000Z"),
        status: "recorded",
      },
    ]);
    mocks.fetchPropertiesMock.mockResolvedValue({
      items: [{ id: "prop-1", name: "Alpha Property", portfolioStatus: "active" }],
    });
    mocks.exportExpensesMock.mockResolvedValue({
      blob: new Blob(["csv"]),
      filename: "expenses.csv",
    });
    mocks.previewExpenseImportMock.mockReset();
    mocks.confirmExpenseImportRowsMock.mockReset();
  });

  it("shows the Pro upgrade prompt for import/export on free plans", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "free" },
      features: { "expenses.import": false },
      loading: false,
    });

    render(<ExpensesPage />);

    expect(await screen.findByText("Upgrade to Pro to import receipts, PDFs, CSVs, and spreadsheets with AI-assisted review.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export CSV" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export Spreadsheet (.xls)" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Export PDF" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Alpha Property").length).toBeGreaterThan(0);
  });

  it("shows export controls for Pro plans", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "pro" },
      features: { "expenses.import": true },
      loading: false,
    });

    render(<ExpensesPage />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Export CSV" })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Export Spreadsheet (.xls)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeInTheDocument();
  });

  it("generates client-side CSV for CSV and spreadsheet downloads without HTML", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "pro" },
      features: { "expenses.import": true },
      loading: false,
    });

    const createObjectURL = vi.fn(() => "blob:url");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", { ...(window.URL || {}), createObjectURL, revokeObjectURL });

    render(<ExpensesPage />);

    expect((await screen.findAllByText("FixIt")).length).toBeGreaterThan(0);
    fireEvent.click((await screen.findAllByRole("button", { name: "Export CSV" }))[0]);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const csvBlob = createObjectURL.mock.calls[0][0] as Blob;
    expect(csvBlob.type).toBe("text/csv;charset=utf-8");
    const csvText = await readBlobText(csvBlob);
    expect(csvText).toContain("date,property,unit,category,vendor,description,amount,status,source");
    expect(csvText).toContain("Unit 3A");
    expect(csvText).not.toContain("unit-firestore-1");
    expect(csvText.toLowerCase()).not.toContain("<!doctype html>");
    expect(mocks.exportExpensesMock).not.toHaveBeenCalledWith("csv", expect.any(Object));

    fireEvent.click(screen.getAllByRole("button", { name: "Export Spreadsheet (.xls)" })[0]);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(2));
    const spreadsheetBlob = createObjectURL.mock.calls[1][0] as Blob;
    expect(spreadsheetBlob.type).toBe("text/csv;charset=utf-8");
    const spreadsheetText = await readBlobText(spreadsheetBlob);
    expect(spreadsheetText).toContain("Unit 3A");
    expect(spreadsheetText).not.toContain("unit-firestore-1");
    expect(mocks.exportExpensesMock).not.toHaveBeenCalledWith("xls", expect.any(Object));

    fireEvent.click(screen.getAllByRole("button", { name: "Export PDF" })[0]);
    await waitFor(() => expect(mocks.exportExpensesMock).toHaveBeenCalledWith("pdf", expect.any(Object)));

    click.mockRestore();
  });

  it("does not expose raw unit ids in CSV when no readable unit label is available", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "pro" },
      features: { "expenses.import": true },
      loading: false,
    });
    mocks.listExpensesMock.mockResolvedValue([
      {
        id: "expense-raw-unit",
        propertyId: "prop-1",
        unitId: "unit_abc123_firestore",
        category: "Repairs",
        vendorName: "FixIt",
        amountCents: 12500,
        incurredAtMs: Date.parse("2026-03-01T00:00:00.000Z"),
        status: "recorded",
      },
    ]);

    const createObjectURL = vi.fn(() => "blob:url");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", { ...(window.URL || {}), createObjectURL, revokeObjectURL });

    render(<ExpensesPage />);

    expect((await screen.findAllByText("FixIt")).length).toBeGreaterThan(0);
    fireEvent.click((await screen.findAllByRole("button", { name: "Export CSV" }))[0]);
    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    const csvText = await readBlobText(createObjectURL.mock.calls[0][0] as Blob);
    expect(csvText).toContain("date,property,unit,category,vendor,description,amount,status,source");
    expect(csvText).not.toContain("unit_abc123_firestore");

    click.mockRestore();
  });

  it("renders preview rows and confirms reviewed imports on Pro plans", async () => {
    mocks.useCapabilitiesMock.mockReturnValue({
      caps: { plan: "pro" },
      features: { "expenses.import": true },
      loading: false,
    });
    mocks.previewExpenseImportMock.mockResolvedValue({
      ok: true,
      files: [{ name: "expenses.csv", type: "text/csv", rowsParsed: 1 }],
      rows: [
        {
          rowId: "row-1",
          date: "2026-03-01",
          property: "Alpha Property",
          propertyId: "prop-1",
          unit: null,
          unitId: null,
          category: "Repairs",
          vendor: "FixIt",
          description: "Pipe repair",
          amount: 125,
          currency: "CAD",
          notes: null,
          sourceFileName: "expenses.csv",
          confidence: 0.9,
          warningCodes: [],
          warnings: [],
          duplicateStatus: "none",
          duplicateReason: null,
          duplicateMatches: [],
          lowConfidence: false,
        },
      ],
      summary: {
        parsed: 1,
        lowConfidence: 0,
        unresolvedProperty: 0,
        unresolvedUnit: 0,
        duplicateCount: 0,
        likelyDuplicateCount: 0,
      },
    });
    mocks.confirmExpenseImportRowsMock.mockResolvedValue({
      ok: true,
      imported: 1,
      skipped: 0,
      duplicateImported: 0,
      errors: [],
    });

    render(<ExpensesPage />);

    const file = new File(["date,property,category,amount\n2026-03-01,Alpha Property,Repairs,125.00"], "expenses.csv", {
      type: "text/csv",
    });
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    const reviewButton = screen
      .getAllByRole("button", { name: "Review import" })
      .find((button) => !(button as HTMLButtonElement).disabled) as HTMLButtonElement;
    fireEvent.click(reviewButton);

    await waitFor(() => {
      expect(mocks.previewExpenseImportMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Review extracted rows")).toBeInTheDocument();
    expect(screen.getByText("1 parsed")).toBeInTheDocument();
    expect(screen.getByText("0 duplicate flagged")).toBeInTheDocument();
    expect(screen.getByDisplayValue("FixIt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));

    await waitFor(() => {
      expect(mocks.confirmExpenseImportRowsMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText("Import completed")).toBeInTheDocument();
    expect(screen.getByText("1 imported")).toBeInTheDocument();
    expect(screen.getByText("0 duplicate-flagged imported")).toBeInTheDocument();
  });

});
