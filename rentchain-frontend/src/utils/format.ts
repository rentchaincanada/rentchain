export function safeLocaleNumber(v: any): string {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

export function safeLocaleDate(v: any): string {
  const n = Number(v);
  if (Number.isFinite(n) && n > 0) {
    return new Date(n).toLocaleString();
  }

  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}
