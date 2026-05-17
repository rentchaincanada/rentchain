import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentCsvImportPreviewCard } from "./PaymentCsvImportPreviewCard";

const mocks = vi.hoisted(() => ({
  previewLedgerPaymentCsvImportMock: vi.fn(),
  confirmLedgerPaymentCsvImportMock: vi.fn(),
}));

vi.mock("@/api/ledgerPaymentImportApi", () => ({
  confirmLedgerPaymentCsvImport: mocks.confirmLedgerPaymentCsvImportMock,
  previewLedgerPaymentCsvImport: mocks.previewLedgerPaymentCsvImportMock,
}));

describe("PaymentCsvImportPreviewCard", () => {
  beforeEach(() => {
    mocks.previewLedgerPaymentCsvImportMock.mockReset();
    mocks.confirmLedgerPaymentCsvImportMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders preview summary and grouped payment rows without confirm writes", async () => {
    mocks.previewLedgerPaymentCsvImportMock.mockResolvedValue({
      ok: true,
      importBatchId: "batch-1",
      filename: "payments.csv",
      notices: {
        ignoredColumns: true,
        sensitiveColumnsOmitted: true,
        messages: [
          "Some columns were ignored because they are not needed for rent payment import.",
          "Sensitive banking columns were detected and omitted from preview/import.",
        ],
      },
      summary: {
        totalRows: 2,
        totalPaymentAmountCents: 35000,
        totalPaymentAmountDisplay: "$350.00",
        matchedRows: 2,
        highConfidenceRows: 1,
        mediumConfidenceRows: 1,
        lowConfidenceRows: 0,
        unmatchedRows: 0,
        ambiguousRows: 0,
        invalidRows: 0,
        preselectedRows: 1,
        duplicateRows: 0,
        groupedByProperty: [
          { propertyLabel: "Harbour View", rowCount: 2, amountCents: 35000, amountDisplay: "$350.00" },
        ],
      },
      rows: [
        {
          rowId: "row-1",
          sourceRowNumber: 2,
          sourceFileName: "payments.csv",
          tenantName: "Bailey Blinkers",
          tenantEmail: "bailey@example.com",
          property: "Harbour View",
          unit: "1",
          amountCents: 15000,
          amountDisplay: "$150.00",
          paymentDate: "2026-05-15",
          method: "etransfer",
          reference: "may",
          notes: null,
          matchStatus: "matched",
          confidence: "high",
          preselected: true,
          warning: null,
          reason: "Tenant name, property, and unit matched an active lease.",
          matchBasis: ["tenant", "property", "unit"],
          matchedTenantId: "tenant-1",
          matchedTenantName: "Bailey Blinkers",
          leaseId: "lease-1",
          propertyId: "property-1",
          propertyLabel: "Harbour View",
          unitId: "unit-1",
          unitLabel: "Unit 1",
          duplicateInFile: false,
          rowFingerprint: "abc",
        },
        {
          rowId: "row-2",
          sourceRowNumber: 3,
          sourceFileName: "payments.csv",
          tenantName: "Unknown Tenant",
          tenantEmail: null,
          property: "Harbour View",
          unit: "2",
          amountCents: 20000,
          amountDisplay: "$200.00",
          paymentDate: "2026-05-15",
          method: null,
          reference: null,
          notes: null,
          matchStatus: "matched",
          confidence: "medium",
          preselected: false,
          warning: "Tenant matched by name only. Please confirm before import.",
          reason: "Tenant name matched one active lease, but property/unit context is incomplete.",
          matchBasis: ["tenant"],
          matchedTenantId: "tenant-2",
          matchedTenantName: "Unknown Tenant",
          leaseId: "lease-2",
          propertyId: "property-1",
          propertyLabel: "Harbour View",
          unitId: "unit-2",
          unitLabel: "Unit 2",
          duplicateInFile: false,
          rowFingerprint: "def",
        },
      ],
    });

    render(<PaymentCsvImportPreviewCard />);

    expect(screen.getByText("Accepted columns: tenant name (or first/last name), amount, payment date. Property/unit recommended.")).toBeInTheDocument();
    expect(screen.getByLabelText("Payment CSV example")).toHaveTextContent("Reference,Date,First Name,Last Name,Rent Amount,Property,Unit,Method");
    const input = screen.getByLabelText("Payment CSV file") as HTMLInputElement;
    const file = new File(["tenantName,amount,paymentDate\nBailey Blinkers,150,2026-05-15"], "payments.csv", {
      type: "text/csv",
    });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Preview CSV" }));

    await waitFor(() => expect(mocks.previewLedgerPaymentCsvImportMock).toHaveBeenCalledWith(file));
    expect(await screen.findByText("$350.00")).toBeInTheDocument();
    expect(screen.getByText("Some columns were ignored because they are not needed for rent payment import.")).toBeInTheDocument();
    expect(screen.getByText("Sensitive banking columns were detected and omitted from preview/import.")).toBeInTheDocument();
    expect(screen.getByText("2 rows matched tenant lease records. 0 rows are blocked until the row-level issue is fixed.")).toBeInTheDocument();
    expect(screen.getByText("Matched by: Tenant + Property + Unit")).toBeInTheDocument();
    expect(screen.getByText("Matched by: Tenant")).toBeInTheDocument();
    expect(screen.getByText("Tenant matched by name only. Please confirm before import.")).toBeInTheDocument();
    expect(screen.getByLabelText("Select row 2")).toBeChecked();
    expect(screen.getByLabelText("Select row 3")).not.toBeChecked();
    expect(screen.getByLabelText("Select row 3")).not.toBeDisabled();
    expect(screen.getAllByText("Harbour View").length).toBeGreaterThan(0);
    expect(screen.getByText("Bailey Blinkers")).toBeInTheDocument();
    expect(screen.getByText("Unknown Tenant")).toBeInTheDocument();
    expect(screen.getByText("Preview is read-only until you click Import selected payments. High-confidence rows are preselected. Review-required rows can be selected manually. Blocked, ambiguous, invalid, and duplicate rows are not imported.")).toBeInTheDocument();
  });

  it("requires a selected file before preview", () => {
    render(<PaymentCsvImportPreviewCard />);
    fireEvent.click(screen.getByRole("button", { name: "Preview CSV" }));
    expect(screen.getByText("Choose a CSV file first.")).toBeInTheDocument();
    expect(mocks.previewLedgerPaymentCsvImportMock).not.toHaveBeenCalled();
  });

  it("downloads a landlord-friendly CSV template", () => {
    const createObjectURL = vi.fn(() => "blob:template");
    const revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.stubGlobal("URL", { ...(window.URL || {}), createObjectURL, revokeObjectURL });

    render(<PaymentCsvImportPreviewCard />);
    fireEvent.click(screen.getByRole("button", { name: "Download CSV template" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:template");
    click.mockRestore();
  });

  it("confirms selected eligible rows and renders the import result", async () => {
    const onImportComplete = vi.fn();
    mocks.previewLedgerPaymentCsvImportMock.mockResolvedValue({
      ok: true,
      importBatchId: "batch-1",
      filename: "payments.csv",
      notices: { ignoredColumns: false, sensitiveColumnsOmitted: false, messages: [] },
      summary: {
        totalRows: 1,
        totalPaymentAmountCents: 15000,
        totalPaymentAmountDisplay: "$150.00",
        matchedRows: 1,
        highConfidenceRows: 1,
        mediumConfidenceRows: 0,
        lowConfidenceRows: 0,
        unmatchedRows: 0,
        ambiguousRows: 0,
        invalidRows: 0,
        preselectedRows: 1,
        duplicateRows: 0,
        groupedByProperty: [{ propertyLabel: "Harbour View", rowCount: 1, amountCents: 15000, amountDisplay: "$150.00" }],
      },
      rows: [
        {
          rowId: "row-1",
          sourceRowNumber: 2,
          sourceFileName: "payments.csv",
          tenantName: "Bailey Blinkers",
          tenantEmail: null,
          property: "Harbour View",
          unit: "1",
          amountCents: 15000,
          amountDisplay: "$150.00",
          paymentDate: "2026-05-15",
          method: "etransfer",
          reference: "may",
          notes: null,
          matchStatus: "matched",
          confidence: "high",
          preselected: true,
          warning: null,
          reason: "Tenant name, property, and unit matched an active lease.",
          matchBasis: ["tenant", "property", "unit"],
          matchedTenantId: "tenant-1",
          matchedTenantName: "Bailey Blinkers",
          leaseId: "lease-1",
          propertyId: "property-1",
          propertyLabel: "Harbour View",
          unitId: "unit-1",
          unitLabel: "Unit 1",
          duplicateInFile: false,
          rowFingerprint: "abc",
        },
      ],
    });
    mocks.confirmLedgerPaymentCsvImportMock.mockResolvedValue({
      ok: true,
      importBatchId: "batch-1",
      importedCount: 1,
      duplicateCount: 0,
      failedCount: 0,
      results: [{ rowId: "row-1", rowFingerprint: "abc", status: "imported", reason: "ok", paymentDocumentId: "payment-1", ledgerEntryId: "entry-1" }],
      warnings: [],
    });

    render(<PaymentCsvImportPreviewCard onImportComplete={onImportComplete} />);
    const input = screen.getByLabelText("Payment CSV file") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["csv"], "payments.csv", { type: "text/csv" })] } });
    fireEvent.click(screen.getByRole("button", { name: "Preview CSV" }));
    expect(await screen.findByRole("button", { name: "Import selected payments (1)" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import selected payments (1)" }));

    await waitFor(() =>
      expect(mocks.confirmLedgerPaymentCsvImportMock).toHaveBeenCalledWith({
        importBatchId: "batch-1",
        selectedRowIds: ["row-1"],
      })
    );
    expect(await screen.findByText("Import result")).toBeInTheDocument();
    expect(screen.getByText("Imported 1 rows. Skipped duplicates 0. Failed 0.")).toBeInTheDocument();
    expect(onImportComplete).toHaveBeenCalledTimes(1);
  });
});
