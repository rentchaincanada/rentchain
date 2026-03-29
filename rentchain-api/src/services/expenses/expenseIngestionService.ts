import Papa from "papaparse";
import type {
  ExpenseImportConfirmRow,
  ExpenseExistingLookupRow,
  ExpenseImportDuplicateMatch,
  ExpenseImportPreviewResult,
  ExpenseImportPreviewRow,
  ExpensePropertyOption,
  ExpenseImportWarningCode,
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
    lowConfidence: rows.filter((row) => row.lowConfidence || (row.confidence ?? 0) < 0.75).length,
    unresolvedProperty: rows.filter((row) => !row.propertyId).length,
    unresolvedUnit: rows.filter((row) => Boolean(row.unit) && !row.unitId).length,
    duplicateCount: rows.filter((row) => row.duplicateStatus !== "none").length,
    likelyDuplicateCount: rows.filter((row) => row.duplicateStatus === "likely_duplicate").length,
  };
}

function dedupeWarnings(warnings: string[]) {
  return Array.from(new Set(warnings.filter(Boolean)));
}

function dedupeWarningCodes(codes: ExpenseImportWarningCode[]) {
  return Array.from(new Set(codes));
}

function pushWarning(
  warnings: string[],
  warningCodes: ExpenseImportWarningCode[],
  code: ExpenseImportWarningCode,
  label: string
) {
  warnings.push(label);
  warningCodes.push(code);
}

function computeConfidence(params: {
  propertyResolved: boolean;
  unitNeedsReview: boolean;
  categoryResolved: boolean;
  amountResolved: boolean;
  dateResolved: boolean;
  vendorPresent: boolean;
  descriptionPresent: boolean;
  hasAiReviewWarning: boolean;
}) {
  let confidence = 0.98;
  if (!params.propertyResolved) confidence -= 0.28;
  if (params.unitNeedsReview) confidence -= 0.08;
  if (!params.categoryResolved) confidence -= 0.18;
  if (!params.amountResolved) confidence -= 0.3;
  if (!params.dateResolved) confidence -= 0.24;
  if (!params.vendorPresent) confidence -= 0.08;
  if (!params.descriptionPresent) confidence -= 0.05;
  if (params.hasAiReviewWarning) confidence -= 0.05;
  confidence = Math.max(0.18, Math.min(0.98, confidence));
  return {
    confidence,
    lowConfidence:
      confidence < 0.75 ||
      !params.propertyResolved ||
      !params.categoryResolved ||
      !params.amountResolved ||
      !params.dateResolved,
  };
}

