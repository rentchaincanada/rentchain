export type ProvinceCode =
  | "AB"
  | "BC"
  | "MB"
  | "NB"
  | "NL"
  | "NS"
  | "NT"
  | "NU"
  | "ON"
  | "PE"
  | "QC"
  | "SK"
  | "YT"
  | "UNSET";

export const PROVINCE_OPTIONS: Array<{ code: ProvinceCode; label: string }> = [
  { code: "UNSET", label: "Select province" },
  { code: "AB", label: "Alberta" },
  { code: "BC", label: "British Columbia" },
  { code: "MB", label: "Manitoba" },
  { code: "NB", label: "New Brunswick" },
  { code: "NL", label: "Newfoundland and Labrador" },
  { code: "NS", label: "Nova Scotia" },
  { code: "NT", label: "Northwest Territories" },
  { code: "NU", label: "Nunavut" },
  { code: "ON", label: "Ontario" },
  { code: "PE", label: "Prince Edward Island" },
  { code: "QC", label: "Quebec" },
  { code: "SK", label: "Saskatchewan" },
  { code: "YT", label: "Yukon" },
];

const NAME_TO_CODE: Record<string, ProvinceCode> = {
  alberta: "AB",
  "british columbia": "BC",
  manitoba: "MB",
  "new brunswick": "NB",
  "newfoundland and labrador": "NL",
  "newfoundland labrador": "NL",
  "nova scotia": "NS",
  "northwest territories": "NT",
  nunavut: "NU",
  ontario: "ON",
  "prince edward island": "PE",
  quebec: "QC",
  saskatchewan: "SK",
  yukon: "YT",
  unset: "UNSET",
};

const CODE_SET = new Set(PROVINCE_OPTIONS.map((item) => item.code));

function normalizeName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

export function normalizeProvinceCode(input?: string | null): ProvinceCode | null {
  const raw = String(input || "").trim();
  if (!raw) return "UNSET";
  const upper = raw.toUpperCase() as ProvinceCode;
  if (CODE_SET.has(upper)) return upper;
  return NAME_TO_CODE[normalizeName(raw)] ?? null;
}

export function provinceLabelFromCode(input?: string | null): string {
  const code = normalizeProvinceCode(input);
  if (!code) return "Unknown province";
  const item = PROVINCE_OPTIONS.find((opt) => opt.code === code);
  return item?.label ?? code;
}

