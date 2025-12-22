import Papa from "papaparse";
import { UnitCsvRowSchema, mapRow } from "./unitCsv.schema";

export type ImportError = { row: number; code: string; message: string; raw?: any };
export type ImportResult<T> = {
  ok: boolean;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  errors: ImportError[];
  items: T[];
};

export function parseAndValidateUnitsCsv(csvText: string): ImportResult<any> {
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  const data = (parsed.data || []) as any[];

  const errors: ImportError[] = [];
  const items: any[] = [];

  data.forEach((raw, idx) => {
    const rowNum = idx + 2; // header is row 1
    const mapped = mapRow(raw);
    const v = UnitCsvRowSchema.safeParse(mapped);

    if (!v.success) {
      errors.push({
        row: rowNum,
        code: "ROW_INVALID",
        message: "Invalid row",
        raw,
      });
      return;
    }

    const unitNumber = String(v.data.unitNumber || "").trim();
    if (!unitNumber) {
      errors.push({ row: rowNum, code: "UNIT_REQUIRED", message: "unitNumber is required", raw });
      return;
    }

    items.push({ ...v.data, unitNumber });
  });

  const seen = new Set<string>();
  for (const it of items) {
    const key = it.unitNumber;
    if (seen.has(key)) {
      errors.push({ row: -1, code: "DUPLICATE_IN_CSV", message: `Duplicate unitNumber in CSV: ${key}` });
    }
    seen.add(key);
  }

  return {
    ok: errors.length === 0,
    totalRows: data.length,
    validCount: items.length,
    invalidCount: errors.length,
    errors,
    items,
  };
}
