export type CsvCell = string | number | boolean | null | undefined;

export function csvEscape(value: CsvCell): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsvText(headers: string[], rows: CsvCell[][]): string {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
}

export function buildCsvBlob(headers: string[], rows: CsvCell[][]): Blob {
  const csv = buildCsvText(headers, rows);
  return new Blob([csv], { type: "text/csv;charset=utf-8" });
}
