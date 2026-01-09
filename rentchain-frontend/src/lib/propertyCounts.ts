export function unitsForProperty(p: any): number {
  if (Array.isArray(p?.units)) return p.units.length;
  const n = Number(p?.unitsCount ?? p?.unitCount ?? 0);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}
