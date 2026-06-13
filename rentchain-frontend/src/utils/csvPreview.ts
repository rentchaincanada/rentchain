import type { UnitInput } from "../api/unitsApi";
import type { UnitCsvIssue, UnitCsvPreviewRow } from "../api/unitsImportApi";

export function normalizeCsvPreviewText(text: string) {
  return String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/^[\uFFFD]+/, "")
    .replace(/\u0000/g, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export function parseCsvPreview(text: string, maxRows = 10) {
  const lines = normalizeCsvPreviewText(text)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return { headers: [], rows: [] as string[][] };

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        out.push(cur.replace(/^\uFEFF/, "").trim());
        cur = "";
        continue;
      }
      cur += ch;
    }
    out.push(cur.replace(/^\uFEFF/, "").trim());
    return out;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1, 1 + maxRows).map(parseLine);

  return { headers, rows };
}

const HEADER_ALIASES: Record<string, keyof UnitInput | "rent"> = {
  unitnumber: "unitNumber",
  unit: "unitNumber",
  unitno: "unitNumber",
  unitnum: "unitNumber",
  marketrent: "marketRent",
  rent: "marketRent",
  monthlyrent: "marketRent",
  beds: "beds",
  bedrooms: "beds",
  baths: "baths",
  bathrooms: "baths",
  sqft: "sqft",
  squarefeet: "sqft",
  status: "status",
  occupancystatus: "status",
  occupantname: "occupantName",
  tenantname: "tenantName",
  leaseenddate: "leaseEndDate",
  enddate: "leaseEndDate",
  leaseend: "leaseEndDate",
};

const OCCUPANCY_METADATA_HEADERS = new Set(["occupantName", "tenantName", "leaseEndDate"]);

function normalizeHeaderName(header: string) {
  return String(header || "")
    .trim()
    .replace(/^\uFEFF/, "")
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}

function normalizeStatus(value: unknown): "vacant" | "occupied" {
  const status = String(value || "").trim().toLowerCase();
  if (status === "occupied" || status === "leased" || status === "rented") return "occupied";
  return "vacant";
}

function parseOptionalNumber(value: unknown): number | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const normalized = raw.replace(/[$,\s]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function csvUsesOccupancyMetadataHeaders(headers: string[]) {
  return headers.some((header) => {
    const field = HEADER_ALIASES[normalizeHeaderName(header)];
    return OCCUPANCY_METADATA_HEADERS.has(String(field));
  });
}

export function parseUnitsCsvForManualImport(text: string): {
  headers: string[];
  rows: string[][];
  units: UnitInput[];
  previewRows: UnitCsvPreviewRow[];
  issues: UnitCsvIssue[];
} {
  const parsed = parseCsvPreview(text, Number.POSITIVE_INFINITY);
  const headers = parsed.headers;
  const rows = parsed.rows;
  const mappedHeaders = headers.map((header) => HEADER_ALIASES[normalizeHeaderName(header)] || null);
  const issues: UnitCsvIssue[] = [];

  headers.forEach((header, index) => {
    if (!String(header || "").trim()) return;
    if (!mappedHeaders[index]) {
      issues.push({
        row: 1,
        code: "HEADER_UNKNOWN",
        field: header,
        message: `Unknown header '${header}'. Expected headers: unitNumber, marketRent, beds, baths, sqft, status, occupantName, leaseEndDate`,
      });
    }
  });

  if (!mappedHeaders.includes("unitNumber")) {
    issues.push({
      row: 1,
      code: "HEADER_MISSING",
      field: "unitNumber",
      message: "Missing required header 'unitNumber'.",
    });
  }

  const units: UnitInput[] = [];
  const previewRows: UnitCsvPreviewRow[] = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const raw: Record<string, string> = {};
    mappedHeaders.forEach((field, columnIndex) => {
      if (!field) return;
      raw[field] = row[columnIndex] ?? "";
    });

    const status = normalizeStatus(raw.status);
    const occupantName = String(raw.occupantName || raw.tenantName || "").trim();
    const leaseEndDate = String(raw.leaseEndDate || "").trim();
    const unitNumber = String(raw.unitNumber || "").trim();
    const unitIssues: UnitCsvIssue[] = [];

    if (!unitNumber) {
      unitIssues.push({
        row: rowNumber,
        code: "UNIT_NUMBER_REQUIRED",
        field: "unitNumber",
        message: "Unit number is required.",
      });
    }

    const unit: UnitInput = {
      unitNumber,
      marketRent: parseOptionalNumber(raw.marketRent),
      beds: parseOptionalNumber(raw.beds),
      baths: parseOptionalNumber(raw.baths),
      sqft: parseOptionalNumber(raw.sqft),
      status,
      occupantName: status === "occupied" ? occupantName || null : null,
      tenantName: status === "occupied" ? occupantName || null : null,
      leaseEndDate: status === "occupied" ? leaseEndDate || null : null,
    };

    if (unitNumber && unitIssues.length === 0) {
      units.push(unit);
    }

    issues.push(...unitIssues);

    return {
      row: rowNumber,
      status: unitIssues.length ? "invalid" : "valid",
      unitNumber,
      data: {
        unitNumber,
        rent: unit.marketRent ?? null,
        bedrooms: unit.beds ?? null,
        bathrooms: unit.baths ?? null,
        sqft: unit.sqft ?? null,
        status,
        occupantName: unit.occupantName ?? null,
        tenantName: unit.tenantName ?? null,
        leaseEndDate: unit.leaseEndDate ?? null,
      },
      issues: unitIssues,
    };
  });

  return { headers, rows, units, previewRows, issues };
}