function normalizeTextForMatch(value: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function buildDuplicateMatch(entry: {
  expenseId?: string | null;
  source: "existing" | "batch";
  date?: string | null;
  vendor?: string | null;
  description?: string | null;
  amount?: number | null;
  property?: string | null;
}): ExpenseImportDuplicateMatch {
  return {
    expenseId: entry.expenseId || null,
    source: entry.source,
    date: entry.date || null,
    vendor: entry.vendor || null,
    description: entry.description || null,
    amount: entry.amount ?? null,
    property: entry.property || null,
  };
}

function analyzeDuplicatePair(
  row: Pick<ExpenseImportPreviewRow, "date" | "amount" | "vendor" | "description" | "property" | "propertyId">,
  candidate: Pick<ExpenseExistingLookupRow, "date" | "amount" | "vendor" | "description" | "property" | "propertyId">
) {
  if (!row.date || row.amount == null || !candidate.date || candidate.amount == null) return null;
  if (row.date !== candidate.date) return null;
  if (Math.abs(Number(row.amount) - Number(candidate.amount)) > 0.009) return null;

  const rowVendor = normalizeTextForMatch(row.vendor);
  const rowDescription = normalizeTextForMatch(row.description);
  const rowPropertyId = normalizeTextForMatch(row.propertyId);
  const rowProperty = normalizeTextForMatch(row.property);
  const candidateVendor = normalizeTextForMatch(candidate.vendor);
  const candidateDescription = normalizeTextForMatch(candidate.description);
  const candidatePropertyId = normalizeTextForMatch(candidate.propertyId);
  const candidateProperty = normalizeTextForMatch(candidate.property);

  const sameVendor = Boolean(rowVendor && candidateVendor && rowVendor === candidateVendor);
  const sameDescription = Boolean(rowDescription && candidateDescription && rowDescription === candidateDescription);
  const sameProperty =
    Boolean(rowPropertyId && candidatePropertyId && rowPropertyId === candidatePropertyId) ||
    Boolean(rowProperty && candidateProperty && rowProperty === candidateProperty);

  if (sameVendor && (sameProperty || sameDescription || !row.propertyId)) {
    return {
      status: "likely_duplicate" as const,
      reason: sameProperty
        ? "Likely duplicate of an expense with the same date, amount, property, and vendor."
        : "Likely duplicate of an expense with the same date, amount, and vendor.",
    };
  }

  if (sameDescription || (sameProperty && sameVendor)) {
    return {
      status: "possible_duplicate" as const,
      reason: "Possible duplicate with the same date and amount plus matching property or description.",
    };
  }

  return null;
}

function applyDuplicateAnalysis(params: {
  rows: ExpenseImportPreviewRow[];
  existingExpenses?: ExpenseExistingLookupRow[];
}) {
  const rows = params.rows.map((row) => ({
    ...row,
    duplicateStatus: row.duplicateStatus || "none",
    duplicateReason: row.duplicateReason || null,
    duplicateMatches: Array.isArray(row.duplicateMatches) ? [...row.duplicateMatches] : [],
    warningCodes: dedupeWarningCodes(row.warningCodes || []),
    warnings: dedupeWarnings(row.warnings || []),
  }));

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    let highestStatus: ExpenseImportPreviewRow["duplicateStatus"] = row.duplicateStatus;
    let reason = row.duplicateReason || null;
    const matches = [...(row.duplicateMatches || [])];

    for (const existing of params.existingExpenses || []) {
      const result = analyzeDuplicatePair(row, existing);
      if (!result) continue;
      matches.push(
        buildDuplicateMatch({
          expenseId: existing.expenseId || null,
          source: "existing",
          date: existing.date || null,
          vendor: existing.vendor || null,
          description: existing.description || null,
          amount: existing.amount ?? null,
          property: existing.property || null,
        })
      );
      if (result.status === "likely_duplicate" || highestStatus === "none") {
        highestStatus = result.status;
        reason = result.reason;
      }
    }

    for (let inner = 0; inner < rows.length; inner += 1) {
      if (inner === index) continue;
      const candidate = rows[inner];
      const result = analyzeDuplicatePair(row, candidate);
      if (!result) continue;
      matches.push(
        buildDuplicateMatch({
          source: "batch",
          date: candidate.date,
          vendor: candidate.vendor,
          description: candidate.description,
          amount: candidate.amount,
          property: candidate.property,
        })
      );
      if (result.status === "likely_duplicate" || highestStatus === "none") {
        highestStatus = result.status === "likely_duplicate" ? "likely_duplicate" : "possible_duplicate";
        reason =
          result.status === "likely_duplicate"
            ? "Likely duplicate of another row in this import batch."
            : "Possible duplicate of another row in this import batch.";
      }
    }

    if (matches.length) {
      row.duplicateStatus = highestStatus === "none" ? "possible_duplicate" : highestStatus;
      row.duplicateReason = reason;
      row.duplicateMatches = matches.slice(0, 6);
      pushWarning(
        row.warnings,
        row.warningCodes,
        row.duplicateStatus === "likely_duplicate" ? "likely_duplicate" : "possible_duplicate",
        row.duplicateReason ||
          (row.duplicateStatus === "likely_duplicate"
            ? "Likely duplicate of an existing expense."
            : "Possible duplicate detected.")
      );
    } else {
      row.duplicateStatus = "none";
      row.duplicateReason = null;
      row.duplicateMatches = [];
    }

    row.warningCodes = dedupeWarningCodes(row.warningCodes);
    row.warnings = dedupeWarnings(row.warnings);
    if (row.duplicateStatus === "likely_duplicate") {
      row.include = false;
    } else if (row.include == null && row.lowConfidence) {
      row.include = false;
    }
  }

  return rows;
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
  const warningCodes: ExpenseImportWarningCode[] = [];

  if (warnings.some((warning) => /AI-assisted extraction needs review/i.test(warning))) {
    warningCodes.push("ai_review_required");
  }
  if (warnings.some((warning) => /No readable text/i.test(warning))) {
    warningCodes.push("no_text_extracted");
  }

  if (!property) pushWarning(warnings, warningCodes, "unresolved_property", "Missing property match");
  if (input.unitText && !unit) pushWarning(warnings, warningCodes, "unresolved_unit", "Missing unit match");
  if (!category) pushWarning(warnings, warningCodes, "missing_category", "Missing category");
  if (amount == null) pushWarning(warnings, warningCodes, "missing_amount", "Missing amount");
  if (!date) pushWarning(warnings, warningCodes, "missing_date", "Missing date");
  if (!String(input.vendorText || "").trim()) pushWarning(warnings, warningCodes, "weak_vendor_match", "Vendor needs review");
  if (!String(input.descriptionText || "").trim())
    pushWarning(warnings, warningCodes, "weak_description", "Description needs review");

  const confidenceResult = computeConfidence({
    propertyResolved: Boolean(property),
    unitNeedsReview: Boolean(input.unitText && !unit),
    categoryResolved: Boolean(category),
    amountResolved: amount != null,
    dateResolved: Boolean(date),
    vendorPresent: Boolean(String(input.vendorText || "").trim()),
    descriptionPresent: Boolean(String(input.descriptionText || "").trim()),
    hasAiReviewWarning: warningCodes.includes("ai_review_required"),
  });

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
    confidence: confidenceResult.confidence,
    warnings: dedupeWarnings(warnings),
    warningCodes: dedupeWarningCodes(warningCodes),
    duplicateStatus: "none",
    duplicateReason: null,
    duplicateMatches: [],
    lowConfidence: confidenceResult.lowConfidence,
    include: confidenceResult.lowConfidence ? false : true,
  } satisfies ExpenseImportPreviewRow;
}

