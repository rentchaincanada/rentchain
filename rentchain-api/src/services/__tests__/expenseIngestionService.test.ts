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
      existingExpenses: [],
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

  it("flags exact duplicates against existing expenses during preview", () => {
    const result = previewDelimitedExpenseFile({
      fileName: "expenses.csv",
      csvText: [
        "date,property,unit,category,vendor,description,amount",
        "2026-03-01,Coburg Rd,12A,Repairs,FixIt,Pipe repair,125.00",
      ].join("\n"),
      properties,
      units,
      existingExpenses: [
        {
          expenseId: "expense-1",
          date: "2026-03-01",
          amount: 125,
          vendor: "FixIt",
          description: "Pipe repair",
          property: "Coburg Rd",
          propertyId: "prop-1",
        },
      ],
    });

    expect(result.rows[0]).toMatchObject({
      duplicateStatus: "likely_duplicate",
      include: false,
    });
    expect(result.rows[0]?.duplicateMatches?.[0]).toMatchObject({
      expenseId: "expense-1",
      source: "existing",
    });
    expect(result.summary.duplicateCount).toBe(1);
  });

  it("flags intra-batch duplicates during preview", () => {
    const result = previewDelimitedExpenseFile({
      fileName: "expenses.csv",
      csvText: [
        "date,property,category,vendor,description,amount",
        "2026-03-01,Coburg Rd,Repairs,FixIt,Pipe repair,125.00",
        "2026-03-01,Coburg Rd,Repairs,FixIt,Pipe repair,125.00",
      ].join("\n"),
      properties,
      units,
      existingExpenses: [],
    });

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.duplicateStatus).toBe("likely_duplicate");
    expect(result.rows[1]?.duplicateStatus).toBe("likely_duplicate");
    expect(result.rows[0]?.duplicateMatches?.[0]?.source).toBe("batch");
  });

  it("leaves non-duplicate rows unflagged", () => {
    const result = previewDelimitedExpenseFile({
      fileName: "expenses.csv",
      csvText: [
        "date,property,category,vendor,description,amount",
        "2026-03-01,Coburg Rd,Repairs,FixIt,Pipe repair,125.00",
      ].join("\n"),
      properties,
      units,
      existingExpenses: [
        {
          expenseId: "expense-9",
          date: "2026-03-02",
          amount: 99,
          vendor: "Other Vendor",
          description: "Other repair",
          property: "Summit",
          propertyId: "prop-2",
        },
      ],
    });

    expect(result.rows[0]?.duplicateStatus).toBe("none");
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
      existingExpenses: [],
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
      existingExpenses: [],
    });

    expect(result.rows[0]?.warnings).toContain("Missing property match");
    expect(result.rows[0]?.warningCodes).toContain("unresolved_property");
    expect(result.summary.lowConfidence).toBe(1);
    expect(result.rows[0]?.include).toBe(false);
  });

  it("keeps missing amount/date rows previewable but invalid for confirm", async () => {
    const preview = previewDelimitedExpenseFile({
      fileName: "expenses.csv",
      csvText: ["date,property,category,vendor,description,amount", ",Coburg Rd,Repairs,FixIt,Pipe repair,"].join("\n"),
      properties,
      units,
      existingExpenses: [],
    });

    expect(preview.rows[0]?.lowConfidence).toBe(true);
    expect(preview.rows[0]?.warningCodes).toEqual(expect.arrayContaining(["missing_amount", "missing_date"]));

    const createExpense = vi.fn(async () => undefined);
    const result = await confirmExpenseImport({
      rows: preview.rows.map((row) => ({ ...row, include: true })),
      properties,
      units,
      createExpense,
    });

    expect(result.imported).toBe(0);
    expect(result.skipped).toBe(1);
    expect(createExpense).not.toHaveBeenCalled();
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
          warningCodes: [],
          duplicateStatus: "likely_duplicate",
          duplicateReason: "Likely duplicate of an existing expense.",
          duplicateMatches: [],
          lowConfidence: false,
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
          warningCodes: [],
          duplicateStatus: "none",
          duplicateReason: null,
          duplicateMatches: [],
          lowConfidence: false,
        },
      ],
      properties,
      units,
      createExpense,
    });

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.duplicateImported).toBe(1);
    expect(createExpense).toHaveBeenCalledTimes(1);
  });
});
