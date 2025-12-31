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

export function safeNumber(v: any, opts?: Intl.NumberFormatOptions): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, opts);
}

export function safeDate(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return new Date(n).toLocaleString();
}
