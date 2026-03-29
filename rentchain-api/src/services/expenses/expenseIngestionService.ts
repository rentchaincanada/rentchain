import Papa from "papaparse";
import type {
  ExpenseImportConfirmRow,
  ExpenseImportPreviewResult,
  ExpenseImportPreviewRow,
  ExpensePropertyOption,
  ExpenseUnitOption,
} from "./expenseIngestionTypes";

const CATEGORY_OPTIONS = [
  "Repairs",
  "Maintenance",
  "Utilities",
  "Cleaning",
  "Supplies",
  "Landscaping",
  "Insurance",
  "Taxes",
  "Administration",
  "Contractor Labor",
  "Materials",
  "Other",
] as const;

function normalizeHeader(value: unknown): string {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function normalizeKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function decodeXml(value: string): string {
  return String(value || "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function getValue(row: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function toIsoDate(value: unknown): string | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = Date.parse(raw);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function toAmount(value: unknown): number | null {
  const raw = String(value || "").trim().replace(/[$,\s]/g, "");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeCategory(value: unknown): string | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  const match = CATEGORY_OPTIONS.find((option) => option.toLowerCase() === raw);
  return match || null;
}

function resolveProperty(
  properties: ExpensePropertyOption[],
  propertyId: string,
  propertyName: string
) {
  const id = String(propertyId || "").trim();
  if (id) {
    const byId = properties.find((property) => property.id === id);
    if (byId) return byId;
  }
  const nameKey = normalizeKey(propertyName);
  if (!nameKey) return null;
  return properties.find((property) => normalizeKey(property.name) === nameKey) || null;
}

function resolveUnit(
  units: ExpenseUnitOption[],
  propertyId: string,
  unitId: string,
  unitLabel: string
) {
  const scoped = units.filter((unit) => unit.propertyId === propertyId);
  const directId = String(unitId || "").trim();
  if (directId) {
    const byId = scoped.find((unit) => unit.id === directId);
    if (byId) return byId;
  }
  const labelKey = normalizeKey(unitLabel);
  if (!labelKey) return null;
  return scoped.find((unit) => normalizeKey(unit.label) === labelKey) || null;
}

function summarize(rows: ExpenseImportPreviewRow[]) {
  return {
    parsed: rows.length,
    lowConfidence: rows.filter((row) => (row.confidence ?? 0) < 0.75).length,
    unresolvedProperty: rows.filter((row) => !row.propertyId).length,
    unresolvedUnit: rows.filter((row) => Boolean(row.unit) && !row.unitId).length,
  };
}

function buildPreviewRow(input: {
  rowId: string;
  sourceFileName: string;
  propertyText?: string;
  propertyIdText?: string;
  unitText?: string;
  unitIdText?: string;
  categoryText?: string;
  vendorText?: string;
  descriptionText?: string;
  notesText?: string;
  dateText?: string;
  amountText?: string | number | null;
  currencyText?: string;
  properties: ExpensePropertyOption[];
  units: ExpenseUnitOption[];
  baseWarnings?: string[];
}) {
  const property = resolveProperty(input.properties, input.propertyIdText || "", input.propertyText || "");
  const unit = property
    ? resolveUnit(input.units, property.id, input.unitIdText || "", input.unitText || "")
    : null;
  const category = normalizeCategory(input.categoryText);
  const date = toIsoDate(input.dateText);
  const amount = typeof input.amountText === "number" ? input.amountText : toAmount(input.amountText);
  const warnings = [...(input.baseWarnings || [])];

  if (!property) warnings.push("Property needs review");
  if (input.unitText && !unit) warnings.push("Unit needs review");
  if (!category) warnings.push("Category needs review");
  if (amount == null) warnings.push("Amount needs review");
  if (!date) warnings.push("Date needs review");

  const confidence = Math.max(0.2, Math.min(0.98, 1 - warnings.length * 0.15));

  return {
    rowId: input.rowId,
    date,
    property: property?.name || input.propertyText || null,
    propertyId: property?.id || null,
    unit: unit?.label || input.unitText || null,
    unitId: unit?.id || null,
    category,
    vendor: input.vendorText || null,
    description: input.descriptionText || null,
    amount,
    currency: input.currencyText || "CAD",
    notes: input.notesText || null,
    sourceFileName: input.sourceFileName,
    confidence,
    warnings,
  } satisfies ExpenseImportPreviewRow;
}

export function previewDelimitedExpenseFile(params: {
  fileName: string;
  csvText: string;
  properties: ExpensePropertyOption[];
  units: ExpenseUnitOption[];
  defaultPropertyId?: string | null;
}) {
  const parsed = Papa.parse<Record<string, string>>(params.csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => normalizeHeader(header),
  });

  const rows = (parsed.data || []).map((row, index) =>
    buildPreviewRow({
      rowId: `${params.fileName}-${index + 1}`,
      sourceFileName: params.fileName,
      propertyText: getValue(row, "property"),
      propertyIdText: getValue(row, "propertyid") || String(params.defaultPropertyId || ""),
      unitText: getValue(row, "unit"),
      unitIdText: getValue(row, "unitid"),
      categoryText: getValue(row, "category"),
      vendorText: getValue(row, "vendor", "vendorname"),
      descriptionText: getValue(row, "description"),
      notesText: getValue(row, "notes", "description"),
      dateText: getValue(row, "date", "incurredat", "incurredatms"),
      amountText: getValue(row, "amount"),
      currencyText: getValue(row, "currency") || "CAD",
      properties: params.properties,
      units: params.units,
    })
  );

  return {
    files: [{ name: params.fileName, type: "text/csv", rowsParsed: rows.length }],
    rows,
    summary: summarize(rows),
  } satisfies ExpenseImportPreviewResult;
}

export function previewSpreadsheetXmlFile(params: {
  fileName: string;
  xmlText: string;
  properties: ExpensePropertyOption[];
  units: ExpenseUnitOption[];
  defaultPropertyId?: string | null;
}) {
  const rowMatches = Array.from(params.xmlText.matchAll(/<Row>([\s\S]*?)<\/Row>/gi));
  const rows = rowMatches.map((match) =>
    Array.from(match[1].matchAll(/<Data[^>]*>([\s\S]*?)<\/Data>/gi)).map((cell) =>
      decodeXml(cell[1].replace(/<[^>]+>/g, "").trim())
    )
  );
  if (rows.length < 2) {
    return {
      files: [{ name: params.fileName, type: "application/vnd.ms-excel", rowsParsed: 0 }],
      rows: [],
      summary: summarize([]),
    } satisfies ExpenseImportPreviewResult;
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  const body = rows.slice(1).filter((row) => row.some((cell) => String(cell || "").trim()));
  const mapped = body.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]))
  );

  return previewDelimitedExpenseFile({
    fileName: params.fileName,
    csvText: Papa.unparse(mapped),
    properties: params.properties,
    units: params.units,
    defaultPropertyId: params.defaultPropertyId,
  });
}

