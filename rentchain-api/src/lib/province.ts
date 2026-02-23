const PROVINCE_CODES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
  "UNSET",
] as const;

type ProvinceCode = (typeof PROVINCE_CODES)[number];

const PROVINCE_CODE_SET = new Set<string>(PROVINCE_CODES);

const PROVINCE_NAME_TO_CODE: Record<string, ProvinceCode> = {
  alberta: "AB",
  "british columbia": "BC",
  manitoba: "MB",
  "new brunswick": "NB",
  "newfoundland and labrador": "NL",
  "newfoundland labrador": "NL",
  novascotia: "NS",
  "nova scotia": "NS",
  northwestterritories: "NT",
  "northwest territories": "NT",
  nunavut: "NU",
  ontario: "ON",
  "prince edward island": "PE",
  quebec: "QC",
  saskatchewan: "SK",
  yukon: "YT",
  unset: "UNSET",
};

function normalizeProvinceName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeProvince(input?: unknown): ProvinceCode | null {
  const raw = String(input || "").trim();
  if (!raw) return "UNSET";
  const upper = raw.toUpperCase();
  if (PROVINCE_CODE_SET.has(upper)) return upper as ProvinceCode;
  const byName = PROVINCE_NAME_TO_CODE[normalizeProvinceName(raw)];
  return byName ?? null;
}

export function isProvinceSupported(input?: unknown): boolean {
  return normalizeProvince(input) !== null;
}
