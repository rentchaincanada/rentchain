import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentCsvImportPreviewCard } from "./PaymentCsvImportPreviewCard";

const mocks = vi.hoisted(() => ({
  previewLedgerPaymentCsvImportMock: vi.fn(),
}));

vi.mock("@/api/ledgerPaymentImportApi", () => ({
  previewLedgerPaymentCsvImport: mocks.previewLedgerPaymentCsvImportMock,
}));

describe("PaymentCsvImportPreviewCard", () => {
  beforeEach(() => {
    mocks.previewLedgerPaymentCsvImportMock.mockReset();
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
        matchedRows: 1,
        highConfidenceRows: 1,
        mediumConfidenceRows: 0,
        lowConfidenceRows: 1,
        unmatchedRows: 1,
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
          matchStatus: "unmatched",
          confidence: "low",
          preselected: false,
          warning: "Unmatched rows are not imported.",
          reason: "No active tenant lease match found.",
          matchBasis: [],
          matchedTenantId: null,
          matchedTenantName: null,
          leaseId: null,
          propertyId: null,
          propertyLabel: "Harbour View",
          unitId: null,
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
    expect(screen.getByText("1 rows matched tenant lease records. 1 rows are blocked until the row-level issue is fixed.")).toBeInTheDocument();
    expect(screen.getByText("Matched by: Tenant + Property + Unit")).toBeInTheDocument();
    expect(screen.getAllByText("Harbour View").length).toBeGreaterThan(0);
    expect(screen.getByText("Bailey Blinkers")).toBeInTheDocument();
    expect(screen.getByText("Unknown Tenant")).toBeInTheDocument();
    expect(screen.getByText("Preview only. Payment and ledger writes require a separate confirmation flow and are not enabled in this version.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm import/i })).not.toBeInTheDocument();
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
});
