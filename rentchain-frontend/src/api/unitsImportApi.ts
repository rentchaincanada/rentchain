import api from "./client";

export type UnitCsvIssue = {
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
  data: {
    unitNumber?: string;
    rent?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    sqft?: number | null;
    status?: "vacant" | "occupied" | null;
  };
  issues: UnitCsvIssue[];
};

export type UnitCsvPreviewResponse = {
  ok: boolean;
  headers?: {
    valid: boolean;
    received: string[];
    expected: string[];
    missing: string[];
    unknown: string[];
  };
  summary?: {
    totalRows?: number;
    candidates?: number;
    insertable?: number;
    invalid?: number;
    duplicatesInCsv?: number;
    conflicts?: number;
    issueCount?: number;
  };
  preview?: {
    rows: UnitCsvPreviewRow[];
    errors: UnitCsvIssue[];
  };
  rows?: UnitCsvPreviewRow[];
  issues?: UnitCsvIssue[];
};

export async function previewUnitsCsv(csvText: string): Promise<UnitCsvPreviewResponse> {
  const res = await api.post(
    "/properties/units/csv-preview",
    { csvText },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}

export async function previewPropertyUnitsCsv(
  propertyId: string,
  csvText: string
): Promise<UnitCsvPreviewResponse> {
  const res = await api.post(
    `/properties/${propertyId}/units/csv-parse`,
    { csvText },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}

export async function importUnitsCsv(
  propertyId: string,
  csvText: string,
  mode: "dryRun" | "strict" | "partial" = "partial",
  idempotencyKey?: string
) {
  console.log("[unitsImportApi] POST", `/api/properties/${propertyId}/units/import`, {
    mode,
    hasCsvText: !!csvText,
  });
  const res = await api.post(
    `/api/properties/${propertyId}/units/import`,
    { csvText, mode, idempotencyKey },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data;
}