function inferCategoryFromText(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("repair")) return "Repairs";
  if (lower.includes("maintenance")) return "Maintenance";
  if (lower.includes("utility") || lower.includes("hydro") || lower.includes("electric")) return "Utilities";
  if (lower.includes("clean")) return "Cleaning";
  if (lower.includes("insurance")) return "Insurance";
  if (lower.includes("tax")) return "Taxes";
  return null;
}

function firstLine(text: string) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || "";
}

function findAmount(text: string): number | null {
  const match = text.match(/(?:CAD|USD|\$)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2})?)/i);
  return match?.[1] ? toAmount(match[1]) : null;
}

function findDate(text: string): string | null {
  const patterns = [
    /\b(\d{4}-\d{2}-\d{2})\b/,
    /\b(\d{2}\/\d{2}\/\d{4})\b/,
    /\b([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const iso = toIsoDate(match[1]);
      if (iso) return iso;
    }
  }
  return null;
}

export function previewDocumentTextFile(params: {
  fileName: string;
  textPreview: string;
  properties: ExpensePropertyOption[];
  units: ExpenseUnitOption[];
  aiSummary?: string | null;
}) {
  const text = String(params.textPreview || "").trim();
  const baseWarnings = ["AI-assisted extraction needs review before import."];
  if (!text) {
    baseWarnings.push("No readable text was extracted from this file.");
  }

  const row = buildPreviewRow({
    rowId: `${params.fileName}-1`,
    sourceFileName: params.fileName,
    propertyText: "",
    unitText: "",
    categoryText: inferCategoryFromText(text || "") || undefined,
    vendorText: firstLine(text || ""),
    descriptionText: firstLine(text || "") || "Imported document",
    notesText: params.aiSummary || undefined,
    dateText: findDate(text || "") || undefined,
    amountText: findAmount(text || "") ?? undefined,
    currencyText: "CAD",
    properties: params.properties,
    units: params.units,
    baseWarnings,
  });

  return {
    files: [{ name: params.fileName, type: "document", rowsParsed: 1 }],
    rows: [row],
    summary: summarize([row]),
  } satisfies ExpenseImportPreviewResult;
}

export async function confirmExpenseImport(params: {
  rows: ExpenseImportConfirmRow[];
  properties: ExpensePropertyOption[];
  units: ExpenseUnitOption[];
  createExpense: (payload: {
    propertyId: string;
    unitId: string | null;
    category: string;
    vendorName: string;
    amountCents: number;
    incurredAtMs: number;
    notes: string;
    sourceDocumentName: string;
    sourceDocumentMimeType?: string | null;
    aiSummary?: string | null;
  }) => Promise<void>;
}) {
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of params.rows) {
    if (row.include === false) {
      skipped += 1;
      continue;
    }

    const property = resolveProperty(params.properties, row.propertyId || "", row.property || "");
    const unit =
      property && row.unit
        ? resolveUnit(params.units, property.id, row.unitId || "", row.unit || "")
        : null;
    const category = normalizeCategory(row.category);
    const date = toIsoDate(row.date);
    const amount = typeof row.amount === "number" ? row.amount : toAmount(row.amount);

    if (!property || !category || !date || amount == null || amount < 0) {
      skipped += 1;
      errors.push(`Row ${row.rowId}: missing property, category, amount, or date.`);
      continue;
    }
    if (row.unit && !unit) {
      skipped += 1;
      errors.push(`Row ${row.rowId}: unit needs review before import.`);
      continue;
    }

    await params.createExpense({
      propertyId: property.id,
      unitId: unit?.id || null,
      category,
      vendorName: row.vendor || "",
      amountCents: Math.round(amount * 100),
      incurredAtMs: Date.parse(`${date}T00:00:00.000Z`),
      notes: row.notes || row.description || "",
      sourceDocumentName: row.sourceFileName,
      sourceDocumentMimeType: null,
      aiSummary: row.warnings.length ? row.warnings.join(" | ") : null,
    });
    imported += 1;
  }

  return { imported, skipped, errors };
}
