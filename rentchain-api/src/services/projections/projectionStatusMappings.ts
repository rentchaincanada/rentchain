export function asProjectionString(value: unknown, max = 240): string | null {
  const next = String(value || "").trim().slice(0, max);
  return next || null;
}

export function asProjectionNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export function normalizeProjectionStatus(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}
