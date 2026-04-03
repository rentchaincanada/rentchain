import crypto from "crypto";

export function nowIso() {
  return new Date().toISOString();
}

export function compactObject<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as T;
}

export function trimString(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

export function normalizePid(value: unknown): string | null {
  const trimmed = trimString(value);
  if (!trimmed) return null;
  const digits = trimmed.replace(/[^\d]/g, "");
  return digits || trimmed.toUpperCase();
}

export function normalizePostalCode(value: unknown): string | null {
  const trimmed = trimString(value);
  if (!trimmed) return null;
  const compact = trimmed.replace(/\s+/g, "").toUpperCase();
  return compact || null;
}

const ADDRESS_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bstreet\b/g, "st"],
  [/\bavenue\b/g, "ave"],
  [/\broad\b/g, "rd"],
  [/\bdrive\b/g, "dr"],
  [/\bboulevard\b/g, "blvd"],
  [/\blane\b/g, "ln"],
  [/\bplace\b/g, "pl"],
  [/\bcourt\b/g, "ct"],
  [/\bhighway\b/g, "hwy"],
  [/\bapartment\b/g, "apt"],
  [/\bunit\b/g, "unit"],
];

export function normalizeAddress(value: unknown): string | null {
  const trimmed = trimString(value);
  if (!trimmed) return null;
  let normalized = trimmed.toLowerCase().replace(/[.,#]/g, " ").replace(/\s+/g, " ").trim();
  for (const [pattern, replacement] of ADDRESS_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized || null;
}

export function normalizeAddressFromParts(parts: Array<unknown>): string | null {
  return normalizeAddress(parts.map((part) => trimString(part)).filter(Boolean).join(" "));
}

export function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const trimmed = trimString(value);
  if (!trimmed) return null;
  const numeric = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export function parseDateString(value: unknown): string | null {
  const trimmed = trimString(value);
  if (!trimmed) return null;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export function hashPayload(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

export function makeStableId(parts: Array<unknown>): string {
  const cleaned = parts
    .map((part) => String(part ?? "").trim())
    .filter(Boolean)
    .join("_")
    .replace(/[^a-zA-Z0-9_-]+/g, "_");
  return cleaned || crypto.randomUUID();
}

export function scoreAddressSimilarity(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap / Math.max(aTokens.size, bTokens.size);
}
