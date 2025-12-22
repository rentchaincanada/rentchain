import Papa from "papaparse";
import { UnitCsvRowSchema, mapRow } from "./unitCsv.schema";

export type RowIssue = {
  row: number;
  code: string;
  message: string;
  unitNumber?: string;
};

export type ParsedUnitsCsv = {
  totalRows: number;
  candidates: { row: number; unitNumber: string; data: any }[];
  invalid: RowIssue[];
  duplicatesInCsv: RowIssue[];
};

export function parseUnitsCsv(csvText: string): ParsedUnitsCsv {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const data = (parsed.data || []) as any[];

  const invalid: RowIssue[] = [];
  const candidates: { row: number; unitNumber: string; data: any }[] = [];

  data.forEach((raw, idx) => {
    const rowNum = idx + 2; // header row is 1
    const mapped = mapRow(raw);
    const v = UnitCsvRowSchema.safeParse(mapped);
    if (!v.success) {
      invalid.push({ row: rowNum, code: "ROW_INVALID", message: "Invalid row shape", unitNumber: undefined });
      return;
    }
    const unitNumber = String(v.data.unitNumber || "").trim();
    if (!unitNumber) {
      invalid.push({ row: rowNum, code: "UNIT_REQUIRED", message: "unitNumber is required" });
      return;
    }
    candidates.push({ row: rowNum, unitNumber, data: { ...v.data, unitNumber } });
  });

  const seen = new Map<string, number>();
  const duplicatesInCsv: RowIssue[] = [];
  for (const c of candidates) {
    const prev = seen.get(c.unitNumber);
    if (prev) {
      duplicatesInCsv.push({
        row: c.row,
        code: "DUPLICATE_IN_CSV",
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

  return { totalRows: data.length, candidates: unique, invalid, duplicatesInCsv };
}
