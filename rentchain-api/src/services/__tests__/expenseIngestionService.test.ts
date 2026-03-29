import { describe, expect, it, vi } from "vitest";
import {
  confirmExpenseImport,
  previewDelimitedExpenseFile,
  previewDocumentTextFile,
  previewSpreadsheetXmlFile,
} from "../expenses/expenseIngestionService";

const properties = [
  { id: "prop-1", name: "Coburg Rd" },
  { id: "prop-2", name: "Summit" },
];

const units = [
  { id: "unit-1", propertyId: "prop-1", label: "12A" },
  { id: "unit-2", propertyId: "prop-2", label: "4" },
];

describe("expenseIngestionService", () => {
  it("parses a RentChain-exported csv shape", () => {
    const result = previewDelimitedExpenseFile({
      fileName: "expenses.csv",
      csvText: [
        "date,property,unit,category,vendor,description,amount,status,source",
        "2026-03-01,Coburg Rd,12A,Repairs,FixIt,Pipe repair,125.00,recorded,manual",
      ].join("\n"),
      properties,
      units,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      propertyId: "prop-1",
      unitId: "unit-1",
      category: "Repairs",
      amount: 125,
      currency: "CAD",
    });
    expect(result.summary.parsed).toBe(1);
  });

  it("parses spreadsheet xml rows with exported headers", () => {
    const xml = `<?xml version="1.0"?><Workbook><Worksheet><Table>
      <Row><Cell><Data>Date</Data></Cell><Cell><Data>Property</Data></Cell><Cell><Data>Unit</Data></Cell><Cell><Data>Category</Data></Cell><Cell><Data>Vendor</Data></Cell><Cell><Data>Description</Data></Cell><Cell><Data>Amount</Data></Cell><Cell><Data>Status</Data></Cell><Cell><Data>Source</Data></Cell></Row>
      <Row><Cell><Data>2026-03-02</Data></Cell><Cell><Data>Summit</Data></Cell><Cell><Data>4</Data></Cell><Cell><Data>Utilities</Data></Cell><Cell><Data>Nova Power</Data></Cell><Cell><Data>Hydro bill</Data></Cell><Cell><Data>88.12</Data></Cell><Cell><Data>paid</Data></Cell><Cell><Data>manual</Data></Cell></Row>
    </Table></Worksheet></Workbook>`;
    const result = previewSpreadsheetXmlFile({
      fileName: "expenses.xlsx",
      xmlText: xml,
      properties,
      units,
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      propertyId: "prop-2",
      unitId: "unit-2",
      category: "Utilities",
      amount: 88.12,
    });
  });

  it("returns warnings for unresolved rows in document previews", () => {
    const result = previewDocumentTextFile({
      fileName: "receipt.pdf",
      textPreview: "Vendor Receipt\nTotal Due $19.20\n2026-03-03",
      properties,
      units,
      aiSummary: "Detected uploaded expense document.",
    });

    expect(result.rows[0]?.warnings).toContain("Property needs review");
    expect(result.summary.lowConfidence).toBe(1);
  });

  it("imports only confirmed rows during confirm", async () => {
    const createExpense = vi.fn(async () => undefined);

    const result = await confirmExpenseImport({
      rows: [
        {
          rowId: "row-1",
          include: true,
          date: "2026-03-01",
          property: "Coburg Rd",
          propertyId: "prop-1",
          unit: "12A",
          unitId: "unit-1",
          category: "Repairs",
          vendor: "FixIt",
          description: "Pipe repair",
          amount: 125,
          currency: "CAD",
          notes: null,
          sourceFileName: "expenses.csv",
          confidence: 0.95,
          warnings: [],
        },
        {
          rowId: "row-2",
          include: false,
          date: "2026-03-02",
          property: "Summit",
          propertyId: "prop-2",
          unit: null,
          unitId: null,
          category: "Utilities",
          vendor: "Nova Power",
          description: "Hydro",
          amount: 88.12,
          currency: "CAD",
          notes: null,
          sourceFileName: "expenses.xlsx",
          confidence: 0.9,
          warnings: [],
        },
      ],
      properties,
      units,
      createExpense,
    });

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(createExpense).toHaveBeenCalledTimes(1);
  });
});
