export function asArray<T>(v: any): T[] {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.items)) return v.items;
  if (v && typeof v === "object" && v.ok === false) return [];
  return [];
}
