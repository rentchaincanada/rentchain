import Papa from "papaparse";
import {
  EXPECTED_UNIT_CSV_HEADERS,
  UNIT_CSV_FIELD_MAP,
  UnitCsvRowSchema,
  mapRow,
  resolveUnitCsvField,
} from "./unitCsv.schema";

export type RowIssue = {
  row: number;
  code: string;
  message: string;
  field?: string;
  unitNumber?: string;
};

export type UnitCsvPreviewRow = {
  row: number;
  status: "valid" | "invalid" | "skipped";
  unitNumber?: string;
  data: Record<string, any>;
  issues: RowIssue[];
};

export type ParsedUnitsCsv = {
  totalRows: number;
  candidates: { row: number; unitNumber: string; data: any }[];
  invalid: RowIssue[];
  duplicatesInCsv: RowIssue[];
  headers: {
    valid: boolean;
    received: string[];
    expected: string[];
    missing: string[];
    unknown: string[];
  };
  rows: UnitCsvPreviewRow[];
  preview: {
    rows: UnitCsvPreviewRow[];
    errors: RowIssue[];
  };
};

export function parseUnitsCsv(csvText: string): ParsedUnitsCsv {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: false });
  const data = (parsed.data || []) as any[];
  const receivedHeaders = (parsed.meta.fields || []).map((header) => String(header || "").replace(/^\uFEFF/, "").trim());
  const knownFields = new Set<string>();
  const unknown = receivedHeaders.filter((header) => {
    if (!header) return false;
    const field = resolveUnitCsvField(header)?.field;
    if (field) knownFields.add(field);
    return !field;
  });
  const missing = UNIT_CSV_FIELD_MAP.filter((entry) => entry.required && !knownFields.has(entry.field)).map(
    (entry) => entry.canonicalHeader
  );
  const headerIssues: RowIssue[] = [
    ...missing.map((header) => ({
      row: 1,
      code: "HEADER_MISSING",
      field: header,
      message: `Required header '${header}' is missing. Expected headers: ${EXPECTED_UNIT_CSV_HEADERS.join(", ")}`,
    })),
    ...unknown.map((header) => ({
      row: 1,
      code: "HEADER_UNKNOWN",
      field: header,
      message: `Unknown header '${header}'. Expected headers: ${EXPECTED_UNIT_CSV_HEADERS.join(", ")}`,
    })),
  ];

  const invalid: RowIssue[] = [...headerIssues];
  const candidates: { row: number; unitNumber: string; data: any }[] = [];
  const rows: UnitCsvPreviewRow[] = [];

  data.forEach((raw, idx) => {
    const rowNum = idx + 2; // header row is 1
    const isEmpty = Object.values(raw || {}).every((value) => String(value ?? "").trim() === "");
    if (isEmpty) {
      const issue = {
        row: rowNum,
        code: "ROW_EMPTY",
        message: `Row ${rowNum}: entire row is empty, skipping.`,
      };
      rows.push({ row: rowNum, status: "skipped", data: {}, issues: [issue] });
      return;
    }

    const mapped = mapRow(raw);
    const v = UnitCsvRowSchema.safeParse(mapped);
    if (!v.success) {
      const issues = v.error.issues.map((issue) => {
        const field = String(issue.path[0] || "row");
        return {
          row: rowNum,
          code: "ROW_INVALID",
          field,
          message: `Row ${rowNum}: ${field} - ${issue.message}`,
          unitNumber: mapped.unitNumber ? String(mapped.unitNumber).trim() : undefined,
        };
      });
      invalid.push(...issues);
      rows.push({ row: rowNum, status: "invalid", unitNumber: mapped.unitNumber, data: mapped, issues });
      return;
    }
    const unitNumber = String(v.data.unitNumber || "").trim();
    if (!unitNumber) {
      const issue = {
        row: rowNum,
        code: "UNIT_REQUIRED",
        field: "unitNumber",
        message: `Row ${rowNum}: unitNumber - unitNumber is required`,
      };
      invalid.push(issue);
      rows.push({ row: rowNum, status: "invalid", data: mapped, issues: [issue] });
      return;
    }
    const data = { ...v.data, unitNumber };
    candidates.push({ row: rowNum, unitNumber, data });
    rows.push({ row: rowNum, status: "valid", unitNumber, data, issues: [] });
  });

  const seen = new Map<string, number>();
  const duplicatesInCsv: RowIssue[] = [];
  for (const c of candidates) {
    const prev = seen.get(c.unitNumber);
    if (prev) {
      duplicatesInCsv.push({
        row: c.row,
        code: "DUPLICATE_IN_CSV",
        field: "unitNumber",
        message: `Duplicate unitNumber in CSV: ${c.unitNumber}`,
        unitNumber: c.unitNumber,
      });
    } else {
      seen.set(c.unitNumber, c.row);
    }
  }

  const unique: typeof candidates = [];
  const keep = new Set<string>();
  for (const c of candidates) {
    if (keep.has(c.unitNumber)) continue;
    keep.add(c.unitNumber);
    unique.push(c);
  }

  const duplicateRows = new Map(duplicatesInCsv.map((issue) => [issue.row, issue]));
  const previewRows = rows.map((row) => {
    const duplicate = duplicateRows.get(row.row);
    if (!duplicate) return row;
    return {
      ...row,
      status: "invalid" as const,
      issues: [...row.issues, duplicate],
    };
  });
  const errors = [...invalid, ...duplicatesInCsv];

  return {
    totalRows: data.length,
    candidates: unique,
    invalid,
    duplicatesInCsv,
    headers: {
      valid: missing.length === 0 && unknown.length === 0,
      received: receivedHeaders,
      expected: EXPECTED_UNIT_CSV_HEADERS,
      missing,
      unknown,
    },
    rows: previewRows,
    preview: {
      rows: previewRows,
      errors,
    },
  };
}
