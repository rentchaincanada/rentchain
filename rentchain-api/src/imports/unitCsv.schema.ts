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
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function cleanCell(value: any) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text === "" ? undefined : text;
}

function normalizeStatus(value: any) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return undefined;
  if (["vacant", "available", "empty"].includes(text)) return "vacant";
  if (["occupied", "leased", "rented"].includes(text)) return "occupied";
  return text;
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
    const value = entry.field === "status" ? normalizeStatus(v) : cleanCell(v);
    if (value === undefined) continue;
    out[entry.field] = value;
  }
  return out;
}
