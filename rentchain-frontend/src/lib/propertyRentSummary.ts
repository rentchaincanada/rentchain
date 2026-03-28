function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function resolveConfiguredUnitRent(unit: any): number | null {
  if (!unit || typeof unit !== "object") return null;
  return (
    toNumberOrNull(unit.rent) ??
    toNumberOrNull(unit.marketRent) ??
    toNumberOrNull(unit.askingRent) ??
    toNumberOrNull(unit.monthlyRent)
  );
}

export function calculateConfiguredUnitRentTotal(units: any[]): number {
  return (Array.isArray(units) ? units : []).reduce((sum, unit) => {
    return sum + (resolveConfiguredUnitRent(unit) ?? 0);
  }, 0);
}
