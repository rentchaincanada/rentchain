import { z } from "zod";

export const UnitCsvRowSchema = z.object({
  unitNumber: z.string().min(1),
  rent: z.coerce.number().nonnegative().optional(),
  bedrooms: z.coerce.number().int().min(0).max(10).optional(),
  bathrooms: z.coerce.number().min(0).max(10).optional(),
  sqft: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(["vacant", "occupied"]).optional(),
});

export type UnitCsvRow = z.infer<typeof UnitCsvRowSchema>;

export type ManualUnitValidationIssue = {
  index: number;
  position: number;
  field: "unitNumber" | "marketRent" | "beds" | "baths" | "sqft" | "status";
  message: string;
};

export type ManualUnitValidationResult = {
  valid: boolean;
  units: Array<{
    unitNumber: string;
    rent: number | null;
    bedrooms: number | null;
    bathrooms: number | null;
    sqft: number | null;
    status: "vacant" | "occupied" | null;
  }>;
  issues: ManualUnitValidationIssue[];
};

export const UNIT_CSV_FIELD_MAP = [
  {
    field: "unitNumber",
    canonicalHeader: "unitNumber",
    required: true,
    aliases: ["unit", "unitnumber", "unitno", "number", "suite", "unit name", "unit name/number"],
  },
  {
    field: "rent",
    canonicalHeader: "marketRent",
    required: false,
    aliases: ["rent", "rentamount", "amount", "marketrent", "market rent", "monthlyrent", "monthly rent"],
  },
  {
    field: "bedrooms",
    canonicalHeader: "beds",
    required: false,
    aliases: ["bed", "beds", "bedrooms"],
  },
  {
    field: "bathrooms",
    canonicalHeader: "baths",
    required: false,
    aliases: ["bath", "baths", "bathrooms"],
  },
  {
    field: "sqft",
    canonicalHeader: "sqft",
    required: false,
    aliases: ["sqft", "squarefeet", "square feet", "size"],
  },
  {
    field: "status",
    canonicalHeader: "status",
    required: false,
    aliases: ["status", "occupancy", "occupancy status"],
  },
] as const;

export const EXPECTED_UNIT_CSV_HEADERS = UNIT_CSV_FIELD_MAP.map((entry) => entry.canonicalHeader);

export function normalizeHeader(h: string) {
  return cleanText(h)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function cleanText(value: any) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/^[\uFFFD]+/, "")
    .replace(/\u0000/g, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/\u00A0/g, " ");
}

function cleanCell(value: any) {
  if (value === undefined || value === null) return undefined;
  const text = cleanText(value).trim();
  return text === "" ? undefined : text;
}

function cleanNumericCell(value: any) {
  const text = cleanCell(value);
  if (text === undefined) return undefined;
  const normalized = text.replace(/[$£€]/g, "").replace(/(?<=\d)[,\s](?=\d{3}(\D|$))/g, "");
  return normalized.trim();
}

function normalizeStatus(value: any) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return undefined;
  if (["vacant", "available", "empty"].includes(text)) return "vacant";
  if (["occupied", "leased", "rented"].includes(text)) return "occupied";
  return text;
}

function hasManualUnitValue(unit: any) {
  if (!unit || typeof unit !== "object") return false;
  const values = [
    unit.unitNumber,
    unit.unit,
    unit.label,
    unit.rent,
    unit.marketRent,
    unit.monthlyRent,
    unit.bedrooms,
    unit.beds,
    unit.bathrooms,
    unit.baths,
    unit.sqft,
    unit.squareFeet,
    unit.status,
  ];
  return values.some((value) => {
    if (value === undefined || value === null) return false;
    return String(value).trim() !== "";
  });
}

function coerceOptionalNumber(value: any) {
  if (value === undefined || value === null || String(value).trim() === "") return undefined;
  return value;
}

function publicFieldName(field: string): ManualUnitValidationIssue["field"] {
  if (field === "rent") return "marketRent";
  if (field === "bedrooms") return "beds";
  if (field === "bathrooms") return "baths";
  if (field === "sqft") return "sqft";
  if (field === "status") return "status";
  return "unitNumber";
}

