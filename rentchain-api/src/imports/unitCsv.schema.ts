import { z } from "zod";

export const UnitCsvRowSchema = z.object({
  unitNumber: z.string().min(1),
  rent: z.coerce.number().nonnegative().optional(),
  bedrooms: z.coerce.number().int().min(0).max(10).optional(),
  bathrooms: z.coerce.number().min(0).max(10).optional(),
  sqft: z.coerce.number().int().nonnegative().optional(),
});

export type UnitCsvRow = z.infer<typeof UnitCsvRowSchema>;

export function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/\s+/g, "");
}

export function mapRow(raw: Record<string, any>) {
  const out: any = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = normalizeHeader(k);
    if (["unit", "unitnumber", "unitno", "number"].includes(key)) out.unitNumber = v;
    else if (["rent", "rentamount", "amount"].includes(key)) out.rent = v;
    else if (["bed", "beds", "bedrooms"].includes(key)) out.bedrooms = v;
    else if (["bath", "baths", "bathrooms"].includes(key)) out.bathrooms = v;
    else if (["sqft", "squarefeet", "size"].includes(key)) out.sqft = v;
  }
  return out;
}