export function previewDelimitedExpenseFile(params: {
  fileName: string;
  csvText: string;
  properties: ExpensePropertyOption[];
  units: ExpenseUnitOption[];
  defaultPropertyId?: string | null;
  existingExpenses?: ExpenseExistingLookupRow[];
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

  const finalizedRows = applyDuplicateAnalysis({
    rows,
    existingExpenses: params.existingExpenses,
  });

  return {
    files: [{ name: params.fileName, type: "text/csv", rowsParsed: rows.length }],
    rows: finalizedRows,
    summary: summarize(finalizedRows),
  } satisfies ExpenseImportPreviewResult;
}

export function previewSpreadsheetXmlFile(params: {
  fileName: string;
  xmlText: string;
  properties: ExpensePropertyOption[];
  units: ExpenseUnitOption[];
  defaultPropertyId?: string | null;
  existingExpenses?: ExpenseExistingLookupRow[];
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
    existingExpenses: params.existingExpenses,
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
  existingExpenses?: ExpenseExistingLookupRow[];
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

  const finalizedRows = applyDuplicateAnalysis({
    rows: [row],
    existingExpenses: params.existingExpenses,
  });

  return {
    files: [{ name: params.fileName, type: "document", rowsParsed: 1 }],
    rows: finalizedRows,
    summary: summarize(finalizedRows),
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
  let duplicateImported = 0;
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
    if (row.duplicateStatus && row.duplicateStatus !== "none") {
      duplicateImported += 1;
    }
  }

  return { imported, skipped, duplicateImported, errors };
}