function fieldLabel(field: ManualUnitValidationIssue["field"]) {
  switch (field) {
    case "unitNumber":
      return "Unit number";
    case "marketRent":
      return "Rent";
    case "beds":
      return "Beds";
    case "baths":
      return "Baths";
    case "sqft":
      return "Square feet";
    case "status":
      return "Status";
  }
}

function manualMessage(field: ManualUnitValidationIssue["field"], zodMessage: string) {
  const label = fieldLabel(field);
  if (zodMessage.includes("Required")) return `${label} is required.`;
  if (field === "marketRent") return "Rent must be a number greater than or equal to 0.";
  if (field === "beds") return "Beds must be a whole number from 0 to 10.";
  if (field === "baths") return "Baths must be a number from 0 to 10.";
  if (field === "sqft") return "Square feet must be a whole number greater than or equal to 0.";
  if (field === "status") return "Status must be vacant or occupied.";
  return `${label} is invalid.`;
}

export function resolveUnitCsvField(header: string): (typeof UNIT_CSV_FIELD_MAP)[number] | undefined {
  const normalized = normalizeHeader(header);
  return UNIT_CSV_FIELD_MAP.find((entry) =>
    entry.aliases.some((alias) => normalizeHeader(alias) === normalized)
  );
}

export function mapRow(raw: Record<string, any>) {
  const out: any = {};
  for (const [k, v] of Object.entries(raw)) {
    const entry = resolveUnitCsvField(k);
    if (!entry) continue;
    const value =
      entry.field === "status"
        ? normalizeStatus(v)
        : ["rent", "bedrooms", "bathrooms", "sqft"].includes(entry.field)
          ? cleanNumericCell(v)
          : cleanCell(v);
    if (value === undefined) continue;
    out[entry.field] = value;
  }
  return out;
}

export function validateManualUnitInputs(units: any[]): ManualUnitValidationResult {
  const normalized: ManualUnitValidationResult["units"] = [];
  const issues: ManualUnitValidationIssue[] = [];

  (Array.isArray(units) ? units : []).forEach((unit, index) => {
    if (!hasManualUnitValue(unit)) return;

    const mapped = {
      unitNumber: cleanCell(unit?.unitNumber ?? unit?.unit ?? unit?.label),
      rent: coerceOptionalNumber(unit?.marketRent ?? unit?.rent ?? unit?.monthlyRent),
      bedrooms: coerceOptionalNumber(unit?.beds ?? unit?.bedrooms),
      bathrooms: coerceOptionalNumber(unit?.baths ?? unit?.bathrooms),
      sqft: coerceOptionalNumber(unit?.sqft ?? unit?.squareFeet),
      status: normalizeStatus(unit?.status),
    };

    const unitNumberMissing = mapped.unitNumber === undefined;
    const rentMissing = mapped.rent === undefined;
    const parsed = UnitCsvRowSchema.safeParse(mapped);
    if (!parsed.success || unitNumberMissing || rentMissing) {
      if (unitNumberMissing) {
        issues.push({
          index,
          position: index + 1,
          field: "unitNumber",
          message: "Unit number is required.",
        });
      }
      if (rentMissing) {
        issues.push({
          index,
          position: index + 1,
          field: "marketRent",
          message: "Rent is required.",
        });
      }
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = publicFieldName(String(issue.path[0] || "unitNumber"));
          if (field === "unitNumber" && unitNumberMissing) continue;
          if (field === "marketRent" && rentMissing) continue;
          issues.push({
            index,
            position: index + 1,
            field,
            message: manualMessage(field, issue.message),
          });
        }
      }
      return;
    }

    normalized.push({
      unitNumber: parsed.data.unitNumber.trim(),
      rent: parsed.data.rent ?? null,
      bedrooms: parsed.data.bedrooms ?? null,
      bathrooms: parsed.data.bathrooms ?? null,
      sqft: parsed.data.sqft ?? null,
      status: parsed.data.status ?? null,
    });
  });

  return {
    valid: issues.length === 0,
    units: normalized,
    issues,
  };
}
